// How the wizard fills each side when a comparison type is picked. Neither
// side is pre-filled with a vendor: no vendor has researched defaults yet,
// and a vendor's name over generic numbers would look vendor-specific
// without being so (see the README's design principles). Once vendors are
// researched, seeding one here is a workflow convenience, as in the video
// calculator, never a change to the math.
import type { ShapeOption } from "../../_tco-shared/lib/fields";
import type { SolutionInputs } from "./model";
import { defaultSolution } from "./defaults";

export const PLACEHOLDER_NAMES = [
  "Solution A (Cloud)", "Solution A (Server-based)", "Solution B (Cloud)", "Solution B (Server-based)",
];

export function seedSolution(slot: "a" | "b", opt: ShapeOption): SolutionInputs {
  const model = slot === "a" ? opt.modelA : opt.modelB;
  const name = `Solution ${slot.toUpperCase()} (${model === "cloud" ? "Cloud" : "Server-based"})`;
  return defaultSolution(slot, name, model);
}
