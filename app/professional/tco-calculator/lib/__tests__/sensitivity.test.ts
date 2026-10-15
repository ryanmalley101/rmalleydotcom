import { test } from "node:test";
import assert from "node:assert/strict";
import { computeComparison, type ScenarioInputs, type SolutionInputs } from "../model";
import { findFlipPoints } from "../sensitivity";
import { seedOnprem, seedVerkada, scenario } from "./helpers";

const gapWith = (scn: ScenarioInputs, a: SolutionInputs, b: SolutionInputs) => {
  const c = computeComparison(scn, a, b);
  return c.a.total - c.b.total;
};

test("every flip point is where the totals actually cross", () => {
  const scn = scenario({ incumbent: "a" });
  const a = seedOnprem("a");
  // Same labor inputs on both sides makes for a close comparison with several flip points.
  const b = { ...seedVerkada("b"), adminHrsPerCamYr: a.adminHrsPerCamYr, investigationHrsPerIncident: a.investigationHrsPerIncident, truckRollsPerSiteYr: a.truckRollsPerSiteYr };
  const points = findFlipPoints(scn, a, b, 20);
  assert.ok(points.length >= 3, `expected several flip points, got ${points.length}`);
  const keyFor: Record<string, string> = {
    "hours per investigation": "investigationHrsPerIncident", "admin hours per camera per year": "adminHrsPerCamYr",
    "truck rolls per site per year": "truckRollsPerSiteYr", discount: "discountPct", "camera price": "cameraCost",
    "camera half-life": "fleetHalfLifeYears", "license price per term": "tierPrice", "connector price": "applianceCost",
    "per-camera license": "deviceLicense", "recording server price": "serverCost", "analytics appliance price": "analyticsApplianceCost",
    "support renewal rate": "carePct",
  };
  for (const p of points) {
    const at = (x: number) => {
      if (p.owner === null) return gapWith({ ...scn, [{ "investigations per month": "investigationsPerMonth", "investigator hourly rate": "investigatorRate", "admin hourly rate": "adminRate", "labor escalation": "laborEscalationPct", "license escalation": "licenseEscalationPct", "hardware escalation": "hardwareEscalationPct" }[p.label]!]: x }, a, b);
      const key = keyFor[p.label];
      return p.owner === "a" ? gapWith(scn, { ...a, [key]: x }, b) : gapWith(scn, a, { ...b, [key]: x });
    };
    const step = Math.max(Math.abs(p.flipAt) * 0.01, 0.01);
    assert.notEqual(Math.sign(at(p.flipAt + step)), Math.sign(at(p.flipAt - step)), p.label);
  }
  for (let i = 1; i < points.length; i++) assert.ok(points[i - 1].distance <= points[i].distance);
});

test("a lopsided comparison may have few or no flip points", () => {
  const points = findFlipPoints(scenario({ incumbent: "a" }), seedOnprem("a"), seedVerkada("b"));
  assert.ok(points.length <= 5);
});
