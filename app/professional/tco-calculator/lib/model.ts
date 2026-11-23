// Generic two-solution TCO model. Deliberately vendor-agnostic: a "solution" is
// just a deployment model (cloud/hybrid vs on-prem) plus a set of cost
// assumptions, so the same math drives on-prem-vs-on-prem, cloud-vs-cloud, and
// on-prem-vs-cloud comparisons alike. By default both solutions pay their own
// year-0 buildout cost, so the shape of the comparison doesn't itself favor
// either side. The "incumbent" scenario setting is the deliberate exception:
// when one solution represents what's already deployed, its year-0 buildout
// cost is zeroed out (that hardware is already paid for) while the other
// solution is still costed as a fresh deployment. A cloud/hybrid solution's
// year-0 cost in that case is just its connector/NVR-style appliance, not a
// full camera fleet replacement, since most such products are designed to
// reuse the customer's existing cameras.

// Bumped whenever a change to this file (or to the defaults it's fed) changes
// what an existing share link or saved comparison would compute. Stamped into
// every share link/save, so a link created under an older model can say its
// totals were recalculated instead of silently showing different numbers.
// Links from before versioning existed decode as version 1.
import { sanitizeScenario, sanitizeSolution } from "./sanitize";
import { annualOutcomes, type Vertical } from "./verticals";
import {
  advanceCohorts, compareTotals, isRefreshYear, miscForYear, residualCredit, splitTotals, tallyYears,
  type Cohort, type ComparisonTotals, type DeploymentModel, type IncumbentChoice, type Lump, type MiscCostItem, type SolutionTotals,
} from "../../_tco-shared/lib/engine";

export type { DeploymentModel, IncumbentChoice, MiscCostItem, MiscItemTiming } from "../../_tco-shared/lib/engine";

// 3: an incumbent whose refresh or renewal is 0 years away buys at year 0.
// 4: electricity (power draw per camera x the scenario's $/kWh), the same
//    default for both deployment models.
export const MODEL_VERSION = 4;

// How a cloud/hybrid solution's cameras get onto the new platform:
// "connector" reuses the existing camera fleet behind a connector/NVR-style
// appliance (a common product shape among cloud/hybrid VMS vendors) - year-0
// hardware cost is just that appliance, and cameras are swapped for native
// ones only as they fail, same as the ongoing replacement schedule.
// "ripReplace" swaps every camera for a native one up front - year-0 cost is
// the full fleet of native cameras instead, and no connector appliance.
export type CloudMigrationStrategy = "connector" | "ripReplace";
// The on-prem equivalent: keep the cameras already on site and add them to
// the new VMS, or buy a new fleet at year 0. Only matters when
// ScenarioInputs.existingCamerasReusable is true; otherwise every newly
// deployed side buys cameras regardless.
export type OnpremCameraStrategy = "reuse" | "replace";
export type RetentionPricing = "scaled" | "flat";

// One connector/appliance model a cloud vendor sells, for vendors whose
// connectors come in sizes (cameras per unit) and storage tiers (days of
// retention). With any listed, the model picks the cheapest one that covers
// the cameras at the scenario's retention (see chooseApplianceOption), in
// place of the single applianceCost/applianceCapacity. Every unit is the
// same model; mixing sizes across sites isn't modeled.
export interface ApplianceOption {
  id: string;
  label: string;
  cost: number; // list price per unit
  capacity: number; // cameras per unit when its storage holds `retentionDays`
  // Days of retention per camera with every channel in use, or null when
  // capacity doesn't depend on retention (e.g. the license carries it).
  // Longer retention than this spreads the same storage over fewer cameras.
  retentionDays: number | null;
}

// An option's cameras per unit at `retentionDays`, units needed (at least
// one per site, as for the single appliance), and total list price. Whole
// cameras only: the storage behind 33.3 cameras serves 33.
export function applianceOptionFit(o: ApplianceOption, scn: Pick<ScenarioInputs, "cameras" | "sites" | "retentionDays">) {
  const effCap = Math.max(1, Math.floor(o.capacity * (o.retentionDays ? Math.min(1, o.retentionDays / scn.retentionDays) : 1)));
  const units = Math.max(scn.sites, Math.ceil(scn.cameras / effCap));
  return { effCap, units, total: units * o.cost };
}

// The cheapest listed option (the first, on a tie), or null when none are listed.
export function chooseApplianceOption(options: ApplianceOption[], scn: Pick<ScenarioInputs, "cameras" | "sites" | "retentionDays">) {
  let best: { option: ApplianceOption; units: number; total: number } | null = null;
  for (const option of options) {
    const fit = applianceOptionFit(option, scn);
    if (!best || fit.total < best.total) best = { option, units: fit.units, total: fit.total };
  }
  return best;
}

// On-prem storage redundancy. Affects only how many drives have to be
// bought for the usable capacity needed, not the recording server count.
// RAID 5 and 6 (parity) are the usual NVR setups; RAID 0 has no redundancy
// and is kept only so older saved comparisons still load.
export type RaidLevel = "none" | "raid0" | "raid1" | "raid10" | "raid5" | "raid6";

// Minimum drives a valid array of each level needs.
const RAID_MIN_DRIVES: Record<RaidLevel, number> = {
  none: 1,
  raid0: 2,
  raid1: 2,
  raid10: 4,
  raid5: 3,
  raid6: 4,
};

// Drives to buy for one recording server's array, given the usable TB it
// has to hold. Mirrors (RAID 1/10) double the data drives; parity levels
// add one (RAID 5) or two (RAID 6) parity drives per array of up to
// `arrayDrives` drives. You can't buy a fraction of a drive, and each level
// has a minimum array size.
export function drivesForArray(usableTb: number, raidLevel: RaidLevel, driveCapacityTb: number, arrayDrives: number): number {
  return Math.max(RAID_MIN_DRIVES[raidLevel], drivesBeforeMinimum(dataDrives(usableTb, driveCapacityTb), raidLevel, arrayDrives));
}

// drivesForArray's steps, which the cost model's storage sizing (DERIVED,
// below) shows one per spreadsheet row.
export const dataDrives = (usableTb: number, driveCapacityTb: number) => Math.max(1, Math.ceil(usableTb / Math.max(1, driveCapacityTb)));
export const raidParity = (raidLevel: RaidLevel) => (raidLevel === "raid5" ? 1 : raidLevel === "raid6" ? 2 : 0);
export function drivesBeforeMinimum(data: number, raidLevel: RaidLevel, arrayDrives: number): number {
  if (raidLevel === "raid1" || raidLevel === "raid10") return data * 2;
  const parity = raidParity(raidLevel);
  if (parity === 0) return data;
  const dataPerArray = Math.max(1, arrayDrives - parity);
  return data + Math.ceil(data / dataPerArray) * parity;
}

// Needed to convert a raw physical TB figure into a drive count for
// whole-drive storage billing (see driveCountFor below); assumed as a
// current-gen surveillance/enterprise HDD capacity. Editable ScenarioInputs
// field; this is just the fallback value used when it's missing (an older
// share link/saved comparison from before it existed), exported so
// lib/defaults.ts's DEFAULT_SCENARIO can seed the same number instead of
// duplicating it.
export const DEFAULT_DRIVE_CAPACITY_TB = 16;
// Multiplier on top of the raw video-bitrate math in tbUsable below, for
// metadata/audio/keyframe-indexing overhead beyond the encoded video stream
// itself. Previously a bare, un-editable constant; some VMSes genuinely run
// leaner or heavier overhead than this default, so it's a real assumption
// worth exposing rather than a fixed fact like a unit conversion.
export const DEFAULT_STORAGE_OVERHEAD_MULTIPLIER = 1.3;
// On-prem recording servers bought beyond whatever capacity actually
// requires — hot-spare/headroom, not a fixed technical fact (some
// deployments run leaner, some want more than one spare).
export const DEFAULT_SPARE_SERVERS = 1;

export interface ScenarioInputs {
  cameras: number;
  sites: number;
  retentionDays: number;
  horizonYears: number;
  bitrateMbps: number;
  investigationsPerMonth: number;
  // Compounding annual price growth, split three ways because the three move
  // differently over a 10-15 year horizon: labor and services (install,
  // truck rolls, admin, investigations, replacement labor, misc items) tend
  // to rise with wages; hardware (cameras, servers, storage, appliances) is
  // often flat or falling per unit; license and subscription pricing follows
  // its own contracts. Older share links carried one annualEscalationPct,
  // which normalizeScenario copies into all three.
  laborEscalationPct: number;
  hardwareEscalationPct: number;
  licenseEscalationPct: number;
  // Which solution (if either) is already deployed. The incumbent skips its
  // year-0 buildout cost; the other solution pays it as a fresh deployment.
  incumbent: IncumbentChoice;
  // Whether the cameras already on site can be kept by a newly deployed
  // solution (a cloud connector, or an on-prem VMS that adds them). false
  // means a new site or cameras that must go: every newly deployed side then
  // buys its full camera fleet at year 0. Defaults to true, which matches how
  // the model behaved before this question existed.
  existingCamerasReusable: boolean;
  // How old the cameras already on site are at year 0, in years. Applies to
  // the incumbent's fleet and to any side that keeps those cameras: their
  // warranty is counted from this age, not from year 0. Defaults to 0, which
  // treats them as new (the model's behavior before this field existed), so
  // enter the real age for an existing fleet.
  existingFleetAgeYears: number;
  // Shared market rates: the operator's own costs, independent of vendor.
  adminRate: number;
  investigatorRate: number;
  truckRollCost: number;
  // What the site pays for electricity, $/kWh. Shared by both solutions;
  // each one's power draw is its own (SolutionInputs.powerWattsPerCam).
  electricityRatePerKwh: number;
  // See the DEFAULT_* constants above. A missing or invalid value (older
  // share link/saved comparison, cleared field) is replaced by
  // lib/sanitize.ts before any math runs.
  driveCapacityTb: number;
  storageOverheadMultiplier: number;
  spareServers: number;
  // Credit the unused share of any lump purchase that outlasts the horizon
  // (a cloud license term, a hardware or connector refresh), straight-line
  // over its service life. Without it, a purchase made late in the horizon is
  // billed in full for a year or two of use: a six-year horizon pays for two
  // five-year cloud terms. Defaults to true.
  creditResidualValue: boolean;
  // Industry for the business impact step (lib/verticals.ts), or null for
  // none, which leaves business impact out of the comparison entirely.
  vertical: Vertical | null;
  // That industry's shared inputs, keyed by OutcomeInput.key. A missing key
  // reads as the input's default.
  outcomeBaseline: Record<string, number>;
  // Ids of the categories switched on for this business. Only these show
  // fields or count toward a total; the rest keep any entered values, so
  // switching one back on restores them.
  outcomeEnabled: string[];
}

export interface SolutionInputs {
  id: "a" | "b";
  name: string;
  model: DeploymentModel;
  // On-prem deployments typically pair a VMS vendor with a separate camera
  // hardware vendor; cloud/hybrid deployments are usually a single ecosystem,
  // so cloud solutions just use `name` directly. Bookkeeping only: the calc
  // engine never reads these, they only drive the wizard's naming UI.
  vmsProvider?: string;
  cameraProvider?: string;
  // Off list, this vendor's own negotiated discounts, split because hardware
  // and licenses are often discounted differently. discountPct covers
  // cameras, connectors, servers (with their software), storage, and
  // analytics appliances; licenseDiscountPct covers licenses, subscriptions,
  // add-ons, and support renewals. Older links had one discount for both,
  // which normalizeSolution copies into licenseDiscountPct.
  discountPct: number;
  licenseDiscountPct: number;

  // Shared across both models
  cameraCost: number; // $/cam, replacement hardware
  // Bulk professional install (year-0 buildout, planned rollout across the
  // whole fleet) is typically cheaper per camera than an unplanned one-off
  // truck roll to swap a single failed unit later, hence two separate rates.
  bulkInstallLaborCost: number; // $/cam, year-0 install (new cameras) or onboarding (reused cameras)
  replacementInstallLaborCost: number; // $/cam, ongoing decay-driven swaps
  // How long until roughly half of today's cameras have failed and been
  // replaced. Per-solution (not shared) since each side's camera hardware
  // can have a different reliability curve, even when comparing two
  // deployments of the same type (e.g. two different on-prem camera brands).
  fleetHalfLifeYears: number;
  // How many years new camera hardware is covered by the manufacturer's
  // warranty. A failure within this window is assumed to cost only the labor
  // to swap the unit, not the hardware itself, so the half-life-driven
  // replacement cost is moot until a camera outlives its warranty.
  warrantyYears: number;
  truckRollsPerSiteYr: number;
  adminHrsPerCamYr: number;
  investigationHrsPerIncident: number;

  // Cloud/hybrid only
  migrationStrategy: CloudMigrationStrategy;
  tierPrice: number; // license cost for a term of `tierYears`, this vendor's own term length
  tierYears: number;
  applianceCost: number; // connector/NVR-style appliance, only used when migrationStrategy is "connector"
  applianceCapacity: number;
  // The vendor's connector models, when it sells several (see
  // ApplianceOption). Empty means applianceCost/applianceCapacity apply.
  applianceOptions: ApplianceOption[];
  // Manufacturer's hardware warranty on the connector/appliance itself, separate
  // from `warrantyYears` (camera hardware only) since the two commonly differ for
  // the same vendor (e.g. a 10-year camera warranty against a 5-year connector
  // one). Reference/comparison data only: unlike camera warranty, it doesn't
  // reduce a cost line, because the appliance's replacement cost above is driven
  // by a scheduled refresh cycle the buyer chooses, not a failure event a
  // warranty would cover.
  applianceWarrantyYears: number;
  // Editable, matching on-prem's refreshCycleYears/yearsUntilNextRefresh, rather
  // than a hardcoded cadence: there's no reason the appliance side should be the
  // one part of this model a user can't adjust to their own assumptions.
  applianceRefreshCycleYears: number;
  yearsUntilNextApplianceRefresh: number;
  // Defaults to 0 ("bundled into the license"). Not every cloud vendor bundles
  // support/analytics/extended retention into one flat price the way this
  // tool's own defaults assume; this makes that assumption visible and
  // overridable per solution instead of a silent, hardcoded universal.
  supportAddonPerCamYr: number;
  // Whether this vendor's license price rises with retention ("scaled", the
  // retention curve) or not ("flat"): vendors that record on the camera or a
  // local appliance sell longer retention as bigger hardware or a separate
  // archive add-on, not a pricier license. Put that cost in the camera or
  // add-on fields instead.
  retentionPricing: RetentionPricing;
  // Incumbent only: years until the license already in place comes up for
  // renewal. Absent means one full term from year 0 (as if just bought),
  // which is how the model always treated an incumbent's license before.
  yearsUntilLicenseRenewal?: number;

  // On-prem only
  onpremCameraStrategy: OnpremCameraStrategy;
  baseLicense: number;
  deviceLicense: number;
  carePct: number;
  serverCost: number;
  serverCapacity: number;
  storageCostPerTB: number;
  raidLevel: RaidLevel;
  // Drives per array for RAID 5/6: parity overhead is 1 or 2 drives per
  // array of this many. Ignored for other levels.
  raidArrayDrives: number;
  // On-prem only. Whether this solution includes AI video search
  // (analytics). Off by default: cloud vendors bundle search into the
  // license, while on-prem buys it separately, and the on-prem defaults
  // already assume slower, unassisted investigations. Turning it on adds the
  // analytics costs below and, in the UI, moves this side's hours per
  // investigation to the faster with-search default (withAnalytics in
  // lib/defaults.ts), so the cost and its benefit always come together.
  // Before this, on-prem paid for analytics and still carried four times the
  // investigation hours.
  analyticsEnabled: boolean;
  // Analytics hardware, sized by camera count like recording servers'
  // capacity (no per-site minimum: per-site pricing made 100 cameras cost
  // $188 each at one site and $9,375 each at 50). Bought with the servers
  // and replaced on the same refresh cycle.
  analyticsApplianceCost: number;
  analyticsApplianceCapacity: number;
  // Per-camera analytics software: a one-time license at year 0 (owned
  // already by the incumbent, and not repurchased at hardware refresh), and
  // an optional recurring subscription on top.
  analyticsSoftwareCostPerCam: number;
  analyticsSoftwareCostPerCamYr: number;
  refreshCycleYears: number;
  yearsUntilNextRefresh: number;

  // Extra internet/WAN cost per site per year this solution needs, e.g.
  // upload bandwidth for a vendor that records to the cloud. Both models;
  // default 0.
  networkCostPerSiteYr: number;
  // Average power draw per camera, in watts, all-in: the camera itself plus
  // its share of whatever else this solution keeps running on site
  // (recording servers, storage, analytics, connectors, switches). Both
  // models, and the same default for both (DEFAULT_POWER_WATTS_PER_CAM):
  // on-prem usually draws more, but without researched figures a different
  // default would decide the comparison on a guess. Billed every year after
  // year 0 at the scenario's electricity rate.
  powerWattsPerCam: number;
  // On-prem only: server software bought with each server (Windows Server,
  // SQL Server, other OS/database licensing), and non-recording management
  // servers (management/SQL/failover) bought alongside the recording
  // servers. Both default to 0 and recur with every hardware refresh.
  serverSoftwareCost: number;
  managementServers: number;

  // Free-form list of misc cost/credit line items — see MiscCostItem above.
  // Defaults to an empty array; purely additive, never changes any other
  // category's math.
  miscItems: MiscCostItem[];

  // Business impact: this solution's change to each of the scenario
  // vertical's categories, keyed by category id (a % for a cost the business
  // already has, an amount for a new one; see lib/verticals.ts). Missing
  // means no change. Ignored for the incumbent, whose effect is already in
  // today's numbers.
  outcomeChanges: Record<string, number>;
  // Codes of the business impact considerations (lib/verticals.ts
  // CONSIDERATIONS) this solution offers: benefits listed beside the
  // totals, never priced into them.
  considerations: string[];
}

export const CATEGORIES = [
  "Cameras",
  "Hardware (initial & refresh)",
  "Licenses/subscription",
  "Installation",
  "Truck rolls",
  "Admin labor",
  "Investigations",
  "Network / bandwidth",
  "Electricity",
  "Misc / other",
  "Business impact: savings",
  "Business impact: added costs",
  "Residual value (credit)",
] as const;
export type Category = (typeof CATEGORIES)[number];

// Categories that estimate internal staff time rather than money actually
// paid out to a vendor or contractor. Kept in every total, but reported
// separately (SolutionResult.staffTimeTotal) because they're the softest,
// least-verifiable numbers in a comparison and often its biggest driver.
export const STAFF_TIME_CATEGORIES: readonly Category[] = ["Admin labor", "Investigations"];

// The business impact step's estimates (lib/verticals.ts): changes to theft,
// claims, guards, and the like. Also kept in every total and reported
// separately (SolutionResult.outcomeTotal), for the same reason as staff
// time, only more so.
export const OUTCOME_CATEGORIES: readonly Category[] = ["Business impact: savings", "Business impact: added costs"];

// Continuous replacement for the old 5-step (30/60/90/180/365-day) table.
// Fit as a power curve (days/30)^0.4 against those same reference points
// (30d=1.0x, 60d=1.35x, 90d=1.6x, 180d=2.0x, 365d=2.6x, all within ~5%), so it
// keeps the same "sublinear" shape (retention-driven storage is only part of
// what a cloud license covers, and storage itself gets cheaper per unit at
// higher volumes/cold tiers) without an artificial cliff right at each
// threshold day. On-prem storage cost already scales continuously with days
// via `tbUsable`, this brings cloud licensing in line with that.
//
// Floored at 30 days: license prices are quoted for (at least) 30-day
// retention, and the curve was only fit from 30 days up, so shorter
// retention no longer extrapolates into a discount (7 days used to cut the
// price by 44%).
export function retentionMultiplier(days: number) {
  return Math.pow(Math.max(days, 30) / 30, 0.4);
}

// End-state hardware footprint, for the results summary's "what do you
// actually end up owning" line, distinct from totalsByCategory (dollars).
// Reuses the same unit counts the cost model itself computes rather than
// re-deriving them, so this can never drift from what was actually costed.
export interface HardwareFootprint {
  // Null when the deployment has no local recording/connector box at all
  // (cloud ripReplace: native cameras record straight to the vendor's cloud).
  unitsLabel: string | null;
  units: number;
  // The connector model chosen from the vendor's list, if it has one.
  unitsModel: string | null;
  // Physical (post-RAID-overhead) storage bought, TB. On-prem only; cloud/hybrid
  // storage lives in the vendor's cloud, not something this deployment buys.
  storageTB: number | null;
  // On-prem management (non-recording) servers, 0 otherwise.
  managementServers: number;
  cameras: number;
  // Camera swaps over the horizon, counting replacements that fail again.
  cameraSwaps: number;
  // Share of the cameras in place at year 0 that failed within the horizon, 0-100.
  originalFleetReplacedPct: number;
}

// Totals by category and year, with total split into money paid out,
// estimated internal staff time (STAFF_TIME_CATEGORIES), and estimated
// business impact (OUTCOME_CATEGORIES).
export interface SolutionResult extends SolutionTotals<Category> {
  hardware: HardwareFootprint;
}

// ---------------------------------------------------------------------------
// The cost model, written once for both the app and the spreadsheet export.
//
// Every quantity below is one entry with two halves side by side: `value`,
// the TypeScript math computeSolution runs, and `formula`, the same math as
// an Excel formula that lib/spreadsheet.ts writes into the exported model
// sheet. Change one half, change the other in the same place. The
// spreadsheet tests rebuild a range of comparisons and fail if any year's
// category cost differs between the two, and check every formula against an
// independent spreadsheet engine.
//
// The flow: DERIVED quantities first (unit counts, storage sizing,
// discounted prices, refresh timing), then the camera fleet's failures
// (simulateFleet / FLEET_SHEET), then LINES year by year (escalation, what's
// bought, each cost category), then RESIDUAL, the end-of-horizon credit.
// Each `value` keeps the original model's order of operations, so results
// match it to the last bit.

// How a quantity is shown in the spreadsheet (a subset of its cell styles).
export type ModelFormat = "usd" | "usdCents" | "num" | "int" | "factor" | "flag";

// Choice inputs as the spreadsheet shows them: readable words in a dropdown,
// which the formulas below compare against.
export const SHEET_CHOICES = {
  yes: "Yes",
  no: "No",
  migration: { connector: "Connector", ripReplace: "Rip and replace" } as Record<CloudMigrationStrategy, string>,
  cameraStrategy: { reuse: "Reuse", replace: "Replace" } as Record<OnpremCameraStrategy, string>,
  retentionPricing: { scaled: "Scaled", flat: "Flat" } as Record<RetentionPricing, string>,
  raid: { raid5: "RAID 5", raid6: "RAID 6", raid1: "RAID 1", raid10: "RAID 10", none: "No RAID", raid0: "RAID 0" } as Record<RaidLevel, string>,
  miscTiming: { upfront: "Upfront", recurring: "Recurring", once: "Once" },
} as const;
const { yes: YES, no: NO, migration: MIGRATION, cameraStrategy: CAMERA_STRATEGY, retentionPricing: RETENTION, raid: RAID, miscTiming: TIMING } = SHEET_CHOICES;

// What a formula can refer to. lib/spreadsheet.ts supplies the cells.
export interface ModelRefs {
  // Fixed by the export: this solution's deployment model, and the horizon.
  model: DeploymentModel;
  H: number;
  S: Record<keyof ScenarioInputs, string>; // scenario inputs
  P: Record<keyof SolutionInputs, string>; // this solution's inputs
  O: Record<keyof SolutionInputs, string>; // the other solution's inputs
  me: "A" | "B";
  them: "A" | "B";
  d: (key: string) => string; // a DERIVED (or RESIDUAL) cell
  at: (key: string, y: number) => string; // a LINES cell in year y
  span: (key: string) => string; // a LINES row across every year
  year: (y: number) => string; // the cell holding year number y
  misc: { amount: string; timing: string; year: string };
  // This solution's connector models on the Inputs sheet (cloud only): list
  // prices, and the units needed and total list price at this scenario.
  appliance: { price: string; units: string; total: string } | null;
  // This solution's yearly business impact, or null for none.
  impact: { savings: string; costs: string } | null;
  fleet: {
    start: (y: number) => string; // the starting fleet's failures in year y
    // Every replacement batch's failures in year y, and the column of the
    // years they were installed; null when the horizon is too short for any.
    batches: (y: number) => string | null;
    installed: string | null;
  };
}

// What a value can read: the sanitized inputs, and everything computed so far.
export interface ModelContext {
  scn: ScenarioInputs;
  sol: SolutionInputs;
  // The incumbent's solution, when this side keeps the incumbent's cameras.
  existingFleet?: SolutionInputs;
  isInc: boolean;
  H: number;
  // Yearly business impact at today's prices: savings (negative) and added costs.
  outcomes: { savings: number; costs: number };
  d: Record<string, number>;
  at: (key: string, y: number) => number;
  fleet: { failed: number[]; outOfWarranty: number[]; startRemaining: number; swaps: number };
}

type Formula = string | number;

export interface DerivedDef {
  key: string;
  label: string;
  note?: string;
  format: ModelFormat;
  // Only for these deployment models; both when absent.
  models?: DeploymentModel[];
  value: (x: ModelContext) => number;
  formula: (r: ModelRefs) => Formula;
}

export interface LineDef {
  key: string;
  label: string;
  note?: string;
  format: ModelFormat;
  models?: DeploymentModel[];
  // Show a horizon total beside the line.
  total?: boolean;
  value: (x: ModelContext, y: number) => number;
  formula: (r: ModelRefs, y: number) => Formula;
}

export type LineEntry = LineDef | { section: string; models?: DeploymentModel[] };

const CLOUD: DeploymentModel[] = ["cloud"];
const ONPREM: DeploymentModel[] = ["onprem"];
const b01 = (b: boolean) => (b ? 1 : 0);
const isCloud = (x: ModelContext) => x.sol.model === "cloud";
// Whether a purchase on a cycle lands in year y, as a formula (see isRefreshYear).
const refreshFormula = (r: ModelRefs, y: number, first: string, cycle: string) =>
  `IF(AND(${r.year(y)}>=${first},MOD(${r.year(y)}-${first},${cycle})=0,${r.year(y)}<${r.S.horizonYears}),1,0)`;

export const DERIVED: DerivedDef[] = [
  {
    key: "isInc", label: "Is the incumbent (1 = yes)", format: "flag",
    value: (x) => b01(x.isInc),
    formula: (r) => `IF(${r.S.incumbent}="${r.me}",1,0)`,
  },
  {
    key: "otherInc", label: "Other solution is the incumbent (1 = yes)", format: "flag",
    value: (x) => b01(!x.isInc && x.scn.incumbent === (x.sol.id === "a" ? "b" : "a")),
    formula: (r) => `IF(${r.S.incumbent}="${r.them}",1,0)`,
  },
  {
    key: "disc", label: "Hardware price factor after discount", format: "factor",
    note: "Applies to cameras, connectors, servers, storage, and analytics appliances; not to labor or misc items.",
    value: (x) => 1 - x.sol.discountPct / 100,
    formula: (r) => `1-${r.P.discountPct}/100`,
  },
  {
    key: "discLic", label: "License price factor after discount", format: "factor",
    note: "Applies to licenses, subscriptions, add-ons, and support renewals.",
    value: (x) => 1 - x.sol.licenseDiscountPct / 100,
    formula: (r) => `1-${r.P.licenseDiscountPct}/100`,
  },
  // Whether this side buys a camera fleet at year 0 (when it isn't the
  // incumbent): always on a new site, and otherwise only if it chose to
  // replace the existing cameras.
  {
    key: "buys", label: "Buys a camera fleet at year 0 (1 = yes)", format: "flag",
    note: "A new site, or a solution set to replace the existing cameras. Not charged for the incumbent.",
    value: (x) => b01(x.scn.existingCamerasReusable === false ||
      (isCloud(x) ? x.sol.migrationStrategy === "ripReplace" : x.sol.onpremCameraStrategy === "replace")),
    formula: (r) => `IF(OR(${r.S.existingCamerasReusable}="${NO}",` +
      (r.model === "cloud" ? `${r.P.migrationStrategy}="${MIGRATION.ripReplace}"` : `${r.P.onpremCameraStrategy}="${CAMERA_STRATEGY.replace}"`) + "),1,0)",
  },
  // The year-0 fleet is the cameras already on site whenever this side keeps
  // them: the incumbent, or a side reusing them (a cloud connector, or an
  // on-prem VMS adding them).
  {
    key: "keeps", label: "Keeps the cameras already on site (1 = yes)", format: "flag",
    value: (x) => b01(x.isInc || x.d.buys === 0),
    formula: (r) => `IF(OR(${r.d("isInc")}=1,${r.d("buys")}=0),1,0)`,
  },
  // When the other side is the incumbent, kept cameras are its hardware, so
  // they fail and carry warranty on its numbers, not this solution's.
  // (computeComparison passes `existingFleet` exactly when cameras are
  // reusable and the other side is the incumbent.)
  {
    key: "useOther", label: "Kept cameras are the other solution's (1 = yes)", format: "flag",
    note: "Then they fail and carry warranty on the incumbent's numbers.",
    value: (x) => b01(x.d.keeps === 1 && x.existingFleet !== undefined),
    formula: (r) => `IF(AND(${r.d("keeps")}=1,${r.S.existingCamerasReusable}="${YES}",${r.d("otherInc")}=1),1,0)`,
  },
  {
    key: "startHalfLife", label: "Starting fleet half-life (yrs)", format: "num",
    value: (x) => (x.d.useOther ? x.existingFleet! : x.sol).fleetHalfLifeYears,
    formula: (r) => `IF(${r.d("useOther")}=1,${r.O.fleetHalfLifeYears},${r.P.fleetHalfLifeYears})`,
  },
  {
    key: "startWarranty", label: "Starting fleet warranty (yrs)", format: "num",
    value: (x) => (x.d.useOther ? x.existingFleet! : x.sol).warrantyYears,
    formula: (r) => `IF(${r.d("useOther")}=1,${r.O.warrantyYears},${r.P.warrantyYears})`,
  },
  // Cameras already on site are `existingFleetAgeYears` old, so their
  // warranty may already be used up.
  {
    key: "startInstalled", label: "Starting fleet installed in year", format: "num",
    note: "Negative: installed before year 0. Warranty is counted from here.",
    value: (x) => (x.d.keeps ? -x.scn.existingFleetAgeYears : 0),
    formula: (r) => `IF(${r.d("keeps")}=1,-${r.S.existingFleetAgeYears},0)`,
  },
  {
    key: "startDecay", label: "Starting fleet: share failing each year", format: "factor",
    value: (x) => 1 - Math.pow(0.5, 1 / x.d.startHalfLife),
    formula: (r) => `1-0.5^(1/${r.d("startHalfLife")})`,
  },
  {
    key: "replDecay", label: "Replacement cameras: share failing each year", format: "factor",
    value: (x) => 1 - Math.pow(0.5, 1 / x.sol.fleetHalfLifeYears),
    formula: (r) => `1-0.5^(1/${r.P.fleetHalfLifeYears})`,
  },

  // ---- Cloud/hybrid
  // Retention scales the license along retentionMultiplier, unless this
  // vendor's price doesn't depend on retention.
  {
    key: "retFactor", label: "License retention multiplier", format: "factor", models: CLOUD,
    note: "(days/30)^0.4, from 30 days up; 1 for flat-priced licenses.",
    value: (x) => (x.sol.retentionPricing === "flat" ? 1 : retentionMultiplier(x.scn.retentionDays)),
    formula: (r) => `IF(${r.P.retentionPricing}="${RETENTION.flat}",1,(MAX(${r.S.retentionDays},30)/30)^0.4)`,
  },
  // Charged as a lump sum at purchase/renewal (year 0, then every term), not
  // smoothed: a 5-year license is a single 5-year payment.
  {
    key: "termCost", label: "License per camera per term, after discount", format: "usdCents", models: CLOUD,
    value: (x) => x.sol.tierPrice * x.d.retFactor * x.d.discLic,
    formula: (r) => `${r.P.tierPrice}*${r.d("retFactor")}*${r.d("discLic")}`,
  },
  // Not storage-driven, so not scaled by retention, but discounted; charged
  // every year regardless of where the term-renewal cycle is.
  {
    key: "addon", label: "Support/analytics add-on per camera per year, after discount", format: "usdCents", models: CLOUD,
    value: (x) => x.sol.supportAddonPerCamYr * x.d.discLic,
    formula: (r) => `${r.P.supportAddonPerCamYr}*${r.d("discLic")}`,
  },
  // A connector/NVR-style box is needed whenever cameras other than the
  // vendor's own native ones are in use; native ("ripReplace") cameras talk
  // to the cloud directly.
  {
    key: "hasConnector", label: "Uses connector appliances (1 = yes)", format: "flag", models: CLOUD,
    value: (x) => b01(x.sol.migrationStrategy === "connector"),
    formula: (r) => `IF(${r.P.migrationStrategy}="${MIGRATION.connector}",1,0)`,
  },
  // A vendor with several connector models uses the cheapest that covers the
  // cameras at this retention (the Inputs sheet sizes each one); otherwise
  // the single applianceCost/applianceCapacity apply.
  {
    key: "optCount", label: "Connector models listed", format: "int", models: CLOUD,
    note: "With any listed, the cheapest that covers the cameras at this retention is used.",
    value: (x) => x.sol.applianceOptions.length,
    formula: (r) => (r.appliance ? `COUNT(${r.appliance.price})` : 0),
  },
  {
    key: "unitCost", label: "Connector price per unit (list)", format: "usd", models: CLOUD,
    value: (x) => (x.d.optCount ? chooseApplianceOption(x.sol.applianceOptions, x.scn)!.option.cost : x.sol.applianceCost),
    formula: (r) => (r.appliance
      ? `IF(${r.d("optCount")}>0,INDEX(${r.appliance.price},MATCH(MIN(${r.appliance.total}),${r.appliance.total},0)),${r.P.applianceCost})`
      : r.P.applianceCost),
  },
  // At least one box per site (a connector is physically local to the
  // cameras it serves), or more if the camera count demands it.
  {
    key: "units", label: "Connector appliances", format: "int", models: CLOUD, note: "At least one per site.",
    value: (x) => (x.d.optCount
      ? chooseApplianceOption(x.sol.applianceOptions, x.scn)!.units
      : Math.max(x.scn.sites, Math.ceil(x.scn.cameras / x.sol.applianceCapacity))),
    formula: (r) => {
      const single = `MAX(${r.S.sites},ROUNDUP(${r.S.cameras}/${r.P.applianceCapacity},0))`;
      return r.appliance
        ? `IF(${r.d("optCount")}>0,INDEX(${r.appliance.units},MATCH(MIN(${r.appliance.total}),${r.appliance.total},0)),${single})`
        : single;
    },
  },
  {
    key: "hwCycle", label: "Appliance refresh cycle (yrs)", format: "int", models: CLOUD,
    value: (x) => x.sol.applianceRefreshCycleYears,
    formula: (r) => r.P.applianceRefreshCycleYears,
  },
  // "Years until next refresh" describes hardware already installed and
  // aging, so only the incumbent uses it. A side that buys new hardware at
  // year 0 gets its first refresh one full cycle later.
  {
    key: "firstHw", label: "First appliance refresh in year", format: "int", models: CLOUD,
    note: "The incumbent's follows its years until next refresh; a new deployment's comes one cycle after year 0.",
    value: (x) => (x.isInc ? x.sol.yearsUntilNextApplianceRefresh : x.d.hwCycle),
    formula: (r) => `IF(${r.d("isInc")}=1,${r.P.yearsUntilNextApplianceRefresh},${r.d("hwCycle")})`,
  },
  // Renewals: every term after year 0 for a new purchase; for the incumbent,
  // starting when its current term actually ends.
  {
    key: "firstRenewal", label: "First license renewal in year", format: "int", models: CLOUD,
    value: (x) => (x.isInc && x.sol.yearsUntilLicenseRenewal !== undefined ? x.sol.yearsUntilLicenseRenewal : x.sol.tierYears),
    formula: (r) => `IF(AND(${r.d("isInc")}=1,ISNUMBER(${r.P.yearsUntilLicenseRenewal})),${r.P.yearsUntilLicenseRenewal},${r.P.tierYears})`,
  },

  // ---- On-prem
  {
    key: "nSrv", label: "Recording servers", format: "int", models: ONPREM, note: "At least one per site, plus spares.",
    value: (x) => Math.max(x.scn.sites, Math.ceil(x.scn.cameras / x.sol.serverCapacity)) + x.scn.spareServers,
    formula: (r) => `MAX(${r.S.sites},ROUNDUP(${r.S.cameras}/${r.P.serverCapacity},0))+${r.S.spareServers}`,
  },
  // Each active (non-spare) recording server holds its share of the footage
  // on its own array, so a RAID level's minimum drive count applies per
  // server: five small sites on RAID 10 need five 4-drive arrays, not one.
  {
    key: "activeServers", label: "Active (non-spare) recording servers", format: "int", models: ONPREM,
    value: (x) => Math.max(1, x.d.nSrv - x.scn.spareServers),
    formula: (r) => `MAX(1,${r.d("nSrv")}-${r.S.spareServers})`,
  },
  // Everything an on-prem build (or refresh) buys: recording servers plus any
  // management servers, each with its server software.
  {
    key: "serverUnits", label: "Servers bought (recording + management)", format: "int", models: ONPREM,
    value: (x) => x.d.nSrv + x.sol.managementServers,
    formula: (r) => `${r.d("nSrv")}+${r.P.managementServers}`,
  },
  {
    key: "analyticsOn", label: "Includes analytics (1 = yes)", format: "flag", models: ONPREM,
    value: (x) => b01(x.sol.analyticsEnabled === true),
    formula: (r) => `IF(${r.P.analyticsEnabled}="${YES}",1,0)`,
  },
  {
    key: "analyticsUnits", label: "Analytics appliances", format: "int", models: ONPREM,
    value: (x) => (x.d.analyticsOn ? Math.ceil(x.scn.cameras / x.sol.analyticsApplianceCapacity) : 0),
    formula: (r) => `${r.d("analyticsOn")}*ROUNDUP(${r.S.cameras}/${r.P.analyticsApplianceCapacity},0)`,
  },
  {
    key: "tbUsable", label: "Usable storage needed (TB)", format: "num", models: ONPREM, note: "Cameras × bitrate × retention × overhead.",
    value: (x) => (x.scn.cameras * (x.scn.bitrateMbps / 8) * 86400 * x.scn.retentionDays) / 1e6 * x.scn.storageOverheadMultiplier,
    formula: (r) => `${r.S.cameras}*(${r.S.bitrateMbps}/8)*86400*${r.S.retentionDays}/1000000*${r.S.storageOverheadMultiplier}`,
  },
  // Whole drives, per active server's array; see drivesForArray.
  {
    key: "dataDrives", label: "Data drives per active server", format: "int", models: ONPREM,
    value: (x) => dataDrives(x.d.tbUsable / x.d.activeServers, x.scn.driveCapacityTb),
    formula: (r) => `MAX(1,ROUNDUP(${r.d("tbUsable")}/${r.d("activeServers")}/MAX(1,${r.S.driveCapacityTb}),0))`,
  },
  {
    key: "parity", label: "Parity drives per RAID 5/6 array", format: "int", models: ONPREM,
    value: (x) => raidParity(x.sol.raidLevel),
    formula: (r) => `IF(${r.P.raidLevel}="${RAID.raid5}",1,IF(${r.P.raidLevel}="${RAID.raid6}",2,0))`,
  },
  {
    key: "drivesRaw", label: "Drives per server before the RAID minimum", format: "int", models: ONPREM,
    note: "Mirrors double the data drives; RAID 5/6 add parity drives per array.",
    value: (x) => drivesBeforeMinimum(x.d.dataDrives, x.sol.raidLevel, x.sol.raidArrayDrives),
    formula: (r) => `IF(OR(${r.P.raidLevel}="${RAID.raid1}",${r.P.raidLevel}="${RAID.raid10}"),${r.d("dataDrives")}*2,` +
      `IF(${r.d("parity")}>0,${r.d("dataDrives")}+ROUNDUP(${r.d("dataDrives")}/MAX(1,${r.P.raidArrayDrives}-${r.d("parity")}),0)*${r.d("parity")},${r.d("dataDrives")}))`,
  },
  {
    key: "minDrives", label: "Minimum drives for this RAID level", format: "int", models: ONPREM,
    value: (x) => RAID_MIN_DRIVES[x.sol.raidLevel],
    formula: (r) => `IF(OR(${r.P.raidLevel}="${RAID.raid10}",${r.P.raidLevel}="${RAID.raid6}"),4,IF(${r.P.raidLevel}="${RAID.raid5}",3,` +
      `IF(OR(${r.P.raidLevel}="${RAID.raid1}",${r.P.raidLevel}="${RAID.raid0}"),2,1)))`,
  },
  {
    key: "drivesPerServer", label: "Drives per active server", format: "int", models: ONPREM,
    value: (x) => Math.max(x.d.minDrives, x.d.drivesRaw),
    formula: (r) => `MAX(${r.d("minDrives")},${r.d("drivesRaw")})`,
  },
  {
    key: "tbBilled", label: "Storage bought (TB, whole drives)", format: "num", models: ONPREM,
    value: (x) => x.d.drivesPerServer * x.d.activeServers * x.scn.driveCapacityTb,
    formula: (r) => `${r.d("drivesPerServer")}*${r.d("activeServers")}*${r.S.driveCapacityTb}`,
  },
  {
    key: "hwPurchase", label: "Hardware purchase at today's prices, after discount", format: "usd", models: ONPREM,
    note: "Servers with their software, storage, and analytics appliances.",
    value: (x) => (x.sol.serverCost + x.sol.serverSoftwareCost) * x.d.disc * x.d.serverUnits + x.sol.storageCostPerTB * x.d.disc * x.d.tbBilled +
      x.sol.analyticsApplianceCost * x.d.disc * x.d.analyticsUnits,
    formula: (r) => `(${r.P.serverCost}+${r.P.serverSoftwareCost})*${r.d("disc")}*${r.d("serverUnits")}+${r.P.storageCostPerTB}*${r.d("disc")}*${r.d("tbBilled")}` +
      `+${r.P.analyticsApplianceCost}*${r.d("disc")}*${r.d("analyticsUnits")}`,
  },
  // A fresh on-prem deployment buys its perpetual license at year 0; only
  // the support renewal (and any analytics subscription) recurs.
  {
    key: "perpetual", label: "Perpetual licenses, after discount", format: "usd", models: ONPREM, note: "Bought at year 0 unless this is the incumbent.",
    value: (x) => (x.sol.baseLicense + x.sol.deviceLicense * x.scn.cameras + x.d.analyticsOn * x.sol.analyticsSoftwareCostPerCam * x.scn.cameras) * x.d.discLic,
    formula: (r) => `(${r.P.baseLicense}+${r.P.deviceLicense}*${r.S.cameras}+${r.d("analyticsOn")}*${r.P.analyticsSoftwareCostPerCam}*${r.S.cameras})*${r.d("discLic")}`,
  },
  {
    key: "care", label: "Support renewal per year, after discount", format: "usd", models: ONPREM,
    value: (x) => (x.sol.baseLicense + x.sol.deviceLicense * x.scn.cameras) * x.d.discLic * (x.sol.carePct / 100),
    formula: (r) => `(${r.P.baseLicense}+${r.P.deviceLicense}*${r.S.cameras})*${r.d("discLic")}*(${r.P.carePct}/100)`,
  },
  {
    key: "analyticsSub", label: "Analytics subscription per year, after discount", format: "usd", models: ONPREM,
    value: (x) => x.d.analyticsOn * x.sol.analyticsSoftwareCostPerCamYr * x.scn.cameras * x.d.discLic,
    formula: (r) => `${r.d("analyticsOn")}*${r.P.analyticsSoftwareCostPerCamYr}*${r.S.cameras}*${r.d("discLic")}`,
  },
  {
    key: "hwCycle", label: "Hardware refresh cycle (yrs)", format: "int", models: ONPREM,
    value: (x) => x.sol.refreshCycleYears,
    formula: (r) => r.P.refreshCycleYears,
  },
  {
    key: "firstHw", label: "First hardware refresh in year", format: "int", models: ONPREM,
    note: "The incumbent's follows its years until next refresh; a new deployment's comes one cycle after year 0.",
    value: (x) => (x.isInc ? x.sol.yearsUntilNextRefresh : x.d.hwCycle),
    formula: (r) => `IF(${r.d("isInc")}=1,${r.P.yearsUntilNextRefresh},${r.d("hwCycle")})`,
  },

  // ---- Business impact (lib/verticals.ts): a change from today, so none for
  // the incumbent, which is today. The spreadsheet's business impact table
  // zeroes the incumbent's column itself.
  {
    key: "impactSavings", label: "Business impact savings per year (today's prices)", format: "usd",
    note: "From the Inputs sheet's business impact table, when an industry is selected.",
    value: (x) => x.outcomes.savings,
    formula: (r) => r.impact?.savings ?? 0,
  },
  {
    key: "impactCosts", label: "Business impact added costs per year (today's prices)", format: "usd",
    value: (x) => x.outcomes.costs,
    formula: (r) => r.impact?.costs ?? 0,
  },
];

// The camera fleet, tracked as batches by install year. Each camera fails at
// a constant yearly rate set by its batch's half-life, and a failure inside
// that batch's warranty window costs only replacement labor. Every failure
// is replaced at this solution's own camera price and becomes a new batch
// that can fail in turn (the old model only ever decayed the original
// fleet, undercounting swaps by a quarter to a half).
//
// The app simulates the batches year by year; the spreadsheet lays the same
// batches out as a table, one row per install batch (FLEET_SHEET), in closed
// form: a batch of size n with yearly failure share d loses
// n(1-d)^(t-1)d cameras in its t-th year.
export function simulateFleet(x: ModelContext): ModelContext["fleet"] {
  const start: Cohort = { size: x.scn.cameras, installedYear: x.d.startInstalled, halfLife: x.d.startHalfLife, warrantyYears: x.d.startWarranty };
  const cohorts = [start];
  const failed = [0], outOfWarranty = [0];
  let swaps = 0;
  for (let y = 1; y <= x.H; y++) {
    const year = advanceCohorts(cohorts, y, { halfLife: x.sol.fleetHalfLifeYears, warrantyYears: x.sol.warrantyYears });
    failed.push(year.failed);
    outOfWarranty.push(year.outOfWarranty);
    swaps += year.failed;
  }
  return { failed, outOfWarranty, startRemaining: start.size, swaps };
}

export const FLEET_SHEET = {
  // The starting fleet, `size` cameras, fails from year 1.
  start: (r: ModelRefs, size: string, y: number): Formula =>
    y === 0 ? 0 : `${size}*(1-${r.d("startDecay")})^(${r.year(y)}-1)*${r.d("startDecay")}`,
  // A replacement batch installed in year k fails from year k+1.
  batch: (r: ModelRefs, size: string, installed: string, k: number, y: number): Formula =>
    y <= k ? 0 : `${size}*(1-${r.d("replDecay")})^(${r.year(y)}-${installed}-1)*${r.d("replDecay")}`,
};

// applianceOptionFit as Inputs-sheet formulas, one row per connector model.
// Rows with no price (spares for new models) stay blank, so COUNT and MIN
// skip them. A blank or 0 retention means capacity doesn't depend on it.
export const APPLIANCE_SHEET = {
  effCap: (S: ModelRefs["S"], price: string, capacity: string, days: string) =>
    `IF(ISNUMBER(${price}),MAX(1,ROUNDDOWN(${capacity}*IF(ISNUMBER(${days}),IF(${days}>0,MIN(1,${days}/${S.retentionDays}),1),1),0)),"")`,
  units: (S: ModelRefs["S"], price: string, effCap: string) =>
    `IF(ISNUMBER(${price}),MAX(${S.sites},ROUNDUP(${S.cameras}/${effCap},0)),"")`,
  total: (price: string, units: string) => `IF(ISNUMBER(${price}),${units}*${price},"")`,
};

export const LINES: LineEntry[] = [
  // Escalation factors; every amount is escalated as it's assigned (year 0's are all 1).
  { section: "Escalation (price factor vs. year 0)" },
  {
    key: "labor", label: "Labor & services", format: "factor",
    value: (x, y) => Math.pow(1 + x.scn.laborEscalationPct / 100, y),
    formula: (r, y) => `(1+${r.S.laborEscalationPct}/100)^${r.year(y)}`,
  },
  {
    key: "hw", label: "Hardware", format: "factor",
    value: (x, y) => Math.pow(1 + x.scn.hardwareEscalationPct / 100, y),
    formula: (r, y) => `(1+${r.S.hardwareEscalationPct}/100)^${r.year(y)}`,
  },
  {
    key: "lic", label: "Licenses & subscriptions", format: "factor",
    value: (x, y) => Math.pow(1 + x.scn.licenseEscalationPct / 100, y),
    formula: (r, y) => `(1+${r.S.licenseEscalationPct}/100)^${r.year(y)}`,
  },

  // What's bought when: year 0 for a new deployment, and for the incumbent
  // only if its refresh or renewal is due now (0 years away); then on each
  // refresh/renewal cycle, never in the horizon's final year (see
  // isRefreshYear). Before the "due now" case existed, an incumbent at 0
  // years bought nothing until a full cycle later.
  { section: "Purchases (1 = bought this year)" },
  {
    key: "hwBuy", label: "Hardware bought", format: "flag",
    note: "Year 0 for a new deployment, or for the incumbent when its refresh is due now; then each refresh; never in the final year.",
    // ripReplace has no connector appliance, so no cloud hardware at all.
    value: (x, y) => (isCloud(x) ? x.d.hasConnector : 1) *
      (y === 0 ? 1 - x.d.isInc + x.d.isInc * b01(x.d.firstHw === 0) : b01(isRefreshYear(y, x.d.firstHw, x.d.hwCycle, x.H))),
    formula: (r, y) => (r.model === "cloud" ? `${r.d("hasConnector")}*` : "") +
      (y === 0 ? `(1-${r.d("isInc")}+${r.d("isInc")}*IF(${r.d("firstHw")}=0,1,0))` : refreshFormula(r, y, r.d("firstHw"), r.d("hwCycle"))),
  },
  {
    key: "term", label: "License term bought", format: "flag", models: CLOUD,
    note: "Year 0 for a new deployment, or for the incumbent when its renewal is due now; then each renewal; never in the final year.",
    value: (x, y) => (y === 0 ? 1 - x.d.isInc + x.d.isInc * b01(x.d.firstRenewal === 0) : b01(isRefreshYear(y, x.d.firstRenewal, x.sol.tierYears, x.H))),
    formula: (r, y) => (y === 0
      ? `1-${r.d("isInc")}+${r.d("isInc")}*IF(${r.d("firstRenewal")}=0,1,0)`
      : refreshFormula(r, y, r.d("firstRenewal"), r.P.tierYears)),
  },

  { section: "Camera fleet" },
  {
    key: "failed", label: "Cameras failing", format: "num", total: true, note: "All install batches; see the table at the bottom.",
    value: (x, y) => x.fleet.failed[y],
    formula: (r, y) => {
      if (y === 0) return 0;
      const batches = r.fleet.batches(y);
      return `SUM(${r.fleet.start(y)}${batches ? `,${batches}` : ""})`;
    },
  },
  {
    key: "oow", label: "Failures out of warranty", format: "num", total: true, note: "Only these cost a new camera; every failure costs labor.",
    value: (x, y) => x.fleet.outOfWarranty[y],
    formula: (r, y) => {
      if (y === 0) return 0;
      const start = `IF(${r.year(y)}-${r.d("startInstalled")}>${r.d("startWarranty")},${r.fleet.start(y)},0)`;
      const batches = r.fleet.batches(y);
      return batches ? `${start}+SUMIF(${r.fleet.installed},"<"&(${r.year(y)}-${r.P.warrantyYears}),${batches})` : start;
    },
  },

  { section: "Costs by category" },
  // Every failure costs replacement labor; only out-of-warranty ones cost
  // the camera too. Year 0 buys a fleet only if this side buys cameras.
  {
    key: "Cameras", label: "Cameras", format: "usd", total: true,
    value: (x, y) => (y === 0
      ? (1 - x.d.isInc) * x.d.buys * x.scn.cameras * x.sol.cameraCost * x.d.disc * x.at("hw", y)
      : x.at("failed", y) * x.sol.replacementInstallLaborCost * x.at("labor", y) + x.at("oow", y) * x.sol.cameraCost * x.d.disc * x.at("hw", y)),
    formula: (r, y) => (y === 0
      ? `(1-${r.d("isInc")})*${r.d("buys")}*${r.S.cameras}*${r.P.cameraCost}*${r.d("disc")}*${r.at("hw", y)}`
      : `${r.at("failed", y)}*${r.P.replacementInstallLaborCost}*${r.at("labor", y)}+${r.at("oow", y)}*${r.P.cameraCost}*${r.d("disc")}*${r.at("hw", y)}`),
  },
  {
    key: "Hardware (initial & refresh)", label: "Hardware (initial & refresh)", format: "usd", total: true,
    value: (x, y) => (isCloud(x)
      ? x.at("hwBuy", y) * x.d.unitCost * x.d.disc * x.d.units * x.at("hw", y)
      : x.at("hwBuy", y) * x.d.hwPurchase * x.at("hw", y)),
    formula: (r, y) => (r.model === "cloud"
      ? `${r.at("hwBuy", y)}*${r.d("unitCost")}*${r.d("disc")}*${r.d("units")}*${r.at("hw", y)}`
      : `${r.at("hwBuy", y)}*${r.d("hwPurchase")}*${r.at("hw", y)}`),
  },
  // Cloud: the first term up front, then each renewal as a lump sum, plus the
  // yearly add-on. On-prem: the perpetual license at year 0, then the
  // support renewal and any analytics subscription every year.
  {
    key: "Licenses/subscription", label: "Licenses/subscription", format: "usd", total: true,
    value: (x, y) => {
      if (isCloud(x)) {
        if (y === 0) return x.at("term", y) * x.d.termCost * x.scn.cameras * x.at("lic", y);
        return (x.d.addon * x.scn.cameras + x.at("term", y) * x.d.termCost * x.scn.cameras) * x.at("lic", y);
      }
      if (y === 0) return (1 - x.d.isInc) * x.d.perpetual * x.at("lic", y);
      return (x.d.care + x.d.analyticsSub) * x.at("lic", y);
    },
    formula: (r, y) => {
      if (r.model === "cloud") {
        if (y === 0) return `${r.at("term", y)}*${r.d("termCost")}*${r.S.cameras}*${r.at("lic", y)}`;
        return `(${r.d("addon")}*${r.S.cameras}+${r.at("term", y)}*${r.d("termCost")}*${r.S.cameras})*${r.at("lic", y)}`;
      }
      if (y === 0) return `(1-${r.d("isInc")})*${r.d("perpetual")}*${r.at("lic", y)}`;
      return `(${r.d("care")}+${r.d("analyticsSub")})*${r.at("lic", y)}`;
    },
  },
  // Install labor for a new fleet, or onboarding labor when the existing
  // cameras are kept and added to the new system.
  {
    key: "Installation", label: "Installation", format: "usd", total: true,
    value: (x, y) => (y === 0 ? (1 - x.d.isInc) * x.sol.bulkInstallLaborCost * x.scn.cameras * x.at("labor", y) : 0),
    formula: (r, y) => (y === 0 ? `(1-${r.d("isInc")})*${r.P.bulkInstallLaborCost}*${r.S.cameras}*${r.at("labor", y)}` : 0),
  },
  {
    key: "Truck rolls", label: "Truck rolls", format: "usd", total: true,
    value: (x, y) => (y === 0 ? 0 : x.scn.sites * x.sol.truckRollsPerSiteYr * x.scn.truckRollCost * x.at("labor", y)),
    formula: (r, y) => (y === 0 ? 0 : `${r.S.sites}*${r.P.truckRollsPerSiteYr}*${r.S.truckRollCost}*${r.at("labor", y)}`),
  },
  {
    key: "Admin labor", label: "Admin labor", format: "usd", total: true,
    value: (x, y) => (y === 0 ? 0 : x.sol.adminHrsPerCamYr * x.scn.cameras * x.scn.adminRate * x.at("labor", y)),
    formula: (r, y) => (y === 0 ? 0 : `${r.P.adminHrsPerCamYr}*${r.S.cameras}*${r.S.adminRate}*${r.at("labor", y)}`),
  },
  {
    key: "Investigations", label: "Investigations", format: "usd", total: true,
    value: (x, y) => (y === 0 ? 0 : x.scn.investigationsPerMonth * 12 * x.sol.investigationHrsPerIncident * x.scn.investigatorRate * x.at("labor", y)),
    formula: (r, y) => (y === 0 ? 0 : `${r.S.investigationsPerMonth}*12*${r.P.investigationHrsPerIncident}*${r.S.investigatorRate}*${r.at("labor", y)}`),
  },
  {
    key: "Network / bandwidth", label: "Network / bandwidth", format: "usd", total: true,
    value: (x, y) => (y === 0 ? 0 : x.scn.sites * x.sol.networkCostPerSiteYr * x.at("labor", y)),
    formula: (r, y) => (y === 0 ? 0 : `${r.S.sites}*${r.P.networkCostPerSiteYr}*${r.at("labor", y)}`),
  },
  // Watts per camera running all year (8,760 hours = 8.76 kWh per watt), at
  // the scenario's rate. Grows with labor and services, like the network line,
  // since there's no separate energy escalation rate.
  {
    key: "Electricity", label: "Electricity", format: "usd", total: true,
    value: (x, y) => (y === 0 ? 0 : x.scn.cameras * x.sol.powerWattsPerCam * 8.76 * x.scn.electricityRatePerKwh * x.at("labor", y)),
    formula: (r, y) => (y === 0 ? 0 : `${r.S.cameras}*${r.P.powerWattsPerCam}*8.76*${r.S.electricityRatePerKwh}*${r.at("labor", y)}`),
  },
  // User-authored, so they always apply, incumbent or not, at face value (no
  // vendor discount), growing with labor and services.
  {
    key: "Misc / other", label: "Misc / other", format: "usd", total: true,
    value: (x, y) => miscForYear(x.sol.miscItems, y) * x.at("labor", y),
    formula: (r, y) => {
      const m = r.misc;
      const timed = `SUMIF(${m.timing},"${y === 0 ? TIMING.upfront : TIMING.recurring}",${m.amount})`;
      return `(${timed}+SUMIFS(${m.amount},${m.timing},"${TIMING.once}",${m.year},${r.year(y)}))*${r.at("labor", y)}`;
    },
  },
  // Recurring from year 1, once the system is in, and escalated with labor
  // and services, since losses and claims track wages and prices.
  {
    key: "Business impact: savings", label: "Business impact: savings", format: "usd", total: true,
    value: (x, y) => (y === 0 ? 0 : x.d.impactSavings * x.at("labor", y)),
    formula: (r, y) => (y === 0 ? 0 : `${r.d("impactSavings")}*${r.at("labor", y)}`),
  },
  {
    key: "Business impact: added costs", label: "Business impact: added costs", format: "usd", total: true,
    value: (x, y) => (y === 0 ? 0 : x.d.impactCosts * x.at("labor", y)),
    formula: (r, y) => (y === 0 ? 0 : `${r.d("impactCosts")}*${r.at("labor", y)}`),
  },
  // Booked in the final year from RESIDUAL below. The app leaves it at 0 here
  // and lets tallyYears book it, as for every calculator.
  {
    key: "Residual value (credit)", label: "Residual value (credit)", format: "usd", total: true,
    value: () => 0,
    formula: (r, y) => (y === r.H ? `-${r.d("residual")}` : 0),
  },
];

// The unused share of every lump purchase that outlasts the horizon,
// straight-line over its service life (see residualCredit). Lumps are each
// year's hardware purchase (life: its refresh cycle) and, for cloud, each
// license term bought (life: the term).
export const RESIDUAL_LINES: LineEntry[] = [
  { section: "Residual value (unused service life at the horizon's end)" },
  {
    key: "hwUnused", label: "Hardware bought this year: share of its life unused", format: "factor", note: "Applied to the hardware cost line above.",
    value: (x, y) => unusedShare(x.d.hwCycle, x.H, y),
    formula: (r, y) => unusedShareFormula(r, r.d("hwCycle"), y),
  },
  {
    key: "termLump", label: "License term bought this year (lump)", format: "usd", models: CLOUD,
    value: (x, y) => x.at("term", y) * x.d.termCost * x.scn.cameras * x.at("lic", y),
    formula: (r, y) => `${r.at("term", y)}*${r.d("termCost")}*${r.S.cameras}*${r.at("lic", y)}`,
  },
  {
    key: "termUnused", label: "License term bought this year: share unused", format: "factor", models: CLOUD,
    value: (x, y) => unusedShare(x.sol.tierYears, x.H, y),
    formula: (r, y) => unusedShareFormula(r, r.P.tierYears, y),
  },
];

const unusedShare = (life: number, H: number, y: number) => (life - Math.min(life, Math.max(0, H - y))) / life;
const unusedShareFormula = (r: ModelRefs, life: string, y: number) =>
  `(${life}-MIN(${life},MAX(0,${r.S.horizonYears}-${r.year(y)})))/${life}`;

export const RESIDUAL: DerivedDef = {
  key: "residual", label: "Residual value credit", format: "usd",
  note: "Credited in the final year when the scenario's residual-value option is on.",
  value: (x) => {
    if (x.scn.creditResidualValue === false) return 0;
    const lumps: Lump[] = [];
    for (let y = 0; y <= x.H; y++) {
      const hardware = x.at("Hardware (initial & refresh)", y);
      if (hardware > 0) lumps.push({ year: y, amount: hardware, life: x.d.hwCycle });
      if (isCloud(x) && x.at("term", y)) lumps.push({ year: y, amount: x.at("termLump", y), life: x.sol.tierYears });
    }
    return residualCredit(lumps, x.H);
  },
  formula: (r) => `IF(${r.S.creditResidualValue}="${YES}",SUMPRODUCT(${r.span("Hardware (initial & refresh)")},${r.span("hwUnused")})` +
    (r.model === "cloud" ? `+SUMPRODUCT(${r.span("termLump")},${r.span("termUnused")})` : "") + ",0)",
};

const applies = (entry: { models?: DeploymentModel[] }, model: DeploymentModel) => !entry.models || entry.models.includes(model);
export const derivedFor = (model: DeploymentModel) => DERIVED.filter((d) => applies(d, model));
export const linesFor = (entries: LineEntry[], model: DeploymentModel) => entries.filter((e) => applies(e, model));
const isLine = (e: LineEntry): e is LineDef => "key" in e;

export function computeSolution(
  rawScenario: ScenarioInputs,
  rawSol: SolutionInputs,
  isIncumbent = false,
  rawExistingFleet?: SolutionInputs
): SolutionResult {
  // Every input is clamped to a usable range first (see lib/sanitize.ts), so
  // nothing in the definitions above needs its own guard against a cleared
  // or missing field.
  const scn = sanitizeScenario(rawScenario);
  const sol = sanitizeSolution(rawSol);
  const existingFleet = rawExistingFleet && sanitizeSolution(rawExistingFleet);
  const outcomes = isIncumbent ? [] : annualOutcomes(scn, sol);
  const lineValues: Record<string, number[]> = {};
  const x: ModelContext = {
    scn, sol, existingFleet, isInc: isIncumbent, H: scn.horizonYears,
    outcomes: {
      savings: outcomes.reduce((sum, o) => sum + Math.min(0, o.amount), 0),
      costs: outcomes.reduce((sum, o) => sum + Math.max(0, o.amount), 0),
    },
    d: {},
    at: (key, y) => lineValues[key][y],
    fleet: { failed: [], outOfWarranty: [], startRemaining: 0, swaps: 0 },
  };
  for (const def of derivedFor(sol.model)) x.d[def.key] = def.value(x);
  x.fleet = simulateFleet(x);
  const lines = [...linesFor(LINES, sol.model), ...linesFor(RESIDUAL_LINES, sol.model)].filter(isLine);
  for (let y = 0; y <= x.H; y++) {
    for (const line of lines) (lineValues[line.key] ??= [])[y] = line.value(x, y);
  }
  const credit = RESIDUAL.value(x);
  const years = Array.from({ length: x.H + 1 }, (_, y) => Object.fromEntries(CATEGORIES.map((c) => [c, lineValues[c][y]])) as Record<Category, number>);
  const totals = splitTotals(tallyYears(CATEGORIES, years, credit, "Residual value (credit)"), STAFF_TIME_CATEGORIES, OUTCOME_CATEGORIES);

  const cams = scn.cameras;
  const connector = sol.model === "cloud" && sol.migrationStrategy === "connector";
  const hardware: HardwareFootprint = {
    unitsLabel: sol.model === "onprem" ? "Recording servers" : connector ? "Connector appliances" : null,
    units: sol.model === "onprem" ? x.d.nSrv : connector ? x.d.units : 0,
    unitsModel: connector && x.d.optCount ? chooseApplianceOption(sol.applianceOptions, scn)!.option.label || null : null,
    // tbBilled, the whole-drive figure the cost lines actually charged for.
    storageTB: sol.model === "onprem" ? x.d.tbBilled : null,
    managementServers: sol.model === "onprem" ? sol.managementServers : 0,
    cameras: cams,
    cameraSwaps: x.fleet.swaps,
    originalFleetReplacedPct: cams > 0 ? Math.min(100, Math.max(0, (100 * (cams - x.fleet.startRemaining)) / cams)) : 0,
  };
  return { ...totals, hardware };
}

export type ComparisonResult = ComparisonTotals<Category, SolutionResult>;

export function computeComparison(rawScenario: ScenarioInputs, solA: SolutionInputs, solB: SolutionInputs): ComparisonResult {
  const scenario = sanitizeScenario(rawScenario);
  // A side that keeps the cameras already on site is keeping the incumbent's
  // hardware when the other side is the incumbent, so its starting fleet uses
  // the incumbent's reliability and warranty (see computeSolution's cohorts).
  // computeSolution ignores this for a side that buys new cameras.
  const reusing = scenario.existingCamerasReusable !== false;
  const existingFleetForA = reusing && scenario.incumbent === "b" ? solB : undefined;
  const existingFleetForB = reusing && scenario.incumbent === "a" ? solA : undefined;
  const a = computeSolution(scenario, solA, scenario.incumbent === "a", existingFleetForA);
  const b = computeSolution(scenario, solB, scenario.incumbent === "b", existingFleetForB);
  return compareTotals(CATEGORIES, a, b, scenario.horizonYears);
}
