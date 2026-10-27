import type { DeploymentModel, ScenarioInputs, SolutionInputs } from "./model";
import type { ShapeOption } from "../../_tco-shared/lib/fields";

// Every number here is an unsourced placeholder, to be replaced with quotes
// and the customer's own figures (the pre-share checklist says so). No
// vendor has researched defaults yet; see the README.

export const DEFAULT_SCENARIO: ScenarioInputs = {
  doors: 50,
  readersPerDoor: 1,
  sites: 3,
  cardholders: 500,
  turnoverPct: 20,
  accessChangesPerCardholderYr: 0.5,
  lostCredentialPct: 5,
  doorAlarmsPerDoorMonth: 2,
  horizonYears: 10,
  laborEscalationPct: 3,
  hardwareEscalationPct: 3,
  licenseEscalationPct: 3,
  incumbent: "none",
  existingDoorsInstalled: true,
  existingHardwareAgeYears: 0,
  adminRate: 85,
  operatorRate: 45,
  truckRollCost: 400,
  creditResidualValue: true,
  vertical: null,
  outcomeBaseline: {},
  outcomeEnabled: [],
};

// The same for both deployment models unless the difference is physical:
// only the license structure and on-prem servers differ. Fields for the
// other model stay populated, so switching a solution's model later doesn't
// lose prior edits.
export function defaultSolution(id: "a" | "b", name: string, model: DeploymentModel): SolutionInputs {
  return {
    id, name, model,
    discountPct: 0,
    readerCost: 300,
    controllerCost: 2000,
    doorsPerController: 4,
    doorHardwareCost: 1000,
    newDoorInstallCost: 1500,
    migrationLaborPerDoor: 250,
    replacementLaborPerDevice: 200,
    hardwareHalfLifeYears: 12,
    warrantyYears: 3,
    // Readers are usually Wiegand or OSDP and broadly reusable; controllers
    // are where platforms differ, so the conservative default is to replace
    // them. The checklist asks to confirm both.
    reusesReaders: true,
    reusesControllers: false,
    tierPrice: 250,
    tierYears: 1,
    siteFeePerYr: 0,
    baseLicense: 5000,
    doorLicense: 150,
    carePct: 18,
    serverCount: 1,
    serverCost: 6000,
    serverSoftwareCost: 2000,
    serverAdminHrsPerYr: 40,
    refreshCycleYears: 5,
    yearsUntilNextRefresh: 2,
    cardCost: 5,
    mobileSharePct: 0,
    mobileCostPerUserYr: 0,
    reissueCredentials: false,
    adminHrsPerDoorYr: 1,
    cardholderChangeMinutes: 10,
    alarmMinutes: 3,
    truckRollsPerSiteYr: 1,
    networkCostPerSiteYr: 0,
    miscItems: [],
    outcomeChanges: {},
    considerations: [],
  };
}

// Backfills any fields missing from a solution or scenario decoded from an
// older share link or saved comparison with current defaults, rather than
// leaving them undefined (an undefined number turns every total into NaN).
// Existing values always win.
export function normalizeSolution(sol: SolutionInputs): SolutionInputs {
  return { ...defaultSolution(sol.id, sol.name, sol.model), ...sol };
}

export function normalizeScenario(scenario: ScenarioInputs): ScenarioInputs {
  return { ...DEFAULT_SCENARIO, ...scenario };
}

// Listed in order of how often they come up: comparing an installed
// server-based system against a cloud one leads. A workflow convenience, not
// a ranking.
export const SHAPE_OPTIONS: ShapeOption[] = [
  {
    id: "onprem-cloud",
    label: "Cloud vs. Server-Based",
    description: "One server-based (on-premises) system against one cloud-managed system.",
    useWhen: [
      "You're weighing a move between server-based and cloud access control, in either direction",
      "You want perpetual licenses and servers side by side with a subscription",
    ],
    keepInMind: [
      "Check which existing readers and controllers each side can actually keep; it decides most of the year-0 cost",
    ],
    modelA: "onprem",
    modelB: "cloud",
  },
  {
    id: "cloud-cloud",
    label: "Two Cloud Systems",
    description: "Two cloud-managed access control systems.",
    useWhen: [
      "You've settled on cloud and are comparing vendors",
      "You're renewing or replacing an existing cloud system",
    ],
    keepInMind: [
      "Controller compatibility, per-site fees, and mobile credential pricing vary a lot between vendors",
    ],
    modelA: "cloud",
    modelB: "cloud",
  },
  {
    id: "onprem-onprem",
    label: "Two Server-Based Systems",
    description: "Two on-premises access control systems.",
    useWhen: [
      "You've settled on a server-based system and are comparing vendors",
      "You're upgrading or replacing an existing server-based system",
    ],
    keepInMind: [
      "Door licenses, support renewals, and whether the existing panels carry over drive most of the difference",
    ],
    modelA: "onprem",
    modelB: "onprem",
  },
];
