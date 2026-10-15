// "What would flip the result": for a handful of the inputs that most often
// decide a comparison, finds the value at which the cheaper solution would
// stop being cheaper, holding everything else fixed. Each input is searched
// by bisection over a plausible range, assuming total cost moves one way as
// the input moves (true for every input listed here).
import { computeComparison, type ScenarioInputs, type SolutionInputs } from "./model";

export type FlipUnit = "usd" | "hours" | "pct" | "years" | "count";

interface Param {
  key: string;
  label: string;
  unit: FlipUnit;
  model?: "cloud" | "onprem";
  // Search range as a function of the current value.
  range: (current: number) => [number, number];
}

const upTo = (factor: number, floor: number) => (c: number): [number, number] => [0, Math.max(floor, c * factor)];

const SOLUTION_PARAMS: Param[] = [
  { key: "investigationHrsPerIncident", label: "hours per investigation", unit: "hours", range: upTo(5, 5) },
  { key: "adminHrsPerCamYr", label: "admin hours per camera per year", unit: "hours", range: upTo(5, 5) },
  { key: "truckRollsPerSiteYr", label: "truck rolls per site per year", unit: "count", range: upTo(5, 10) },
  { key: "discountPct", label: "discount", unit: "pct", range: () => [0, 90] },
  { key: "cameraCost", label: "camera price", unit: "usd", range: upTo(5, 2000) },
  { key: "fleetHalfLifeYears", label: "camera half-life", unit: "years", range: (c) => [0.5, Math.max(30, c * 3)] },
  { key: "tierPrice", label: "license price per term", unit: "usd", model: "cloud", range: upTo(5, 2000) },
  { key: "applianceCost", label: "connector price", unit: "usd", model: "cloud", range: upTo(5, 20000) },
  { key: "deviceLicense", label: "per-camera license", unit: "usd", model: "onprem", range: upTo(5, 1000) },
  { key: "serverCost", label: "recording server price", unit: "usd", model: "onprem", range: upTo(5, 20000) },
  { key: "analyticsApplianceCost", label: "analytics appliance price", unit: "usd", model: "onprem", range: upTo(5, 50000) },
  { key: "carePct", label: "support renewal rate", unit: "pct", model: "onprem", range: () => [0, 60] },
];

const SCENARIO_PARAMS: Param[] = [
  { key: "investigationsPerMonth", label: "investigations per month", unit: "count", range: upTo(5, 50) },
  { key: "investigatorRate", label: "investigator hourly rate", unit: "usd", range: upTo(5, 200) },
  { key: "adminRate", label: "admin hourly rate", unit: "usd", range: upTo(5, 200) },
  { key: "laborEscalationPct", label: "labor escalation", unit: "pct", range: () => [-10, 20] },
  { key: "licenseEscalationPct", label: "license escalation", unit: "pct", range: () => [-10, 20] },
  { key: "hardwareEscalationPct", label: "hardware escalation", unit: "pct", range: () => [-10, 20] },
];

export interface FlipPoint {
  label: string;
  // Which solution the input belongs to, or null for a shared scenario input.
  owner: "a" | "b" | null;
  unit: FlipUnit;
  current: number;
  flipAt: number;
  // Relative distance from the current value, for ranking (smaller = closer to flipping).
  distance: number;
}

function bisect(gap: (x: number) => number, lo: number, hi: number, signAtLo: number): number {
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(gap(mid)) === signAtLo) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Finds where gap(x) changes sign starting from `current`, searching toward
// whichever end of the range has the opposite sign.
function findFlip(gap: (x: number) => number, current: number, [min, max]: [number, number]): number | null {
  const s0 = Math.sign(gap(current));
  if (s0 === 0) return null;
  if (max > current && Math.sign(gap(max)) === -s0) return bisect(gap, current, max, s0);
  if (min < current && Math.sign(gap(min)) === -s0) return bisect((x) => gap(x), current, min, s0);
  return null;
}

export function findFlipPoints(scenario: ScenarioInputs, solA: SolutionInputs, solB: SolutionInputs, limit = 5): FlipPoint[] {
  const points: FlipPoint[] = [];
  const total = (s: ScenarioInputs, a: SolutionInputs, b: SolutionInputs) => {
    const c = computeComparison(s, a, b);
    return c.a.total - c.b.total;
  };

  for (const [owner, sol] of [["a", solA], ["b", solB]] as const) {
    for (const p of SOLUTION_PARAMS) {
      if (p.model && p.model !== sol.model) continue;
      const current = Number((sol as unknown as Record<string, unknown>)[p.key]) || 0;
      const gap = (x: number) => {
        const changed = { ...sol, [p.key]: x } as SolutionInputs;
        return owner === "a" ? total(scenario, changed, solB) : total(scenario, solA, changed);
      };
      const flipAt = findFlip(gap, current, p.range(current));
      if (flipAt !== null) points.push({ label: p.label, owner, unit: p.unit, current, flipAt, distance: Math.abs(flipAt - current) / Math.max(Math.abs(current), 1e-6) });
    }
  }
  for (const p of SCENARIO_PARAMS) {
    const current = Number((scenario as unknown as Record<string, unknown>)[p.key]) || 0;
    const gap = (x: number) => total({ ...scenario, [p.key]: x }, solA, solB);
    const flipAt = findFlip(gap, current, p.range(current));
    if (flipAt !== null) points.push({ label: p.label, owner: null, unit: p.unit, current, flipAt, distance: Math.abs(flipAt - current) / Math.max(Math.abs(current), 1e-6) });
  }
  return points.sort((x, y) => x.distance - y.distance).slice(0, limit);
}
