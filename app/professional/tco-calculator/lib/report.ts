// This calculator's CSV and printable report: its inputs, with each field's
// source status, turned into the shared report builder's spec.
import { CATEGORIES, type ComparisonResult, type SolutionInputs } from "./model";
import type { SharedState } from "./shareState";
import { SCENARIO_FIELDS, fieldsFor } from "./fields";
import { fieldSourceInfo, vendorEntriesFor } from "./vendorDefaults";
import { outcomeReportRows } from "./verticals";
import {
  buildCsv as sharedBuildCsv, buildReportHtml as sharedBuildReportHtml, type ReportSpec,
} from "../../_tco-shared/lib/report";
import { METHODOLOGY_NOTES } from "./methodology";

export { upfrontAndOngoing } from "../../_tco-shared/lib/report";

export function sourceStatus(sol: SolutionInputs, key: keyof SolutionInputs): string {
  const meta = fieldSourceInfo(key, sol[key], ...vendorEntriesFor(sol));
  if (!meta) return "";
  return `${meta.status} (${meta.confidence} confidence)${meta.sources[0] ? " " + meta.sources[0] : ""}`;
}

// Scenario values as a reader should see them: the incumbent by name.
function scenarioValue(state: SharedState, key: keyof SharedState["scenario"]): unknown {
  const v = state.scenario[key];
  if (key === "incumbent") return v === "a" ? state.solA.name : v === "b" ? state.solB.name : "Neither";
  return v;
}

function reportSpec(state: SharedState, notes: string[]): ReportSpec<(typeof CATEGORIES)[number]> {
  const { scenario, solA, solB } = state;
  const fields = [...fieldsFor(solA.model), ...fieldsFor(solB.model)];
  const keys = Array.from(new Set(fields.map((f) => f.key)));
  const labelFor = new Map(fields.map((f) => [f.key, f.label]));
  const applies = (sol: SolutionInputs, key: keyof SolutionInputs) => fieldsFor(sol.model).some((f) => f.key === key);
  return {
    title: "Video surveillance TCO comparison",
    nameA: solA.name,
    nameB: solB.name,
    subtitle: `${scenario.cameras} cameras · ${scenario.sites} sites · ${scenario.horizonYears}-year horizon`,
    scenarioRows: SCENARIO_FIELDS.map((f) => [f.label, scenarioValue(state, f.key)]),
    inputRows: keys.map((key) => ({
      label: labelFor.get(key) ?? key,
      a: applies(solA, key) ? solA[key] : "n/a", aSource: applies(solA, key) ? sourceStatus(solA, key) : "",
      b: applies(solB, key) ? solB[key] : "n/a", bSource: applies(solB, key) ? sourceStatus(solB, key) : "",
    })),
    miscA: solA.miscItems,
    miscB: solB.miscItems,
    impact: outcomeReportRows(scenario, solA, solB),
    categories: CATEGORIES,
    notes,
  };
}

export function buildCsv(state: SharedState, c: ComparisonResult): string {
  return sharedBuildCsv(reportSpec(state, METHODOLOGY_NOTES), c);
}

export function buildReportHtml(state: SharedState, c: ComparisonResult, notes: string[]): string {
  return sharedBuildReportHtml(reportSpec(state, notes), c);
}
