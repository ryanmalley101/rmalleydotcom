// Industry-specific business impact: costs a business already carries (theft,
// injury claims, guards) that a video system can raise or lower, new costs a
// system can bring with it (compliance work, monitoring fees), and benefits
// that can't credibly be priced. Separate from the hardware/license/labor
// math in model.ts because these are effects of what the system is used for,
// not of what it costs to run, and they're the softest numbers in a
// comparison.
//
// The categories follow a value-proposition framework of five pillars
// (Safety, Risk & liability, Operational impact, Compliance & governance,
// Total cost of ownership), each prop with a code such as RL2 (theft,
// shrink & fraud). `code` keeps that mapping; it's never shown in the UI.
// Of the framework's 34 props:
// - 16 are priced here, as a cost the business has today ("existing").
// - 4 are already in the core cost model and deliberately left out, so they
//   aren't counted twice: SF7 investigations (hours per investigation),
//   TCO1 infrastructure (servers/NVRs/storage), TCO2 maintenance (admin
//   hours, truck rolls), TCO5 deployment (install labor).
// - 9 are CONSIDERATIONS below: real, but either revenue rather than cost or
//   with no credible dollar figure. Ticked per solution, never in a total.
// - 5 come from products this calculator doesn't price (access control,
//   environmental sensors, intercom, guest management, fleet), so they're
//   out of scope (OUT_OF_SCOPE): counting their benefit without their cost
//   would tilt the comparison.
//
// The engine (kinds of category, how a change becomes a yearly amount, the
// incumbent rule) is shared with the access control calculator; see
// _tco-shared/lib/impact.ts. This file is the video catalog: every industry
// offers the same priced props, with its own wording and placeholders where
// it matters, and pre-checks the ones its section of the framework names
// (`suggested`).
//
// Kept free of runtime imports from model.ts (types only) so the model can
// call it without an import cycle, like sanitize.ts.
import {
  annual, buildVertical as sharedBuildVertical, createImpact, incidents, merge, text,
  type Consideration, type InputSpec, type InputText, type NewCostDef, type OutcomeIcon, type Overrides, type PillarDef, type Spec,
  type VerticalDef,
} from "../../_tco-shared/lib/impact";

export {
  NEW_COST_UNIT_LABEL, annualBaselinePerSite, baselineValue, changeValue, inputsInUse, isCategoryEnabled,
} from "../../_tco-shared/lib/impact";
export type {
  Consideration, NewCostUnit, OutcomeCategory, OutcomeGroup, OutcomeIcon, OutcomeInput, OutcomeInputUnit, VerticalDef,
} from "../../_tco-shared/lib/impact";

export type Vertical = "education" | "retail" | "healthcare" | "logistics" | "manufacturing" | "property" | "finance";

// The framework's pillars, in its order, as group headings. "NEW" holds the
// new costs, which aren't part of the framework.
const PILLARS: PillarDef[] = [
  { prefix: "SF", label: "Safety", description: "Harm to people, and the claims that follow.", icon: "safety" },
  { prefix: "RL", label: "Risk & liability", description: "Theft, damage, disputes, and insurance.", icon: "gavel" },
  { prefix: "OI", label: "Operational impact", description: "Staffing, process failures, waste, and lost assets.", icon: "workflow" },
  { prefix: "CG", label: "Compliance & governance", description: "Audits, records requests, and citations.", icon: "fileCheck" },
  { prefix: "TCO", label: "Other costs a system can replace", description: "Separate tools, contracts, and fines.", icon: "wallet" },
  { prefix: "NEW", label: "New costs", description: "Costs a system can bring that you don't have today.", icon: "dollar" },
];

// ---------------------------------------------------------------------------
// Priced categories, built with the shared helpers (incidents, annual): one
// category plus the shared inputs it needs; an input's key is
// `<industry>.<category>.<name>` unless it sets its own (to share it between
// categories, like retail's sales and shrink). Each is the generic version,
// worded for any industry; an industry overrides only the text and
// placeholders that differ for it.

const PRICED: Record<string, (o?: Overrides) => Spec> = {
  SF1: (o) => incidents("SF1",
    text({ label: "Violence & aggression", icon: "alert", help: "Incidents × average cost. Fight and person-of-interest alerts can interrupt incidents and speed up the response; the cost includes injuries, lost work time, and legal exposure." }, o),
    merge<InputText>({ label: "Violent incidents per site per year", icon: "alert", help: "Assaults, fights, and threats against staff or visitors per site per year.", default: 1 }, o?.count),
    merge<InputText>({ label: "Average incident cost ($)", icon: "dollar", help: "Injury and medical costs, lost work time, turnover, and legal costs for one incident. A placeholder; use your own claims history.", default: 20_000 }, o?.cost)),
  SF8: (o) => incidents("SF8",
    text({ label: "Workplace injury claims", icon: "hardHat", help: "Claims × average cost. Footage helps resolve disputed claims, and near-miss reviews help find unsafe practices before someone is hurt." }, o),
    merge<InputText>({ label: "Workers' comp claims per site per year", icon: "hardHat", help: "Employee injury claims per site per year.", default: 0.5 }, o?.count),
    merge<InputText>({ label: "Average workers' comp claim cost ($)", icon: "gavel", help: "Average total cost of one claim. A placeholder; use your own claims history.", default: 40_000 }, o?.cost)),
  RL1: (o) => incidents("RL1",
    text({ label: "Liability claims & disputes", icon: "gavel", help: "Claims × average cost. Footage can disprove false claims and settle real ones faster, but only if it's still there: claims often arrive months after the incident, after short retention has overwritten it." }, o),
    merge<InputText>({ label: "Liability claims per site per year", icon: "gavel", help: "Injury, damage, and other liability claims and disputes per site per year.", default: 1 }, o?.count),
    merge<InputText>({ label: "Average liability claim cost ($)", icon: "dollar", help: "Average total cost of one claim: payout plus legal defense and adjuster time. A placeholder; your insurer or risk team will have the real figure.", default: 30_000 }, o?.cost)),
  RL2: (o) => annual("RL2",
    text({ label: "Theft & fraud", icon: "outsideTheft", help: "What theft and fraud cost each site today. Deterrence, person-of-interest alerts, and video linked to transactions can reduce it; only claim the transaction part for a solution that has that integration." }, o),
    merge<InputText>({ label: "Theft & fraud losses ($/site/yr)", icon: "outsideTheft", help: "Yearly losses per site to theft and fraud, internal and external.", default: 20_000 }, o?.amount)),
  RL3: (o) => incidents("RL3",
    text({ label: "Break-ins & vandalism", icon: "hammer", help: "Incidents × average cost. Deterrence, after-hours perimeter alerts, and talk-down speakers. Research on CCTV has found its clearest effects in parking lots." }, o),
    merge<InputText>({ label: "Break-ins & vandalism per site per year", icon: "hammer", help: "After-hours break-ins, graffiti, and other property damage per site per year.", default: 0.5 }, o?.count),
    merge<InputText>({ label: "Average break-in or vandalism cost ($)", icon: "dollar", help: "Average cost of one incident: repairs, stolen property, and downtime.", default: 8_000 }, o?.cost)),
  RL5: (o) => annual("RL5",
    text({ label: "Insurance premiums", icon: "umbrella", help: "A % change to what you pay for property and liability insurance. Some carriers credit verified monitoring or strong video evidence; ask yours before claiming any change." }, o),
    merge<InputText>({ label: "Insurance premiums ($/site/yr)", icon: "umbrella", help: "Yearly property and liability premiums per site.", default: 15_000 }, o?.amount)),
  OI2: (o) => ({
    id: "OI2", code: "OI2",
    ...text({ label: "Security guards", icon: "guard", help: "Hours × rate × 52 weeks. Remote and virtual guarding can replace some on-site hours; turn on \"Remote video monitoring\" under New costs and enter what it costs, so both sides of the trade show up." }, o),
    inputs: [
      merge<InputSpec>({ name: "hours", unit: "hours", label: "Guard hours per site per week", icon: "clock", help: "On-site security guard hours per site per week.", default: 40 }, o?.hours),
      merge<InputSpec>({ name: "rate", unit: "usd", label: "Guard rate ($/hr)", icon: "dollar", help: "Billed hourly rate for a contract guard, or the loaded cost of an in-house one.", default: 35 }, o?.cost),
    ],
    annualPerSite: (v) => v("hours") * v("rate") * 52,
    formula: "{hours}*{rate}*52",
  }),
  OI3: (o) => annual("OI3",
    text({ label: "Process & SOP failures", icon: "clipboard", help: "What missed procedures cost today: rework, defects, and failed checks. Reviewing footage of how work is actually done can show where procedures slip." }, o),
    merge<InputText>({ label: "Cost of process failures ($/site/yr)", icon: "clipboard", help: "Yearly cost per site of rework, defects, and procedures not followed.", default: 10_000 }, o?.amount)),
  OI4: (o) => annual("OI4",
    text({ label: "Operational waste", icon: "waste", help: "What avoidable waste costs today. Footage and occupancy data can show where it happens." }, o),
    merge<InputText>({ label: "Operational waste ($/site/yr)", icon: "waste", help: "Yearly cost per site of avoidable waste.", default: 5_000 }, o?.amount)),
  OI5: (o) => annual("OI5",
    text({ label: "Lost assets & inventory errors", icon: "boxes", help: "What lost equipment and inventory mistakes cost today. License plate recognition and footage at docks and storage areas help track what moves where." }, o),
    merge<InputText>({ label: "Asset & inventory losses ($/site/yr)", icon: "boxes", help: "Yearly cost per site of lost equipment, mis-shipments, and inventory errors.", default: 10_000 }, o?.amount)),
  CG1: (o) => ({
    id: "CG1", code: "CG1",
    ...text({ label: "Audit preparation", icon: "fileCheck", help: "Staff hours × the admin rate. Long retention and quick footage search make it faster to produce evidence for auditors and inspectors." }, o),
    inputs: [merge<InputSpec>({ name: "hours", unit: "hours", label: "Audit prep hours per site per year", icon: "clock", help: "Staff hours per site per year spent gathering records and footage for audits and inspections. Costed at the admin rate in the scenario's advanced settings.", default: 40 }, o?.hours)],
    annualPerSite: (v) => v("hours") * v("scenario.adminRate"),
    formula: "{hours}*{scenario.adminRate}",
  }),
  CG3: (o) => ({
    id: "CG3", code: "CG3",
    ...text({ label: "Records requests & redaction", icon: "eyeOff", help: "Requests × hours each × the admin rate. Automatic face blurring can cut the time spent redacting footage before it's shared." }, o),
    inputs: [
      merge<InputSpec>({ name: "count", unit: "count", label: "Footage requests per site per year", icon: "scroll", help: "Requests for footage from police, lawyers, insurers, or the public that need people blurred before release.", default: 10 }, o?.count),
      merge<InputSpec>({ name: "hours", unit: "hours", label: "Hours to redact one request", icon: "clock", help: "Staff hours to find, redact, and release the footage for one request. Costed at the admin rate in the scenario's advanced settings.", default: 3 }, o?.hours),
    ],
    annualPerSite: (v) => v("count") * v("hours") * v("scenario.adminRate"),
    formula: "{count}*{hours}*{scenario.adminRate}",
  }),
  CG5: (o) => incidents("CG5",
    text({ label: "Safety & health citations", icon: "citation", help: "Citations × average cost. Footage that shows a safety procedure was followed can answer an inspector's question on the spot." }, o),
    merge<InputText>({ label: "Citations per site per year", icon: "citation", help: "Safety, health, or environmental citations per site per year.", default: 0.2 }, o?.count),
    merge<InputText>({ label: "Average citation cost ($)", icon: "dollar", help: "Average fine plus the cost of fixing and documenting the finding.", default: 15_000 }, o?.cost)),
  TCO3: (o) => incidents("TCO3",
    text({ label: "False-alarm fines", icon: "siren", help: "False alarms × fine. Checking an alarm against video before dispatch cuts false dispatches." }, o),
    merge<InputText>({ label: "False alarms per site per year", icon: "siren", help: "Intrusion alarms that turned out to be false and drew a police dispatch.", default: 2 }, o?.count),
    merge<InputText>({ label: "Average false-alarm fine ($)", icon: "dollar", help: "What one false dispatch costs. Many cities fine after a set number per year, and some only respond to verified alarms.", default: 150 }, o?.cost)),
  TCO4: (o) => annual("TCO4",
    text({ label: "Other vendors' tools & contracts", icon: "swap", help: "What you pay other vendors for things a video platform can take over, such as people counters or a separate analytics tool. -100% means fully replaced; only claim it for a solution that actually has the feature." }, o),
    merge<InputText>({ label: "Replaceable vendor costs ($/site/yr)", icon: "swap", help: "Yearly cost per site of other vendors' tools and contracts a video platform could replace, hardware spread over its life.", default: 1_200 }, o?.amount)),
  TCO6: (o) => annual("TCO6",
    text({ label: "Integration & middleware", icon: "plug", help: "What it costs to connect the video system to your other systems today: custom middleware, integration licenses, and upkeep. Open APIs and built-in integrations can reduce it." }, o),
    merge<InputText>({ label: "Integration costs ($/site/yr)", icon: "plug", help: "Yearly cost per site of middleware, integration licenses, and custom-integration upkeep.", default: 1_000 }, o?.amount)),
};

// The order each industry lists its priced props in, within its pillars.
const PRICED_ORDER = ["SF1", "SF8", "RL2", "RL1", "RL3", "RL5", "OI2", "OI3", "OI4", "OI5", "CG1", "CG3", "CG5", "TCO3", "TCO4", "TCO6"];

// New costs, the same for every industry.
const NEW_COSTS: NewCostDef[] = [
  {
    id: "biometricCompliance", unit: "usdPerYear", icon: "face", label: "Face recognition compliance",
    help: "Yearly cost of using face recognition lawfully, across the company: legal review, signage, consent, and the exposure under biometric privacy laws such as Illinois's BIPA. Leave at 0 for a solution where it isn't used.",
  },
  {
    id: "alertReview", unit: "hoursPerSiteWeek", icon: "bell", label: "Alert review time",
    help: "Staff hours per site per week spent reviewing AI alerts, including false positives, at the investigator rate. Can offset some of the investigation time a faster search saves.",
  },
  {
    id: "remoteMonitoring", unit: "usdPerSiteMonth", icon: "cctv", label: "Remote video monitoring",
    help: "Monthly fee per site for a monitoring service that watches live video or verifies alarms.",
  },
];

// Kept typed by this calculator's own industry ids.
type CameraVerticalDef = VerticalDef & { id: Vertical };
const buildVertical = (id: Vertical, label: string, icon: OutcomeIcon, specs: Spec[], suggested: string[]): CameraVerticalDef =>
  ({ ...sharedBuildVertical(id, label, icon, specs, suggested, PILLARS, NEW_COSTS), id });

// Every priced prop, in order, with this industry's overrides; `replace`
// swaps one prop for a custom set of categories (retail's split shrink).
function specsFor(overrides: Record<string, Overrides> = {}, replace: Record<string, Spec[]> = {}): Spec[] {
  return PRICED_ORDER.flatMap((code) => replace[code] ?? [PRICED[code](overrides[code])]);
}

// Retail splits shrink into outside and employee theft, since only a
// solution with POS integration can claim much against the second. Both
// read the same sales and shrink inputs.
const RETAIL_SHRINK_INPUTS: InputSpec[] = [
  {
    name: "sales", key: "retail.salesPerSite", label: "Annual sales per store ($)", icon: "sales", unit: "usd", default: 3_000_000,
    help: "Average yearly sales per store. Shrink is measured as a share of sales.",
  },
  {
    name: "shrink", key: "retail.shrinkPct", label: "Shrink (% of sales)", icon: "shrink", unit: "pct", default: 1.6,
    help: "Inventory lost to theft, fraud, and errors, as a share of sales. NRF's National Retail Security Survey has reported averages around 1.4-1.6%, but it varies widely by format and location. Use your own figure.",
  },
];
const RETAIL_SHRINK: Spec[] = [
  {
    id: "RL2.external", code: "RL2", label: "Shoplifting & organized retail crime", icon: "outsideTheft",
    help: "Sales × shrink × outside-theft share. Visible cameras and public-view monitors can deter theft, and faster footage search helps build cases against repeat offenders. Evidence on how much varies widely; most published figures are vendor case studies.",
    inputs: [...RETAIL_SHRINK_INPUTS, {
      name: "share", key: "retail.externalSharePct", label: "Share of shrink from outside theft (%)", icon: "outsideTheft", unit: "pct", default: 36,
      help: "How much of shrink comes from shoplifting and organized retail crime. NRF's survey has put it at roughly a third. Use your own loss-prevention numbers where you have them.",
    }],
    annualPerSite: (v) => v("sales") * (v("shrink") / 100) * (v("share") / 100),
    formula: "{sales}*({shrink}/100)*({share}/100)",
  },
  {
    id: "RL2.internal", code: "RL2", label: "Employee theft & POS fraud", icon: "employeeTheft",
    help: "Sales × shrink × employee-theft share. Video linked to POS transactions can flag refund, void, and cash-handling abuse. Only claim a change for a solution that actually has POS integration.",
    inputs: [...RETAIL_SHRINK_INPUTS, {
      name: "share", key: "retail.internalSharePct", label: "Share of shrink from employee theft (%)", icon: "employeeTheft", unit: "pct", default: 29,
      help: "How much of shrink comes from employee theft and POS fraud (sweethearting, void and refund abuse). NRF's survey has put it at a little under a third.",
    }],
    annualPerSite: (v) => v("sales") * (v("shrink") / 100) * (v("share") / 100),
    formula: "{sales}*({shrink}/100)*({share}/100)",
  },
];

const store = (s: string) => s.replace(/\bsite\b/g, "store");

export const VERTICALS: CameraVerticalDef[] = [
  buildVertical("education", "K-12 & Higher Ed", "school", specsFor({
    SF1: { label: "Fights & violent incidents", help: "Incidents × average cost. Fight detection and person-of-interest search can interrupt incidents and speed up the response; the cost includes injuries, staff time, and legal exposure.", count: { label: "Violent incidents per campus per year" } },
    RL3: { count: { label: "Vandalism incidents per campus per year", help: "Graffiti, restroom and property damage, and after-hours break-ins per campus per year." } },
    CG3: { label: "Records requests & redaction (FERPA)", help: "Requests × hours each × the admin rate. Footage that shows students has to be redacted before most releases; automatic face blurring can cut that time.", count: { label: "Footage requests per campus per year", help: "Requests from parents, police, or lawyers for footage that shows students and needs redaction before release." } },
  }), ["SF1", "RL3", "CG3"]),

  buildVertical("retail", "Retail & Convenience", "store", specsFor({
    SF1: { count: { label: store("Violent incidents per site per year") } },
    SF8: { count: { label: store("Workers' comp claims per site per year") } },
    RL1: { label: "Slip-and-fall & liability claims", count: { label: store("Slip-and-fall claims per site per year"), help: "Customer injury and general liability claims per store per year." } },
    RL3: { count: { label: store("Break-ins & vandalism per site per year"), help: "After-hours break-ins, smash-and-grabs, graffiti, and other property damage per store per year." }, cost: { help: "Average cost of one incident: repairs, boarding up, stolen merchandise, lost trading hours." } },
    RL5: { amount: { label: "Insurance premiums ($/store/yr)" } },
    OI2: { hours: { label: store("Guard hours per site per week"), default: 0 } },
    OI3: { help: "What missed procedures cost today, such as opening and closing checks, cash handling, and planogram compliance. Reviewing footage can show where they slip.", amount: { label: "Cost of process failures ($/store/yr)" } },
    OI4: { amount: { label: "Operational waste ($/store/yr)" } },
    OI5: { amount: { label: "Asset & inventory losses ($/store/yr)", help: "Yearly cost per store of receiving disputes, short deliveries, and inventory errors outside of shrink." } },
    CG1: { hours: { label: store("Audit prep hours per site per year") } },
    CG3: { count: { label: store("Footage requests per site per year") } },
    CG5: { count: { label: store("Citations per site per year") } },
    TCO3: { count: { label: store("False alarms per site per year") } },
    TCO4: { label: "People counters & traffic analytics", help: "What you pay other vendors for door counters, occupancy sensors, and traffic, heat-map, or queue analytics. -100% means a solution's own camera-based counting fully replaces them; only claim it for a solution that has that feature.", amount: { label: "People counting & traffic analytics ($/store/yr)", icon: "people" } },
    TCO6: { amount: { label: "Integration costs ($/store/yr)" } },
  }, { RL2: RETAIL_SHRINK }), ["RL2.external", "RL2.internal", "RL1", "TCO3", "TCO4"]),

  buildVertical("healthcare", "Healthcare", "hospital", specsFor({
    SF1: { label: "Workplace violence", help: "Incidents × average cost. Aggression alerts and faster response in high-risk care areas such as the emergency department and behavioral health; the cost includes staff injuries, lost time, and turnover.", count: { label: "Workplace violence incidents per facility per year", help: "Assaults and threats against staff per facility per year." } },
    CG1: { help: "Staff hours × the admin rate. Producing video evidence quickly helps with regulatory reviews, such as EMTALA investigations.", hours: { label: "Audit prep hours per facility per year" } },
  }), ["SF1", "CG1"]),

  buildVertical("logistics", "Logistics & Transportation", "truck", specsFor({
    SF8: { label: "Dock, yard & warehouse injuries", count: { label: "Workers' comp claims per facility per year", help: "Injury claims from docks, yards, and warehouse floors per facility per year. Vehicle and driver incidents need fleet cameras, which this calculator doesn't cover." } },
    RL1: { label: "Damage & liability claims", count: { label: "Damage and liability claims per facility per year", help: "Cargo damage, yard collisions, and third-party claims per facility per year." } },
    RL2: { label: "Cargo theft & fraud", amount: { label: "Cargo theft & fraud losses ($/facility/yr)", help: "Yearly losses per facility to cargo theft, pilferage, and fraud." } },
    OI5: { label: "Mis-shipments & loading errors", amount: { label: "Mis-shipment costs ($/facility/yr)", help: "Yearly cost per facility of wrong or short loads, re-deliveries, and chargebacks." } },
  }), ["SF8", "RL1"]),

  buildVertical("manufacturing", "Manufacturing & Industrial", "factory", specsFor({
    RL3: { label: "Break-ins, vandalism & metal theft", help: "Incidents × average cost. Perimeter detection and after-hours monitoring at remote yards, where copper and scrap metal theft is common.", count: { label: "Break-ins & theft per facility per year" } },
    OI3: { label: "Rework & SOP failures", help: "What missed procedures cost today: rework, scrap, and quality escapes. Reviewing footage of the production floor can show where procedures slip.", amount: { label: "Rework & quality costs ($/facility/yr)" } },
    OI5: { label: "Loading errors & inventory mismatches", help: "What wrong or short loads cost today. Matching footage of outgoing trucks to weighbridge and inventory records helps verify they're loaded correctly.", amount: { label: "Loading & inventory errors ($/facility/yr)" } },
    CG1: { help: "Staff hours × the admin rate. Footage that shows a procedure such as lockout/tagout was followed answers an inspector's question quickly.", hours: { label: "Audit & inspection prep hours per facility per year" } },
    CG5: { label: "OSHA citations", count: { label: "OSHA citations per facility per year" } },
  }), ["RL3", "OI3", "OI5", "CG1", "CG5"]),

  buildVertical("property", "Property Management & CRE", "building", specsFor({
    OI2: { help: "Hours × rate × 52 weeks. Remote and virtual guarding can replace some on-site guard contracts; turn on \"Remote video monitoring\" under New costs and enter what it costs, so both sides of the trade show up.", hours: { label: "Guard hours per property per week" } },
    OI4: { label: "Underused space", help: "What space nobody uses costs today. Occupancy heat maps show which areas can be consolidated or re-leased.", amount: { label: "Cost of underused space ($/property/yr)", help: "Yearly rent and upkeep per property for space that sits mostly empty." } },
    TCO4: { label: "Legacy security providers", help: "What you pay other security providers that one platform could replace, such as separate monitoring or analytics contracts. Enter guard contracts under Security guards instead. -100% means fully replaced.", amount: { label: "Other security provider costs ($/property/yr)", default: 5_000 } },
  }), ["OI2", "OI4", "TCO4"]),

  buildVertical("finance", "Finance", "bank", specsFor({
    RL2: { label: "Teller & transaction fraud", help: "What fraud costs each branch today. Video linked to teller and transaction records can flag suspicious transactions; only claim that part for a solution with the integration.", amount: { label: "Fraud losses ($/branch/yr)", help: "Yearly losses per branch to teller, transaction, and ATM fraud." } },
    CG1: { label: "Regulatory audit preparation", hours: { label: "Audit prep hours per branch per year" } },
  }), ["RL2", "RL1", "CG1"]),
];

// Benefits that are real but not priced, because they're revenue rather than
// cost or there's no credible dollar figure. Several are how a priced saving
// happens (proactive alerts reduce theft, faster response reduces harm), so
// pricing them too would count them twice. Ticked per solution
// (SolutionInputs.considerations) and listed beside the totals, never in them.
export const CONSIDERATIONS: Consideration[] = [
  { code: "SF2", icon: "radar", label: "Proactive alerts that interrupt incidents", help: "Line-crossing, loitering, and similar alerts that let staff step in while something is happening. Its dollar value shows up in theft and damage, so it isn't priced separately." },
  { code: "SF6", icon: "timer", label: "Faster incident response", help: "Alerts routed to the right people, and live video shared with responders. Its dollar value shows up in safety and damage costs." },
  { code: "SF5", icon: "handshake", label: "Stakeholder & community confidence", help: "Trust from employees, customers, parents, or tenants that a site is safe." },
  { code: "RL4", icon: "cameraOff", label: "Tamper alerts that prevent recording gaps", help: "Alerts when a camera is blocked, moved, or offline, so an incident isn't missed for lack of footage." },
  { code: "CG2", icon: "scroll", label: "Audit trails for footage access", help: "A record of who viewed, exported, or shared footage, for chain of custody." },
  { code: "CG4", icon: "badge", label: "Certifications buyers require", help: "Certifications some buyers require before purchase, such as SOC 2, FIPS, or NDAA compliance." },
  { code: "CG6", icon: "lock", label: "Cybersecurity posture", help: "How exposed the system is to attack: open ports, patching, encryption, and the vendor's own security record. This cuts both ways; any networked system adds some exposure, so tick it only where a solution is clearly stronger." },
  { code: "OI7", icon: "chart", label: "Customer & site insights", help: "Foot traffic, dwell time, queue, and occupancy data used to improve layout, staffing, and conversion. Revenue, not cost; replacing a separate counting tool is priced under other vendors' tools.", revenue: true },
  { code: "OI8", icon: "trending", label: "Revenue protection & new business", help: "Capabilities customers will pay for or require, such as live visibility for clients. Revenue, not cost.", revenue: true },
];

// Framework props that need products this calculator doesn't price, for the
// step's scope note.
export const OUT_OF_SCOPE = [
  "emergency lockdown (access control)",
  "vape and air-quality detection (sensors)",
  "front-desk and credential admin (access control, guest management)",
  "unattended operating hours (access control, intercom)",
  "fleet uptime (fleet cameras)",
];

// The catalog's functions, bound to it.
export const IMPACT = createImpact({ verticals: VERTICALS, considerations: CONSIDERATIONS, outOfScope: OUT_OF_SCOPE });
export const { verticalFor, considerationsFor, annualOutcomes, outcomeReportRows } = IMPACT;
