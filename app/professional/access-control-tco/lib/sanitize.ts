// Clamps every numeric input to a range the cost model can use, before any
// math runs (see the shared clamp for why). Kept free of runtime imports
// from model.ts/defaults.ts (types only) so the model can call it without an
// import cycle; each rule carries its own fallback for a missing or
// non-numeric value.
import type { ScenarioInputs, SolutionInputs } from "./model";
import { applyRules, clamp, type Rule } from "../../_tco-shared/lib/sanitize";

const SCENARIO_RULES: Partial<Record<keyof ScenarioInputs, Rule>> = {
  doors: { min: 1, int: true, fallback: 1 },
  readersPerDoor: { min: 1, max: 2, int: true, fallback: 1 },
  sites: { min: 1, int: true, fallback: 1 },
  cardholders: { min: 0, int: true, fallback: 0 },
  turnoverPct: { min: 0, max: 100, fallback: 0 },
  accessChangesPerCardholderYr: { min: 0, fallback: 0 },
  lostCredentialPct: { min: 0, max: 100, fallback: 0 },
  doorAlarmsPerDoorMonth: { min: 0, fallback: 0 },
  horizonYears: { min: 1, max: 30, int: true, fallback: 10 },
  laborEscalationPct: { min: -20, max: 100, fallback: 0 },
  hardwareEscalationPct: { min: -20, max: 100, fallback: 0 },
  licenseEscalationPct: { min: -20, max: 100, fallback: 0 },
  existingHardwareAgeYears: { min: 0, max: 30, fallback: 0 },
  adminRate: { min: 0, fallback: 0 },
  operatorRate: { min: 0, fallback: 0 },
  truckRollCost: { min: 0, fallback: 0 },
};

const SOLUTION_RULES: Partial<Record<keyof SolutionInputs, Rule>> = {
  discountPct: { min: 0, max: 100, fallback: 0 },
  readerCost: { min: 0, fallback: 0 },
  controllerCost: { min: 0, fallback: 0 },
  doorsPerController: { min: 1, int: true, fallback: 4 },
  doorHardwareCost: { min: 0, fallback: 0 },
  newDoorInstallCost: { min: 0, fallback: 0 },
  migrationLaborPerDoor: { min: 0, fallback: 0 },
  replacementLaborPerDevice: { min: 0, fallback: 0 },
  hardwareHalfLifeYears: { min: 0.5, fallback: 12 },
  warrantyYears: { min: 0, fallback: 0 },
  tierPrice: { min: 0, fallback: 0 },
  tierYears: { min: 1, int: true, fallback: 1 },
  siteFeePerYr: { min: 0, fallback: 0 },
  baseLicense: { min: 0, fallback: 0 },
  doorLicense: { min: 0, fallback: 0 },
  carePct: { min: 0, fallback: 0 },
  serverCount: { min: 0, int: true, fallback: 1 },
  serverCost: { min: 0, fallback: 0 },
  serverSoftwareCost: { min: 0, fallback: 0 },
  serverAdminHrsPerYr: { min: 0, fallback: 0 },
  refreshCycleYears: { min: 1, int: true, fallback: 5 },
  yearsUntilNextRefresh: { min: 0, int: true, fallback: 0 },
  cardCost: { min: 0, fallback: 0 },
  mobileSharePct: { min: 0, max: 100, fallback: 0 },
  mobileCostPerUserYr: { min: 0, fallback: 0 },
  adminHrsPerDoorYr: { min: 0, fallback: 0 },
  cardholderChangeMinutes: { min: 0, fallback: 0 },
  alarmMinutes: { min: 0, fallback: 0 },
  truckRollsPerSiteYr: { min: 0, fallback: 0 },
  networkCostPerSiteYr: { min: 0, fallback: 0 },
};

export const sanitizeScenario = (s: ScenarioInputs): ScenarioInputs => applyRules(s, SCENARIO_RULES);
export const sanitizeSolution = (s: SolutionInputs): SolutionInputs => {
  const out = applyRules(s, SOLUTION_RULES);
  // Optional: left absent unless set, since absent has its own meaning.
  if (out.yearsUntilLicenseRenewal !== undefined) {
    out.yearsUntilLicenseRenewal = clamp(out.yearsUntilLicenseRenewal, { min: 0, int: true, fallback: out.tierYears });
  }
  return out;
};
