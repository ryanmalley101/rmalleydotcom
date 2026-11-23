import { test } from "node:test";
import assert from "node:assert/strict";
import LZString from "lz-string";
import { applyDelta, decodeState, diffObject, encodeState, isStaleState, type ComparisonState, type ShareCodec } from "../shareState";

// A toy calculator: a solution's starting values depend on its vendor.
interface Scenario { units: number; incumbent: string; tags: string[]; nested: { x: number; y: number } }
interface Solution { id: "a" | "b"; vendor: string; price: number; years: number; note?: string }

const PRICES: Record<string, number> = { Acme: 100, Globex: 200 };
const codec = (prices = PRICES, units = 10): ShareCodec<Scenario, Solution> => ({
  modelVersion: 4,
  seedKeys: ["id", "vendor"],
  solutionBaseline: (seed) => ({ id: seed.id ?? "a", vendor: seed.vendor ?? "", price: prices[seed.vendor ?? ""] ?? 50, years: 5 }),
  scenarioBaseline: (shapeId) => ({ units, incumbent: shapeId === "x" ? "a" : "none", tags: [], nested: { x: 1, y: 2 } }),
  defaultColors: { a: "#111111", b: "#222222" },
  normalize: (s) => s,
});

const untouched: ComparisonState<Scenario, Solution> = {
  shapeId: "x",
  scenario: { units: 10, incumbent: "a", tags: [], nested: { x: 1, y: 2 } },
  solA: { id: "a", vendor: "Acme", price: 100, years: 5 },
  solB: { id: "b", vendor: "Globex", price: 200, years: 5 },
  colorA: "#111111",
  colorB: "#222222",
};

test("an untouched comparison round-trips from a short link", () => {
  const link = encodeState(untouched, codec());
  assert.match(link, /^2\.[A-Za-z0-9_-]+$/);
  assert.ok(link.length < 120, `link was ${link.length} chars`);
  assert.deepEqual(decodeState(link, codec()), { ...untouched, modelVersion: 4 });
});

test("edits of every kind round-trip exactly", () => {
  const edited: ComparisonState<Scenario, Solution> = {
    ...untouched,
    scenario: { units: 7, incumbent: "b", tags: ["q", "r"], nested: { x: 1, y: 9 } },
    solA: { ...untouched.solA, vendor: "Globex", years: 8, note: "quoted" }, // vendor switched: baseline follows
    solB: { ...untouched.solB, price: 150 },
    colorB: "#abcdef",
  };
  assert.deepEqual(decodeState(encodeState(edited, codec()), codec()), { ...edited, modelVersion: 4 });
});

test("a field removed relative to the defaults stays removed", () => {
  const { years: _drop, ...rest } = untouched.solA;
  void _drop;
  const decoded = decodeState(encodeState({ ...untouched, solA: rest as Solution }, codec()), codec());
  assert.equal(decoded?.solA.years, undefined);
  assert.ok(!("years" in decoded!.solA));
});

test("diffObject and applyDelta are inverses, and nested objects diff per field", () => {
  const base = { a: 1, o: { p: 1, q: 2 }, arr: [1, 2], gone: true };
  const cur = { a: 1, o: { p: 1, q: 3 }, arr: [1, 2, 3], extra: "x" };
  const d = diffObject(base, cur);
  assert.deepEqual(d, { o: { q: 3 }, arr: [1, 2, 3], extra: "x", "~": ["gone"] });
  assert.deepEqual(applyDelta(base, d), cur);
  assert.equal(diffObject(base, { ...base }), undefined);
});

test("changed defaults flag the link, unless the sender overrode that field", () => {
  const link = encodeState(untouched, codec());
  assert.equal(decodeState(link, codec())?.defaultsChanged, undefined);

  const repriced = { ...PRICES, Acme: 120 };
  const drifted = decodeState(link, codec(repriced));
  assert.equal(drifted?.defaultsChanged, true);
  assert.equal(drifted?.solA.price, 120); // untouched field follows today's defaults
  assert.equal(isStaleState(drifted!, 4), true);

  // Sender typed their own Acme price: the default changing doesn't matter.
  const overridden = encodeState({ ...untouched, solA: { ...untouched.solA, price: 90 } }, codec());
  const kept = decodeState(overridden, codec(repriced));
  assert.equal(kept?.defaultsChanged, undefined);
  assert.equal(kept?.solA.price, 90);

  // Defaults of a vendor neither side uses don't matter either.
  assert.equal(decodeState(link, codec({ ...PRICES, Initech: 1 }))?.defaultsChanged, undefined);
  // Nor do scenario defaults the sender overrode.
  const units = encodeState({ ...untouched, scenario: { ...untouched.scenario, units: 3 } }, codec());
  assert.equal(decodeState(units, codec(PRICES, 99))?.defaultsChanged, undefined);
  assert.equal(decodeState(link, codec(PRICES, 99))?.defaultsChanged, true);
});

test("older link formats still decode", () => {
  const legacy = { ...untouched, modelVersion: 3 };
  assert.deepEqual(decodeState(LZString.compressToEncodedURIComponent(JSON.stringify(legacy)), codec()), legacy);
  assert.deepEqual(decodeState(JSON.stringify(untouched), codec()), untouched);
});

test("garbage decodes to null", () => {
  for (const raw of ["not-a-link", "2.", "2.!!!", "2.AAAA", "{}"]) assert.equal(decodeState(raw, codec()), null, raw);
});
