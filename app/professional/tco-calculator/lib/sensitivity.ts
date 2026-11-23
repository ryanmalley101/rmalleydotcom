// "What would flip the result" for this calculator: the inputs that most
// often decide a video comparison, searched by the shared bisection (total
// cost moves one way as each of these moves).
import { computeComparison, type ScenarioInputs, type SolutionInputs } from "./model";
import { findFlipPoints as sharedFindFlipPoints, upTo, type FlipParam, type FlipPoint } from "../../_tco-shared/lib/sensitivity";

export type { FlipPoint, FlipUnit } from "../../_tco-shared/lib/sensitivity";

const cloud = (s: SolutionInputs) => s.model === "cloud";
const onprem = (s: SolutionInputs) => s.model === "onprem";

const SOLUTION_PARAMS: FlipParam<SolutionInputs>[] = [
  { key: "investigationHrsPerIncident", label: "hours per investigation", unit: "hours", range: upTo(5, 5) },
  { key: "adminHrsPerCamYr", label: "admin hours per camera per year", unit: "hours", range: upTo(5, 5) },
  { key: "truckRollsPerSiteYr", label: "truck rolls per site per year", unit: "count", range: upTo(5, 10) },
  { key: "discountPct", label: "hardware discount", unit: "pct", range: () => [0, 90] },
  { key: "licenseDiscountPct", label: "license discount", unit: "pct", range: () => [0, 90] },
  { key: "cameraCost", label: "camera price", unit: "usd", range: upTo(5, 2000) },
  { key: "fleetHalfLifeYears", label: "camera half-life", unit: "years", range: (c) => [0.5, Math.max(30, c * 3)] },
  { key: "tierPrice", label: "license price per term", unit: "usd", applies: cloud, range: upTo(5, 2000) },
  // Not when the connector comes from a list of models, which this price doesn't set.
  { key: "applianceCost", label: "connector price", unit: "usd", applies: (s) => cloud(s) && !s.applianceOptions?.length, range: upTo(5, 20000) },
  { key: "deviceLicense", label: "per-camera license", unit: "usd", applies: onprem, range: upTo(5, 1000) },
  { key: "serverCost", label: "recording server price", unit: "usd", applies: onprem, range: upTo(5, 20000) },
  { key: "analyticsApplianceCost", label: "analytics appliance price", unit: "usd", applies: onprem, range: upTo(5, 50000) },
  { key: "carePct", label: "support renewal rate", unit: "pct", applies: onprem, range: () => [0, 60] },
];

const SCENARIO_PARAMS: FlipParam<ScenarioInputs>[] = [
  { key: "investigationsPerMonth", label: "investigations per month", unit: "count", range: upTo(5, 50) },
  { key: "investigatorRate", label: "investigator hourly rate", unit: "usd", range: upTo(5, 200) },
  { key: "adminRate", label: "admin hourly rate", unit: "usd", range: upTo(5, 200) },
  { key: "laborEscalationPct", label: "labor escalation", unit: "pct", range: () => [-10, 20] },
  { key: "licenseEscalationPct", label: "license escalation", unit: "pct", range: () => [-10, 20] },
  { key: "hardwareEscalationPct", label: "hardware escalation", unit: "pct", range: () => [-10, 20] },
];

export function findFlipPoints(scenario: ScenarioInputs, solA: SolutionInputs, solB: SolutionInputs, limit = 5): FlipPoint[] {
  return sharedFindFlipPoints(scenario, solA, solB, {
    solutionParams: SOLUTION_PARAMS,
    scenarioParams: SCENARIO_PARAMS,
    gap: (s, a, b) => {
      const c = computeComparison(s, a, b);
      return c.a.total - c.b.total;
    },
  }, limit);
}
