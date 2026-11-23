// The single list of input definitions: labels, help text, and valid ranges
// for every field. The wizard, the results page, and the exports all read
// from it, so the same input can't be labeled or explained differently in
// two places. `models` limits a solution field to the deployment model(s) it
// applies to.
import type { ScenarioInputs, SolutionInputs } from "./model";
import type { FieldDef } from "../../_tco-shared/lib/fields";

const UNSOURCED = "The default is an unsourced placeholder, the same for both deployment models; replace it with your own number.";

const NEXT_REFRESH_HELP =
  "How many years until the servers already installed are next replaced; 0 means they're due now and are bought at year 0. Only shown for the incumbent: servers bought new at year 0 get their first refresh one full cycle later.";

export const SCENARIO_FIELDS: FieldDef<keyof ScenarioInputs>[] = [
  { key: "doors", label: "Doors", min: 1, int: true, help: "Controlled openings: doors, gates, and turnstiles with a reader. Drives hardware, installation, door licenses, and door alarms." },
  { key: "readersPerDoor", label: "Readers per door", min: 1, max: 2, int: true, help: "1 for entry-only doors, 2 where people badge both in and out." },
  { key: "sites", label: "Sites / buildings", min: 1, int: true, help: "Each site needs at least one controller of its own, and truck rolls are counted per site." },
  { key: "cardholders", label: "Cardholders", min: 0, int: true, help: "People with credentials: employees, contractors, tenants, students. Credentials and cardholder admin scale with this, not with doors." },
  { key: "turnoverPct", label: "Cardholder turnover (%/yr)", min: 0, max: 100, step: 1, help: "Share of cardholders who leave and are replaced each year. Each one is a removal plus an add, and a new card." },
  { key: "horizonYears", label: "Horizon (years)", min: 1, max: 30, int: true },
  { key: "incumbent", label: "Incumbent" },
  { key: "existingDoorsInstalled", label: "Doors already wired" },
  { key: "existingHardwareAgeYears", label: "Age of existing readers and controllers (yrs)" },
  { key: "accessChangesPerCardholderYr", label: "Access changes / cardholder / yr", min: 0, step: 0.25, decimalScale: 2, help: "Changes to someone's access beyond joining and leaving: new doors, schedules, role changes." },
  { key: "lostCredentialPct", label: "Lost credentials (%/yr)", min: 0, max: 100, step: 1, help: "Share of cardholders who lose or break a credential each year. Each one is an admin action, plus a new card for card users." },
  { key: "doorAlarmsPerDoorMonth", label: "Door alarms / door / mo", min: 0, step: 0.5, decimalScale: 1, help: "Door forced-open and held-open alarms per door per month that someone has to look at." },
  { key: "laborEscalationPct", label: "Labor & services escalation (%/yr)" },
  { key: "hardwareEscalationPct", label: "Hardware price escalation (%/yr)" },
  { key: "licenseEscalationPct", label: "License & subscription escalation (%/yr)" },
  { key: "adminRate", label: "Admin ($/hr)" },
  { key: "operatorRate", label: "Security staff ($/hr)" },
  { key: "truckRollCost", label: "Truck roll ($)" },
  { key: "creditResidualValue", label: "Credit unused service life at horizon end" },
];

export const SOLUTION_FIELDS: FieldDef<keyof SolutionInputs>[] = [
  { key: "model", label: "Deployment model" },
  {
    key: "discountPct", label: "Discount off list (%)", min: 0, max: 100,
    help: "This vendor's negotiated discount off list price. Applies to readers, controllers, licenses, and servers; not to door hardware, labor, credentials, or your misc items.",
  },
  { key: "reusesReaders", label: "Keeps existing readers" },
  { key: "reusesControllers", label: "Keeps existing controllers" },
  { key: "readerCost", label: "Reader ($/reader)", help: "Price of one reader, for new doors, for replacing readers this solution doesn't keep, and for out-of-warranty failures." },
  { key: "controllerCost", label: "Controller ($/unit)", help: "Price of one door controller with its enclosure and power supply. At least one per site, more if the door count needs it." },
  { key: "doorsPerController", label: "Doors per controller", min: 1, int: true },
  {
    key: "doorHardwareCost", label: "Door hardware ($/door)",
    help: "Lock or electric strike, door position sensor, request-to-exit, and power, for doors that aren't wired yet. Not charged when the doors are already wired, since that hardware stays whoever wins. " + UNSOURCED,
  },
  { key: "newDoorInstallCost", label: "New-door install ($/door)", help: "Labor to wire and install a door from nothing: cabling, lock hardware, reader, controller. " + UNSOURCED },
  { key: "migrationLaborPerDoor", label: "Migration labor ($/door)", help: "Labor to cut a wired door over to this system: re-terminating, swapping whatever changes, programming, testing. Much less than a new install. Not charged for the incumbent." },
  { key: "replacementLaborPerDevice", label: "Replacement labor ($/device)", help: "Labor to swap one failed reader or controller. Charged for every failure, in warranty or not." },
  {
    key: "hardwareHalfLifeYears", label: "Hardware half-life (yrs)", min: 0.5, step: 0.5, decimalScale: 1,
    help: "How long until about half of a batch of readers and controllers has failed, half of the rest by twice that, and so on. " + UNSOURCED,
  },
  { key: "warrantyYears", label: "Warranty (yrs)", step: 0.5, decimalScale: 1, help: "How many years readers and controllers are covered. A failure inside it costs only the labor to swap the device." },
  { key: "tierYears", label: "License term (years)", models: ["cloud"], min: 1, int: true, help: "Length of one license term. The term's price is paid up front at purchase and again at each renewal." },
  { key: "tierPrice", label: "License cost for term ($/door)", models: ["cloud"], help: "Price per door for one full term, before the discount. For a vendor that licenses per reader, enter the per-door equivalent. " + UNSOURCED },
  { key: "siteFeePerYr", label: "Site fee ($/site/yr)", models: ["cloud"], help: "A yearly per-site or per-controller charge some vendors add on top of door licenses. Leave at 0 if there isn't one." },
  { key: "yearsUntilLicenseRenewal", label: "Years until license renewal (incumbent)", models: ["cloud"] },
  { key: "baseLicense", label: "Base license ($, one-time)", models: ["onprem"], help: "Server software license, charged once at year 0 unless this solution is the incumbent. Only the support renewal recurs." },
  { key: "doorLicense", label: "Door license ($/door, one-time)", models: ["onprem"], help: "Per-door license, charged once at year 0 unless this solution is the incumbent. For a vendor that licenses per reader, enter the per-door equivalent." },
  { key: "carePct", label: "Support renewal (% of license/yr)", models: ["onprem"], help: "Yearly software support and upgrade plan as a percentage of the license price. Charged every year, including for the incumbent." },
  { key: "serverCount", label: "Servers", models: ["onprem"], min: 0, int: true, help: "Servers the system runs on: the main server, plus any failover or regional servers." },
  { key: "serverCost", label: "Server ($/unit)", models: ["onprem"], help: "Price of one server, bought at year 0 and on each refresh." },
  { key: "serverSoftwareCost", label: "Server software ($/server)", models: ["onprem"], help: "Windows Server, SQL Server, and any other OS or database licensing, bought with each server and again at each refresh." },
  { key: "serverAdminHrsPerYr", label: "Server upkeep (hrs/server/yr)", models: ["onprem"], help: "Staff hours per server per year for patching, backups, and database upkeep. This is the main admin difference between the two deployment models, so it's its own line rather than a higher per-door figure. " + UNSOURCED },
  { key: "refreshCycleYears", label: "Server refresh cycle (yrs)", models: ["onprem"], min: 1, int: true, help: "How often servers and their software are replaced." },
  { key: "yearsUntilNextRefresh", label: "Years until next refresh", models: ["onprem"], min: 0, int: true, help: NEXT_REFRESH_HELP },
  { key: "cardCost", label: "Card ($/card)", help: "Price of one card or fob, for new hires, lost cards, and any reissue. Secure cards cost more than proximity cards." },
  { key: "mobileSharePct", label: "Mobile credentials (% of cardholders)", min: 0, max: 100, help: "Share of cardholders using a phone instead of a card. They need no card, but may carry a yearly fee." },
  { key: "mobileCostPerUserYr", label: "Mobile credential ($/user/yr)", help: "Yearly fee per mobile credential user. Leave at 0 if the license includes them." },
  { key: "reissueCredentials", label: "Reissue credentials at deployment" },
  { key: "adminHrsPerDoorYr", label: "Admin hrs / door / yr", step: 0.25, decimalScale: 2, help: "Staff hours per door per year for system admin: schedules, firmware, health checks, door troubleshooting. Server upkeep is counted separately. " + UNSOURCED },
  { key: "cardholderChangeMinutes", label: "Minutes per cardholder change", step: 1, decimalScale: 1, help: "Staff time for one add, removal, access change, or lost-credential replacement. Integrations that sync with HR systems can cut it; enter a lower number only for a solution that has one. " + UNSOURCED },
  { key: "alarmMinutes", label: "Minutes per door alarm", step: 0.5, decimalScale: 1, help: "Staff time to look at and close out one door alarm, at the security staff rate. Video linked to the door can shorten it. " + UNSOURCED },
  { key: "truckRollsPerSiteYr", label: "Truck rolls / site / yr", step: 0.5, decimalScale: 1, help: "Paid site visits per site per year for anything other than swapping a failed device, which replacement labor already counts. " + UNSOURCED },
  { key: "networkCostPerSiteYr", label: "Internet / WAN ($/site/yr)", help: "Extra internet or WAN cost per site per year that this solution needs and the other may not. Leave at 0 if it's the same either way." },
];

export const SOLUTION_FIELD_MAP = Object.fromEntries(SOLUTION_FIELDS.map((f) => [f.key, f])) as Record<keyof SolutionInputs, FieldDef<keyof SolutionInputs>>;
export const SCENARIO_FIELD_MAP = Object.fromEntries(SCENARIO_FIELDS.map((f) => [f.key, f])) as Record<keyof ScenarioInputs, FieldDef<keyof ScenarioInputs>>;

export const fieldsFor = (model: SolutionInputs["model"]) => SOLUTION_FIELDS.filter((f) => !f.models || f.models.includes(model));

export const STAFF_TIME_NOTE =
  "Admin, cardholder admin, and alarm handling are estimates of staff time rather than invoices, so they're shown separately from cash costs.";

export const OUTCOME_NOTE =
  "Business impact is your own estimate of how a solution changes costs like theft and rekeying, from the business impact step, so it's shown separately too. A negative figure is a net saving.";
