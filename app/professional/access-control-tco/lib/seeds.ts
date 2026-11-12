// How the wizard fills each side when a comparison type is picked: a
// convenience for the most common starting point, comparing Verkada against
// an installed LenelS2 OnGuard system (the cloud-vs-server-based shape
// defaults OnGuard to incumbent). Both are researched vendors, so the
// pre-filled numbers are their own, with source dots, and every other field
// keeps the same generic default as any vendor. Neither choice changes the
// math, and both stay editable through the same provider pickers. When both
// sides share a deployment model, only slot A gets a vendor; comparing a
// vendor against itself by default wouldn't make sense.
import type { ShapeOption } from "../../_tco-shared/lib/fields";
import type { SolutionInputs } from "./model";
import { defaultSolution } from "./defaults";
import { switchVendor } from "./vendorDefaults";

export const PLACEHOLDER_NAMES = [
  "Solution A (Cloud)", "Solution A (Server-based)", "Solution B (Cloud)", "Solution B (Server-based)",
];

export const DEFAULT_CLOUD_VENDOR = "Verkada";
export const DEFAULT_ONPREM_VENDOR = "LenelS2 OnGuard";

export function seedSolution(slot: "a" | "b", opt: ShapeOption): SolutionInputs {
  const model = slot === "a" ? opt.modelA : opt.modelB;
  const leaveOpen = opt.modelA === opt.modelB && slot === "b";
  if (leaveOpen) return defaultSolution(slot, `Solution B (${model === "cloud" ? "Cloud" : "Server-based"})`, model);
  const vendor = model === "cloud" ? DEFAULT_CLOUD_VENDOR : DEFAULT_ONPREM_VENDOR;
  return { ...switchVendor(defaultSolution(slot, vendor, model), undefined, vendor), name: vendor };
}
