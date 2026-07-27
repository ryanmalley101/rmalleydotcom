import type { ScenarioInputs, SolutionInputs, DeploymentModel } from "./model";

export const DEFAULT_SCENARIO: ScenarioInputs = {
  cameras: 100,
  sites: 5,
  retentionDays: 30,
  horizonYears: 10,
  bitrateMbps: 2,
  investigationsPerMonth: 20,
  npvDiscountPct: 0,
  annualEscalationPct: 3,
  incumbent: "none",
  adminRate: 85,
  investigatorRate: 45,
  truckRollCost: 400,
  electricityRate: 0.15,
};

export function defaultSolution(id: "a" | "b", name: string, model: DeploymentModel): SolutionInputs {
  if (model === "cloud") {
    return {
      id, name, model,
      discountPct: 30,
      cameraCost: 1200,
      bulkInstallLaborCost: 100,
      replacementInstallLaborCost: 250,
      fleetHalfLifeYears: 7,
      warrantyYears: 3,
      truckRollsPerSiteYr: 1,
      adminHrsPerCamYr: 1,
      investigationHrsPerIncident: 0.75,
      framerateFps: 24,
      migrationStrategy: "connector",
      tierPrice: 1099,
      tierYears: 5,
      applianceCost: 9999,
      applianceCapacity: 50,
      applianceWarrantyYears: 5,
      applianceRefreshCycleYears: 7,
      yearsUntilNextApplianceRefresh: 2,
      supportAddonPerCamYr: 0,
      // on-prem-only fields, unused by the cloud formula but kept populated,
      // so switching a solution's model later doesn't lose prior edits
      baseLicense: 1500,
      deviceLicense: 250,
      carePct: 20,
      serverCost: 9000,
      serverCapacity: 100,
      storageCostPerTB: 200,
      raidLevel: "raid1",
      analyticsApplianceCost: 25000,
      analyticsSoftwareCost: 8000,
      refreshCycleYears: 5,
      yearsUntilNextRefresh: 2,
    };
  }
  return {
    id, name, model,
    discountPct: 25,
    cameraCost: 700,
    bulkInstallLaborCost: 100,
    replacementInstallLaborCost: 250,
    fleetHalfLifeYears: 7,
    warrantyYears: 3,
    truckRollsPerSiteYr: 4,
    adminHrsPerCamYr: 2.5,
    investigationHrsPerIncident: 3,
    framerateFps: 24,
    baseLicense: 1500,
    deviceLicense: 250,
    carePct: 20,
    serverCost: 9000,
    serverCapacity: 100,
    storageCostPerTB: 200,
    raidLevel: "raid1",
    analyticsApplianceCost: 25000,
    analyticsSoftwareCost: 8000,
    refreshCycleYears: 5,
    yearsUntilNextRefresh: 2,
    // cloud-only fields, unused by the on-prem formula
    migrationStrategy: "connector",
    tierPrice: 1099,
    tierYears: 5,
    applianceCost: 9999,
    applianceCapacity: 50,
    applianceWarrantyYears: 5,
    applianceRefreshCycleYears: 7,
    yearsUntilNextApplianceRefresh: 2,
    supportAddonPerCamYr: 0,
  };
}

export interface ShapeOption {
  id: string;
  label: string;
  description: string;
  pros: string[];
  cons: string[];
  modelA: DeploymentModel;
  modelB: DeploymentModel;
}

// Listed in order of how often they come up: replacing an existing on-prem
// system with a cloud/hybrid one is the most common real comparison, so it
// leads. This is a workflow convenience, not a scoring order, all three
// remain equally full-featured and the pros/cons stay even-handed either way.
export const SHAPE_OPTIONS: ShapeOption[] = [
  {
    id: "onprem-cloud",
    label: "Cloud / Hybrid vs. On-Prem",
    description: "An on-prem deployment against a cloud/hybrid one: CapEx vs. OpEx.",
    pros: [
      "Compares the CapEx-heavy and OpEx-heavy approaches directly",
      "Good for evaluating a migration off an existing on-prem system",
    ],
    cons: [
      "Harder to compare apples-to-apples; the two paths differ structurally",
    ],
    modelA: "onprem",
    modelB: "cloud",
  },
  {
    id: "cloud-cloud",
    label: "Two Cloud / Hybrid Solutions",
    description: "Two cloud-managed or hybrid deployments: lighter on-site footprint, subscription licensing.",
    pros: [
      "Less on-site hardware to buy, rack, and refresh",
      "Lower admin labor and truck rolls; faster investigations",
    ],
    cons: [
      "Subscription fees compound over the horizon",
      "Depends on cloud connectivity",
    ],
    modelA: "cloud",
    modelB: "cloud",
  },
  {
    id: "onprem-onprem",
    label: "Two On-Prem Solutions",
    description: "Two on-premises deployments: servers, storage, and hardware you own and refresh.",
    pros: [
      "No recurring per-camera subscription",
      "Full data locality, no internet dependency",
    ],
    cons: [
      "Higher hardware capex, upfront and ongoing",
      "More admin labor and truck rolls",
    ],
    modelA: "onprem",
    modelB: "onprem",
  },
];
