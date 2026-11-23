// Clamps every numeric input to a range the cost model can use, before any
// math runs (see the shared clamp in _tco-shared/lib/sanitize.ts for why).
// Here, a 0 half-life used to turn every total into NaN, a 0 refresh cycle
// silently disabled refreshes, and a fractional camera or horizon count
// produced odd partial years.
//
// Kept free of runtime imports from model.ts/defaults.ts (types only) so the
// model can call it without an import cycle; each rule carries its own
// fallback for a missing or non-numeric value.
import type { ScenarioInputs, SolutionInputs } from "./model";
import { applyRules, clamp, type Rule } from "../../_tco-shared/lib/sanitize";

const SCENARIO_RULES: Partial<Record<keyof ScenarioInputs, Rule>> = {
  cameras: { min: 1, int: true, fallback: 1 },
  sites: { min: 1, int: true, fallback: 1 },
  retentionDays: { min: 1, int: true, fallback: 30 },
  horizonYears: { min: 1, max: 30, int: true, fallback: 10 },
  bitrateMbps: { min: 0.1, fallback: 2 },
  investigationsPerMonth: { min: 0, fallback: 0 },
  laborEscalationPct: { min: -20, max: 100, fallback: 0 },
  hardwareEscalationPct: { min: -20, max: 100, fallback: 0 },
  licenseEscalationPct: { min: -20, max: 100, fallback: 0 },
  adminRate: { min: 0, fallback: 0 },
  investigatorRate: { min: 0, fallback: 0 },
  truckRollCost: { min: 0, fallback: 0 },
  electricityRatePerKwh: { min: 0, fallback: 0 },
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
  networkCostPerSiteYr: { min: 0, fallback: 0 },
  powerWattsPerCam: { min: 0, fallback: 0 },
  serverSoftwareCost: { min: 0, fallback: 0 },
  managementServers: { min: 0, int: true, fallback: 0 },
  raidArrayDrives: { min: 3, max: 24, int: true, fallback: 8 },
  analyticsApplianceCost: { min: 0, fallback: 0 },
  analyticsApplianceCapacity: { min: 1, int: true, fallback: 50 },
  analyticsSoftwareCostPerCam: { min: 0, fallback: 0 },
  analyticsSoftwareCostPerCamYr: { min: 0, fallback: 0 },
  refreshCycleYears: { min: 1, int: true, fallback: 5 },
  yearsUntilNextRefresh: { min: 0, int: true, fallback: 0 },
};

export const sanitizeScenario = (s: ScenarioInputs): ScenarioInputs => applyRules(s, SCENARIO_RULES);
export const sanitizeSolution = (s: SolutionInputs): SolutionInputs => {
  const out = applyRules(s, SOLUTION_RULES);
  // A solution from before the split discount has one discount for both.
  out.licenseDiscountPct = clamp(s.licenseDiscountPct ?? out.discountPct, { min: 0, max: 100, fallback: out.discountPct });
  out.applianceOptions = (Array.isArray(s.applianceOptions) ? s.applianceOptions : []).map((o) => ({
    id: String(o?.id ?? ""),
    label: String(o?.label ?? ""),
    cost: clamp(o?.cost, { min: 0, fallback: 0 }),
    capacity: clamp(o?.capacity, { min: 1, int: true, fallback: 1 }),
    // Blank or 0: capacity doesn't depend on retention.
    retentionDays: o?.retentionDays ? clamp(o.retentionDays, { min: 1, int: true, fallback: 30 }) : null,
  }));
  // Optional: left absent unless set, since absent has its own meaning.
  if (out.yearsUntilLicenseRenewal !== undefined) {
    out.yearsUntilLicenseRenewal = clamp(out.yearsUntilLicenseRenewal, { min: 0, int: true, fallback: out.tierYears });
  }
  return out;
};
