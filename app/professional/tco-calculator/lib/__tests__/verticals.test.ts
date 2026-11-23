import { test } from "node:test";
import assert from "node:assert/strict";
import { computeComparison, computeSolution } from "../model";
import { buildChecklist } from "../checklist";
import { normalizeScenario, normalizeSolution } from "../defaults";
import { CONSIDERATIONS, VERTICALS, annualOutcomes, inputsInUse, outcomeReportRows, verticalFor } from "../verticals";
import { seedOnprem, seedVerkada, scenario, round, NO_ESCALATION } from "./helpers";

const ALL_RETAIL = VERTICALS.find((v) => v.id === "retail")!.categories.map((c) => c.id);
const retail = (overrides = {}) =>
  scenario({ ...NO_ESCALATION, vertical: "retail", sites: 10, outcomeEnabled: ALL_RETAIL, ...overrides });

test("no industry leaves totals unchanged", () => {
  const plain = computeComparison(scenario({ incumbent: "a" }), seedOnprem("a"), seedVerkada("b"));
  const b = { ...seedVerkada("b"), outcomeChanges: { "retail.RL2.external": -10 } };
  const c = computeComparison(scenario({ incumbent: "a", outcomeEnabled: ALL_RETAIL }), seedOnprem("a"), b);
  assert.equal(round(c.b.total), round(plain.b.total));
  assert.equal(c.b.outcomeTotal, 0);
});

test("picking an industry with every change at 0 leaves totals unchanged", () => {
  const plain = computeComparison(scenario({ incumbent: "a" }), seedOnprem("a"), seedVerkada("b"));
  for (const v of VERTICALS) {
    const all = v.categories.map((c) => c.id);
    const c = computeComparison(scenario({ incumbent: "a", vertical: v.id, outcomeEnabled: all }), seedOnprem("a"), seedVerkada("b"));
    assert.equal(round(c.a.total), round(plain.a.total), v.id);
    assert.equal(round(c.b.total), round(plain.b.total), v.id);
  }
});

test("a % change applies to the shared baseline across every site, from year 1", () => {
  const scn = retail({ outcomeBaseline: { "retail.salesPerSite": 1_000_000, "retail.shrinkPct": 2, "retail.externalSharePct": 50 } });
  const sol = { ...seedVerkada("b"), outcomeChanges: { "retail.RL2.external": -10 } };
  const r = computeSolution(scn, sol, false);
  // $1M × 2% × 50% = $10k/site; 10 sites; -10%.
  assert.equal(r.byYear[0]["Business impact: savings"], 0);
  assert.equal(round(r.byYear[1]["Business impact: savings"]), -10_000);
  assert.equal(round(r.totalsByCategory["Business impact: savings"]), -10_000 * scn.horizonYears);
});

test("hour-based categories are costed at the scenario's admin rate", () => {
  const scn = scenario({ ...NO_ESCALATION, vertical: "healthcare", sites: 4, adminRate: 50, outcomeEnabled: ["healthcare.CG1"],
    outcomeBaseline: { "healthcare.CG1.hours": 100 } });
  const sol = { ...seedVerkada("b"), outcomeChanges: { "healthcare.CG1": -50 } };
  // 100 hrs × $50 × 4 sites × -50%.
  assert.equal(annualOutcomes(scn, sol)[0].amount, -10_000);
});

test("a category that's switched off counts for nothing and hides its inputs", () => {
  const sol = { ...seedVerkada("b"), outcomeChanges: { "retail.RL2.external": -10, "retail.RL1": -10 } };
  const scn = retail({ outcomeEnabled: ["retail.RL1"] });
  assert.deepEqual(annualOutcomes(scn, sol).map((o) => o.category.id), ["retail.RL1"]);
  const shown = inputsInUse(scn, verticalFor(scn)!).map((i) => i.key);
  assert.deepEqual(shown, ["retail.RL1.count", "retail.RL1.cost"]);
});

test("retail's two shrink categories share their sales and shrink inputs", () => {
  const scn = retail({ outcomeEnabled: ["retail.RL2.external", "retail.RL2.internal"] });
  const shown = inputsInUse(scn, verticalFor(scn)!).map((i) => i.key);
  assert.deepEqual(shown, ["retail.salesPerSite", "retail.shrinkPct", "retail.externalSharePct", "retail.internalSharePct"]);
});

test("new costs use their own units", () => {
  const scn = retail({ investigatorRate: 50 });
  const sol = {
    ...seedVerkada("b"),
    outcomeChanges: { "retail.biometricCompliance": 20_000, "retail.remoteMonitoring": 100, "retail.alertReview": 2 },
  };
  const byId = Object.fromEntries(annualOutcomes(scn, sol).map((o) => [o.category.id, o.amount]));
  assert.equal(byId["retail.biometricCompliance"], 20_000);
  assert.equal(byId["retail.remoteMonitoring"], 100 * 12 * 10);
  assert.equal(byId["retail.alertReview"], 2 * 52 * 10 * 50);
  const r = computeSolution(scn, sol, false);
  assert.equal(round(r.byYear[1]["Business impact: added costs"]), 20_000 + 12_000 + 52_000);
});

test("the incumbent never carries a change", () => {
  const scn = retail({ incumbent: "a" });
  const a = { ...seedOnprem("a"), outcomeChanges: { "retail.RL2.external": -50, "retail.biometricCompliance": 5000 } };
  const c = computeComparison(scn, a, seedVerkada("b"));
  assert.equal(c.a.outcomeTotal, 0);
});

test("business impact is reported separately and sums back to the total", () => {
  const scn = retail({ incumbent: "a" });
  const b = { ...seedVerkada("b"), outcomeChanges: { "retail.RL2.external": -5, "retail.remoteMonitoring": 50 } };
  const c = computeComparison(scn, seedOnprem("a"), b);
  assert.ok(c.b.outcomeTotal !== 0);
  assert.equal(round(c.b.cashTotal + c.b.staffTimeTotal + c.b.outcomeTotal), round(c.b.total));
  assert.ok(c.activeCategories.includes("Business impact: savings"));
});

test("changes are clamped: no more than -100% of a cost, no negative new cost", () => {
  const scn = retail({ outcomeBaseline: { "retail.TCO4.amount": 1000 } });
  const sol = { ...seedVerkada("b"), outcomeChanges: { "retail.TCO4": -500, "retail.remoteMonitoring": -100 } };
  const byId = Object.fromEntries(annualOutcomes(scn, sol).map((o) => [o.category.id, o.amount]));
  assert.equal(byId["retail.TCO4"], -1000 * 10);
  assert.equal(byId["retail.remoteMonitoring"], 0);
});

test("considerations never change a total, and are listed in the report", () => {
  const scn = retail({ incumbent: "a" });
  const b = { ...seedVerkada("b"), considerations: ["SF6", "OI7"] };
  const plain = computeComparison(scn, seedOnprem("a"), seedVerkada("b"));
  const c = computeComparison(scn, seedOnprem("a"), b);
  assert.equal(round(c.b.total), round(plain.b.total));
  const rows = outcomeReportRows(scn, seedOnprem("a"), b).considerations;
  assert.deepEqual(rows.map(([, a, bb]) => [a, bb]), [["", "yes"], ["", "yes"]]);
});

test("the checklist flags a gap driven by business impact, and placeholder inputs behind it", () => {
  const scn = retail({ incumbent: "a" });
  const a = seedOnprem("a");
  const b = { ...seedVerkada("b"), outcomeChanges: { "retail.RL2.external": -30 } };
  const items = buildChecklist(scn, a, b, computeComparison(scn, a, b));
  assert.ok(items.some((i) => i.text.includes("estimated business impact")));
  assert.ok(items.some((i) => i.text.includes("Shrink (% of sales)")));
  assert.ok(!items.some((i) => i.text.includes("Slip-and-fall claims")), "only inputs behind a claimed change");
});

test("older links without business impact fields normalize to none", () => {
  const legacyScenario = { ...scenario() } as Record<string, unknown>;
  delete legacyScenario.vertical;
  delete legacyScenario.outcomeBaseline;
  delete legacyScenario.outcomeEnabled;
  const legacySol = { ...seedVerkada("b") } as Record<string, unknown>;
  delete legacySol.outcomeChanges;
  delete legacySol.considerations;
  const scn = normalizeScenario(legacyScenario as never);
  const sol = normalizeSolution(legacySol as never);
  assert.equal(scn.vertical, null);
  assert.deepEqual(scn.outcomeBaseline, {});
  assert.deepEqual(scn.outcomeEnabled, []);
  assert.deepEqual(sol.outcomeChanges, {});
  assert.deepEqual(sol.considerations, []);
});

test("every industry is internally consistent", () => {
  for (const v of VERTICALS) {
    const keys = new Set(v.inputs.map((i) => i.key));
    const ids = v.categories.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, `${v.id}: duplicate category ids`);
    for (const c of v.categories) {
      if (c.kind === "existing") for (const k of c.inputKeys) assert.ok(keys.has(k), `${c.id} uses unknown input ${k}`);
    }
    const grouped = v.groups.flatMap((g) => g.categoryIds);
    assert.deepEqual([...grouped].sort(), [...ids].sort(), `${v.id}: every category in exactly one group`);
    for (const s of v.suggested) assert.ok(ids.includes(s), `${v.id}: suggests unknown category ${s}`);
  }
  assert.equal(new Set(CONSIDERATIONS.map((c) => c.code)).size, CONSIDERATIONS.length);
});
