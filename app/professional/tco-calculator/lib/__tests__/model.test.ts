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
    { a: 1143331, b: 520050, crossover: 2 },
  );
});

test("staff time is reported separately and sums back to the total", () => {
  const c = computeComparison(scenario({ incumbent: "a" }), seedOnprem("a"), seedVerkada("b"));
  for (const r of [c.a, c.b]) {
    assert.equal(round(r.cashTotal + r.staffTimeTotal), round(r.total));
    assert.equal(round(r.staffTimeTotal), round(r.totalsByCategory["Admin labor"] + r.totalsByCategory["Investigations"]));
  }
});

test("a fresh deployment's first refresh comes one full cycle after year 0", () => {
  const scn = scenario({ annualEscalationPct: 0, horizonYears: 10 });
  const onprem = seedOnprem("a"); // 5-year cycle, 2 years until next refresh
  const fresh = computeSolution(scn, onprem, false);
  const onePurchase = fresh.byYear[0]["Hardware (initial & refresh)"];
  // Years 0 and 5, not 0, 2, and 7.
  assert.equal(round(fresh.totalsByCategory["Hardware (initial & refresh)"]), round(onePurchase * 2));

  const cloud = seedVerkada("b"); // 7-year cycle, 2 years until next refresh
  const freshCloud = computeSolution(scn, cloud, false);
  const cloudOne = freshCloud.byYear[0]["Hardware (initial & refresh)"];
  assert.equal(round(freshCloud.totalsByCategory["Hardware (initial & refresh)"]), round(cloudOne * 2)); // years 0 and 7
});

test("the incumbent still refreshes on its own offset", () => {
  const scn = scenario({ annualEscalationPct: 0, horizonYears: 10 });
  const onprem = seedOnprem("a");
  const inc = computeSolution(scn, onprem, true);
  const onePurchase = computeSolution(scn, onprem, false).byYear[0]["Hardware (initial & refresh)"];
  assert.equal(round(inc.totalsByCategory["Hardware (initial & refresh)"]), round(onePurchase * 2)); // years 2 and 7
});

const yearZero = (sol: Parameters<typeof computeSolution>[1], overrides = {}) =>
  computeSolution(scenario({ annualEscalationPct: 0, ...overrides }), sol, false).byYear[0];

test("on a new site every newly deployed side buys its cameras", () => {
  const onprem = seedOnprem("a");
  const verkada = seedVerkada("b");
  const greenfield = { existingCamerasReusable: false };
  assert.equal(round(yearZero(onprem, greenfield)["Cameras"]), round(100 * onprem.cameraCost * (1 - onprem.discountPct / 100)));
  const cloud = yearZero(verkada, greenfield);
  assert.equal(round(cloud["Cameras"]), round(100 * verkada.cameraCost * (1 - verkada.discountPct / 100)));
  assert.ok(cloud["Hardware (initial & refresh)"] > 0, "a connector setup still needs its connectors");
});

test("with reusable cameras, only sides that choose to replace them buy cameras", () => {
  const onprem = seedOnprem("a");
  assert.equal(yearZero(onprem)["Cameras"], 0);
  assert.ok(yearZero({ ...onprem, onpremCameraStrategy: "replace" })["Cameras"] > 0);
  assert.equal(yearZero(seedVerkada("b"))["Cameras"], 0);
  const rip = yearZero({ ...seedVerkada("b"), migrationStrategy: "ripReplace" });
  assert.ok(rip["Cameras"] > 0);
  assert.equal(rip["Installation"], 100 * seedVerkada("b").bulkInstallLaborCost, "install labor is reported as Installation");
  assert.equal(rip["Hardware (initial & refresh)"], 0, "native cameras need no connector");
});

test("a connector only inherits the incumbent's fleet when cameras are reused", () => {
  const onprem = { ...seedOnprem("a"), fleetHalfLifeYears: 3, warrantyYears: 0 };
  const verkada = seedVerkada("b");
  const reused = computeComparison(scenario({ incumbent: "a" }), onprem, verkada);
  const greenfield = computeComparison(scenario({ incumbent: "a", existingCamerasReusable: false }), onprem, verkada);
  const purchase = 100 * verkada.cameraCost * (1 - verkada.discountPct / 100);
  const greenfieldReplacements = greenfield.b.totalsByCategory["Cameras"] - purchase;
  // Reused: failures follow the incumbent's short half-life and lapsed warranty.
  // New site: Verkada's own, longer-lived, in-warranty fleet.
  assert.ok(reused.b.totalsByCategory["Cameras"] > greenfieldReplacements * 2);
});

test("purchases that outlast the horizon are credited for their unused share", () => {
  const sol = { ...seedVerkada("b"), supportAddonPerCamYr: 0, migrationStrategy: "ripReplace" as const };
  const scn = scenario({ annualEscalationPct: 0, horizonYears: 6 });
  const r = computeSolution(scn, sol, false);
  const term = sol.tierPrice * (1 - sol.discountPct / 100) * 100;
  // Terms bought at years 0 and 5; the second serves only year 6 of its five.
  assert.equal(round(r.totalsByCategory["Residual value (credit)"]), round(-term * 4 / 5));
  assert.equal(round(r.cumulative[6]), round(r.total));

  const off = computeSolution({ ...scn, creditResidualValue: false }, sol, false);
  assert.equal(off.totalsByCategory["Residual value (credit)"], 0);
  assert.equal(round(off.total - r.total), round(term * 4 / 5));
});

test("credits show up in the category breakdown", () => {
  const c = computeComparison(scenario({ incumbent: "a" }), seedOnprem("a"), seedVerkada("b"));
  assert.ok(c.activeCategories.includes("Residual value (credit)"));
});

test("replacement cameras can fail again", () => {
  const sol = { ...seedOnprem("a"), fleetHalfLifeYears: 7 };
  const r = computeSolution(scenario({ horizonYears: 10 }), sol, false);
  const originalOnly = 100 * (1 - Math.pow(0.5, 10 / 7));
  // Constant hazard with replacement: about 100 * (1 - 0.5^(1/7)) * 10 swaps.
  assert.ok(r.hardware.cameraSwaps > originalOnly * 1.3);
  assert.equal(round(r.hardware.originalFleetReplacedPct), round(originalOnly));
});

test("an old incumbent fleet is out of warranty from year 1", () => {
  const sol = { ...seedOnprem("a"), warrantyYears: 3 };
  const fresh = computeSolution(scenario({ horizonYears: 1 }), sol, true);
  const old = computeSolution(scenario({ horizonYears: 1, existingFleetAgeYears: 5 }), sol, true);
  assert.ok(old.totalsByCategory["Cameras"] > fresh.totalsByCategory["Cameras"] * 2);
});

test("a side reusing the incumbent's cameras starts on the incumbent's reliability", () => {
  const verkada = seedVerkada("b");
  const shortLived = { ...seedOnprem("a"), fleetHalfLifeYears: 2, warrantyYears: 0 };
  const c = computeComparison(scenario({ incumbent: "a" }), shortLived, verkada);
  const ownFleet = computeSolution(scenario(), verkada, false);
  assert.ok(c.b.hardware.cameraSwaps > ownFleet.hardware.cameraSwaps * 2);
});

test("misc items apply to the incumbent and can land in a chosen year", () => {
  const scn = scenario({ annualEscalationPct: 0 });
  const base = { ...seedOnprem("a"), miscItems: [] };
  const withItems = {
    ...base,
    miscItems: [
      { id: "1", label: "Replace EOL NVRs", amount: 50000, timing: "upfront" as const },
      { id: "2", label: "VMS upgrade", amount: 20000, timing: "once" as const, year: 3 },
      { id: "3", label: "Insurance credit", amount: -1000, timing: "recurring" as const },
    ],
  };
  const before = computeSolution(scn, base, true);
  const after = computeSolution(scn, withItems, true);
  assert.equal(round(after.total - before.total), 50000 + 20000 - 1000 * 10);
  assert.equal(round(after.cumulative[3] - after.cumulative[2] - (before.cumulative[3] - before.cumulative[2])), 20000 - 1000);
});

test("cleared or invalid inputs can't break the totals", () => {
  const broken = { ...seedOnprem("a"), fleetHalfLifeYears: 0, refreshCycleYears: 0, serverCapacity: 0, tierYears: Number.NaN };
  const r = computeSolution(scenario({ horizonYears: 0, cameras: 0 }), broken, false);
  assert.equal(r.cumulative.length, 2, "a zero horizon is clamped to one year");
  assert.ok(Number.isFinite(r.total));
  const c = computeComparison(scenario({ horizonYears: 10.6 as number }), broken, seedVerkada("b"));
  assert.equal(c.labels.length, 12, "horizon rounds to a whole number of years");
  assert.ok(Number.isFinite(c.a.total) && Number.isFinite(c.b.total));
});

test("zero spare servers means zero", () => {
  const sol = seedOnprem("a");
  const none = computeSolution(scenario({ spareServers: 0 }), sol, false).hardware.units;
  const one = computeSolution(scenario({ spareServers: 1 }), sol, false).hardware.units;
  assert.equal(one - none, 1);
});

test("the per-year breakdown sums to the total", () => {
  const c = computeComparison(scenario({ incumbent: "a" }), seedOnprem("a"), seedVerkada("b"));
  const sum = c.a.byYear.reduce((t, yr) => t + Object.values(yr).reduce((a, b) => a + b, 0), 0);
  assert.equal(round(sum), round(c.a.total));
});

test("incumbent pays nothing at year 0", () => {
  const r = computeSolution(scenario(), seedOnprem("a"), true);
  assert.equal(r.cumulative[0], 0);
});

test("non-incumbent on-prem pays its perpetual license at year 0", () => {
  const sol = seedOnprem("a");
  const r = computeSolution(scenario({ annualEscalationPct: 0 }), sol, false);
  const expected = (sol.baseLicense + sol.deviceLicense * 100 + sol.analyticsSoftwareCostPerCam * 100) * (1 - sol.discountPct / 100);
  assert.equal(round(r.byYear[0]["Licenses/subscription"]), round(expected));
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
