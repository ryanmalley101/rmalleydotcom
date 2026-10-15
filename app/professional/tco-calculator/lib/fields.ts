// One place that names every input, for exports and reports. `models`
// limits a solution field to the deployment model(s) it applies to.
import type { DeploymentModel, RaidLevel, ScenarioInputs, SolutionInputs } from "./model";

export interface FieldDef<K extends string> {
  key: K;
  label: string;
  models?: DeploymentModel[];
}

export const SCENARIO_FIELDS: FieldDef<keyof ScenarioInputs>[] = [
  { key: "cameras", label: "Camera count" },
  { key: "sites", label: "Sites / buildings" },
  { key: "retentionDays", label: "Retention (days)" },
  { key: "horizonYears", label: "Horizon (years)" },
  { key: "bitrateMbps", label: "Avg bitrate/cam (Mbps)" },
  { key: "investigationsPerMonth", label: "Investigations/mo" },
  { key: "incumbent", label: "Incumbent" },
  { key: "existingCamerasReusable", label: "Existing cameras reusable" },
  { key: "existingFleetAgeYears", label: "Age of existing cameras (yrs)" },
  { key: "laborEscalationPct", label: "Labor & services escalation (%/yr)" },
  { key: "hardwareEscalationPct", label: "Hardware price escalation (%/yr)" },
  { key: "licenseEscalationPct", label: "License & subscription escalation (%/yr)" },
  { key: "adminRate", label: "Admin ($/hr)" },
  { key: "investigatorRate", label: "Investigator ($/hr)" },
  { key: "truckRollCost", label: "Truck roll ($)" },
  { key: "driveCapacityTb", label: "Drive capacity (TB/drive)" },
  { key: "storageOverheadMultiplier", label: "Storage overhead (x)" },
  { key: "spareServers", label: "Spare recording servers" },
  { key: "creditResidualValue", label: "Credit unused service life at horizon end" },
];

export const SOLUTION_FIELDS: FieldDef<keyof SolutionInputs>[] = [
  { key: "model", label: "Deployment model" },
  { key: "vmsProvider", label: "VMS software", models: ["onprem"] },
  { key: "cameraProvider", label: "Camera hardware", models: ["onprem"] },
  { key: "discountPct", label: "Discount off list (%)" },
  { key: "migrationStrategy", label: "Migration strategy", models: ["cloud"] },
  { key: "onpremCameraStrategy", label: "Cameras (reuse or buy new)", models: ["onprem"] },
  { key: "cameraCost", label: "Camera ($/cam)" },
  { key: "bulkInstallLaborCost", label: "Year-0 install / onboarding ($/cam)" },
  { key: "replacementInstallLaborCost", label: "Replacement install labor ($/cam)" },
  { key: "fleetHalfLifeYears", label: "Camera fleet half-life (yrs)" },
  { key: "warrantyYears", label: "Warranty (yrs)" },
  { key: "tierYears", label: "License term (years)", models: ["cloud"] },
  { key: "tierPrice", label: "License cost for term ($/cam)", models: ["cloud"] },
  { key: "supportAddonPerCamYr", label: "Support/analytics add-on ($/cam/yr)", models: ["cloud"] },
  { key: "yearsUntilLicenseRenewal", label: "Years until license renewal (incumbent)", models: ["cloud"] },
  { key: "applianceCost", label: "Connector appliance ($/unit)", models: ["cloud"] },
  { key: "applianceCapacity", label: "Cameras per appliance", models: ["cloud"] },
  { key: "applianceWarrantyYears", label: "Connector warranty (yrs)", models: ["cloud"] },
  { key: "applianceRefreshCycleYears", label: "Appliance refresh cycle (yrs)", models: ["cloud"] },
  { key: "yearsUntilNextApplianceRefresh", label: "Years until next appliance refresh (incumbent)", models: ["cloud"] },
  { key: "baseLicense", label: "Base license ($, one-time)", models: ["onprem"] },
  { key: "deviceLicense", label: "Device license ($/cam, one-time)", models: ["onprem"] },
  { key: "carePct", label: "Support renewal (% of license/yr)", models: ["onprem"] },
  { key: "serverCost", label: "Recording server ($/unit)", models: ["onprem"] },
  { key: "serverCapacity", label: "Cameras per server", models: ["onprem"] },
  { key: "storageCostPerTB", label: "Storage ($/TB raw)", models: ["onprem"] },
  { key: "raidLevel", label: "Storage redundancy", models: ["onprem"] },
  { key: "raidArrayDrives", label: "Drives per RAID 5/6 array", models: ["onprem"] },
  { key: "refreshCycleYears", label: "Refresh cycle (yrs)", models: ["onprem"] },
  { key: "yearsUntilNextRefresh", label: "Years until next refresh (incumbent)", models: ["onprem"] },
  { key: "analyticsApplianceCost", label: "Analytics appliance ($/site)", models: ["onprem"] },
  { key: "analyticsSoftwareCostPerCam", label: "Analytics software license ($/cam, one-time)", models: ["onprem"] },
  { key: "analyticsSoftwareCostPerCamYr", label: "Analytics software ($/cam/yr)", models: ["onprem"] },
  { key: "truckRollsPerSiteYr", label: "Truck rolls / site / yr" },
  { key: "adminHrsPerCamYr", label: "Admin hrs / cam / yr" },
  { key: "investigationHrsPerIncident", label: "Hrs per investigation" },
];

export const fieldsFor = (model: DeploymentModel) => SOLUTION_FIELDS.filter((f) => !f.models || f.models.includes(model));

// Storage redundancy choices, most common first. RAID 0 stays selectable
// only so an older saved comparison using it still displays.
export const RAID_OPTIONS: { value: RaidLevel; label: string }[] = [
  { value: "raid5", label: "RAID 5 (single parity)" },
  { value: "raid6", label: "RAID 6 (double parity)" },
  { value: "raid1", label: "RAID 1 (mirroring)" },
  { value: "raid10", label: "RAID 10 (striped mirrors)" },
  { value: "none", label: "No RAID" },
  { value: "raid0", label: "RAID 0 (striping, no redundancy)" },
];
