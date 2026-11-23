import { test } from "node:test";
import assert from "node:assert/strict";
import { computeComparison } from "../model";
import { DEFAULT_SCENARIO, defaultSolution } from "../defaults";
import { buildCsv, buildReportHtml } from "../report";
import { buildChecklist } from "../checklist";
import { decodeShareState, encodeShareState, isStaleModel } from "../shareState";
import { findFlipPoints } from "../sensitivity";

const state = {
  shapeId: "onprem-cloud",
  scenario: { ...DEFAULT_SCENARIO, incumbent: "a" as const },
  solA: defaultSolution("a", "Server-based", "onprem"),
  solB: defaultSolution("b", "Cloud", "cloud"),
  colorA: "#000000", colorB: "#ffffff",
};
const c = computeComparison(state.scenario, state.solA, state.solB);

test("the CSV carries scenario, inputs, years, and totals", () => {
  const csv = buildCsv(state, c);
  assert.match(csv, /^Access control TCO comparison,Server-based vs\. Cloud/);
  assert.match(csv, /Doors,50/);
  assert.match(csv, /Incumbent,Server-based/);
  assert.match(csv, /License cost for term \(\$\/door\),n\/a,,250,/);
  assert.match(csv, /Yr 10,/);
  assert.match(csv, new RegExp(`Total,${Math.round(c.a.total * 100) / 100},`));
});

test("the printable report escapes user-entered names", () => {
  const html = buildReportHtml({ ...state, solB: { ...state.solB, name: "<script>x</script>" } }, c);
  assert.ok(!html.includes("<script>x</script>"));
  assert.match(html, /50 doors · 3 sites · 500 cardholders/);
});

test("a share link round-trips and backfills missing fields", () => {
  const decoded = decodeShareState(encodeShareState(state));
  assert.deepEqual(decoded?.solB, state.solB);
  assert.equal(isStaleModel(decoded!), false);
  const { alarmMinutes: _drop, ...older } = state.solB;
  void _drop;
  const backfilled = decodeShareState(encodeShareState({ ...state, solB: older as typeof state.solB }));
  assert.equal(backfilled?.solB.alarmMinutes, state.solB.alarmMinutes);
});

test("the checklist asks to confirm hardware reuse and flags placeholders", () => {
  const items = buildChecklist(state.scenario, state.solA, state.solB, c);
  assert.ok(items.some((i) => i.text.startsWith("Cloud is set to replace the existing controllers and keep the existing readers")));
  assert.ok(items.some((i) => i.text.includes("still use generic placeholder values")));
  assert.ok(items.some((i) => i.text.includes("age of the existing readers and controllers")));
  const reissue = buildChecklist(state.scenario, state.solA, { ...state.solB, reissueCredentials: true }, c);
  assert.ok(reissue.some((i) => i.text.includes("reissues credentials but keeps the existing readers")));
  const newDoors = buildChecklist({ ...state.scenario, existingDoorsInstalled: false }, state.solA, state.solB, c);
  assert.ok(!newDoors.some((i) => i.text.includes("existing controllers")));
});

test("flip points move the winner when applied", () => {
  const flips = findFlipPoints(state.scenario, state.solA, state.solB);
  assert.ok(flips.length > 0);
  const cheaperIsA = c.a.total < c.b.total;
  for (const f of flips.filter((p) => p.owner === "b")) {
    const moved = computeComparison(state.scenario, state.solA, { ...state.solB, [keyFor(f.label)]: f.flipAt * (cheaperIsA ? 0.98 : 1.02) });
    assert.equal(moved.a.total < moved.b.total, !cheaperIsA, f.label);
  }
});

function keyFor(label: string): string {
  const map: Record<string, string> = {
    "license price per door per term": "tierPrice", "discount": "discountPct", "admin hours per door per year": "adminHrsPerDoorYr",
    "site fee": "siteFeePerYr", "reader price": "readerCost", "controller price": "controllerCost",
    "minutes per cardholder change": "cardholderChangeMinutes", "minutes per door alarm": "alarmMinutes",
    "truck rolls per site per year": "truckRollsPerSiteYr", "hardware half-life": "hardwareHalfLifeYears",
  };
  return map[label] ?? label;
}
