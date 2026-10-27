// A comparison as it's shared in a link or saved locally, and the encoding
// both use. Each calculator supplies its own input types, model version, and
// normalizers (which backfill fields an older link or save predates).
import LZString from "lz-string";

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
}

// True when the state was created under an older cost model than the one
// now running, so its totals may differ from what the sender saw.
export function isStaleState(state: { modelVersion?: number }, currentVersion: number): boolean {
  return (state.modelVersion ?? 1) < currentVersion;
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

// LZ-string's compressToEncodedURIComponent is synchronous (unlike the
// browser's native CompressionStream), which matters: decoding runs inside a
// React lazy useState initializer on first render, where an async API isn't
// usable. Typically shrinks a payload from ~2.7KB to under 1KB, well clear
// of old link-unfurler/SMS/proxy URL limits.
export function encodeState(state: object, modelVersion: number): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify({ ...state, modelVersion }));
}

export function decodeState<S, T>(
  raw: string,
  normalize: (state: ComparisonState<S, T>) => ComparisonState<S, T>,
): ComparisonState<S, T> | null {
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(raw);
    const json = decompressed ?? raw; // fall back to old (pre-compression) uncompressed share links
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.shapeId || !parsed.scenario || !parsed.solA || !parsed.solB) return null;
    return normalize(parsed as ComparisonState<S, T>);
  } catch {
    return null;
  }
}
