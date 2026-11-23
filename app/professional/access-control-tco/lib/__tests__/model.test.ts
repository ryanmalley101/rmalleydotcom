import { test } from "node:test";
import assert from "node:assert/strict";
import { computeComparison, computeSolution, controllersFor, type ScenarioInputs, type SolutionInputs } from "../model";
import { DEFAULT_SCENARIO, SHAPE_OPTIONS, defaultSolution } from "../defaults";
import { VERTICALS } from "../verticals";
import { seedSolution } from "../seeds";

const scenario = (o: Partial<ScenarioInputs> = {}): ScenarioInputs => ({ ...DEFAULT_SCENARIO, ...o });
const NO_ESCALATION = { laborEscalationPct: 0, hardwareEscalationPct: 0, licenseEscalationPct: 0 };
const onprem = (id: "a" | "b" = "a", o: Partial<SolutionInputs> = {}) => ({ ...defaultSolution(id, "Server-based", "onprem"), ...o });
const cloud = (id: "a" | "b" = "b", o: Partial<SolutionInputs> = {}) => ({ ...defaultSolution(id, "Cloud", "cloud"), ...o });
const round = Math.round;
const yearZero = (sol: SolutionInputs, o: Partial<ScenarioInputs> = {}) => computeSolution(scenario({ ...NO_ESCALATION, ...o }), sol, false).byYear[0];

// Pins the headline numbers of the comparison a first-time visitor sees
// (an incumbent LenelS2 OnGuard vs. Verkada, seeded the way the wizard seeds
// them). Any change to these is a change to what the tool tells people, so
// update them deliberately and note the new totals in the commit message.
test("default comparison snapshot", () => {
  const shape = SHAPE_OPTIONS.find((s) => s.id === "onprem-cloud")!;
  const c = computeComparison(scenario({ incumbent: "a" }), seedSolution("a", shape), seedSolution("b", shape));
  assert.deepEqual(
    { a: round(c.a.total), b: round(c.b.total), crossover: c.crossoverYear },
    { a: 288732, b: 378604, crossover: null },
  );
});

test("the wizard pre-fills researched vendors, leaving slot B open when both share a model", () => {
  const byId = (id: string) => SHAPE_OPTIONS.find((s) => s.id === id)!;
  assert.deepEqual([seedSolution("a", byId("onprem-cloud")).name, seedSolution("b", byId("onprem-cloud")).name], ["LenelS2 OnGuard", "Verkada"]);
  assert.equal(seedSolution("b", byId("onprem-cloud")).tierPrice, 249);
  assert.equal(seedSolution("a", byId("onprem-cloud")).baseLicense, 3760);
  assert.deepEqual([seedSolution("a", byId("cloud-cloud")).name, seedSolution("b", byId("cloud-cloud")).name], ["Verkada", "Solution B (Cloud)"]);
  assert.deepEqual([seedSolution("a", byId("onprem-onprem")).name, seedSolution("b", byId("onprem-onprem")).name], ["LenelS2 OnGuard", "Solution B (Server-based)"]);
});

test("totals split into cash, staff time, and business impact", () => {
  const c = computeComparison(scenario({ incumbent: "a" }), onprem("a"), cloud("b"));
  for (const r of [c.a, c.b]) {
    assert.equal(round(r.cashTotal + r.staffTimeTotal + r.outcomeTotal), round(r.total));
    assert.equal(
      round(r.staffTimeTotal),
      round(r.totalsByCategory["Admin labor"] + r.totalsByCategory["Cardholder admin"] + r.totalsByCategory["Alarm handling"]),
    );
  }
});

test("controllers: at least one per site, more if the doors need it", () => {
  assert.equal(controllersFor(50, 3, 4), 13);
  assert.equal(controllersFor(4, 3, 4), 3);
  assert.equal(controllersFor(1, 1, 16), 1);
});

test("on wired doors a new side buys only what it doesn't keep", () => {
  const sol = cloud("b"); // keeps readers, replaces controllers
  const y0 = yearZero(sol);
  assert.equal(y0["Door hardware"], 0, "door hardware stays whoever wins");
  assert.equal(round(y0["Readers & controllers"]), 13 * 2000);
  assert.equal(round(y0["Installation"]), 50 * 250, "migration labor, not a new install");
  assert.equal(y0["Credentials"], 0, "no reissue unless asked for");

  const keepsBoth = yearZero(cloud("b", { reusesControllers: true }));
  assert.equal(keepsBoth["Readers & controllers"], 0);
  const replacesBoth = yearZero(cloud("b", { reusesReaders: false }));
  assert.equal(round(replacesBoth["Readers & controllers"]), 50 * 300 + 13 * 2000);
});

test("on new doors every side buys everything and issues credentials", () => {
  const newDoors = { existingDoorsInstalled: false };
  for (const sol of [onprem("a", { reusesReaders: true, reusesControllers: true }), cloud("b", { reusesReaders: true, reusesControllers: true })]) {
    const y0 = yearZero(sol, newDoors);
    assert.equal(round(y0["Door hardware"]), 50 * 1000);
    assert.equal(round(y0["Readers & controllers"]), 50 * 300 + 13 * 2000, "reuse settings don't apply with nothing to reuse");
    assert.equal(round(y0["Installation"]), 50 * 1500);
    assert.equal(round(y0["Credentials"]), 500 * 5);
    assert.equal(round(y0["Cardholder admin"]), round(500 * (10 / 60) * 85));
  }
});

test("the discount applies to devices, licenses, and servers, not door hardware or labor", () => {
  const full = yearZero(onprem("a"), { existingDoorsInstalled: false });
  const half = yearZero(onprem("a", { discountPct: 50 }), { existingDoorsInstalled: false });
  assert.equal(half["Door hardware"], full["Door hardware"]);
  assert.equal(half["Installation"], full["Installation"]);
  assert.equal(half["Credentials"], full["Credentials"]);
  assert.equal(round(half["Readers & controllers"]), round(full["Readers & controllers"] / 2));
  assert.equal(round(half["Licenses/subscription"]), round(full["Licenses/subscription"] / 2));
  assert.equal(round(half["Servers (initial & refresh)"]), round(full["Servers (initial & refresh)"] / 2));
});

test("the incumbent pays no buildout", () => {
  for (const sol of [onprem("a"), cloud("a")]) {
    const r = computeSolution(scenario({ existingDoorsInstalled: false }), sol, true);
    assert.equal(Object.values(r.byYear[0]).reduce((x, y) => x + y, 0), 0);
  }
});

test("yearly operating costs follow the README's formulas", () => {
  const y1 = computeSolution(scenario(NO_ESCALATION), onprem("a"), true).byYear[1];
  assert.equal(round(y1["Licenses/subscription"]), round((5000 + 150 * 50) * 0.18));
  assert.equal(round(y1["Credentials"]), round(500 * (0.2 + 0.05) * 5));
  // 500 × (2 × 20% turnover + 0.5 changes + 5% lost) events at 10 minutes each.
  assert.equal(round(y1["Cardholder admin"]), round(500 * (0.4 + 0.5 + 0.05) * (10 / 60) * 85));
  assert.equal(round(y1["Alarm handling"]), round(50 * 2 * 12 * (3 / 60) * 45));
  assert.equal(round(y1["Truck rolls"]), 3 * 400);
});

test("staff-time defaults are the same for both models except server upkeep", () => {
  const scn = scenario(NO_ESCALATION);
  const a = computeSolution(scn, onprem("a"), true).byYear[1];
  const b = computeSolution(scn, cloud("b"), true).byYear[1];
  assert.equal(a["Cardholder admin"], b["Cardholder admin"]);
  assert.equal(a["Alarm handling"], b["Alarm handling"]);
  assert.equal(a["Truck rolls"], b["Truck rolls"]);
  assert.equal(round(a["Admin labor"] - b["Admin labor"]), 40 * 85, "one server's upkeep hours");
});

test("a one-year cloud term is bought every year, with nothing left to credit", () => {
  const r = computeSolution(scenario({ ...NO_ESCALATION, horizonYears: 10 }), cloud("b"), false);
  assert.equal(round(r.totalsByCategory["Licenses/subscription"]), 10 * 50 * 250);
  assert.equal(r.totalsByCategory["Residual value (credit)"], 0);
});

test("a multi-year term is a lump at purchase and renewal, credited past the horizon", () => {
  const r = computeSolution(scenario({ ...NO_ESCALATION, horizonYears: 6 }), cloud("b", { tierYears: 5, tierPrice: 1000 }), false);
  assert.equal(round(r.byYear[0]["Licenses/subscription"]), 50 * 1000);
  assert.equal(round(r.byYear[5]["Licenses/subscription"]), 50 * 1000);
  assert.equal(round(r.byYear[3]["Licenses/subscription"]), 0);
  // The year-5 term serves years 6-10; only year 6 is inside the horizon.
  assert.equal(round(r.totalsByCategory["Residual value (credit)"]), -round(50 * 1000 * 4 / 5));
});

test("an incumbent cloud license renews when its current term ends", () => {
  const sol = cloud("a", { tierYears: 3, tierPrice: 600, yearsUntilLicenseRenewal: 1 });
  const r = computeSolution(scenario(NO_ESCALATION), sol, true);
  const renewals = r.byYear.map((y, i) => (y["Licenses/subscription"] > 0 ? i : null)).filter((i) => i !== null);
  assert.deepEqual(renewals, [1, 4, 7]);
});

test("servers refresh one cycle after purchase, or on the incumbent's own offset", () => {
  const scn = scenario({ ...NO_ESCALATION, horizonYears: 10 });
  const fresh = computeSolution(scn, onprem("a"), false);
  const one = fresh.byYear[0]["Servers (initial & refresh)"];
  assert.equal(round(fresh.totalsByCategory["Servers (initial & refresh)"]), round(one * 2)); // years 0 and 5
  const inc = computeSolution(scn, onprem("a"), true);
  assert.equal(round(inc.totalsByCategory["Servers (initial & refresh)"]), round(one * 2)); // years 2 and 7
  assert.equal(computeSolution(scn, cloud("b"), false).totalsByCategory["Servers (initial & refresh)"], 0);
});

test("kept hardware fails on the incumbent's reliability, not the new side's", () => {
  const scn = scenario({ incumbent: "a" });
  const fragile = onprem("a", { hardwareHalfLifeYears: 3, warrantyYears: 0 });
  const keeps = cloud("b", { reusesReaders: true, reusesControllers: true });
  const buys = cloud("b", { reusesReaders: false, reusesControllers: false });
  const kept = computeComparison(scn, fragile, keeps).b.hardware.deviceSwaps;
  const bought = computeComparison(scn, fragile, buys).b.hardware.deviceSwaps;
  assert.ok(kept > bought * 1.5, `${kept} vs ${bought}`);
});

test("old existing hardware is out of warranty sooner", () => {
  const sol = onprem("a");
  const newHw = computeSolution(scenario({ ...NO_ESCALATION, existingHardwareAgeYears: 0 }), sol, true);
  const oldHw = computeSolution(scenario({ ...NO_ESCALATION, existingHardwareAgeYears: 8 }), sol, true);
  assert.ok(oldHw.byYear[1]["Readers & controllers"] > newHw.byYear[1]["Readers & controllers"]);
});

test("mobile credentials replace cards and carry their own fee", () => {
  const scn = scenario(NO_ESCALATION);
  const allMobile = computeSolution(scn, cloud("b", { mobileSharePct: 100, mobileCostPerUserYr: 4 }), true).byYear[1];
  assert.equal(round(allMobile["Credentials"]), 500 * 4);
  const reissue = yearZero(cloud("b", { reissueCredentials: true, mobileSharePct: 40 }));
  assert.equal(round(reissue["Credentials"]), 300 * 5, "only card users get a card");
});

test("business impact: zero changes leave totals alone, a change is a share of today's cost", () => {
  const plain = computeComparison(scenario({ incumbent: "a" }), onprem("a"), cloud("b"));
  for (const v of VERTICALS) {
    const all = v.categories.map((c) => c.id);
    const c = computeComparison(scenario({ incumbent: "a", vertical: v.id, outcomeEnabled: all }), onprem("a"), cloud("b"));
    assert.equal(round(c.b.total), round(plain.b.total), v.id);
  }
  const scn = scenario({ ...NO_ESCALATION, incumbent: "a", vertical: "retail", outcomeEnabled: ["retail.RL2"] });
  const c = computeComparison(scn, onprem("a", { outcomeChanges: { "retail.RL2": -50 } }), cloud("b", { outcomeChanges: { "retail.RL2": -50 } }));
  assert.equal(c.a.outcomeTotal, 0, "the incumbent is today");
  assert.equal(round(c.b.byYear[1]["Business impact: savings"]), -round(10_000 * 3 * 0.5));
});

test("cleared fields don't produce NaN", () => {
  const broken = { ...cloud("b"), hardwareHalfLifeYears: 0, doorsPerController: 0, tierYears: 0 } as SolutionInputs;
  const c = computeComparison(scenario({ doors: 0, sites: 0 }), onprem("a"), broken);
  assert.ok(Number.isFinite(c.a.total) && Number.isFinite(c.b.total));
});

test("an incumbent whose servers or license are due now buys them at year 0", () => {
  for (const shape of SHAPE_OPTIONS) {
    for (const side of ["a", "b"] as const) {
      const scn: ScenarioInputs = { ...DEFAULT_SCENARIO, incumbent: side };
      const sol = seedSolution(side, shape);
      const due = computeSolution(scn, { ...sol, yearsUntilNextRefresh: 0, yearsUntilLicenseRenewal: 0 }, true);
      const later = computeSolution(scn, { ...sol, yearsUntilNextRefresh: 1, yearsUntilLicenseRenewal: 1 }, true);
      const key = sol.model === "cloud" ? "Licenses/subscription" : "Servers (initial & refresh)";
      if (sol.model === "onprem" && !sol.serverCount) continue;
      assert.ok(due.byYear[0][key] > 0, `${shape.id} ${side}: ${key} due now`);
      assert.equal(later.byYear[0][key], 0, `${shape.id} ${side}: ${key} not yet due`);
    }
  }
});
