import { test } from "node:test";
import assert from "node:assert/strict";
import { computeComparison, computeSolution } from "../model";
import { defaultSolution, normalizeSolution } from "../defaults";
import { seedOnprem, seedVerkada, scenario, round } from "./helpers";

// Pins the headline numbers of the comparison a first-time visitor sees
// (on-prem Milestone/Axis incumbent vs. Verkada). Any change to these is a
// change to what the tool tells people, so update them deliberately and
// note the new totals in the commit message.
test("default comparison snapshot", () => {
  const c = computeComparison(scenario({ incumbent: "a" }), seedOnprem("a"), seedVerkada("b"));
  assert.deepEqual(
    { a: round(c.a.total), b: round(c.b.total), crossover: c.crossoverYear },
    { a: 1151875, b: 555042, crossover: 2 },
  );
});

test("incumbent pays nothing at year 0", () => {
  const r = computeSolution(scenario(), seedOnprem("a"), true);
  assert.equal(r.cumulative[0], 0);
});

test("non-incumbent on-prem pays its perpetual license at year 0", () => {
  const sol = seedOnprem("a");
  const r = computeSolution(scenario({ annualEscalationPct: 0, horizonYears: 0 }), sol, false);
  const expected = (sol.baseLicense + sol.deviceLicense * 100 + sol.analyticsSoftwareCostPerCam * 100) * (1 - sol.discountPct / 100);
  assert.equal(round(r.totalsByCategory["Licenses/subscription"]), round(expected));
});

test("cloud license is billed as a lump sum at purchase and each renewal", () => {
  const sol = { ...seedVerkada("b"), supportAddonPerCamYr: 0 };
  const scn = scenario({ annualEscalationPct: 0, horizonYears: 10 });
  const r = computeSolution(scn, sol, false);
  const term = sol.tierPrice * (1 - sol.discountPct / 100) * 100;
  // Year 0 and year 5; the year-10 renewal falls on the horizon's last year and is skipped.
  assert.equal(round(r.totalsByCategory["Licenses/subscription"]), round(term * 2));
  assert.equal(round(r.cumulative[0] - 0), round(r.cumulative[0]));
});

test("incumbent cloud skips its first term but still renews", () => {
  const sol = { ...seedVerkada("b"), supportAddonPerCamYr: 0 };
  const r = computeSolution(scenario({ annualEscalationPct: 0 }), sol, true);
  const term = sol.tierPrice * (1 - sol.discountPct / 100) * 100;
  assert.equal(round(r.totalsByCategory["Licenses/subscription"]), round(term));
});

test("crossover search starts at year 0", () => {
  const c = computeComparison(scenario({ incumbent: "a" }), seedOnprem("a"), seedVerkada("b"));
  // A starts at $0 (incumbent) below B, then passes it.
  assert.ok(c.a.cumulative[0] < c.b.cumulative[0]);
  assert.equal(c.crossoverYear, 2);
  assert.deepEqual(c.laterCrossoverYears, []);
});

test("normalizeSolution backfills missing fields and migrates legacy misc costs", () => {
  const legacy = { id: "a", name: "Old", model: "onprem", miscUpfrontCost: 500, miscAnnualCost: 50 } as never;
  const n = normalizeSolution(legacy);
  assert.equal(n.serverCost, defaultSolution("a", "Old", "onprem").serverCost);
  assert.deepEqual(n.miscItems.map((i) => [i.amount, i.timing]), [[500, "upfront"], [50, "recurring"]]);
});
