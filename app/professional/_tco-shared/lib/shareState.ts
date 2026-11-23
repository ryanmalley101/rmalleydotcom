// A comparison as it's shared in a link or saved locally, and the link
// encoding. Each calculator supplies its own input types, model version,
// normalizers (which backfill fields an older link or save predates), and
// the defaults a link is encoded against (see ShareCodec).
import LZString from "lz-string";
import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate";

export interface ComparisonState<S, T> {
  shapeId: string;
  scenario: S;
  solA: T;
  solB: T;
  colorA: string;
  colorB: string;
  // Cost-model version this state was created under. Absent on links/saves
  // from before versioning, which count as version 1.
  modelVersion?: number;
  // Set only on a decoded share link whose untouched fields now come from
  // different defaults than the sender's (see ShareCodec). Never saved.
  defaultsChanged?: boolean;
}

// True when the state was created under an older cost model than the one
// now running, or its link's defaults have changed since, so its totals may
// differ from what the sender saw.
export function isStaleState(state: { modelVersion?: number; defaultsChanged?: boolean }, currentVersion: number): boolean {
  return (state.modelVersion ?? 1) < currentVersion || Boolean(state.defaultsChanged);
}

export function normalizeComparisonState<S, T>(
  state: ComparisonState<S, T>,
  normalizeScenario: (s: S) => S,
  normalizeSolution: (s: T) => T,
): ComparisonState<S, T> {
  return {
    ...state,
    scenario: normalizeScenario(state.scenario),
    solA: normalizeSolution(state.solA),
    solB: normalizeSolution(state.solB),
  };
}

// What a calculator tells the link encoding about its defaults. A link
// stores only what differs from the values the wizard would have started
// with, so a typical link is ~150 characters instead of ~2.5K. Those
// starting values are rebuilt on open from each solution's `seedKeys`
// (stored in full), so a solution switched to another vendor is still
// compared against that vendor's defaults, not the original seed's.
//
// The catch is that untouched fields take *today's* defaults when the link
// is opened. Each link therefore carries a fingerprint of the defaults it
// was encoded against; if they've changed since (a vendor price updated,
// say), the decoded state is flagged `defaultsChanged` and the page shows
// the same "recalculated" notice as for a newer cost model. Fields the
// sender changed are excluded from the fingerprint, since their defaults
// don't matter. Adding a new field to a default also changes it, flagging
// links whose totals may well be unchanged: a false notice, but never a
// silent difference.
export interface ShareCodec<S, T> {
  modelVersion: number;
  // Fields that determine a solution's starting values (id, name, deployment
  // model, vendor pickers). Kept on the link whatever their value.
  seedKeys: readonly (keyof T & string)[];
  // The solution the wizard would build from those fields. Must depend only
  // on them, and return the same thing every time for the same input.
  solutionBaseline: (seed: Partial<T>) => T;
  scenarioBaseline: (shapeId: string) => S;
  defaultColors: { a: string; b: string };
  normalize: (state: ComparisonState<S, T>) => ComparisonState<S, T>;
}

// Link format: "2." followed by base64url(deflate(JSON of a CompactLink)).
// The prefix can't occur in older links: lz-string's URL alphabet has no
// ".", and uncompressed JSON links start with "{".
const FORMAT_PREFIX = "2.";

interface CompactLink {
  v: number; // model version
  h: string; // fingerprint of the defaults the delta is against
  s: string; // shapeId
  a: Record<string, unknown>; // solution A's seed fields
  b: Record<string, unknown>; // solution B's seed fields
  d: Delta; // differences from the defaults, keyed by section (see sections())
}

// A partial copy of an object with only the keys that differ; nested plain
// objects diff recursively, anything else (arrays included) is kept whole.
// DELETED lists keys the defaults have that the state doesn't.
const DELETED = "~";
type Delta = { [key: string]: unknown; [DELETED]?: string[] };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Key-order-independent JSON, so the fingerprint and equality checks don't
// change when a default's fields are reordered in source.
function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (isPlainObject(v)) {
    const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

export function diffObject(base: Record<string, unknown>, cur: Record<string, unknown>): Delta | undefined {
  const out: Delta = {};
  let changed = false;
  for (const [key, value] of Object.entries(cur)) {
    if (value === undefined) continue;
    const prev = base[key];
    if (isPlainObject(prev) && isPlainObject(value)) {
      const sub = diffObject(prev, value);
      if (sub) { out[key] = sub; changed = true; }
    } else if (canonicalJson(prev) !== canonicalJson(value)) {
      out[key] = value;
      changed = true;
    }
  }
  const deleted = Object.keys(base).filter((k) => base[k] !== undefined && cur[k] === undefined);
  if (deleted.length) { out[DELETED] = deleted; changed = true; }
  return changed ? out : undefined;
}

export function applyDelta<V>(base: V, delta: Delta | undefined): V {
  if (!delta) return structuredClone(base);
  const out = structuredClone(base) as Record<string, unknown>;
  for (const [key, value] of Object.entries(delta)) {
    if (key === DELETED) continue;
    out[key] = isPlainObject(value) && isPlainObject(out[key]) ? applyDelta(out[key], value as Delta) : value;
  }
  for (const key of delta[DELETED] ?? []) delete out[key];
  return out as V;
}

// The defaults with every field the delta overrides removed: what the
// fingerprint covers (see ShareCodec).
function untouched(base: unknown, delta: Delta | undefined): unknown {
  if (!delta || !isPlainObject(base)) return base;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) {
    if (delta[DELETED]?.includes(key)) continue;
    const sub = delta[key];
    if (sub === undefined) out[key] = value;
    else if (isPlainObject(sub) && isPlainObject(value)) out[key] = untouched(value, sub as Delta);
  }
  return out;
}

// Colors are left out: they don't change any total.
const defaultsFingerprint = (base: Record<string, unknown>, d: Delta) =>
  fingerprint(untouched({ sc: base.sc, A: base.A, B: base.B }, d));

// 32-bit FNV-1a, base36. Only detects change; not a security boundary.
function fingerprint(v: unknown): string {
  const s = canonicalJson(v);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function seedOf<T>(sol: T, keys: readonly string[]): Record<string, unknown> {
  const s = sol as Record<string, unknown>;
  return Object.fromEntries(keys.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]));
}

// The comparison's sections and the defaults each is encoded against. Short
// keys since they're repeated in every link.
function sections<S, T>(codec: ShareCodec<S, T>, shapeId: string, seedA: Record<string, unknown>, seedB: Record<string, unknown>) {
  return {
    sc: codec.scenarioBaseline(shapeId),
    A: { ...codec.solutionBaseline(seedA as Partial<T>), ...seedA },
    B: { ...codec.solutionBaseline(seedB as Partial<T>), ...seedB },
    ca: codec.defaultColors.a,
    cb: codec.defaultColors.b,
  } as Record<string, unknown>;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// Both directions are synchronous (fflate's deflateSync, unlike the
// browser's async CompressionStream), which matters: decoding runs inside a
// React lazy useState initializer on first render.
export function encodeState<S, T>(state: ComparisonState<S, T>, codec: ShareCodec<S, T>): string {
  const seedA = seedOf(state.solA, codec.seedKeys);
  const seedB = seedOf(state.solB, codec.seedKeys);
  const base = sections(codec, state.shapeId, seedA, seedB);
  const cur: Record<string, unknown> = { sc: state.scenario, A: state.solA, B: state.solB, ca: state.colorA, cb: state.colorB };
  const d = diffObject(base, cur) ?? {};
  const link: CompactLink = { v: codec.modelVersion, h: defaultsFingerprint(base, d), s: state.shapeId, a: seedA, b: seedB, d };
  return FORMAT_PREFIX + toBase64Url(deflateSync(strToU8(JSON.stringify(link)), { level: 9 }));
}

function decodeCompact<S, T>(raw: string, codec: ShareCodec<S, T>): ComparisonState<S, T> | null {
  const link = JSON.parse(strFromU8(inflateSync(fromBase64Url(raw.slice(FORMAT_PREFIX.length))))) as CompactLink;
  if (!isPlainObject(link) || typeof link.s !== "string" || !isPlainObject(link.a) || !isPlainObject(link.b)) return null;
  const d = isPlainObject(link.d) ? link.d : {};
  const base = sections(codec, link.s, link.a, link.b);
  const full = applyDelta(base, d);
  return {
    shapeId: link.s,
    scenario: full.sc as S,
    solA: full.A as T,
    solB: full.B as T,
    colorA: full.ca as string,
    colorB: full.cb as string,
    modelVersion: link.v,
    defaultsChanged: defaultsFingerprint(base, d) !== link.h || undefined,
  };
}

// Older links: lz-string-compressed full JSON, or before that plain JSON.
function decodeLegacy<S, T>(raw: string): ComparisonState<S, T> | null {
  const decompressed = LZString.decompressFromEncodedURIComponent(raw);
  const parsed = JSON.parse(decompressed || raw);
  if (!isPlainObject(parsed) || !parsed.shapeId || !parsed.scenario || !parsed.solA || !parsed.solB) return null;
  return parsed as unknown as ComparisonState<S, T>;
}

export function decodeState<S, T>(raw: string, codec: ShareCodec<S, T>): ComparisonState<S, T> | null {
  try {
    const state = raw.startsWith(FORMAT_PREFIX) ? decodeCompact(raw, codec) : decodeLegacy<S, T>(raw);
    if (!state) return null;
    const { defaultsChanged, ...rest } = state;
    const normalized = codec.normalize(rest);
    return defaultsChanged ? { ...normalized, defaultsChanged } : normalized;
  } catch {
    return null;
  }
}
