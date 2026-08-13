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

// Per-device wattage assumptions behind the "Power/facilities" category.
// Deliberately real per-unit figures (a server chassis, a PoE camera, a
// hard drive, a connector appliance) rather than a flat kW-per-category
// guess, on the theory that numbers close to a real datasheet are more
// defensible than a made-up round one — though the exact figures below are
// still assumptions, not a specific vendor's spec sheet. All six are
// editable ScenarioInputs fields (see below); these are just the fallback
// values used when a field is missing (an older share link/saved comparison
// from before it existed), exported so lib/defaults.ts's DEFAULT_SCENARIO
// can seed the same numbers instead of duplicating them.
export const DEFAULT_SERVER_WATTS = 75; // per recording server/NVR
export const DEFAULT_CAMERA_WATTS = 8; // per IP camera (PoE draw); applies to both
// deployment models since a physical camera draws power regardless of which
// backend it's recording to.
export const DEFAULT_DRIVE_WATTS = 8; // per physical hard drive
// Needed to convert tbPhysical (TB) into a drive count; assumed as a
// current-gen surveillance/enterprise HDD capacity.
export const DEFAULT_DRIVE_CAPACITY_TB = 16;
export const DEFAULT_APPLIANCE_WATTS = 60; // connector/NVR-style cloud appliance chassis
// A connector appliance is functionally an NVR — it records locally, then
// syncs to the vendor's cloud — so it gets its own drive power term too, the
// same shape as on-prem's. It's not assumed to hold the full retention
// window locally the way an on-prem NVR does, though: most real connector
// products keep a short rolling local buffer (for cloud-outage resilience)
// rather than a full local copy, so this uses its own shorter window
// instead of the scenario's cloud retention days. Assumed unRAIDed (a
// single local drive, not a mirrored array), unlike the on-prem side.
export const DEFAULT_CONNECTOR_BUFFER_DAYS = 3;
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
  // Shared market rates: the operator's own costs, independent of vendor.
  adminRate: number;
  investigatorRate: number;
  truckRollCost: number;
  electricityRate: number;
  // Per-device wattage assumptions behind the "Power/facilities" category
  // (see the DEFAULT_* constants above for what each means). Resolved via
  // `Number(scenario.x) || DEFAULT_X` in computeSolution, so a missing value
  // (older share link/saved comparison) falls back to the original built-in
  // assumption instead of zeroing out a whole cost line or, for
  // driveCapacityTb specifically, dividing by zero.
  serverWatts: number;
  cameraWatts: number;
  driveWatts: number;
  driveCapacityTb: number;
  applianceWatts: number;
  connectorBufferDays: number;
  // See DEFAULT_STORAGE_OVERHEAD_MULTIPLIER/DEFAULT_SPARE_SERVERS above.
  // Same resolution/fallback pattern as the wattage fields.
  storageOverheadMultiplier: number;
  spareServers: number;
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
  bulkInstallLaborCost: number; // $/cam, year-0 buildout only
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

  // Misc modifiers: an escape valve for costs that don't fit any category
  // above (professional services, custom integration work, a one-off
  // migration fee, a compliance/audit line item, etc.) without inventing a
  // new named category or formula for every oddball line item a real quote
  // might contain. Both default to $0 and are purely additive — they never
  // change any other category's math.
  // One-time, year-0 only (e.g. professional services for initial setup).
  // Subject to the same incumbent-zeroing and vendor discount as the rest of
  // year 0's buildout cost, since it represents work done as part of that
  // same rollout.
  miscUpfrontCost: number;
  // Recurring, charged every year after year 0 (e.g. a compliance audit fee,
  // a monitoring contract, anything ongoing that isn't admin labor, truck
  // rolls, or a license renewal). Escalates and discounts the same as every
  // other recurring line.
  miscAnnualCost: number;
}

export const CATEGORIES = [
  "Camera replacements",
  "Hardware (initial & refresh)",
  "Licenses/subscription",
  "Installation",
  "Truck rolls",
  "Admin labor",
  "Investigations",
  "Power/facilities",
  "Misc / other",
] as const;
export type Category = (typeof CATEGORIES)[number];

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

  // Resolved wattage assumptions for the "Power/facilities" category — see
  // the ScenarioInputs comment for why the fallback pattern.
  const serverWatts = Number(scenario.serverWatts) || DEFAULT_SERVER_WATTS;
  const cameraWatts = Number(scenario.cameraWatts) || DEFAULT_CAMERA_WATTS;
  const driveWatts = Number(scenario.driveWatts) || DEFAULT_DRIVE_WATTS;
  const driveCapacityTb = Number(scenario.driveCapacityTb) || DEFAULT_DRIVE_CAPACITY_TB;
  const applianceWatts = Number(scenario.applianceWatts) || DEFAULT_APPLIANCE_WATTS;
  const connectorBufferDays = Number(scenario.connectorBufferDays) || DEFAULT_CONNECTOR_BUFFER_DAYS;
  const storageOverheadMultiplier = Number(scenario.storageOverheadMultiplier) || DEFAULT_STORAGE_OVERHEAD_MULTIPLIER;
  const spareServers = Number(scenario.spareServers) || DEFAULT_SPARE_SERVERS;

  // The add-on isn't storage-driven, so it doesn't scale with retentionMultiplier the way
  // the base license does, but the vendor's own negotiated discount still applies to it.
  const licAnnual =
    sol.model === "cloud"
      ? (sol.tierPrice / tierYears) * retentionMultiplier(ret) * disc + sol.supportAddonPerCamYr * disc
      : 0;
  // At least one box per site (a connector/NVR is physically local to the cameras it
  // serves, you can't split one across sites), or more if total camera count demands it.
  const applianceUnits = sol.model === "cloud" ? Math.max(sites, Math.ceil(cams / Math.max(1, sol.applianceCapacity))) : 0;
  const nSrv =
    sol.model === "onprem" ? Math.max(sites, Math.ceil(cams / Math.max(1, sol.serverCapacity))) + spareServers : 0;
  const tbUsable = (cams * (br / 8) * 86400 * ret) / 1e6 * storageOverheadMultiplier * (sol.framerateFps / 24);
  // Physical drives to buy: usable capacity times RAID overhead (1x for RAID 0/none, 2x for
  // mirrored RAID 1/10). Power draw scales with physical drives too, more disks spinning.
  const tbPhysical = sol.model === "onprem" ? tbUsable * RAID_STORAGE_MULTIPLIER[sol.raidLevel] : tbUsable;
  // Storage is billed for the whole drives actually bought (respecting each RAID level's
  // drive-count floor via driveCountFor — a small RAID 10 array still needs 4 real drives,
  // and costs like it) rather than the continuous tbPhysical figure. Only matters on-prem;
  // cloud has no drives-you-buy line for this to apply to.
  const tbBilled =
    sol.model === "onprem" ? driveCountFor(tbPhysical, sol.raidLevel, driveCapacityTb) * driveCapacityTb : tbPhysical;
  // A connector appliance's own local buffer (see connectorBufferDays above), not the
  // full cloud retention window, and not RAID-redundant. Only feeds the power-draw
  // model's drive term below — the dollar cost model still prices the appliance as one
  // flat per-unit SKU (applianceCost).
  const connectorBufferTb =
    sol.model === "cloud" && sol.migrationStrategy === "connector"
      ? (cams * (br / 8) * 86400 * connectorBufferDays) / 1e6 * storageOverheadMultiplier * (sol.framerateFps / 24)
      : 0;
  const careCost = sol.model === "onprem" ? (sol.baseLicense + sol.deviceLicense * cams) * disc * (sol.carePct / 100) : 0;

  const totalsByCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  const cumulative: number[] = [];
  let running = 0;

  for (let y = 0; y <= yrs; y++) {
    const escalation = Math.pow(1 + esc, y);
    const yearCosts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;

    if (y === 0) {
      if (!isIncumbent) {
        if (sol.model === "cloud" && sol.migrationStrategy === "ripReplace") {
          // Full fleet swapped for native cameras up front, at the bulk rate; no connector appliance needed.
          yearCosts["Camera replacements"] = cams * (sol.cameraCost * disc + sol.bulkInstallLaborCost);
        } else {
          yearCosts["Installation"] = sol.bulkInstallLaborCost * cams;
          yearCosts["Hardware (initial & refresh)"] =
            sol.model === "cloud"
              ? sol.applianceCost * disc * applianceUnits
              : sol.serverCost * disc * nSrv + sol.storageCostPerTB * disc * tbBilled + sol.analyticsApplianceCost * disc * sites;
          // A fresh (non-incumbent) on-prem deployment has to buy its perpetual
          // license too, not just the hardware — only the incumbent's license is
          // already owned/sunk. Only the ongoing care/SUP renewal (and the separate
          // analyticsSoftwareCostPerCamYr below) recur after this.
          if (sol.model === "onprem") {
            yearCosts["Licenses/subscription"] =
              (sol.baseLicense + sol.deviceLicense * cams + sol.analyticsSoftwareCostPerCam * cams) * disc;
          }
        }
        // Flat, not per-camera: professional-services/setup fees are typically
        // a project-level line item, not priced per unit installed. Coerced
        // through Number(...) || 0 (not just used raw) since sol can come from
        // an older share link/saved comparison predating this field — an
        // undefined here would poison this whole year's total, and every
        // later year's cumulative total, with NaN.
        yearCosts["Misc / other"] = (Number(sol.miscUpfrontCost) || 0) * disc;
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
      yearCosts["Camera replacements"] = fails * (sol.replacementInstallLaborCost + (inWarranty ? 0 : sol.cameraCost * disc));

      yearCosts["Licenses/subscription"] =
        sol.model === "cloud" ? licAnnual * cams : careCost + sol.analyticsSoftwareCostPerCamYr * cams * disc;

      yearCosts["Truck rolls"] = sites * sol.truckRollsPerSiteYr * scenario.truckRollCost;
      yearCosts["Admin labor"] = sol.adminHrsPerCamYr * cams * scenario.adminRate;
      yearCosts["Investigations"] = invMo * 12 * sol.investigationHrsPerIncident * scenario.investigatorRate;
      yearCosts["Misc / other"] = (Number(sol.miscAnnualCost) || 0) * disc;

      // Camera wattage applies to both models and both cloud migration strategies — a
      // physical camera draws power regardless of which backend it's recording to.
      const cameraPowerKw = (cams * cameraWatts) / 1000;
      if (sol.model === "cloud") {
        // ripReplace has no connector appliance, so no ongoing hardware refresh, but it
        // still pays for the cameras themselves.
        if (sol.migrationStrategy === "connector") {
          const appliancePowerKw = (applianceUnits * applianceWatts) / 1000;
          // "none" here, not sol.raidLevel: the connector's local buffer is assumed
          // unRAIDed (see connectorBufferDays above), unlike on-prem's array.
          const connectorDrivePowerKw = (driveCountFor(connectorBufferTb, "none", driveCapacityTb) * driveWatts) / 1000;
          yearCosts["Power/facilities"] = (cameraPowerKw + appliancePowerKw + connectorDrivePowerKw) * 8760 * scenario.electricityRate;
          if (
            y >= sol.yearsUntilNextApplianceRefresh &&
            (y - sol.yearsUntilNextApplianceRefresh) % sol.applianceRefreshCycleYears === 0 &&
            y < yrs
          ) {
            yearCosts["Hardware (initial & refresh)"] = sol.applianceCost * disc * applianceUnits;
          }
        } else {
          yearCosts["Power/facilities"] = cameraPowerKw * 8760 * scenario.electricityRate;
        }
      } else {
        const serverPowerKw = (nSrv * serverWatts) / 1000;
        const drivePowerKw = (driveCountFor(tbPhysical, sol.raidLevel, driveCapacityTb) * driveWatts) / 1000;
        yearCosts["Power/facilities"] = (cameraPowerKw + serverPowerKw + drivePowerKw) * 8760 * scenario.electricityRate;
        if (y >= sol.yearsUntilNextRefresh && (y - sol.yearsUntilNextRefresh) % sol.refreshCycleYears === 0 && y < yrs) {
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
  const hardware: HardwareFootprint = {
    unitsLabel:
      sol.model === "onprem" ? "Recording servers" : sol.migrationStrategy === "connector" ? "Connector appliances" : null,
    units: sol.model === "onprem" ? nSrv : sol.migrationStrategy === "connector" ? applianceUnits : 0,
    // tbBilled (not tbPhysical) so this never drifts from what the cost lines above
    // actually charged for — the whole-drive figure, not the continuous one.
    storageTB: sol.model === "onprem" ? tbBilled : null,
    cameras: cams,
  };
  return { totalsByCategory, cumulative, total, hardware };
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
  const existingFleetForA = solA.model === "cloud" && solA.migrationStrategy === "connector" && scenario.incumbent === "b" ? solB : undefined;
  const existingFleetForB = solB.model === "cloud" && solB.migrationStrategy === "connector" && scenario.incumbent === "a" ? solA : undefined;
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
