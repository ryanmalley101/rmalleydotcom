// Clamps every numeric input to a range the cost model can use, before any
// math runs. Inputs arrive straight from form fields, where a cleared box
// becomes 0 (or an older share link may be missing a field entirely), and
// a single bad value used to poison the results: a 0 half-life turned every
// total into NaN, a 0 refresh cycle silently disabled refreshes, and a
// fractional camera or horizon count produced odd partial years.
//
// Kept free of runtime imports from model.ts/defaults.ts (types only) so the
// model can call it without an import cycle; each rule carries its own
// fallback for a missing or non-numeric value.
import type { ScenarioInputs, SolutionInputs } from "./model";

interface Rule { min: number; max?: number; int?: boolean; fallback: number }

const SCENARIO_RULES: Partial<Record<keyof ScenarioInputs, Rule>> = {
  cameras: { min: 1, int: true, fallback: 1 },
  sites: { min: 1, int: true, fallback: 1 },
  retentionDays: { min: 1, int: true, fallback: 30 },
  horizonYears: { min: 1, max: 30, int: true, fallback: 10 },
  bitrateMbps: { min: 0.1, fallback: 2 },
  investigationsPerMonth: { min: 0, fallback: 0 },
  annualEscalationPct: { min: 0, max: 100, fallback: 0 },
  adminRate: { min: 0, fallback: 0 },
  investigatorRate: { min: 0, fallback: 0 },
  truckRollCost: { min: 0, fallback: 0 },
  driveCapacityTb: { min: 1, fallback: 16 },
  storageOverheadMultiplier: { min: 1, fallback: 1.3 },
  spareServers: { min: 0, int: true, fallback: 1 },
  existingFleetAgeYears: { min: 0, max: 30, fallback: 0 },
};

const SOLUTION_RULES: Partial<Record<keyof SolutionInputs, Rule>> = {
  discountPct: { min: 0, max: 100, fallback: 0 },
  cameraCost: { min: 0, fallback: 0 },
  bulkInstallLaborCost: { min: 0, fallback: 0 },
  replacementInstallLaborCost: { min: 0, fallback: 0 },
  fleetHalfLifeYears: { min: 0.5, fallback: 7 },
  warrantyYears: { min: 0, fallback: 0 },
  truckRollsPerSiteYr: { min: 0, fallback: 0 },
  adminHrsPerCamYr: { min: 0, fallback: 0 },
  investigationHrsPerIncident: { min: 0, fallback: 0 },
  framerateFps: { min: 1, fallback: 24 },
  tierPrice: { min: 0, fallback: 0 },
  tierYears: { min: 1, int: true, fallback: 1 },
  applianceCost: { min: 0, fallback: 0 },
  applianceCapacity: { min: 1, int: true, fallback: 1 },
  applianceWarrantyYears: { min: 0, fallback: 0 },
  applianceRefreshCycleYears: { min: 1, int: true, fallback: 7 },
  yearsUntilNextApplianceRefresh: { min: 0, int: true, fallback: 0 },
  supportAddonPerCamYr: { min: 0, fallback: 0 },
  baseLicense: { min: 0, fallback: 0 },
  deviceLicense: { min: 0, fallback: 0 },
  carePct: { min: 0, fallback: 0 },
  serverCost: { min: 0, fallback: 0 },
  serverCapacity: { min: 1, int: true, fallback: 1 },
  storageCostPerTB: { min: 0, fallback: 0 },
  analyticsApplianceCost: { min: 0, fallback: 0 },
  analyticsSoftwareCostPerCam: { min: 0, fallback: 0 },
  analyticsSoftwareCostPerCamYr: { min: 0, fallback: 0 },
  refreshCycleYears: { min: 1, int: true, fallback: 5 },
  yearsUntilNextRefresh: { min: 0, int: true, fallback: 0 },
};

function clamp(value: unknown, rule: Rule): number {
  let n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) n = rule.fallback;
  if (rule.int) n = Math.round(n);
  n = Math.max(rule.min, n);
  if (rule.max !== undefined) n = Math.min(rule.max, n);
  return n;
}

function apply<T extends object>(input: T, rules: Partial<Record<keyof T, Rule>>): T {
  const out = { ...input } as Record<string, unknown>;
  for (const [key, rule] of Object.entries(rules) as [string, Rule][]) out[key] = clamp(out[key], rule);
  return out as T;
}

export const sanitizeScenario = (s: ScenarioInputs): ScenarioInputs => apply(s, SCENARIO_RULES);
export const sanitizeSolution = (s: SolutionInputs): SolutionInputs => apply(s, SOLUTION_RULES);
