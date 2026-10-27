// "What would flip the result" for this calculator: the inputs that most
// often decide an access control comparison, searched by the shared
// bisection (total cost moves one way as each of these moves).
import { computeComparison, type ScenarioInputs, type SolutionInputs } from "./model";
import { findFlipPoints as sharedFindFlipPoints, upTo, type FlipParam, type FlipPoint } from "../../_tco-shared/lib/sensitivity";

const cloud = (s: SolutionInputs) => s.model === "cloud";
const onprem = (s: SolutionInputs) => s.model === "onprem";

const SOLUTION_PARAMS: FlipParam<SolutionInputs>[] = [
  { key: "adminHrsPerDoorYr", label: "admin hours per door per year", unit: "hours", range: upTo(5, 5) },
  { key: "cardholderChangeMinutes", label: "minutes per cardholder change", unit: "minutes", range: upTo(5, 60) },
  { key: "alarmMinutes", label: "minutes per door alarm", unit: "minutes", range: upTo(5, 30) },
  { key: "truckRollsPerSiteYr", label: "truck rolls per site per year", unit: "count", range: upTo(5, 10) },
  { key: "discountPct", label: "discount", unit: "pct", range: () => [0, 90] },
  { key: "readerCost", label: "reader price", unit: "usd", range: upTo(5, 1500) },
  { key: "controllerCost", label: "controller price", unit: "usd", range: upTo(5, 10000) },
  { key: "hardwareHalfLifeYears", label: "hardware half-life", unit: "years", range: (c) => [0.5, Math.max(30, c * 3)] },
  { key: "tierPrice", label: "license price per door per term", unit: "usd", applies: cloud, range: upTo(5, 2000) },
  { key: "siteFeePerYr", label: "site fee", unit: "usd", applies: cloud, range: upTo(5, 5000) },
  { key: "doorLicense", label: "per-door license", unit: "usd", applies: onprem, range: upTo(5, 1000) },
  { key: "carePct", label: "support renewal rate", unit: "pct", applies: onprem, range: () => [0, 60] },
  { key: "serverAdminHrsPerYr", label: "server upkeep hours", unit: "hours", applies: onprem, range: upTo(5, 200) },
];

const SCENARIO_PARAMS: FlipParam<ScenarioInputs>[] = [
  { key: "turnoverPct", label: "cardholder turnover", unit: "pct", range: () => [0, 100] },
  { key: "adminRate", label: "admin hourly rate", unit: "usd", range: upTo(5, 200) },
  { key: "operatorRate", label: "security staff hourly rate", unit: "usd", range: upTo(5, 200) },
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
