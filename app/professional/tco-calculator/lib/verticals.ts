// Industry-specific business impact: costs a business already carries (theft,
// injury claims, guards) that a video system can raise or lower, and new
// costs a system can bring with it (compliance work, monitoring fees).
// Separate from the hardware/license/labor math in model.ts because these are
// effects of what the system is used for, not of what it costs to run, and
// they're the softest numbers in a comparison.
//
// Two kinds of category:
// - "existing": a cost the business has today. Its yearly size per site comes
//   from shared inputs (facts about the business, the same for both
//   solutions); each solution enters a % change to it.
// - "new": a cost the business doesn't have today. Each solution enters its
//   own amount.
// Categories sit in themed groups and are each switched on by the user
// (ScenarioInputs.outcomeEnabled), so only the costs that apply to this
// business show any fields; a category that's off counts for nothing.
//
// Every value is a change from today. The incumbent *is* today, so its
// changes are always 0 (computeSolution skips them): today's shrink and
// claims already reflect the system that's installed. On a new site neither
// side is incumbent, and both are changes from having no system at all.
//
// Kept free of runtime imports from model.ts (types only) so the model can
// call it without an import cycle, like sanitize.ts.
import type { ScenarioInputs, SolutionInputs } from "./model";

export type Vertical = "retail" | "education" | "manufacturing" | "healthcare" | "finance";

export type OutcomeInputUnit = "usd" | "pct" | "count" | "hours";

// Names an icon shown beside a field's label. Strings rather than icon
// components so this file stays free of React; BusinessImpactStep maps them.
export type OutcomeIcon =
  | "store" | "sales" | "shrink" | "outsideTheft" | "employeeTheft" | "slip" | "gavel" | "hardHat"
  | "hammer" | "siren" | "people" | "guard" | "clock" | "dollar" | "face" | "bell" | "cctv" | "shield" | "swap";

// A shared fact about the business, entered once and used by one or more
// "existing" categories.
export interface OutcomeInput {
  key: string;
  label: string;
  help: string;
  icon: OutcomeIcon;
  unit: OutcomeInputUnit;
  // Directional placeholder so the inputs aren't blank. Every solution's
  // change starts at 0, so these never move a total on their own.
  default: number;
}

export type NewCostUnit = "usdPerYear" | "usdPerSiteMonth" | "hoursPerSiteWeek";

export type OutcomeCategory =
  | {
      id: string;
      label: string;
      help: string;
      icon: OutcomeIcon;
      kind: "existing";
      // The shared inputs this category's yearly cost is built from, for display.
      inputKeys: string[];
      // Yearly cost per site today, from the shared inputs.
      annualPerSite: (v: (key: string) => number) => number;
    }
  | {
      id: string;
      label: string;
      help: string;
      icon: OutcomeIcon;
      kind: "new";
      unit: NewCostUnit;
    };

// A themed set of categories, shown together with its own heading so the
// step isn't one long list.
export interface OutcomeGroup {
  id: string;
  label: string;
  description: string;
  icon: OutcomeIcon;
  categoryIds: string[];
}

export interface VerticalDef {
  id: Vertical;
  label: string;
  // False until the vertical's categories are built; listed in the picker
  // but not selectable.
  modeled: boolean;
  inputs: OutcomeInput[];
  categories: OutcomeCategory[];
  groups: OutcomeGroup[];
}

const RETAIL: VerticalDef = {
  id: "retail",
  label: "Retail",
  modeled: true,
  inputs: [
    {
      key: "retail.salesPerSite", icon: "sales", label: "Annual sales per store ($)", unit: "usd", default: 3_000_000,
      help: "Average yearly sales per store. Shrink is measured as a share of sales.",
    },
    {
      key: "retail.shrinkPct", icon: "shrink", label: "Shrink (% of sales)", unit: "pct", default: 1.6,
      help: "Inventory lost to theft, fraud, and errors, as a share of sales. NRF's National Retail Security Survey has reported averages around 1.4-1.6%, but it varies widely by format and location. Use your own figure.",
    },
    {
      key: "retail.externalSharePct", icon: "outsideTheft", label: "Share of shrink from outside theft (%)", unit: "pct", default: 36,
      help: "How much of shrink comes from shoplifting and organized retail crime. NRF's survey has put it at roughly a third. Use your own loss-prevention numbers where you have them.",
    },
    {
      key: "retail.internalSharePct", icon: "employeeTheft", label: "Share of shrink from employee theft (%)", unit: "pct", default: 29,
      help: "How much of shrink comes from employee theft and POS fraud (sweethearting, void and refund abuse). NRF's survey has put it at a little under a third.",
    },
    {
      key: "retail.liabilityClaimsPerSite", icon: "slip", label: "Slip-and-fall claims per store per year", unit: "count", default: 1,
      help: "Customer injury and general liability claims per store per year.",
    },
    {
      key: "retail.liabilityClaimCost", icon: "gavel", label: "Average liability claim cost ($)", unit: "usd", default: 30_000,
      help: "Average total cost of one claim: payout plus legal defense and adjuster time. A placeholder; your insurer or risk team will have the real figure.",
    },
    {
      key: "retail.wcClaimsPerSite", icon: "hardHat", label: "Workers' comp claims per store per year", unit: "count", default: 0.5,
      help: "Employee injury claims per store per year.",
    },
    {
      key: "retail.wcClaimCost", icon: "gavel", label: "Average workers' comp claim cost ($)", unit: "usd", default: 40_000,
      help: "Average total cost of one workers' comp claim. A placeholder; use your own claims history.",
    },
    {
      key: "retail.breakInsPerSite", icon: "hammer", label: "Break-ins & vandalism per store per year", unit: "count", default: 0.5,
      help: "After-hours break-ins, smash-and-grabs, graffiti, and other property damage per store per year.",
    },
    {
      key: "retail.breakInCost", icon: "dollar", label: "Average break-in or vandalism cost ($)", unit: "usd", default: 8_000,
      help: "Average cost of one incident: repairs, boarding up, stolen merchandise, lost trading hours.",
    },
    {
      key: "retail.falseAlarmsPerSite", icon: "siren", label: "False alarms per store per year", unit: "count", default: 2,
      help: "Intrusion alarms that turned out to be false and drew a police dispatch.",
    },
    {
      key: "retail.falseAlarmFine", icon: "dollar", label: "Average false-alarm fine ($)", unit: "usd", default: 150,
      help: "What one false dispatch costs. Many cities fine after a set number per year, and some only respond to verified alarms.",
    },
    {
      key: "retail.counterCostPerSiteYr", icon: "people", label: "People counting & traffic analytics ($/store/yr)", unit: "usd", default: 1_200,
      help: "Yearly cost per store of door counters, occupancy sensors, and traffic, heat-map, or queue analytics from other vendors: subscriptions plus sensor hardware spread over its life. Enter 0 if you have none.",
    },
    {
      key: "retail.guardHoursPerWeek", icon: "clock", label: "Guard hours per store per week", unit: "hours", default: 0,
      help: "On-site security guard hours per store per week. Enter 0 if you have no guards.",
    },
    {
      key: "retail.guardRate", icon: "dollar", label: "Guard rate ($/hr)", unit: "usd", default: 35,
      help: "Billed hourly rate for a contract guard, or the loaded cost of an in-house one.",
    },
  ],
  categories: [
    {
      id: "retail.externalTheft", icon: "outsideTheft", kind: "existing", label: "Shoplifting & organized retail crime",
      help: "Sales × shrink × outside-theft share. Visible cameras and public-view monitors can deter theft, and faster footage search helps build cases against repeat offenders. Evidence on how much varies widely; most published figures are vendor case studies.",
      inputKeys: ["retail.salesPerSite", "retail.shrinkPct", "retail.externalSharePct"],
      annualPerSite: (v) => v("retail.salesPerSite") * (v("retail.shrinkPct") / 100) * (v("retail.externalSharePct") / 100),
    },
    {
      id: "retail.internalTheft", icon: "employeeTheft", kind: "existing", label: "Employee theft & POS fraud",
      help: "Sales × shrink × employee-theft share. Video linked to POS transactions can flag sweethearting and void or refund abuse. Only claim a change for a solution that actually has POS integration.",
      inputKeys: ["retail.salesPerSite", "retail.shrinkPct", "retail.internalSharePct"],
      annualPerSite: (v) => v("retail.salesPerSite") * (v("retail.shrinkPct") / 100) * (v("retail.internalSharePct") / 100),
    },
    {
      id: "retail.liabilityClaims", icon: "slip", kind: "existing", label: "Slip-and-fall & liability claims",
      help: "Claims × average cost. Footage can disprove false claims and settle real ones faster, but only if it's still there: claims often arrive months after the incident, after short retention has overwritten it.",
      inputKeys: ["retail.liabilityClaimsPerSite", "retail.liabilityClaimCost"],
      annualPerSite: (v) => v("retail.liabilityClaimsPerSite") * v("retail.liabilityClaimCost"),
    },
    {
      id: "retail.workersComp", icon: "hardHat", kind: "existing", label: "Workers' comp claims",
      help: "Claims × average cost. Footage helps resolve disputed claims and spot unsafe practices.",
      inputKeys: ["retail.wcClaimsPerSite", "retail.wcClaimCost"],
      annualPerSite: (v) => v("retail.wcClaimsPerSite") * v("retail.wcClaimCost"),
    },
    {
      id: "retail.breakIns", icon: "hammer", kind: "existing", label: "Break-ins & vandalism",
      help: "Incidents × average cost. Deterrence, after-hours alerts, and talk-down speakers. Research on CCTV has found its clearest effects in parking lots.",
      inputKeys: ["retail.breakInsPerSite", "retail.breakInCost"],
      annualPerSite: (v) => v("retail.breakInsPerSite") * v("retail.breakInCost"),
    },
    {
      id: "retail.falseAlarms", icon: "siren", kind: "existing", label: "False-alarm fines",
      help: "False alarms × fine. Checking an alarm against video before dispatch cuts false dispatches.",
      inputKeys: ["retail.falseAlarmsPerSite", "retail.falseAlarmFine"],
      annualPerSite: (v) => v("retail.falseAlarmsPerSite") * v("retail.falseAlarmFine"),
    },
    {
      id: "retail.peopleCounting", icon: "people", kind: "existing", label: "People counters & traffic analytics",
      help: "What you pay other vendors today. -100% means a solution's own camera-based counting fully replaces them; only claim it for a solution that has that feature.",
      inputKeys: ["retail.counterCostPerSiteYr"],
      annualPerSite: (v) => v("retail.counterCostPerSiteYr"),
    },
    {
      id: "retail.guards", icon: "guard", kind: "existing", label: "Security guards",
      help: "Hours × rate × 52 weeks. Remote monitoring can replace some on-site hours; turn on \"Remote video monitoring\" under New costs and enter what it costs, so both sides of the trade show up.",
      inputKeys: ["retail.guardHoursPerWeek", "retail.guardRate"],
      annualPerSite: (v) => v("retail.guardHoursPerWeek") * v("retail.guardRate") * 52,
    },
    {
      id: "retail.biometricCompliance", icon: "face", kind: "new", unit: "usdPerYear", label: "Face recognition compliance",
      help: "Yearly cost of using face recognition lawfully, across the company: legal review, signage, consent, and the exposure under biometric privacy laws such as Illinois's BIPA. Leave at 0 for a solution where it isn't used.",
    },
    {
      id: "retail.alertReview", icon: "bell", kind: "new", unit: "hoursPerSiteWeek", label: "Alert review time",
      help: "Staff hours per store per week spent reviewing AI alerts, including false positives, at the investigator rate. Can offset some of the investigation time a faster search saves.",
    },
    {
      id: "retail.remoteMonitoring", icon: "cctv", kind: "new", unit: "usdPerSiteMonth", label: "Remote video monitoring",
      help: "Monthly fee per store for a monitoring service that watches live video or verifies alarms.",
    },
  ],
  groups: [
    {
      id: "retail.shrink", label: "Shrink", icon: "shrink",
      description: "Inventory lost to theft and fraud.",
      categoryIds: ["retail.externalTheft", "retail.internalTheft"],
    },
    {
      id: "retail.safety", label: "Safety & liability", icon: "gavel",
      description: "Injury claims from customers and employees.",
      categoryIds: ["retail.liabilityClaims", "retail.workersComp"],
    },
    {
      id: "retail.security", label: "Crime & security operations", icon: "shield",
      description: "Property crime, alarm response, and guarding.",
      categoryIds: ["retail.breakIns", "retail.falseAlarms", "retail.guards"],
    },
    {
      id: "retail.tools", label: "Tools a system could replace", icon: "swap",
      description: "Separate products whose job camera analytics can take over.",
      categoryIds: ["retail.peopleCounting"],
    },
    {
      id: "retail.newCosts", label: "New costs", icon: "dollar",
      description: "Costs a system can bring that you don't have today.",
      categoryIds: ["retail.biometricCompliance", "retail.alertReview", "retail.remoteMonitoring"],
    },
  ],
};

const notYetModeled = (id: Vertical, label: string): VerticalDef => ({ id, label, modeled: false, inputs: [], categories: [], groups: [] });

export const VERTICALS: VerticalDef[] = [
  RETAIL,
  notYetModeled("education", "Education"),
  notYetModeled("manufacturing", "Manufacturing"),
  notYetModeled("healthcare", "Healthcare"),
  notYetModeled("finance", "Finance"),
];

export function verticalFor(scenario: Pick<ScenarioInputs, "vertical">): VerticalDef | null {
  const def = VERTICALS.find((v) => v.id === scenario.vertical);
  return def && def.modeled ? def : null;
}

export function isCategoryEnabled(scenario: Pick<ScenarioInputs, "outcomeEnabled">, categoryId: string): boolean {
  return Array.isArray(scenario.outcomeEnabled) && scenario.outcomeEnabled.includes(categoryId);
}

// The shared inputs the enabled categories need, in the vertical's order.
// Inputs only an "off" category uses stay hidden.
export function inputsInUse(scenario: ScenarioInputs, vertical: VerticalDef, categoryIds = vertical.categories.map((c) => c.id)): OutcomeInput[] {
  const keys = new Set(
    vertical.categories
      .filter((c) => categoryIds.includes(c.id) && isCategoryEnabled(scenario, c.id))
      .flatMap((c) => (c.kind === "existing" ? c.inputKeys : [])),
  );
  return vertical.inputs.filter((i) => keys.has(i.key));
}

export const NEW_COST_UNIT_LABEL: Record<NewCostUnit, string> = {
  usdPerYear: "$/yr",
  usdPerSiteMonth: "$/site/mo",
  hoursPerSiteWeek: "hrs/site/wk",
};

const num = (n: unknown, fallback = 0) => (typeof n === "number" && Number.isFinite(n) ? n : fallback);

// Reads a shared input, falling back to its default when it hasn't been set.
// Never negative; percentages capped at 100.
export function baselineValue(scenario: ScenarioInputs, input: OutcomeInput): number {
  const n = Math.max(0, num(scenario.outcomeBaseline?.[input.key], input.default));
  return input.unit === "pct" ? Math.min(100, n) : n;
}

export function annualBaselinePerSite(scenario: ScenarioInputs, vertical: VerticalDef, category: OutcomeCategory): number {
  if (category.kind !== "existing") return 0;
  const byKey = new Map(vertical.inputs.map((i) => [i.key, i]));
  return category.annualPerSite((key) => {
    const input = byKey.get(key);
    return input ? baselineValue(scenario, input) : 0;
  });
}

// A solution's entered change for one category: a % (-100 to 100) for an
// existing cost, a non-negative amount in the category's unit for a new one.
export function changeValue(sol: SolutionInputs, category: OutcomeCategory): number {
  const n = num(sol.outcomeChanges?.[category.id]);
  return category.kind === "existing" ? Math.max(-100, Math.min(100, n)) : Math.max(0, n);
}

// Business impact inputs as a reader of an exported report should see them:
// the shared inputs, then each solution's change per category. Empty when no
// modeled vertical is selected.
export function outcomeReportRows(scenario: ScenarioInputs, solA: SolutionInputs, solB: SolutionInputs): {
  industry: string;
  inputs: [string, number][];
  changes: [string, string, string][];
} {
  const vertical = verticalFor(scenario);
  if (!vertical) return { industry: "None", inputs: [], changes: [] };
  const show = (sol: SolutionInputs, category: OutcomeCategory) => {
    if (scenario.incumbent === sol.id) return "incumbent (today)";
    const v = changeValue(sol, category);
    return category.kind === "existing" ? `${v}%` : `${v} ${NEW_COST_UNIT_LABEL[category.unit]}`;
  };
  return {
    industry: vertical.label,
    inputs: inputsInUse(scenario, vertical).map((i) => [i.label, baselineValue(scenario, i)]),
    changes: vertical.categories
      .filter((c) => isCategoryEnabled(scenario, c.id))
      .map((c) => [c.label, show(solA, c), show(solB, c)]),
  };
}

// Year-1 (unescalated) dollar effect of each category for one solution;
// negative is a saving. Escalated with labor in computeSolution.
export function annualOutcomes(scenario: ScenarioInputs, sol: SolutionInputs): { category: OutcomeCategory; amount: number }[] {
  const vertical = verticalFor(scenario);
  if (!vertical) return [];
  const sites = Math.max(1, scenario.sites);
  return vertical.categories.filter((c) => isCategoryEnabled(scenario, c.id)).map((category) => {
    const change = changeValue(sol, category);
    let amount = 0;
    if (category.kind === "existing") {
      amount = annualBaselinePerSite(scenario, vertical, category) * sites * (change / 100);
    } else if (category.unit === "usdPerYear") {
      amount = change;
    } else if (category.unit === "usdPerSiteMonth") {
      amount = change * 12 * sites;
    } else {
      amount = change * 52 * sites * Math.max(0, num(scenario.investigatorRate));
    }
    return { category, amount };
  });
}
