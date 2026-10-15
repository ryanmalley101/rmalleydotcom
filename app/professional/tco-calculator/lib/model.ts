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
export const MODEL_VERSION = 2;

export type DeploymentModel = "cloud" | "onprem";
export type IncumbentChoice = "none" | "a" | "b";
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

// On-prem storage redundancy. Affects only how much *raw* storage has to be
// bought to get the fleet's usable/needed TB, not the recording server count.
export type RaidLevel = "none" | "raid0" | "raid1" | "raid10";
// Raw-storage multiplier needed to get one TB of usable capacity. RAID 0 and
// no RAID both need exactly the usable capacity (no redundancy overhead);
// RAID 1 and RAID 10 both mirror everything, doubling the raw capacity
// needed to survive a drive failure.
const RAID_STORAGE_MULTIPLIER: Record<RaidLevel, number> = {
  none: 1,
  raid0: 1,
  raid1: 2,
  raid10: 2,
};

// Minimum physical drives a valid array of this level needs, regardless of
// how little raw capacity is actually required — you can't build a mirrored
// array on one drive, and RAID 10 specifically needs at least two mirrored
// pairs (4 drives) to actually stripe across; a "2-drive RAID 10" is just
// RAID 1 under a bigger name. Only matters for the drive *count* used by the
// power-draw and storage-billing math below — the $/TB assumption itself
// (storageCostPerTB) intentionally stays continuous per-TB (see README's
// "avoiding artificial cost cliffs"), this doesn't change that, it changes
// how many TB actually get billed.
const RAID_MIN_DRIVES: Record<RaidLevel, number> = {
  none: 1,
  raid0: 2,
  raid1: 2,
  raid10: 4,
};

// Converts a raw physical TB figure into a whole number of real drives — you
// can't buy or power a fractional drive. RAID 1/RAID 10 mirror in pairs, so
// the count is rounded up to an even number before the RAID_MIN_DRIVES floor
// is applied. driveCapacityTb is a scenario-level assumption (user-editable),
// clamped to a sane positive minimum so a cleared/zeroed input can't divide
// by zero.
function driveCountFor(tbPhysical: number, raidLevel: RaidLevel, driveCapacityTb: number): number {
  const raw = tbPhysical / Math.max(1, driveCapacityTb);
  const isMirrored = raidLevel === "raid1" || raidLevel === "raid10";
  const rounded = isMirrored ? Math.ceil(raw / 2) * 2 : Math.ceil(raw);
  return Math.max(RAID_MIN_DRIVES[raidLevel], rounded);
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
  // Compounding annual growth applied to every recurring cost (subscriptions,
  // labor, truck rolls, refreshes...). Real prices don't hold flat for a
  // 10-15 year horizon.
  annualEscalationPct: number;
  // Which solution (if either) is already deployed. The incumbent skips its
  // year-0 buildout cost; the other solution pays it as a fresh deployment.
  incumbent: IncumbentChoice;
  // Whether the cameras already on site can be kept by a newly deployed
  // solution (a cloud connector, or an on-prem VMS that adds them). false
  // means a new site or cameras that must go: every newly deployed side then
  // buys its full camera fleet at year 0. Defaults to true, which matches how
  // the model behaved before this question existed.
  existingCamerasReusable: boolean;
  // Shared market rates: the operator's own costs, independent of vendor.
  adminRate: number;
  investigatorRate: number;
  truckRollCost: number;
  // See the DEFAULT_* constants above. Resolved via
  // `Number(scenario.x) || DEFAULT_X` in computeSolution, so a missing value
  // (older share link/saved comparison) falls back to the original built-in
  // assumption instead of zeroing out a whole cost line or, for
  // driveCapacityTb specifically, dividing by zero.
  driveCapacityTb: number;
  storageOverheadMultiplier: number;
  spareServers: number;
}

// A free-form misc cost/credit line item — the escape valve for whatever a
// real quote (or a value-justification argument) contains that doesn't fit
// any category above, without inventing a new named category for every
// oddball line a user might want. `amount` can be negative — a workers' comp
// claim reduction, a productivity credit, or any other cost *offset* is just
// a misc item with a negative amount, same mechanism as a misc cost. Applied
// at face value, not multiplied by the vendor's discountPct — these are
// user-authored numbers unrelated to vendor pricing, not a vendor SKU.
export type MiscItemTiming = "upfront" | "recurring";
export interface MiscCostItem {
  id: string;
  label: string;
  amount: number;
  // "upfront": charged once at year 0, same incumbent-zeroing as the rest of
  // that year's buildout cost (nothing new is being deployed for an
  // incumbent, so nothing new to charge/credit). "recurring": charged every
  // year after year 0, escalating like the other recurring lines, regardless
  // of incumbent status (same as the support/care renewal elsewhere).
  timing: MiscItemTiming;
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
  discountPct: number; // off list, this vendor's own negotiated discount

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
  // Frames per second per camera. Per-solution since each side's cameras can
  // run at a different rate; scales on-prem storage sizing relative to the
  // 24fps baseline (bitrate is already a full encoded rate, so this is a
  // secondary adjustment on top of it, not a replacement for it).
  framerateFps: number;

  // Cloud/hybrid only
  migrationStrategy: CloudMigrationStrategy;
  tierPrice: number; // license cost for a term of `tierYears`, this vendor's own term length
  tierYears: number;
  applianceCost: number; // connector/NVR-style appliance, only used when migrationStrategy is "connector"
  applianceCapacity: number;
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

  // On-prem only
  onpremCameraStrategy: OnpremCameraStrategy;
  baseLicense: number;
  deviceLicense: number;
  carePct: number;
  serverCost: number;
  serverCapacity: number;
  storageCostPerTB: number;
  raidLevel: RaidLevel;
  // Per-site, not fleet-wide: an on-prem analytics appliance is deployed at
  // each site individually (it runs against that site's own recording
  // servers), not once for the whole comparison. Multiplies by `sites`
  // wherever it's charged, and recurs on the same refresh cycle as the
  // recording servers/storage.
  analyticsApplianceCost: number;
  // The analytics *software* license, by contrast, is per-camera, not
  // per-site — it's licensed per device analyzed, not per piece of
  // infrastructure. analyticsSoftwareCostPerCam is a one-time purchase,
  // charged alongside baseLicense/deviceLicense at year 0 (same
  // incumbent-zeroing: already-owned for the incumbent, not charged again),
  // and does *not* recur at hardware refresh cycles the way
  // analyticsApplianceCost does — a software license isn't tied to the
  // server hardware it happens to run on. analyticsSoftwareCostPerCamYr is
  // a separate, purely additive ongoing per-camera-per-year cost (defaults
  // to $0), for vendors that also charge a recurring analytics subscription
  // on top of the one-time license.
  analyticsSoftwareCostPerCam: number;
  analyticsSoftwareCostPerCamYr: number;
  refreshCycleYears: number;
  yearsUntilNextRefresh: number;

  // Free-form list of misc cost/credit line items — see MiscCostItem above.
  // Defaults to an empty array; purely additive, never changes any other
  // category's math.
  miscItems: MiscCostItem[];
}

export const CATEGORIES = [
  "Cameras",
  "Hardware (initial & refresh)",
  "Licenses/subscription",
  "Installation",
  "Truck rolls",
  "Admin labor",
  "Investigations",
  "Misc / other",
] as const;
export type Category = (typeof CATEGORIES)[number];

// Categories that estimate internal staff time rather than money actually
// paid out to a vendor or contractor. Kept in every total, but reported
// separately (SolutionResult.staffTimeTotal) because they're the softest,
// least-verifiable numbers in a comparison and often its biggest driver.
export const STAFF_TIME_CATEGORIES: readonly Category[] = ["Admin labor", "Investigations"];

// Continuous replacement for the old 5-step (30/60/90/180/365-day) table.
// Fit as a power curve (days/30)^0.4 against those same reference points
// (30d=1.0x, 60d=1.35x, 90d=1.6x, 180d=2.0x, 365d=2.6x, all within ~5%), so it
// keeps the same "sublinear" shape (retention-driven storage is only part of
// what a cloud license covers, and storage itself gets cheaper per unit at
// higher volumes/cold tiers) without an artificial cliff right at each
// threshold day. On-prem storage cost already scales continuously with days
// via `tbUsable`, this brings cloud licensing in line with that.
function retentionMultiplier(days: number) {
  return Math.pow(Math.max(days, 1) / 30, 0.4);
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
  // Physical (post-RAID-overhead) storage bought, TB. On-prem only; cloud/hybrid
  // storage lives in the vendor's cloud, not something this deployment buys.
  storageTB: number | null;
  cameras: number;
}

export interface SolutionResult {
  totalsByCategory: Record<Category, number>;
  cumulative: number[]; // escalated running total, index = year
  total: number;
  // total split into money paid out vs. estimated internal staff time
  // (STAFF_TIME_CATEGORIES); cashTotal + staffTimeTotal === total.
  cashTotal: number;
  staffTimeTotal: number;
  hardware: HardwareFootprint;
}

export function computeSolution(
  scenario: ScenarioInputs,
  sol: SolutionInputs,
  isIncumbent = false,
  existingFleet?: SolutionInputs
): SolutionResult {
  const { cameras: cams, sites, retentionDays: ret, horizonYears: yrs, bitrateMbps: br, investigationsPerMonth: invMo } = scenario;
  const esc = scenario.annualEscalationPct / 100;
  const disc = 1 - sol.discountPct / 100;
  const tierYears = Math.max(1, sol.tierYears); // guard against a cleared/zeroed input

  // "connector" reuses the *other* side's already-installed camera fleet, not this
  // solution's own hardware, until each unit dies and gets swapped for a native
  // camera (see the CloudMigrationStrategy comment up top). So which cameras are
  // actually failing — and on what schedule — is the *incumbent* fleet's own
  // reliability, not this cloud solution's assumed numbers, whenever there's a
  // real incumbent fleet on the other side to draw that from (computeComparison
  // only passes `existingFleet` when that's true). The replacement unit going in
  // is still this solution's own native camera, though, so its cost/install labor
  // stay `sol.cameraCost`/`sol.replacementInstallLaborCost` below, unchanged.
  const failureSource = sol.model === "cloud" && sol.migrationStrategy === "connector" && existingFleet ? existingFleet : sol;

  // Whether this side buys a camera fleet at year 0 (when it isn't the
  // incumbent): always on a new site, and otherwise only if it chose to
  // replace the existing cameras.
  const buysCameras =
    scenario.existingCamerasReusable === false ||
    (sol.model === "cloud" ? sol.migrationStrategy === "ripReplace" : sol.onpremCameraStrategy === "replace");

  // Resolved storage-billing assumptions — see the ScenarioInputs comment for
  // why the fallback pattern.
  const driveCapacityTb = Number(scenario.driveCapacityTb) || DEFAULT_DRIVE_CAPACITY_TB;
  const storageOverheadMultiplier = Number(scenario.storageOverheadMultiplier) || DEFAULT_STORAGE_OVERHEAD_MULTIPLIER;
  const spareServers = Number(scenario.spareServers) || DEFAULT_SPARE_SERVERS;

  // Charged as a lump sum at purchase/renewal (year 0, then every `tierYears`
  // thereafter), not smoothed evenly across every year of the term — a 5-year
  // license is a single 5-year payment, not a de-facto annual subscription at
  // 1/5th the price. The add-on isn't storage-driven, so it doesn't scale with
  // retentionMultiplier the way the base license does, but the vendor's own
  // negotiated discount still applies to it; unlike the term price, it's
  // named/priced as a genuinely annual cost, so it's charged every year
  // regardless of where the term-renewal cycle is.
  const licenseTermCost = sol.model === "cloud" ? sol.tierPrice * retentionMultiplier(ret) * disc : 0;
  const supportAddonAnnual = sol.model === "cloud" ? sol.supportAddonPerCamYr * disc : 0;
  // At least one box per site (a connector/NVR is physically local to the cameras it
  // serves, you can't split one across sites), or more if total camera count demands it.
  const applianceUnits = sol.model === "cloud" ? Math.max(sites, Math.ceil(cams / Math.max(1, sol.applianceCapacity))) : 0;
  const nSrv =
    sol.model === "onprem" ? Math.max(sites, Math.ceil(cams / Math.max(1, sol.serverCapacity))) + spareServers : 0;
  const tbUsable = (cams * (br / 8) * 86400 * ret) / 1e6 * storageOverheadMultiplier * (sol.framerateFps / 24);
  // Physical drives to buy: usable capacity times RAID overhead (1x for RAID 0/none, 2x for
  // mirrored RAID 1/10).
  const tbPhysical = sol.model === "onprem" ? tbUsable * RAID_STORAGE_MULTIPLIER[sol.raidLevel] : tbUsable;
  // Storage is billed for the whole drives actually bought (respecting each RAID level's
  // drive-count floor via driveCountFor — a small RAID 10 array still needs 4 real drives,
  // and costs like it) rather than the continuous tbPhysical figure. Only matters on-prem;
  // cloud has no drives-you-buy line for this to apply to.
  const tbBilled =
    sol.model === "onprem" ? driveCountFor(tbPhysical, sol.raidLevel, driveCapacityTb) * driveCapacityTb : tbPhysical;
  const careCost = sol.model === "onprem" ? (sol.baseLicense + sol.deviceLicense * cams) * disc * (sol.carePct / 100) : 0;
  // Misc items are applied at face value (no vendor disc), split by timing.
  const miscItems = Array.isArray(sol.miscItems) ? sol.miscItems : [];
  const miscUpfrontTotal = miscItems
    .filter((it) => it.timing === "upfront")
    .reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const miscRecurringTotal = miscItems
    .filter((it) => it.timing === "recurring")
    .reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  // Refresh timing. "Years until next refresh" describes hardware that's
  // already installed and aging, so only the incumbent uses it. A side that
  // buys new hardware at year 0 gets its first refresh one full cycle later;
  // using the offset there too used to buy a brand-new deployment's hardware
  // twice within a couple of years.
  const refreshCycle = Math.max(1, sol.refreshCycleYears);
  const firstRefresh = isIncumbent ? sol.yearsUntilNextRefresh : refreshCycle;
  const applianceCycle = Math.max(1, sol.applianceRefreshCycleYears);
  const firstApplianceRefresh = isIncumbent ? sol.yearsUntilNextApplianceRefresh : applianceCycle;
  const isRefreshYear = (y: number, first: number, cycle: number) => y >= first && (y - first) % cycle === 0 && y < yrs;

  const totalsByCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  const cumulative: number[] = [];
  let running = 0;

  for (let y = 0; y <= yrs; y++) {
    const escalation = Math.pow(1 + esc, y);
    const yearCosts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;

    if (y === 0) {
      // Nothing new is deployed for the incumbent, so its year 0 is empty.
      if (!isIncumbent) {
        // Install labor for a full camera fleet, or onboarding labor when the
        // existing cameras are kept and added to the new system.
        yearCosts["Installation"] = sol.bulkInstallLaborCost * cams;
        if (buysCameras) yearCosts["Cameras"] = cams * sol.cameraCost * disc;
        if (sol.model === "cloud") {
          // A connector/NVR-style box is needed whenever cameras other than the
          // vendor's own native ones are in use; native ("ripReplace") cameras
          // talk to the cloud directly.
          if (sol.migrationStrategy === "connector") {
            yearCosts["Hardware (initial & refresh)"] = sol.applianceCost * disc * applianceUnits;
          }
          // First license term, bought up front.
          yearCosts["Licenses/subscription"] = licenseTermCost * cams;
        } else {
          yearCosts["Hardware (initial & refresh)"] =
            sol.serverCost * disc * nSrv + sol.storageCostPerTB * disc * tbBilled + sol.analyticsApplianceCost * disc * sites;
          // A fresh on-prem deployment buys its perpetual license too; only the
          // ongoing care/SUP renewal (and analyticsSoftwareCostPerCamYr) recur
          // after this. Number(...) || 0 guards an older saved state missing
          // analyticsSoftwareCostPerCam (normalization normally backfills it).
          yearCosts["Licenses/subscription"] =
            (sol.baseLicense + sol.deviceLicense * cams + (Number(sol.analyticsSoftwareCostPerCam) || 0) * cams) * disc;
        }
        // Sum of "upfront" miscItems (see MiscCostItem above).
        yearCosts["Misc / other"] = miscUpfrontTotal;
      }
    } else {
      const surv0 = Math.pow(0.5, (y - 1) / failureSource.fleetHalfLifeYears);
      const surv1 = Math.pow(0.5, y / failureSource.fleetHalfLifeYears);
      const fails = cams * (surv0 - surv1);
      // Cameras fail at year `y` counted from the year-0 install, so `y` doubles as
      // years-since-install for the warranty check. In warranty: labor only, no hardware cost.
      // Both use failureSource (the fleet actually failing), not sol, for a "connector"
      // solution reusing another fleet — see the comment on failureSource above.
      const inWarranty = y <= failureSource.warrantyYears;
      yearCosts["Cameras"] = fails * (sol.replacementInstallLaborCost + (inWarranty ? 0 : sol.cameraCost * disc));

      if (sol.model === "cloud") {
        // The support/analytics add-on is genuinely annual, charged every year;
        // the term price itself only lands on renewal years (a lump sum, not
        // smoothed), same cadence as an on-prem hardware refresh — skipped in
        // the horizon's final year, no benefit renewing a term you won't use.
        let cloudLicenseCost = supportAddonAnnual * cams;
        if (y % tierYears === 0 && y < yrs) {
          cloudLicenseCost += licenseTermCost * cams;
        }
        yearCosts["Licenses/subscription"] = cloudLicenseCost;
      } else {
        yearCosts["Licenses/subscription"] = careCost + (Number(sol.analyticsSoftwareCostPerCamYr) || 0) * cams * disc;
      }

      yearCosts["Truck rolls"] = sites * sol.truckRollsPerSiteYr * scenario.truckRollCost;
      yearCosts["Admin labor"] = sol.adminHrsPerCamYr * cams * scenario.adminRate;
      yearCosts["Investigations"] = invMo * 12 * sol.investigationHrsPerIncident * scenario.investigatorRate;
      // Sum of "recurring" miscItems, regardless of incumbent status, same as
      // the support/care renewal elsewhere.
      yearCosts["Misc / other"] = miscRecurringTotal;

      if (sol.model === "cloud") {
        // ripReplace has no connector appliance, so no ongoing hardware refresh.
        if (sol.migrationStrategy === "connector") {
          if (isRefreshYear(y, firstApplianceRefresh, applianceCycle)) {
            yearCosts["Hardware (initial & refresh)"] = sol.applianceCost * disc * applianceUnits;
          }
        }
      } else {
        if (isRefreshYear(y, firstRefresh, refreshCycle)) {
          yearCosts["Hardware (initial & refresh)"] =
            sol.serverCost * disc * nSrv + sol.storageCostPerTB * disc * tbBilled + sol.analyticsApplianceCost * disc * sites;
        }
      }
    }

    let yearTotal = 0;
    CATEGORIES.forEach((c) => {
      // Year-0 costs are today's dollars already (escalation factor is 1 at y=0 anyway).
      const escalated = yearCosts[c] * escalation;
      totalsByCategory[c] += escalated;
      yearTotal += escalated;
    });
    running += yearTotal;
    cumulative.push(running);
  }

  const total = Object.values(totalsByCategory).reduce((a, b) => a + b, 0);
  const staffTimeTotal = STAFF_TIME_CATEGORIES.reduce((sum, c) => sum + totalsByCategory[c], 0);
  const hardware: HardwareFootprint = {
    unitsLabel:
      sol.model === "onprem" ? "Recording servers" : sol.migrationStrategy === "connector" ? "Connector appliances" : null,
    units: sol.model === "onprem" ? nSrv : sol.migrationStrategy === "connector" ? applianceUnits : 0,
    // tbBilled (not tbPhysical) so this never drifts from what the cost lines above
    // actually charged for — the whole-drive figure, not the continuous one.
    storageTB: sol.model === "onprem" ? tbBilled : null,
    cameras: cams,
  };
  return { totalsByCategory, cumulative, total, cashTotal: total - staffTimeTotal, staffTimeTotal, hardware };
}

export interface ComparisonResult {
  a: SolutionResult;
  b: SolutionResult;
  labels: string[];
  crossoverYear: number | null;
  /** Additional sign flips after the first one, if the lines cross more than once. */
  laterCrossoverYears: number[];
  activeCategories: Category[];
}

export function computeComparison(scenario: ScenarioInputs, solA: SolutionInputs, solB: SolutionInputs): ComparisonResult {
  // A "connector" solution reuses the *other* side's fleet, but only when that
  // other side is a real incumbent — otherwise there's no actual installed fleet
  // to draw reliability numbers from, and it falls back to its own (see
  // computeSolution's failureSource).
  const reusing = scenario.existingCamerasReusable !== false;
  const existingFleetForA = reusing && solA.model === "cloud" && solA.migrationStrategy === "connector" && scenario.incumbent === "b" ? solB : undefined;
  const existingFleetForB = reusing && solB.model === "cloud" && solB.migrationStrategy === "connector" && scenario.incumbent === "a" ? solA : undefined;
  const a = computeSolution(scenario, solA, scenario.incumbent === "a", existingFleetForA);
  const b = computeSolution(scenario, solB, scenario.incumbent === "b", existingFleetForB);
  const labels = Array.from({ length: scenario.horizonYears + 1 }, (_, y) => "Yr " + y);

  // Find the first year with a nonzero gap to use as the baseline side, then
  // scan forward for every year the gap flips relative to the side it flipped
  // to most recently. Starting the baseline at year 0 (rather than year 1)
  // matters: with an incumbent, one side often starts at $0 and can cross the
  // other before year 1.
  const crossoverYears: number[] = [];
  let currentSign = 0;
  let baselineFound = false;
  for (let y = 0; y <= scenario.horizonYears; y++) {
    const sign = Math.sign(a.cumulative[y] - b.cumulative[y]);
    if (sign === 0) continue;
    if (!baselineFound) {
      currentSign = sign;
      baselineFound = true;
    } else if (sign !== currentSign) {
      crossoverYears.push(y);
      currentSign = sign;
    }
  }

  const activeCategories = CATEGORIES.filter((c) => a.totalsByCategory[c] > 0.5 || b.totalsByCategory[c] > 0.5);

  return {
    a, b, labels,
    crossoverYear: crossoverYears[0] ?? null,
    laterCrossoverYears: crossoverYears.slice(1),
    activeCategories,
  };
}
