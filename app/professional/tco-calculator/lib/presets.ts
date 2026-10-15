// Example deployment sizes for the Scenario step, so a first-time user can
// see how size changes the result without inventing numbers. They only set
// the size of the deployment; every cost assumption stays as it was.
import type { ScenarioInputs } from "./model";

export interface ScenarioPreset {
  id: string;
  label: string;
  description: string;
  values: Partial<ScenarioInputs>;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  { id: "office", label: "Small office", description: "30 cameras at 2 sites", values: { cameras: 30, sites: 2, investigationsPerMonth: 5 } },
  { id: "campus", label: "Single campus", description: "400 cameras at 1 site", values: { cameras: 400, sites: 1, investigationsPerMonth: 40 } },
  { id: "retail", label: "Retail chain", description: "320 cameras across 40 stores", values: { cameras: 320, sites: 40, investigationsPerMonth: 30 } },
];
