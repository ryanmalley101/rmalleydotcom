// "Before you share this": things worth checking in the current inputs,
// built from the comparison itself. Each item is a plain sentence; an empty
// list means nothing stood out.
import type { ComparisonResult, ScenarioInputs, SolutionInputs } from "./model";
import { defaultSolution } from "./defaults";
import { SOLUTION_FIELD_MAP } from "./fields";
import { fieldSourceInfo, vendorEntriesFor } from "./vendorDefaults";

// Inputs that most often decide a comparison, checked for still holding an
// unsourced generic default.
const KEY_FIELDS: (keyof SolutionInputs)[] = [
  "discountPct", "cameraCost", "investigationHrsPerIncident", "adminHrsPerCamYr", "truckRollsPerSiteYr",
  "tierPrice", "applianceCost", "deviceLicense", "baseLicense", "serverCost", "analyticsApplianceCost",
];

export function buildChecklist(scenario: ScenarioInputs, solA: SolutionInputs, solB: SolutionInputs, c: ComparisonResult): string[] {
  const items: string[] = [];
  for (const sol of [solA, solB]) {
    const generic = defaultSolution(sol.id, sol.name, sol.model) as unknown as Record<string, unknown>;
    const entries = vendorEntriesFor(sol);
    const genericKeys = KEY_FIELDS.filter((k) => {
      const def = SOLUTION_FIELD_MAP[k];
      if (def.models && !def.models.includes(sol.model)) return false;
      if (k === "applianceCost" && sol.migrationStrategy !== "connector") return false;
      return sol[k] === generic[k] && !fieldSourceInfo(k, sol[k], ...entries);
    });
    if (genericKeys.length) {
      items.push(`${sol.name}: ${genericKeys.map((k) => SOLUTION_FIELD_MAP[k].label).join(", ")} still use generic placeholder values. Replace them with quotes or the customer's own numbers.`);
    }
    const estimated = (Object.keys(SOLUTION_FIELD_MAP) as (keyof SolutionInputs)[])
      .filter((k) => fieldSourceInfo(k, sol[k], ...entries)?.status === "estimated");
    if (estimated.length) {
      items.push(`${sol.name}: ${estimated.length} pre-filled vendor value${estimated.length === 1 ? " is an estimate" : "s are estimates"} rather than sourced (gray dots).`);
    }
  }

  const incumbent = scenario.incumbent === "a" ? solA : scenario.incumbent === "b" ? solB : null;
  if (incumbent) {
    if (!scenario.existingFleetAgeYears) items.push("Enter the age of the existing cameras. At 0 they're treated as new, with their full warranty ahead of them.");
    const generic = defaultSolution(incumbent.id, incumbent.name, incumbent.model);
    if (incumbent.model === "onprem" && incumbent.yearsUntilNextRefresh === generic.yearsUntilNextRefresh) {
      items.push("Confirm when the incumbent's servers and storage are next due for replacement; it's still the default.");
    }
    if (incumbent.model === "cloud" && incumbent.yearsUntilLicenseRenewal === undefined) {
      items.push("Confirm when the incumbent's current license term ends.");
    }
  }

  const gap = Math.abs(c.a.total - c.b.total);
  const staffGap = Math.abs(c.a.staffTimeTotal - c.b.staffTimeTotal);
  if (gap > 0 && staffGap / gap > 0.5 && Math.sign(c.a.staffTimeTotal - c.b.staffTimeTotal) === Math.sign(c.a.total - c.b.total)) {
    items.push(`More than half of the difference is estimated staff time (admin and investigation hours). Check those inputs with the people who do the work.`);
  }
  return items;
}
