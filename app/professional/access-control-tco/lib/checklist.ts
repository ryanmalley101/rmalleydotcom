// "Before you share this": things worth checking in the current inputs,
// built from the comparison itself. An empty list means nothing stood out.
// Items name their solution through `side` (the results page groups by it).
import type { ChecklistItem } from "../../_tco-shared/lib/checklist";
import type { ComparisonResult, ScenarioInputs, SolutionInputs } from "./model";
import { defaultSolution } from "./defaults";
import { SOLUTION_FIELD_MAP } from "./fields";
import { LICENSE_READER_LIMITS, fieldSourceInfo } from "./vendorDefaults";
import { IMPACT, changeValue, isCategoryEnabled } from "./verticals";

// Inputs that most often decide a comparison, checked for still holding an
// unsourced generic default.
const KEY_FIELDS: (keyof SolutionInputs)[] = [
  "discountPct", "readerCost", "controllerCost", "tierPrice", "siteFeePerYr", "doorLicense", "baseLicense", "carePct", "serverCost",
  "adminHrsPerDoorYr", "cardholderChangeMinutes", "migrationLaborPerDoor",
];

export function buildChecklist(scenario: ScenarioInputs, solA: SolutionInputs, solB: SolutionInputs, c: ComparisonResult): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const wired = scenario.existingDoorsInstalled !== false;
  for (const sol of [solA, solB]) {
    const generic = defaultSolution(sol.id, sol.name, sol.model) as unknown as Record<string, unknown>;
    const genericKeys = KEY_FIELDS.filter((k) => {
      const def = SOLUTION_FIELD_MAP[k];
      if (def.models && !def.models.includes(sol.model)) return false;
      if (k === "migrationLaborPerDoor" && !wired) return false;
      return sol[k] === generic[k] && !fieldSourceInfo(sol, k);
    });
    if (genericKeys.length) {
      items.push({
        text: `${genericKeys.map((k) => SOLUTION_FIELD_MAP[k].label).join(", ")} still use generic placeholder values. Replace them with quotes or the customer's own numbers.`,
        side: sol.id, fields: genericKeys, tab: "costs",
      });
    }
    const estimated = (Object.keys(SOLUTION_FIELD_MAP) as (keyof SolutionInputs)[]).filter((k) => fieldSourceInfo(sol, k)?.status === "estimated");
    if (estimated.length) {
      items.push({
        text: `${estimated.length} pre-filled vendor value${estimated.length === 1 ? " is an estimate" : "s are estimates"} rather than sourced (gray dots).`,
        side: sol.id, tab: "costs",
      });
    }
    // A researched license priced by reader-count tier only holds up to its tier.
    const limit = LICENSE_READER_LIMITS[sol.name];
    const readers = scenario.doors * scenario.readersPerDoor;
    if (sol.model === "onprem" && limit && sol.baseLicense === limit.baseLicense && readers > limit.readers) {
      items.push({
        text: `The researched license covers up to ${limit.readers} readers, and this comparison has ${readers}. Enter the license for the larger tier.`,
        side: sol.id, fields: ["baseLicense"], tab: "costs",
      });
    }
    if (wired && scenario.incumbent !== sol.id) {
      items.push({
        text: `${sol.name} is set to ${sol.reusesControllers ? "keep" : "replace"} the existing controllers and ${sol.reusesReaders ? "keep" : "replace"} the existing readers. Confirm that against the vendor's supported hardware; it decides most of the year-0 cost.`,
        side: sol.id, fields: ["reusesControllers", "reusesReaders"], tab: "costs",
      });
      if (sol.reissueCredentials && sol.reusesReaders) {
        items.push({
          text: `${sol.name} reissues credentials but keeps the existing readers. Check that those readers can read the new credentials.`,
          side: sol.id, fields: ["reissueCredentials"], tab: "costs",
        });
      }
    }
  }

  const incumbent = scenario.incumbent === "a" ? solA : scenario.incumbent === "b" ? solB : null;
  if (incumbent && wired) {
    if (!scenario.existingHardwareAgeYears) {
      items.push({ text: "Enter the age of the existing readers and controllers. At 0 they're treated as new, with their full warranty ahead of them.", tab: "scenario" });
    }
    const generic = defaultSolution(incumbent.id, incumbent.name, incumbent.model);
    if (incumbent.model === "onprem" && incumbent.yearsUntilNextRefresh === generic.yearsUntilNextRefresh) {
      items.push({
        text: "Confirm when its servers are next due for replacement; it's still the default.",
        side: incumbent.id, fields: ["yearsUntilNextRefresh"], tab: "costs",
      });
    }
    if (incumbent.model === "cloud" && incumbent.yearsUntilLicenseRenewal === undefined) {
      items.push({ text: "Confirm when its current license term ends.", side: incumbent.id, fields: ["yearsUntilLicenseRenewal"], tab: "costs" });
    }
  }

  const gap = Math.abs(c.a.total - c.b.total);
  const staffGap = Math.abs(c.a.staffTimeTotal - c.b.staffTimeTotal);
  if (gap > 0 && staffGap / gap > 0.5 && Math.sign(c.a.staffTimeTotal - c.b.staffTimeTotal) === Math.sign(c.a.total - c.b.total)) {
    items.push({ text: "More than half of the difference is estimated staff time (admin, cardholder changes, and door alarms). Check those inputs with the people who do the work.", tab: "costs" });
  }

  const vertical = IMPACT.verticalFor(scenario);
  if (vertical) {
    const outcomeGap = Math.abs(c.a.outcomeTotal - c.b.outcomeTotal);
    if (gap > 0 && outcomeGap / gap > 0.5 && Math.sign(c.a.outcomeTotal - c.b.outcomeTotal) === Math.sign(c.a.total - c.b.total)) {
      items.push({ text: "More than half of the difference is estimated business impact (theft, rekeying, and similar changes). Make sure each change is backed by the customer's own data, not a vendor case study.", tab: "impact" });
    }
    // Shared inputs still on their placeholder, for a category some
    // solution has actually claimed a change to.
    const claimed = vertical.categories.filter(
      (cat) =>
        cat.kind === "existing" &&
        isCategoryEnabled(scenario, cat.id) &&
        [solA, solB].some((s) => scenario.incumbent !== s.id && changeValue(s, cat) !== 0),
    );
    const placeholders = vertical.inputs.filter(
      (i) => scenario.outcomeBaseline?.[i.key] === undefined && claimed.some((cat) => cat.kind === "existing" && cat.inputKeys.includes(i.key)),
    );
    if (placeholders.length) {
      items.push({ text: `Business impact: ${placeholders.map((i) => i.label).join(", ")} still use placeholder values. Replace them with the customer's own figures.`, tab: "impact" });
    }
  }
  return items;
}
