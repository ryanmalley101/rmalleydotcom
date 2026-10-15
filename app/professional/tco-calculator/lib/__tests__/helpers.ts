// Shared fixtures for the cost-model tests. Mirrors the wizard's own
// seeding (page.tsx's seedSolution) so "the default comparison" here is the
// same one a first-time visitor sees.
import type { ScenarioInputs, SolutionInputs } from "../model";
import { DEFAULT_SCENARIO, defaultSolution } from "../defaults";
import {
  CLOUD_VENDOR_DEFAULTS, ONPREM_VMS_VENDOR_DEFAULTS, ONPREM_CAMERA_VENDOR_DEFAULTS, withVendorDefaults,
} from "../vendorDefaults";

export function seedOnprem(id: "a" | "b" = "a"): SolutionInputs {
  let s = defaultSolution(id, "", "onprem");
  s = withVendorDefaults(s, "Milestone XProtect", ONPREM_VMS_VENDOR_DEFAULTS);
  s = withVendorDefaults(s, "Axis Communications", ONPREM_CAMERA_VENDOR_DEFAULTS);
  return { ...s, vmsProvider: "Milestone XProtect", cameraProvider: "Axis Communications", name: "Milestone XProtect · Axis Communications cameras" };
}

export function seedVerkada(id: "a" | "b" = "b"): SolutionInputs {
  return withVendorDefaults(defaultSolution(id, "Verkada", "cloud"), "Verkada", CLOUD_VENDOR_DEFAULTS);
}

export function scenario(overrides: Partial<ScenarioInputs> = {}): ScenarioInputs {
  return { ...DEFAULT_SCENARIO, ...overrides };
}

export const round = (n: number) => Math.round(n);

export const NO_ESCALATION = { laborEscalationPct: 0, hardwareEscalationPct: 0, licenseEscalationPct: 0 };
