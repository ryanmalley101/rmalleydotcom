// The business impact engine: industry-specific costs a business already
// carries that a system can raise or lower, new costs a system can bring,
// and benefits that can't credibly be priced. Each calculator supplies its
// own catalog (industries, categories, considerations) built with the
// helpers here; the math and the step UI are shared.
//
// Two kinds of priced category:
// - "existing": a cost the business has today. Its yearly size per site comes
//   from shared inputs (facts about the business, the same for both
//   solutions); each solution enters a % change to it.
// - "new": a cost the business doesn't have today. Each solution enters its
//   own amount.
// The user switches categories on and off (outcomeEnabled); a category
// that's off counts for nothing, but keeps its entered values.
//
// Every value is a change from today. The incumbent *is* today, so its
// changes are always 0 (each model skips them): today's figures already
// reflect the system that's installed. On a new site neither side is
// incumbent, and both are changes from having no system at all.
//
// Kept free of runtime imports from any model so each model can call it
// without an import cycle.
import type { IncumbentChoice } from "./engine";

export type OutcomeInputUnit = "usd" | "pct" | "count" | "hours";

// Names an icon shown beside a field's label. Strings rather than icon
// components so lib/ stays free of React; BusinessImpactStep maps them.
export type OutcomeIcon =
  | "store" | "sales" | "shrink" | "outsideTheft" | "employeeTheft" | "slip" | "gavel" | "hardHat"
  | "hammer" | "siren" | "people" | "guard" | "clock" | "dollar" | "face" | "bell" | "cctv" | "shield" | "swap"
  | "alert" | "umbrella" | "clipboard" | "waste" | "boxes" | "fileCheck" | "eyeOff" | "citation" | "plug"
  | "safety" | "workflow" | "wallet" | "radar" | "handshake" | "timer" | "cameraOff" | "scroll" | "badge" | "lock"
  | "chart" | "trending" | "school" | "hospital" | "truck" | "factory" | "building" | "bank"
  | "door" | "key" | "fingerprint" | "unlock" | "moon";

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
      code: string;
      label: string;
      help: string;
      icon: OutcomeIcon;
      kind: "existing";
      // The shared inputs this category's yearly cost is built from, for display.
      inputKeys: string[];
      // Yearly cost per site today. `v` reads a shared input by key, or a
      // scenario rate as "scenario.adminRate" / "scenario.investigatorRate".
      annualPerSite: (v: (key: string) => number) => number;
      // The same calculation as a spreadsheet formula over {key} placeholders
      // (keys as `v` takes them), for the spreadsheet export. See Spec.formula.
      formula?: string;
    }
  | {
      id: string;
      code: string;
      label: string;
      help: string;
      icon: OutcomeIcon;
      kind: "new";
      unit: NewCostUnit;
      // The scenario rate an hours-based new cost is priced at; defaults to
      // the investigator rate.
      rate?: "adminRate" | "investigatorRate";
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
  id: string;
  label: string;
  icon: OutcomeIcon;
  inputs: OutcomeInput[];
  categories: OutcomeCategory[];
  groups: OutcomeGroup[];
  // Category ids switched on when this industry is picked.
  suggested: string[];
}

// Benefits that are real but not priced, because they're revenue rather than
// cost or there's no credible dollar figure. Ticked per solution and listed
// beside the totals, never in them.
export interface Consideration {
  code: string;
  label: string;
  help: string;
  icon: OutcomeIcon;
  revenue?: boolean;
}

// ---------------------------------------------------------------------------
// Building a catalog. Each priced prop is a Spec: one category plus the
// shared inputs it needs. An input's key is `<industry>.<category>.<name>`
// unless it sets its own (to share it between categories).

export interface InputSpec { name: string; key?: string; label: string; help: string; icon: OutcomeIcon; unit: OutcomeInputUnit; default: number }
export interface Spec {
  id: string;
  code: string;
  label: string;
  help: string;
  icon: OutcomeIcon;
  inputs: InputSpec[];
  annualPerSite: (v: (name: string) => number) => number;
  // annualPerSite as a spreadsheet formula over {name} placeholders (input
  // names, or "scenario.adminRate" / "scenario.investigatorRate"), e.g.
  // "{count}*{cost}", so the spreadsheet export can keep it live. Optional:
  // without it the export writes today's value instead of a formula. A test
  // checks every category's formula against annualPerSite.
  formula?: string;
}

export interface Text { label: string; help: string; icon: OutcomeIcon }
export type InputText = Omit<InputSpec, "name" | "unit" | "key">;

// Incidents per site per year × average cost each.
export function incidents(code: string, t: Text, count: InputText, cost: InputText, id = code): Spec {
  return {
    id, code, ...t,
    inputs: [{ name: "count", unit: "count", ...count }, { name: "cost", unit: "usd", ...cost }],
    annualPerSite: (v) => v("count") * v("cost"),
    formula: "{count}*{cost}",
  };
}

// A yearly dollar amount per site.
export function annual(code: string, t: Text, amount: InputText, id = code): Spec {
  return { id, code, ...t, inputs: [{ name: "amount", unit: "usd", ...amount }], annualPerSite: (v) => v("amount"), formula: "{amount}" };
}

// Staff hours per site per year × the admin rate.
export function adminHours(code: string, t: Text, hours: InputText, id = code): Spec {
  return {
    id, code, ...t,
    inputs: [{ name: "hours", unit: "hours", ...hours }],
    annualPerSite: (v) => v("hours") * v("scenario.adminRate"),
    formula: "{hours}*{scenario.adminRate}",
  };
}

// The generic version of each priced prop, worded for any industry. An
// industry overrides only the text and placeholders that differ for it.
export type Overrides = Partial<Text> & { count?: Partial<InputText>; cost?: Partial<InputText>; amount?: Partial<InputText>; hours?: Partial<InputText> };

export const merge = <T extends object>(base: T, o?: Partial<T>): T => ({ ...base, ...(o ?? {}) });
export const text = (base: Text, o?: Overrides): Text => ({ label: o?.label ?? base.label, help: o?.help ?? base.help, icon: o?.icon ?? base.icon });

// A catalog's group headings. `prefix` matches the letters of a category's
// framework code (e.g. "RL" for RL2); "NEW" holds the new costs.
export interface PillarDef { prefix: string; label: string; description: string; icon: OutcomeIcon }

export interface NewCostDef {
  id: string;
  label: string;
  help: string;
  icon: OutcomeIcon;
  unit: NewCostUnit;
  rate?: "adminRate" | "investigatorRate";
}

export function buildVertical(
  id: string, label: string, icon: OutcomeIcon, specs: Spec[], suggested: string[],
  pillars: PillarDef[], newCosts: NewCostDef[],
): VerticalDef {
  const inputs = new Map<string, OutcomeInput>();
  const categories: OutcomeCategory[] = specs.map((spec) => {
    const keyFor = new Map(spec.inputs.map((i) => [i.name, i.key ?? `${id}.${spec.id}.${i.name}`]));
    for (const i of spec.inputs) {
      const key = keyFor.get(i.name)!;
      if (!inputs.has(key)) inputs.set(key, { key, label: i.label, help: i.help, icon: i.icon, unit: i.unit, default: i.default });
    }
    return {
      id: `${id}.${spec.id}`, code: spec.code, label: spec.label, help: spec.help, icon: spec.icon, kind: "existing" as const,
      inputKeys: Array.from(keyFor.values()),
      annualPerSite: (v: (key: string) => number) => spec.annualPerSite((name) => v(name.startsWith("scenario.") ? name : keyFor.get(name)!)),
      formula: spec.formula?.replace(/\{([^}]+)\}/g, (_, name: string) => `{${name.startsWith("scenario.") ? name : keyFor.get(name)}}`),
    };
  });
  for (const c of newCosts) categories.push({ ...c, id: `${id}.${c.id}`, code: "NEW", kind: "new" });

  const pillarOf = (code: string) => code.replace(/\d+$/, "");
  const groups = pillars.map((p) => ({
    id: `${id}.${p.prefix}`, label: p.label, description: p.description, icon: p.icon,
    categoryIds: categories.filter((c) => pillarOf(c.code) === p.prefix).map((c) => c.id),
  })).filter((g) => g.categoryIds.length > 0);

  return { id, label, icon, inputs: Array.from(inputs.values()), categories, groups, suggested: suggested.map((s) => `${id}.${s}`) };
}

// ---------------------------------------------------------------------------
// The math. Scenario and solution types are structural, so either
// calculator's inputs fit.

export interface ImpactScenario {
  sites: number;
  incumbent: IncumbentChoice;
  // Industry id, or null for none, which leaves business impact out of the
  // comparison entirely.
  vertical: string | null;
  // That industry's shared inputs, keyed by OutcomeInput.key. A missing key
  // reads as the input's default.
  outcomeBaseline: Record<string, number>;
  // Ids of the categories switched on for this business.
  outcomeEnabled: string[];
  adminRate: number;
  investigatorRate?: number;
}

export interface ImpactSolution {
  id: "a" | "b";
  name: string;
  // A % for a cost the business already has, an amount for a new one, keyed
  // by category id. Missing means no change.
  outcomeChanges: Record<string, number>;
  // Codes of the considerations this solution offers.
  considerations: string[];
}

export interface ImpactCatalog {
  verticals: VerticalDef[];
  considerations: Consideration[];
  // Things the catalog deliberately doesn't price, for the step's scope note.
  outOfScope: string[];
}

export function isCategoryEnabled(scenario: Pick<ImpactScenario, "outcomeEnabled">, categoryId: string): boolean {
  return Array.isArray(scenario.outcomeEnabled) && scenario.outcomeEnabled.includes(categoryId);
}

// The shared inputs the enabled categories need, in the vertical's order.
// Inputs only an "off" category uses stay hidden.
export function inputsInUse(scenario: Pick<ImpactScenario, "outcomeEnabled">, vertical: VerticalDef, categoryIds = vertical.categories.map((c) => c.id)): OutcomeInput[] {
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
export function baselineValue(scenario: Pick<ImpactScenario, "outcomeBaseline">, input: OutcomeInput): number {
  const n = Math.max(0, num(scenario.outcomeBaseline?.[input.key], input.default));
  return input.unit === "pct" ? Math.min(100, n) : n;
}

export function annualBaselinePerSite(scenario: ImpactScenario, vertical: VerticalDef, category: OutcomeCategory): number {
  if (category.kind !== "existing") return 0;
  const byKey = new Map(vertical.inputs.map((i) => [i.key, i]));
  return category.annualPerSite((key) => {
    if (key === "scenario.adminRate") return Math.max(0, num(scenario.adminRate));
    if (key === "scenario.investigatorRate") return Math.max(0, num(scenario.investigatorRate));
    const input = byKey.get(key);
    return input ? baselineValue(scenario, input) : 0;
  });
}

// A solution's entered change for one category: a % (-100 to 100) for an
// existing cost, a non-negative amount in the category's unit for a new one.
export function changeValue(sol: Pick<ImpactSolution, "outcomeChanges">, category: OutcomeCategory): number {
  const n = num(sol.outcomeChanges?.[category.id]);
  return category.kind === "existing" ? Math.max(-100, Math.min(100, n)) : Math.max(0, n);
}

export interface ImpactReportRows {
  industry: string;
  inputs: [string, number][];
  changes: [string, string, string][];
  considerations: [string, string, string][];
}

// A catalog's functions, bound to it.
export interface Impact {
  catalog: ImpactCatalog;
  verticalFor: (scenario: Pick<ImpactScenario, "vertical">) => VerticalDef | null;
  // A solution's ticked considerations, in display order.
  considerationsFor: (sol: Pick<ImpactSolution, "considerations">) => Consideration[];
  // Year-1 (unescalated) dollar effect of each enabled category for one
  // solution; negative is a saving. Each model escalates it with labor.
  annualOutcomes: (scenario: ImpactScenario, sol: ImpactSolution) => { category: OutcomeCategory; amount: number }[];
  // Business impact inputs as a reader of an exported report should see
  // them. Empty when no industry is selected.
  outcomeReportRows: (scenario: ImpactScenario, solA: ImpactSolution, solB: ImpactSolution) => ImpactReportRows;
}

export function createImpact(catalog: ImpactCatalog): Impact {
  const verticalFor = (scenario: Pick<ImpactScenario, "vertical">) => catalog.verticals.find((v) => v.id === scenario.vertical) ?? null;

  const considerationsFor = (sol: Pick<ImpactSolution, "considerations">) => {
    const ticked = Array.isArray(sol.considerations) ? sol.considerations : [];
    return catalog.considerations.filter((c) => ticked.includes(c.code));
  };

  function annualOutcomes(scenario: ImpactScenario, sol: ImpactSolution) {
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
        amount = change * 52 * sites * Math.max(0, num(scenario[category.rate ?? "investigatorRate"]));
      }
      return { category, amount };
    });
  }

  function outcomeReportRows(scenario: ImpactScenario, solA: ImpactSolution, solB: ImpactSolution): ImpactReportRows {
    const vertical = verticalFor(scenario);
    if (!vertical) return { industry: "None", inputs: [], changes: [], considerations: [] };
    const show = (sol: ImpactSolution, category: OutcomeCategory) => {
      if (scenario.incumbent === sol.id) return "incumbent (today)";
      const v = changeValue(sol, category);
      return category.kind === "existing" ? `${v}%` : `${v} ${NEW_COST_UNIT_LABEL[category.unit]}`;
    };
    const a = considerationsFor(solA), b = considerationsFor(solB);
    return {
      industry: vertical.label,
      inputs: inputsInUse(scenario, vertical).map((i) => [i.label, baselineValue(scenario, i)]),
      changes: vertical.categories
        .filter((c) => isCategoryEnabled(scenario, c.id))
        .map((c) => [c.label, show(solA, c), show(solB, c)]),
      considerations: catalog.considerations
        .filter((c) => a.includes(c) || b.includes(c))
        .map((c) => [c.label, a.includes(c) ? "yes" : "", b.includes(c) ? "yes" : ""]),
    };
  }

  return { catalog, verticalFor, considerationsFor, annualOutcomes, outcomeReportRows };
}
