// Two-solution access control TCO model. Vendor-agnostic in the same way as
// the video calculator: a "solution" is a deployment model (cloud-managed or
// server-based) plus a set of cost assumptions, so the same math drives every
// pairing. The year-by-year building blocks (misc items, refresh timing,
// failure cohorts, residual credit, totals, crossovers) are shared; see
// _tco-shared/lib/engine.ts. What's specific here is what a door costs:
// hardware per door, licenses per door, credentials and admin per
// cardholder, and which existing hardware a new system can keep (see the
// README's "Reuse").
//
// Defaults are the same for both deployment models unless the difference is
// physical (servers). See the README's design principles before giving the
// two models different staff-time defaults.
import { sanitizeScenario, sanitizeSolution } from "./sanitize";
import { annualOutcomes, type Vertical } from "./verticals";
import {
  advanceCohorts, compareTotals, emptyYear, isRefreshYear, miscForYear, residualCredit, splitTotals, tallyYears,
  type Cohort, type ComparisonTotals, type DeploymentModel, type IncumbentChoice, type Lump, type MiscCostItem, type SolutionTotals,
} from "../../_tco-shared/lib/engine";

export type { DeploymentModel, IncumbentChoice, MiscCostItem, MiscItemTiming } from "../../_tco-shared/lib/engine";

// Bumped whenever a change to this file (or to the defaults it's fed) changes
// what an existing share link or saved comparison would compute, so a link
// made under an older model can say its totals were recalculated.
export const MODEL_VERSION = 1;

export interface ScenarioInputs {
  // Controlled openings: drive hardware, installation, door licenses, and
  // door alarms.
  doors: number;
  // 1 for entry only, 2 for in/out. The doors' design, the same for both
  // solutions.
  readersPerDoor: number;
  sites: number;
  // People with credentials. Drive credentials and cardholder admin, which
  // scale with people, not doors.
  cardholders: number;
  // Share of cardholders who leave (and are replaced) each year.
  turnoverPct: number;
  // Access changes per cardholder per year beyond joining and leaving: new
  // doors, schedules, role changes.
  accessChangesPerCardholderYr: number;
  // Share of cardholders who lose or break a credential each year.
  lostCredentialPct: number;
  // Door forced-open and held-open alarms someone has to look at.
  doorAlarmsPerDoorMonth: number;
  horizonYears: number;
  // Compounding annual price growth, split three ways as in the video
  // calculator: labor and services, hardware, and licenses.
  laborEscalationPct: number;
  hardwareEscalationPct: number;
  licenseEscalationPct: number;
  // Which solution (if either) is already deployed. The incumbent skips its
  // year-0 buildout cost; the other solution pays it as a fresh deployment.
  incumbent: IncumbentChoice;
  // Whether the doors are already wired for access control. false means new
  // construction or doors that never had it: every newly deployed side buys
  // door hardware, readers, and controllers, and pays a full install. true
  // means door hardware and cabling stay whoever wins, and each newly
  // deployed side decides whether it keeps the readers and controllers.
  existingDoorsInstalled: boolean;
  // How old the readers and controllers already on site are at year 0, for
  // their warranty. 0 treats them as new.
  existingHardwareAgeYears: number;
  // Shared market rates: the operator's own costs, independent of vendor.
  adminRate: number;
  // Whoever reviews door alarms: a security operator or front-desk staff.
  operatorRate: number;
  truckRollCost: number;
  // Credit the unused share of any lump purchase that outlasts the horizon
  // (a cloud license term, a server refresh), straight-line over its
  // service life. Defaults to true.
  creditResidualValue: boolean;
  // Business impact (lib/verticals.ts): the industry, or null for none.
  vertical: Vertical | null;
  outcomeBaseline: Record<string, number>;
  outcomeEnabled: string[];
}

export interface SolutionInputs {
  id: "a" | "b";
  name: string;
  model: DeploymentModel;
  discountPct: number; // off list, this vendor's own negotiated discount

  // Door hardware and devices, both models.
  readerCost: number; // $/reader
  controllerCost: number; // $/controller, with its enclosure and power
  doorsPerController: number;
  // Lock or strike, door position sensor, request-to-exit, power: bought
  // only for doors that aren't wired yet.
  doorHardwareCost: number; // $/door
  // Full install on a door with nothing on it: cabling, lock hardware,
  // reader, controller wiring.
  newDoorInstallCost: number; // $/door
  // Cut-over on a door that's already wired: re-terminating, swapping what
  // changes, programming, testing.
  migrationLaborPerDoor: number; // $/door
  replacementLaborPerDevice: number; // $/failed reader or controller
  // Readers and controllers fail at a constant yearly rate set by this
  // half-life; a failure inside the warranty costs labor only.
  hardwareHalfLifeYears: number;
  warrantyYears: number;
  // Whether this solution keeps the existing readers / controllers when the
  // doors are already wired. Ignored on new doors and for the incumbent.
  reusesReaders: boolean;
  reusesControllers: boolean;

  // Cloud only
  tierPrice: number; // $/door for one term of `tierYears`
  tierYears: number;
  siteFeePerYr: number; // $/site/yr, for vendors that also charge per site
  // Incumbent only: years until the current term ends. Absent means one
  // full term from year 0.
  yearsUntilLicenseRenewal?: number;

  // On-prem only
  baseLicense: number; // one-time
  doorLicense: number; // $/door, one-time
  carePct: number; // yearly support renewal, % of the license
  serverCount: number;
  serverCost: number; // $/server
  serverSoftwareCost: number; // $/server: Windows Server, SQL Server
  serverAdminHrsPerYr: number; // patching and upkeep, per server
  refreshCycleYears: number;
  yearsUntilNextRefresh: number;

  // Credentials
  cardCost: number; // $/card
  // Share of cardholders on mobile credentials instead of a card.
  mobileSharePct: number;
  mobileCostPerUserYr: number; // 0 when the license includes them
  // Issue a new card to every card-carrying cardholder at year 0, e.g. to
  // move off 125 kHz prox. Ignored for the incumbent; always happens on new
  // doors.
  reissueCredentials: boolean;

  // Operations, both models. Same defaults for cloud and on-prem.
  adminHrsPerDoorYr: number;
  cardholderChangeMinutes: number;
  alarmMinutes: number;
  truckRollsPerSiteYr: number;
  networkCostPerSiteYr: number;

  miscItems: MiscCostItem[];
  // Business impact: see lib/verticals.ts. Ignored for the incumbent.
  outcomeChanges: Record<string, number>;
  considerations: string[];
}

export const CATEGORIES = [
  "Door hardware",
  "Readers & controllers",
  "Servers (initial & refresh)",
  "Licenses/subscription",
  "Installation",
  "Credentials",
  "Truck rolls",
  "Admin labor",
  "Cardholder admin",
  "Alarm handling",
  "Network / bandwidth",
  "Misc / other",
  "Business impact: savings",
  "Business impact: added costs",
  "Residual value (credit)",
] as const;
export type Category = (typeof CATEGORIES)[number];

// Estimates of internal staff time rather than money paid out. In every
// total, but reported separately (staffTimeTotal).
export const STAFF_TIME_CATEGORIES: readonly Category[] = ["Admin labor", "Cardholder admin", "Alarm handling"];
export const OUTCOME_CATEGORIES: readonly Category[] = ["Business impact: savings", "Business impact: added costs"];

// What the deployment ends up with, from the same unit counts the cost lines
// charged for.
export interface HardwareFootprint {
  readers: number;
  controllers: number;
  servers: number;
  // Reader and controller swaps over the horizon, counting replacements that fail again.
  deviceSwaps: number;
  // Share of the readers and controllers in place at year 0 that failed within the horizon, 0-100.
  originalHardwareReplacedPct: number;
}

export interface SolutionResult extends SolutionTotals<Category> {
  hardware: HardwareFootprint;
}

export type ComparisonResult = ComparisonTotals<Category, SolutionResult>;

export const controllersFor = (doors: number, sites: number, doorsPerController: number) =>
  Math.max(sites, Math.ceil(doors / Math.max(1, doorsPerController)));

export function computeSolution(
  rawScenario: ScenarioInputs,
  rawSol: SolutionInputs,
  isIncumbent = false,
  rawExistingHardware?: SolutionInputs,
): SolutionResult {
  // Every input is clamped to a usable range first (lib/sanitize.ts).
  const scenario = sanitizeScenario(rawScenario);
  const sol = sanitizeSolution(rawSol);
  const existingHardware = rawExistingHardware && sanitizeSolution(rawExistingHardware);
  const { doors, sites, cardholders, horizonYears: yrs } = scenario;
  const escLabor = scenario.laborEscalationPct / 100;
  const escHardware = scenario.hardwareEscalationPct / 100;
  const escLicense = scenario.licenseEscalationPct / 100;
  const disc = 1 - sol.discountPct / 100;
  const cloud = sol.model === "cloud";

  const readers = doors * scenario.readersPerDoor;
  const controllers = controllersFor(doors, sites, sol.doorsPerController);

  // On new doors every newly deployed side buys everything; on wired doors
  // it buys only what it doesn't keep.
  const newDoors = scenario.existingDoorsInstalled === false;
  const buysReaders = newDoors || !sol.reusesReaders;
  const buysControllers = newDoors || !sol.reusesControllers;
  const issuesCredentials = newDoors || sol.reissueCredentials;

  // Readers and controllers as two fleets of install-year cohorts. Kept
  // devices start at the existing hardware's age, and when they're the
  // incumbent's (`existingHardware`), they fail on its numbers.
  const startCohort = (count: number, kept: boolean): Cohort => {
    const source = kept && existingHardware ? existingHardware : sol;
    return {
      size: count,
      installedYear: kept ? -scenario.existingHardwareAgeYears : 0,
      halfLife: source.hardwareHalfLifeYears,
      warrantyYears: source.warrantyYears,
    };
  };
  const readerStart = startCohort(readers, isIncumbent || !buysReaders);
  const controllerStart = startCohort(controllers, isIncumbent || !buysControllers);
  const readerCohorts = [readerStart];
  const controllerCohorts = [controllerStart];
  const replacement = { halfLife: sol.hardwareHalfLifeYears, warrantyYears: sol.warrantyYears };
  let deviceSwaps = 0;

  // Licenses. Cloud: a lump per term, plus a yearly site fee. On-prem: a
  // perpetual license at year 0, then a yearly support renewal on it.
  const licenseTermCost = cloud ? sol.tierPrice * doors * disc : 0;
  const siteFee = cloud ? sol.siteFeePerYr * sites * disc : 0;
  const perpetualLicense = cloud ? 0 : (sol.baseLicense + sol.doorLicense * doors) * disc;
  const care = perpetualLicense * (sol.carePct / 100);
  const firstRenewal = isIncumbent && sol.yearsUntilLicenseRenewal !== undefined ? sol.yearsUntilLicenseRenewal : sol.tierYears;
  const isRenewalYear = (y: number) => y > 0 && isRefreshYear(y, firstRenewal, sol.tierYears, yrs);

  // On-prem servers: bought at year 0 and on each refresh. "Years until next
  // refresh" describes servers already installed, so only the incumbent
  // uses it; a new purchase's first refresh is one full cycle later.
  const servers = cloud ? 0 : sol.serverCount;
  const serverPurchase = servers * (sol.serverCost + sol.serverSoftwareCost) * disc;
  const firstRefresh = isIncumbent ? sol.yearsUntilNextRefresh : sol.refreshCycleYears;

  // Credentials and cardholder admin.
  const physical = cardholders * (1 - sol.mobileSharePct / 100);
  const mobile = cardholders * (sol.mobileSharePct / 100);
  const turnover = scenario.turnoverPct / 100;
  const lost = scenario.lostCredentialPct / 100;
  // Each leaver is a removal plus their replacement's add.
  const cardholderEvents = cardholders * (2 * turnover + scenario.accessChangesPerCardholderYr + lost);
  const minutesCost = (minutes: number) => (minutes / 60) * scenario.adminRate;

  // Business impact, a change from today: none for the incumbent.
  const outcomes = isIncumbent ? [] : annualOutcomes(scenario, sol);
  const outcomeSavings = outcomes.reduce((sum, o) => sum + Math.min(0, o.amount), 0);
  const outcomeCosts = outcomes.reduce((sum, o) => sum + Math.max(0, o.amount), 0);

  const lumps: Lump[] = [];
  const years: Record<Category, number>[] = [];

  for (let y = 0; y <= yrs; y++) {
    const labor = Math.pow(1 + escLabor, y);
    const hw = Math.pow(1 + escHardware, y);
    const lic = Math.pow(1 + escLicense, y);
    const cost = emptyYear(CATEGORIES);

    if (y === 0) {
      // Nothing new is deployed for the incumbent, so its year 0 is empty
      // apart from misc items.
      if (!isIncumbent) {
        // Door hardware isn't a vendor product, so no discount: it's the same
        // doors either way.
        if (newDoors) cost["Door hardware"] = doors * sol.doorHardwareCost * hw;
        cost["Readers & controllers"] =
          ((buysReaders ? readers * sol.readerCost : 0) + (buysControllers ? controllers * sol.controllerCost : 0)) * disc * hw;
        cost["Installation"] = doors * (newDoors ? sol.newDoorInstallCost : sol.migrationLaborPerDoor) * labor;
        cost["Licenses/subscription"] = (cloud ? licenseTermCost : perpetualLicense) * lic;
        cost["Servers (initial & refresh)"] = serverPurchase * hw;
        if (issuesCredentials) {
          cost["Credentials"] = physical * sol.cardCost * hw;
          // Enrolling everyone onto the new credentials.
          cost["Cardholder admin"] = cardholders * minutesCost(sol.cardholderChangeMinutes) * labor;
        }
      }
    } else {
      // Every failure costs replacement labor; only out-of-warranty ones
      // cost the device too.
      const r = advanceCohorts(readerCohorts, y, replacement);
      const c = advanceCohorts(controllerCohorts, y, replacement);
      deviceSwaps += r.failed + c.failed;
      cost["Readers & controllers"] =
        (r.failed + c.failed) * sol.replacementLaborPerDevice * labor +
        (r.outOfWarranty * sol.readerCost + c.outOfWarranty * sol.controllerCost) * disc * hw;

      cost["Licenses/subscription"] = (cloud ? siteFee + (isRenewalYear(y) ? licenseTermCost : 0) : care) * lic;
      if (!cloud && isRefreshYear(y, firstRefresh, sol.refreshCycleYears, yrs)) {
        cost["Servers (initial & refresh)"] = serverPurchase * hw;
      }

      // New hires' and lost cards; mobile credentials are a yearly license.
      cost["Credentials"] = physical * (turnover + lost) * sol.cardCost * hw + mobile * sol.mobileCostPerUserYr * lic;
      cost["Truck rolls"] = sites * sol.truckRollsPerSiteYr * scenario.truckRollCost * labor;
      cost["Network / bandwidth"] = sites * sol.networkCostPerSiteYr * labor;
      cost["Admin labor"] = (sol.adminHrsPerDoorYr * doors + sol.serverAdminHrsPerYr * servers) * scenario.adminRate * labor;
      cost["Cardholder admin"] = cardholderEvents * minutesCost(sol.cardholderChangeMinutes) * labor;
      cost["Alarm handling"] =
        doors * scenario.doorAlarmsPerDoorMonth * 12 * (sol.alarmMinutes / 60) * scenario.operatorRate * labor;
      cost["Business impact: savings"] = outcomeSavings * labor;
      cost["Business impact: added costs"] = outcomeCosts * labor;
    }

    // User-authored, so they always apply, incumbent or not.
    cost["Misc / other"] = miscForYear(sol.miscItems, y) * labor;

    // Server purchases and cloud license terms have a fixed service life.
    if (cost["Servers (initial & refresh)"] > 0) {
      lumps.push({ year: y, amount: cost["Servers (initial & refresh)"], life: sol.refreshCycleYears });
    }
    if (cloud && ((y === 0 && !isIncumbent) || isRenewalYear(y))) {
      lumps.push({ year: y, amount: licenseTermCost * lic, life: sol.tierYears });
    }

    years.push(cost);
  }

  const credit = scenario.creditResidualValue !== false ? residualCredit(lumps, yrs) : 0;
  const totals = splitTotals(tallyYears(CATEGORIES, years, credit, "Residual value (credit)"), STAFF_TIME_CATEGORIES, OUTCOME_CATEGORIES);
  const startDevices = readers + controllers;
  const remaining = readerStart.size + controllerStart.size;
  return {
    ...totals,
    hardware: {
      readers, controllers, servers, deviceSwaps,
      originalHardwareReplacedPct: startDevices > 0 ? Math.min(100, Math.max(0, (100 * (startDevices - remaining)) / startDevices)) : 0,
    },
  };
}

export function computeComparison(rawScenario: ScenarioInputs, solA: SolutionInputs, solB: SolutionInputs): ComparisonResult {
  const scenario = sanitizeScenario(rawScenario);
  // A side that keeps the readers or controllers on wired doors is keeping
  // the incumbent's hardware when the other side is the incumbent, so that
  // hardware fails on the incumbent's numbers. computeSolution ignores this
  // for whatever a side buys new.
  const wired = scenario.existingDoorsInstalled !== false;
  const a = computeSolution(scenario, solA, scenario.incumbent === "a", wired && scenario.incumbent === "b" ? solB : undefined);
  const b = computeSolution(scenario, solB, scenario.incumbent === "b", wired && scenario.incumbent === "a" ? solA : undefined);
  return compareTotals(CATEGORIES, a, b, scenario.horizonYears);
}
