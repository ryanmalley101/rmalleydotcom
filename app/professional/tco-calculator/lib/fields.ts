// The single list of input definitions: labels, help text, and valid ranges
// for every field. The wizard (SolutionsStep), the results page
// (AssumptionsPanel, via SolutionField), and the exports all read from it,
// so the same input can't be labeled or explained differently in two
// places. `models` limits a solution field to the deployment model(s) it
// applies to.
import type { DeploymentModel, RaidLevel, ScenarioInputs, SolutionInputs } from "./model";
import {
  ADMIN_HOURS_HELP, HALF_LIFE_HELP, INVESTIGATION_HOURS_HELP, MANAGEMENT_SERVERS_HELP, NETWORK_HELP,
  RAID_ARRAY_HELP, SERVER_SOFTWARE_HELP, STORAGE_PRICE_HELP, TRUCK_ROLLS_HELP,
} from "./fieldHelp";

export interface FieldDef<K extends string> {
  key: K;
  label: string;
  models?: DeploymentModel[];
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  decimalScale?: number;
  int?: boolean;
}

const ONPREM_LICENSE_HELP =
  "Charged once at year 0, like the hardware, unless this solution is the incumbent (already owned). Only the support renewal recurs afterward.";
const NEXT_REFRESH_HELP =
  "How many years until the already-installed hardware is next replaced. Only shown for the incumbent: a solution bought new at year 0 gets its first refresh one full cycle later.";

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
  {
    key: "discountPct", label: "Discount off list (%)", min: 0, max: 100,
    help: "This vendor's negotiated discount off list price. Applies to cameras, licenses, appliances, servers, storage, and analytics alike; not to labor or your misc items.",
  },
  { key: "migrationStrategy", label: "Migration strategy", models: ["cloud"] },
  { key: "onpremCameraStrategy", label: "Cameras (reuse or buy new)", models: ["onprem"] },
  { key: "cameraCost", label: "Camera ($/cam)", help: "Price of one camera, used for a new fleet at year 0 and for out-of-warranty replacements." },
  {
    key: "bulkInstallLaborCost", label: "Year-0 install / onboarding ($/cam)",
    help: "Labor per camera when this solution is first deployed: a planned install for new cameras, or onboarding existing cameras onto the new system. Not charged for the incumbent.",
  },
  {
    key: "replacementInstallLaborCost", label: "Replacement install labor ($/cam)",
    help: "Labor to swap one failed camera, usually more per camera than a planned bulk install. Charged for every failure, in warranty or not.",
  },
  { key: "fleetHalfLifeYears", label: "Camera fleet half-life (yrs)", min: 0.5, step: 0.5, decimalScale: 1, help: HALF_LIFE_HELP },
  {
    key: "warrantyYears", label: "Warranty (yrs)", step: 0.5, decimalScale: 1,
    help: "How many years camera hardware is covered by the manufacturer's warranty. A failure inside it costs only the labor to swap the unit.",
  },
  {
    key: "tierYears", label: "License term (years)", models: ["cloud"], min: 1, int: true,
    help: "Length of one license term. The term's price is paid up front at purchase and again at each renewal.",
  },
  {
    key: "tierPrice", label: "License cost for term ($/cam)", models: ["cloud"],
    help: "Price per camera for one full term, before the discount and any retention scaling. Support, updates, and analytics are assumed included; use the add-on field for anything priced separately.",
  },
  {
    key: "supportAddonPerCamYr", label: "Support/analytics add-on ($/cam/yr)", models: ["cloud"],
    help: "Yearly per-camera cost for support, analytics, or extended retention this vendor sells separately from its license. Leave at $0 if the license includes them.",
  },
  { key: "yearsUntilLicenseRenewal", label: "Years until license renewal (incumbent)", models: ["cloud"] },
  { key: "retentionPricing", label: "License price vs. retention", models: ["cloud"] },
  {
    key: "applianceCost", label: "Connector appliance ($/unit)", models: ["cloud"],
    help: "Price of one connector box for using cameras other than the vendor's own. At least one per site, more if the camera count needs it, replaced on the appliance refresh cycle.",
  },
  { key: "applianceCapacity", label: "Cameras per appliance", models: ["cloud"], min: 1, int: true },
  { key: "applianceRefreshCycleYears", label: "Appliance refresh cycle (yrs)", models: ["cloud"], min: 1, int: true, help: "How often connector appliances are replaced." },
  { key: "yearsUntilNextApplianceRefresh", label: "Years until next refresh", models: ["cloud"], min: 0, int: true, help: NEXT_REFRESH_HELP },
  { key: "baseLicense", label: "Base license ($, one-time)", models: ["onprem"], help: ONPREM_LICENSE_HELP },
  { key: "deviceLicense", label: "Device license ($/cam, one-time)", models: ["onprem"], help: ONPREM_LICENSE_HELP },
  {
    key: "carePct", label: "Support renewal (% of license/yr)", models: ["onprem"],
    help: "Yearly support and upgrade plan as a percentage of the perpetual license price. Charged every year, including for the incumbent.",
  },
  {
    key: "serverCost", label: "Recording server ($/unit)", models: ["onprem"],
    help: "Price of one recording server. At least one per site plus spares, more if the camera count needs it, replaced on the refresh cycle.",
  },
  { key: "serverCapacity", label: "Cameras per server", models: ["onprem"], min: 1, int: true },
  { key: "serverSoftwareCost", label: "Server software ($/server)", models: ["onprem"], help: SERVER_SOFTWARE_HELP },
  { key: "managementServers", label: "Management servers", models: ["onprem"], int: true, help: MANAGEMENT_SERVERS_HELP },
  { key: "storageCostPerTB", label: "Storage ($/TB raw)", models: ["onprem"], help: STORAGE_PRICE_HELP },
  { key: "raidLevel", label: "Storage redundancy", models: ["onprem"] },
  { key: "raidArrayDrives", label: "Drives per RAID 5/6 array", models: ["onprem"], min: 3, int: true, help: RAID_ARRAY_HELP },
  {
    key: "refreshCycleYears", label: "Refresh cycle (yrs)", models: ["onprem"], min: 1, int: true,
    help: "How often recording servers, storage, and analytics appliances are replaced.",
  },
  { key: "yearsUntilNextRefresh", label: "Years until next refresh", models: ["onprem"], min: 0, int: true, help: NEXT_REFRESH_HELP },
  {
    key: "analyticsApplianceCost", label: "Analytics appliance ($/site)", models: ["onprem"],
    help: "One analytics appliance per site, running against that site's recording servers. Bought with the servers and replaced on the same refresh cycle.",
  },
  {
    key: "analyticsSoftwareCostPerCam", label: "Analytics software license ($/cam, one-time)", models: ["onprem"],
    help: "Analytics software licensed per camera. Charged once at year 0 like the base and device licenses, not for the incumbent, and not again at hardware refresh.",
  },
  {
    key: "analyticsSoftwareCostPerCamYr", label: "Analytics software ($/cam/yr)", models: ["onprem"],
    help: "A recurring per-camera analytics subscription on top of the one-time license, if this vendor charges one.",
  },
  { key: "networkCostPerSiteYr", label: "Internet / WAN ($/site/yr)", help: NETWORK_HELP },
  { key: "truckRollsPerSiteYr", label: "Truck rolls / site / yr", step: 0.5, decimalScale: 1, help: TRUCK_ROLLS_HELP },
  { key: "adminHrsPerCamYr", label: "Admin hrs / cam / yr", step: 0.1, decimalScale: 1, help: ADMIN_HOURS_HELP },
  { key: "investigationHrsPerIncident", label: "Hrs per investigation", step: 0.25, decimalScale: 2, help: INVESTIGATION_HOURS_HELP },
];

export const SOLUTION_FIELD_MAP = Object.fromEntries(SOLUTION_FIELDS.map((f) => [f.key, f])) as Record<keyof SolutionInputs, FieldDef<keyof SolutionInputs>>;

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
