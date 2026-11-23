import type { SolutionInputs } from "./model";
import { defaultSolution, type ShapeOption } from "./defaults";
import { CLOUD_VENDOR_DEFAULTS, ONPREM_VMS_VENDOR_DEFAULTS, ONPREM_CAMERA_VENDOR_DEFAULTS, withVendorDefaults } from "./vendorDefaults";

// Convenience defaults for this tool's actual primary audience, comparing
// against whatever a prospect already runs. Neither is forced, both stay
// fully editable, they just save a click for the most common starting
// point instead of leaving every field blank. On-prem defaults to
// Milestone/Axis (the same pairing the original single-vendor tool's
// numeric defaults were drawn from), so the name lines up with the numbers
// rather than sitting under a generic placeholder. Runs the same
// withVendorDefaults() merge the wizard's Selects use, so a pre-filled
// vendor with researched data (e.g. Milestone, Axis) starts from its real
// numbers instead of the generic defaults, same as picking it manually would.
export function seedSolution(slot: "a" | "b", opt: ShapeOption): SolutionInputs {
  const model = slot === "a" ? opt.modelA : opt.modelB;
  const bothSameModel = opt.modelA === opt.modelB;
  const leaveOpen = bothSameModel && slot === "b"; // the "compared against" side, when both sides share a model

  if (model === "cloud") {
    if (leaveOpen) return defaultSolution(slot, "Solution B (Cloud)", model);
    return withVendorDefaults(defaultSolution(slot, "Verkada", model), "Verkada", CLOUD_VENDOR_DEFAULTS);
  }
  if (leaveOpen) return defaultSolution(slot, "Solution B (On-Prem)", model);
  let sol = defaultSolution(slot, "", model);
  sol = withVendorDefaults(sol, "Milestone XProtect", ONPREM_VMS_VENDOR_DEFAULTS);
  sol = withVendorDefaults(sol, "Axis Communications", ONPREM_CAMERA_VENDOR_DEFAULTS);
  return { ...sol, vmsProvider: "Milestone XProtect", cameraProvider: "Axis Communications", name: "Milestone XProtect · Axis Communications cameras" };
}
