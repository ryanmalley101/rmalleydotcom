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
// appliance (Verkada's Command Connector is the namesake example) - year-0
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

export interface ScenarioInputs {
  cameras: number;
  sites: number;
  retentionDays: number;
  horizonYears: number;
  bitrateMbps: number;
  investigationsPerMonth: number;
  npvDiscountPct: number;
  // Compounding annual growth applied to every recurring cost (subscriptions,
  // labor, truck rolls, refreshes...). Real prices don't hold flat for a
  // 10-15 year horizon; NPV discounting alone only accounts for the time
  // value of money, not that costs themselves tend to rise.
  annualEscalationPct: number;
  // Which solution (if either) is already deployed. The incumbent skips its
  // year-0 buildout cost; the other solution pays it as a fresh deployment.
  incumbent: IncumbentChoice;
  // Shared market rates: the operator's own costs, independent of vendor.
  adminRate: number;
  investigatorRate: number;
  truckRollCost: number;
  electricityRate: number;
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

  // Cloud/hybrid only
  migrationStrategy: CloudMigrationStrategy;
  tierPrice: number; // license cost for a term of `tierYears`, this vendor's own term length
  tierYears: number;
  applianceCost: number; // connector/NVR-style appliance, only used when migrationStrategy is "connector"
  applianceCapacity: number;

  // On-prem only
  baseLicense: number;
  deviceLicense: number;
  carePct: number;
  serverCost: number;
  serverCapacity: number;
  storageCostPerTB: number;
  raidLevel: RaidLevel;
  analyticsApplianceCost: number;
  analyticsSoftwareCost: number;
  refreshCycleYears: number;
  yearsUntilNextRefresh: number;
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

export interface SolutionResult {
  totalsByCategory: Record<Category, number>;
  cumulative: number[]; // NPV-discounted running total, index = year
  total: number;
}

export function computeSolution(scenario: ScenarioInputs, sol: SolutionInputs, isIncumbent = false): SolutionResult {
  const { cameras: cams, sites, retentionDays: ret, horizonYears: yrs, bitrateMbps: br, investigationsPerMonth: invMo } = scenario;
  const r = scenario.npvDiscountPct / 100;
  const esc = scenario.annualEscalationPct / 100;
  const disc = 1 - sol.discountPct / 100;
  const tierYears = Math.max(1, sol.tierYears); // guard against a cleared/zeroed input

  const licAnnual = sol.model === "cloud" ? (sol.tierPrice / tierYears) * retentionMultiplier(ret) * disc : 0;
  // At least one box per site (a connector/NVR is physically local to the cameras it
  // serves, you can't split one across sites), or more if total camera count demands it.
  const applianceUnits = sol.model === "cloud" ? Math.max(sites, Math.ceil(cams / Math.max(1, sol.applianceCapacity))) : 0;
  const nSrv = sol.model === "onprem" ? Math.max(sites, Math.ceil(cams / Math.max(1, sol.serverCapacity))) + 1 : 0;
  const tbUsable = (cams * (br / 8) * 86400 * ret) / 1e6 * 1.3;
  // Physical drives to buy: usable capacity times RAID overhead (1x for RAID 0/none, 2x for
  // mirrored RAID 1/10). Power draw scales with physical drives too, more disks spinning.
  const tbPhysical = sol.model === "onprem" ? tbUsable * RAID_STORAGE_MULTIPLIER[sol.raidLevel] : tbUsable;
  const careCost = sol.model === "onprem" ? (sol.baseLicense + sol.deviceLicense * cams) * disc * (sol.carePct / 100) : 0;

  const totalsByCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  const cumulative: number[] = [];
  let running = 0;

  for (let y = 0; y <= yrs; y++) {
    const df = 1 / Math.pow(1 + r, y);
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
              : sol.serverCost * disc * nSrv + sol.storageCostPerTB * disc * tbPhysical + sol.analyticsApplianceCost * disc;
        }
      }
    } else {
      const surv0 = Math.pow(0.5, (y - 1) / sol.fleetHalfLifeYears);
      const surv1 = Math.pow(0.5, y / sol.fleetHalfLifeYears);
      const fails = cams * (surv0 - surv1);
      // Cameras fail at year `y` counted from the year-0 install, so `y` doubles as
      // years-since-install for the warranty check. In warranty: labor only, no hardware cost.
      const inWarranty = y <= sol.warrantyYears;
      yearCosts["Camera replacements"] = fails * (sol.replacementInstallLaborCost + (inWarranty ? 0 : sol.cameraCost * disc));

      yearCosts["Licenses/subscription"] =
        sol.model === "cloud" ? licAnnual * cams : careCost + sol.analyticsSoftwareCost * disc;

      yearCosts["Truck rolls"] = sites * sol.truckRollsPerSiteYr * scenario.truckRollCost;
      yearCosts["Admin labor"] = sol.adminHrsPerCamYr * cams * scenario.adminRate;
      yearCosts["Investigations"] = invMo * 12 * sol.investigationHrsPerIncident * scenario.investigatorRate;

      if (sol.model === "cloud") {
        // ripReplace has no connector appliance, so no ongoing hardware refresh or its power draw.
        if (sol.migrationStrategy === "connector") {
          yearCosts["Power/facilities"] = applianceUnits * 0.06 * 8760 * scenario.electricityRate;
          if (y % 10 === 0 && y < yrs) {
            yearCosts["Hardware (initial & refresh)"] = sol.applianceCost * disc * applianceUnits;
          }
        }
      } else {
        yearCosts["Power/facilities"] = (nSrv * 0.5 + tbPhysical * 0.01 + 0.3) * 8760 * scenario.electricityRate;
        if (y >= sol.yearsUntilNextRefresh && (y - sol.yearsUntilNextRefresh) % sol.refreshCycleYears === 0 && y < yrs) {
          yearCosts["Hardware (initial & refresh)"] =
            sol.serverCost * disc * nSrv + sol.storageCostPerTB * disc * tbPhysical + sol.analyticsApplianceCost * disc;
        }
      }
    }

    let yearTotal = 0;
    CATEGORIES.forEach((c) => {
      // Year-0 costs are today's dollars already (escalation factor is 1 at y=0 anyway).
      const discounted = yearCosts[c] * escalation * df;
      totalsByCategory[c] += discounted;
      yearTotal += discounted;
    });
    running += yearTotal;
    cumulative.push(running);
  }

  const total = Object.values(totalsByCategory).reduce((a, b) => a + b, 0);
  return { totalsByCategory, cumulative, total };
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
  const a = computeSolution(scenario, solA, scenario.incumbent === "a");
  const b = computeSolution(scenario, solB, scenario.incumbent === "b");
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
