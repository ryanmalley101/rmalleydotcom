// Industry-specific business impact for access control: costs a business
// already carries that an access control system can raise or lower, new
// costs it can bring, and benefits that can't credibly be priced. The engine
// is shared with the video calculator (_tco-shared/lib/impact.ts); this is
// the access control catalog.
//
// Category codes follow the same value-proposition framework as the video
// catalog (never shown in the UI). The framework's access control props were
// out of scope there; here:
// - OI1 front-desk and credential admin: electronic credential admin is
//   already in the core model (Cardholder admin), so it isn't repeated. What
//   stays here is the mechanical side, rekeying and lost keys.
// - OI6 unattended hours: the cost side (staff opening and locking up by
//   hand) is priced; the revenue side is a consideration.
// - SF3 emergency lockdown: a consideration, with no credible dollar figure.
// Most of these effects come from having access control at all rather than
// from which system, so between two installed systems they're usually small.
//
// Kept free of runtime imports from model.ts (types only) so the model can
// call it without an import cycle.
import {
  adminHours, annual, buildVertical as sharedBuildVertical, createImpact, incidents, merge, text,
  type Consideration, type InputText, type NewCostDef, type OutcomeIcon, type Overrides, type PillarDef,
  type Spec, type Text, type VerticalDef,
} from "../../_tco-shared/lib/impact";

export type Vertical = "education" | "retail" | "healthcare" | "logistics" | "manufacturing" | "property" | "finance";

const PILLARS: PillarDef[] = [
  { prefix: "RL", label: "Risk & liability", description: "Theft, break-ins, and insurance.", icon: "gavel" },
  { prefix: "OI", label: "Operational impact", description: "Keys, staffed doors, and opening and closing sites.", icon: "workflow" },
  { prefix: "CG", label: "Compliance & governance", description: "Access reviews and audits.", icon: "fileCheck" },
  { prefix: "TCO", label: "Other costs a system can replace", description: "Separate tools, contracts, and integrations.", icon: "wallet" },
  { prefix: "NEW", label: "New costs", description: "Costs a system can bring that you don't have today.", icon: "dollar" },
];

// Weekly staff hours per site × an hourly rate × 52 weeks.
function weeklyHours(code: string, t: Text, hours: InputText, rate: InputText): Spec {
  return {
    id: code, code, ...t,
    inputs: [{ name: "hours", unit: "hours", ...hours }, { name: "rate", unit: "usd", ...rate }],
    annualPerSite: (v) => v("hours") * v("rate") * 52,
  };
}

// The generic version of each priced prop, worded for any industry.
const PRICED: Record<string, (o?: Overrides) => Spec> = {
  RL2: (o) => annual("RL2",
    text({ label: "Theft & unauthorized entry", icon: "outsideTheft", help: "What theft by people who shouldn't have been inside costs each site today. Badge-controlled doors and revoking access the day someone leaves can reduce it; door hardware alone doesn't stop tailgating." }, o),
    merge<InputText>({ label: "Theft & unauthorized-entry losses ($/site/yr)", icon: "outsideTheft", help: "Yearly losses per site to theft involving people who got in without authorization, or kept access they should have lost.", default: 10_000 }, o?.amount)),
  RL3: (o) => incidents("RL3",
    text({ label: "After-hours break-ins", icon: "hammer", help: "Incidents × average cost. Door position sensors and forced-door alarms flag a break-in as it happens, and scheduled locking leaves fewer doors open by mistake." }, o),
    merge<InputText>({ label: "Break-ins per site per year", icon: "hammer", help: "After-hours forced entries and break-ins per site per year.", default: 0.5 }, o?.count),
    merge<InputText>({ label: "Average break-in cost ($)", icon: "dollar", help: "Average cost of one break-in: repairs, stolen property, and downtime.", default: 8_000 }, o?.cost)),
  RL5: (o) => annual("RL5",
    text({ label: "Insurance premiums", icon: "umbrella", help: "A % change to what you pay for property and liability insurance. Some carriers credit electronic access control; ask yours before claiming any change." }, o),
    merge<InputText>({ label: "Insurance premiums ($/site/yr)", icon: "umbrella", help: "Yearly property and liability premiums per site.", default: 15_000 }, o?.amount)),
  OI1: (o) => incidents("OI1",
    text({ label: "Rekeying & lost keys", icon: "key", help: "Rekey events × average cost. A lost or unreturned mechanical key can mean rekeying every lock it opens; an electronic credential is revoked in software. Mostly relevant against an incumbent that still relies on keys for some doors." }, o),
    merge<InputText>({ label: "Rekey events per site per year", icon: "key", help: "Times per site per year that locks are rekeyed or cores replaced because a key was lost or not returned.", default: 2 }, o?.count),
    merge<InputText>({ label: "Average rekey cost ($)", icon: "dollar", help: "Locksmith time, new cores, and new keys for one rekeying.", default: 1_500 }, o?.cost)),
  OI2: (o) => weeklyHours("OI2",
    text({ label: "Staffed entrances", icon: "guard", help: "Hours × rate × 52 weeks. Badge readers and remote door release can replace some hours of a guard or attendant checking people in at a door." }, o),
    merge<InputText>({ label: "Attended door hours per site per week", icon: "clock", help: "Hours per site per week that a guard or attendant stands at a door to let people in.", default: 20 }, o?.hours),
    merge<InputText>({ label: "Attendant rate ($/hr)", icon: "dollar", help: "Billed hourly rate for a contract guard, or the loaded cost of in-house staff.", default: 35 }, o?.cost)),
  OI6: (o) => weeklyHours("OI6",
    text({ label: "Lock-up & unlock rounds", icon: "unlock", help: "Hours × rate × 52 weeks. Door schedules unlock and lock doors automatically, so nobody walks the building with keys, and doors aren't left open by mistake." }, o),
    merge<InputText>({ label: "Lock-up and unlock hours per site per week", icon: "clock", help: "Staff hours per site per week spent unlocking doors in the morning and locking up at night.", default: 3 }, o?.hours),
    merge<InputText>({ label: "Staff rate ($/hr)", icon: "dollar", help: "Loaded hourly cost of whoever does the rounds.", default: 30 }, o?.cost)),
  CG1: (o) => adminHours("CG1",
    text({ label: "Access reviews & audit prep", icon: "fileCheck", help: "Staff hours × the admin rate. Reports of who can open which doors, and who did, make periodic access reviews and audits faster." }, o),
    merge<InputText>({ label: "Access review and audit hours per site per year", icon: "clock", help: "Staff hours per site per year spent reviewing who has access and producing door records for audits. Costed at the admin rate in the scenario's advanced settings.", default: 24 }, o?.hours)),
  TCO4: (o) => annual("TCO4",
    text({ label: "Other tools & contracts", icon: "swap", help: "What you pay for things an access control platform can take over, such as key management cabinets, separate badge-printing software, or a door-alarm monitoring contract. -100% means fully replaced; only claim it for a solution that actually has the feature." }, o),
    merge<InputText>({ label: "Replaceable tool costs ($/site/yr)", icon: "swap", help: "Yearly cost per site of tools and contracts an access control platform could replace, hardware spread over its life.", default: 1_000 }, o?.amount)),
  TCO6: (o) => annual("TCO6",
    text({ label: "Integration & middleware", icon: "plug", help: "What it costs to connect access control to your other systems today: HR, video, elevators, directory. Open APIs and built-in integrations can reduce it." }, o),
    merge<InputText>({ label: "Integration costs ($/site/yr)", icon: "plug", help: "Yearly cost per site of middleware, integration licenses, and custom-integration upkeep.", default: 1_000 }, o?.amount)),
};

const PRICED_ORDER = ["RL2", "RL3", "RL5", "OI1", "OI2", "OI6", "CG1", "TCO4", "TCO6"];

const NEW_COSTS: NewCostDef[] = [
  {
    id: "biometricCompliance", unit: "usdPerYear", icon: "fingerprint", label: "Biometric compliance",
    help: "Yearly cost of using fingerprint or face readers lawfully, across the company: legal review, consent, retention policies, and the exposure under biometric privacy laws such as Illinois's BIPA. Leave at 0 for a solution where it isn't used.",
  },
  {
    id: "alarmMonitoring", unit: "usdPerSiteMonth", icon: "bell", label: "Door alarm monitoring service",
    help: "Monthly fee per site for an outside service that watches door alarms. Door alarms your own staff handle are already counted under alarm handling.",
  },
];

// Kept typed by this calculator's own industry ids.
type AccessVerticalDef = VerticalDef & { id: Vertical };
const buildVertical = (id: Vertical, label: string, icon: OutcomeIcon, specs: Spec[], suggested: string[]): AccessVerticalDef =>
  ({ ...sharedBuildVertical(id, label, icon, specs, suggested, PILLARS, NEW_COSTS), id });

const specsFor = (overrides: Record<string, Overrides> = {}): Spec[] => PRICED_ORDER.map((code) => PRICED[code](overrides[code]));

export const VERTICALS: AccessVerticalDef[] = [
  buildVertical("education", "K-12 & Higher Ed", "school", specsFor({
    OI1: { count: { label: "Rekey events per campus per year" } },
    OI6: { hours: { label: "Lock-up and unlock hours per campus per week" } },
    RL3: { count: { label: "Break-ins per campus per year" } },
  }), ["OI1", "OI6", "RL3"]),

  buildVertical("retail", "Retail & Convenience", "store", specsFor({
    RL2: { label: "Back-of-house theft", help: "What theft through stockrooms, receiving doors, and offices costs each store today. Badge-controlled back doors and same-day access removal can reduce it.", amount: { label: "Back-of-house theft ($/store/yr)" } },
    OI1: { count: { label: "Rekey events per store per year" } },
    OI6: { hours: { label: "Opening and closing hours per store per week" } },
  }), ["RL2", "OI1", "OI6"]),

  buildVertical("healthcare", "Healthcare", "hospital", specsFor({
    RL2: { label: "Theft & drug diversion", help: "What theft of medications, equipment, and supplies costs each facility today. Badge records on pharmacies and supply rooms show who went in.", amount: { label: "Theft & diversion losses ($/facility/yr)" } },
    CG1: { help: "Staff hours × the admin rate. Regulators and accreditors ask who can enter pharmacies, records rooms, and other restricted areas; door reports answer quickly.", hours: { label: "Access review and audit hours per facility per year" } },
  }), ["RL2", "CG1"]),

  buildVertical("logistics", "Logistics & Transportation", "truck", specsFor({
    RL2: { label: "Cargo theft", amount: { label: "Cargo theft losses ($/facility/yr)", help: "Yearly losses per facility to cargo theft and pilferage by people who got in without authorization." } },
    OI2: { label: "Staffed gates & entrances", hours: { label: "Attended gate hours per facility per week", help: "Hours per facility per week that a guard checks drivers and visitors in at a gate or door." } },
  }), ["RL2", "OI2"]),

  buildVertical("manufacturing", "Manufacturing & Industrial", "factory", specsFor({
    RL2: { label: "Theft & unauthorized entry", amount: { label: "Theft & unauthorized-entry losses ($/facility/yr)" } },
    CG1: { help: "Staff hours × the admin rate. Restricted-area records for safety programs and customer audits.", hours: { label: "Access review and audit hours per facility per year" } },
    OI1: { count: { label: "Rekey events per facility per year" } },
  }), ["RL2", "CG1", "OI1"]),

  buildVertical("property", "Property Management & CRE", "building", specsFor({
    OI1: { help: "Rekey events × average cost. Tenant turnover with mechanical keys often means rekeying suites and common doors; electronic credentials are revoked in software.", count: { label: "Rekey events per property per year" } },
    OI2: { label: "Lobby & front-desk staffing", hours: { label: "Attended lobby hours per property per week" } },
    TCO4: { amount: { label: "Replaceable tool costs ($/property/yr)" } },
  }), ["OI1", "OI2", "TCO4"]),

  buildVertical("finance", "Finance", "bank", specsFor({
    CG1: { label: "Regulatory access reviews", hours: { label: "Access review and audit hours per branch per year" } },
    RL2: { amount: { label: "Theft & unauthorized-entry losses ($/branch/yr)" } },
  }), ["CG1", "RL2"]),
];

// Real but not priced: no credible dollar figure, or revenue rather than
// cost. Ticked per solution and listed beside the totals, never in them.
export const CONSIDERATIONS: Consideration[] = [
  { code: "SF3", icon: "lock", label: "Emergency lockdown", help: "Locking every door, or a chosen set, from one place in an emergency. Real safety value with no credible dollar figure." },
  { code: "CG2", icon: "scroll", label: "Door access audit trail", help: "A record of who opened which door and when, for investigations. The hours it saves in audits are priced under access reviews." },
  { code: "CG4", icon: "badge", label: "Certifications buyers require", help: "Certifications some buyers require before purchase, such as SOC 2, FedRAMP, or FICAM approval." },
  { code: "CG6", icon: "shield", label: "Cybersecurity posture", help: "How exposed the system is to attack: open ports, patching, encrypted reader protocols such as OSDP Secure Channel, and the vendor's own security record. This cuts both ways; tick it only where a solution is clearly stronger." },
  { code: "SF5", icon: "handshake", label: "Stakeholder & community confidence", help: "Trust from employees, tenants, parents, or patients that a site is secure." },
  { code: "OI7", icon: "people", label: "Occupancy & space insights", help: "Badge data used to plan space and staffing. Hard to price; consolidating space it reveals is its real value." },
  { code: "OI6R", icon: "moon", label: "Unattended operating hours", help: "Opening a site, or part of it, without staff present, such as after-hours access for members or tenants. Revenue, not cost.", revenue: true },
];

export const OUT_OF_SCOPE = [
  "visitor and guest management",
  "intercom and remote door release",
  "elevator control",
  "intrusion alarm panels",
  "video (see the video surveillance TCO calculator)",
];

// The catalog's functions, bound to it.
export const IMPACT = createImpact({ verticals: VERTICALS, considerations: CONSIDERATIONS, outOfScope: OUT_OF_SCOPE });
export const { verticalFor, considerationsFor, annualOutcomes, outcomeReportRows } = IMPACT;

export { changeValue, isCategoryEnabled } from "../../_tco-shared/lib/impact";
