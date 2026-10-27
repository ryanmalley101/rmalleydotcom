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
  { id: "office", label: "Small office", description: "12 doors at 1 site, 80 cardholders", values: { doors: 12, sites: 1, cardholders: 80 } },
  { id: "multisite", label: "Multi-site", description: "60 doors across 10 sites, 600 cardholders", values: { doors: 60, sites: 10, cardholders: 600 } },
  { id: "campus", label: "Campus", description: "250 doors at 3 sites, 4,000 cardholders", values: { doors: 250, sites: 3, cardholders: 4000 } },
];
