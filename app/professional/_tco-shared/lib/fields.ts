// Shapes each calculator's input definitions and comparison options share.
import type { DeploymentModel } from "./engine";

// One input's label, help text, and valid range. Each calculator keeps a
// single list of these, read by the wizard, the results page, and the
// exports, so the same input can't be labeled or explained differently in
// two places. `models` limits a solution field to the deployment model(s) it
// applies to.
export interface FieldDef<K extends string> {
  key: K;
  label: string;
  models?: DeploymentModel[];
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  decimalScale?: number;
  int?: boolean;
}

export interface ShapeOption {
  id: string;
  label: string;
  description: string;
  // Neutral guidance on when this comparison fits, not claims about which
  // deployment model is better.
  useWhen: string[];
  keepInMind: string[];
  modelA: DeploymentModel;
  modelB: DeploymentModel;
}

// Which deployment model's default side is the incumbent for a shape: the
// on-prem side of an on-prem-vs-cloud shape, since comparing a cloud system
// against what's already installed is the usual case. Neither otherwise.
export function defaultIncumbentFor(opt: ShapeOption): "none" | "a" | "b" {
  if (opt.modelA === "onprem" && opt.modelB === "cloud") return "a";
  if (opt.modelA === "cloud" && opt.modelB === "onprem") return "b";
  return "none";
}
