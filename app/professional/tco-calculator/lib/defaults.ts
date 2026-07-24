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
      adminHrsPerCamYr: 0.5,
      investigationHrsPerIncident: 0.75,
      migrationStrategy: "connector",
      tierPrice: 1099,
      tierYears: 5,
      applianceCost: 9999,
      applianceCapacity: 50,
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
    description: "The classic tradeoff: an on-premises deployment against a cloud/hybrid one, CapEx vs. OpEx, head-to-head.",
    pros: [
      "Directly compares the CapEx-heavy and OpEx-heavy approaches",
      "Useful when evaluating a migration off an existing on-prem system",
    ],
    cons: [
      "Harder to compare apples-to-apples, since the two paths differ structurally, not just in price",
    ],
    modelA: "onprem",
    modelB: "cloud",
  },
  {
    id: "cloud-cloud",
    label: "Two Cloud / Hybrid Solutions",
    description: "Compare two cloud-managed or hybrid deployments: a lighter on-site footprint with subscription-based licensing.",
    pros: [
      "Less on-site hardware to buy, rack, and refresh",
      "Typically lower admin labor and truck rolls; faster remote investigations",
    ],
    cons: [
      "Recurring per-camera subscription fees compound over the horizon",
      "Ongoing dependency on cloud connectivity",
    ],
    modelA: "cloud",
    modelB: "cloud",
  },
  {
    id: "onprem-onprem",
    label: "Two On-Prem Solutions",
    description: "Compare two on-premises deployments head-to-head: servers, storage, and hardware you own and refresh on a cycle.",
    pros: [
      "No recurring per-camera subscription, mostly one-time or perpetual licensing",
      "Full data locality; local recording doesn't depend on internet uptime",
    ],
    cons: [
      "Higher upfront and recurring hardware capex (servers, storage, analytics appliances)",
      "Typically more admin labor and truck rolls to keep running",
    ],
    modelA: "onprem",
    modelB: "onprem",
  },
];
