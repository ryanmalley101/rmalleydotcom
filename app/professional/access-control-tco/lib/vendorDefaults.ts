// Per-vendor researched defaults, keyed by the exact names in providers.ts.
// Empty on purpose: no vendor has been researched yet, and the wizard
// doesn't pre-fill a vendor name over generic numbers (see the README's
// design principles). Fill these the way the video calculator's were, with
// a research prompt that returns per-field sources and confidence, and
// review the output before merging. Everything that reads them (provider
// switching, source dots, the confidence badge, exports, the checklist) is
// already wired.
import type { SolutionInputs } from "./model";
import { defaultSolution } from "./defaults";
import {
  confidenceSummary as sharedConfidenceSummary, fieldSourceInfo as sharedFieldSourceInfo, switchVendor as sharedSwitchVendor,
  type ConfidenceSummary, type FieldMeta, type VendorDefaultEntry as SharedVendorDefaultEntry,
} from "../../_tco-shared/lib/vendorData";

export type VendorDefaultEntry = SharedVendorDefaultEntry<SolutionInputs>;

export const CLOUD_VENDOR_DEFAULTS: Record<string, VendorDefaultEntry> = {};
export const ONPREM_VENDOR_DEFAULTS: Record<string, VendorDefaultEntry> = {};

export const vendorTableFor = (model: SolutionInputs["model"]) => (model === "cloud" ? CLOUD_VENDOR_DEFAULTS : ONPREM_VENDOR_DEFAULTS);

export function vendorEntriesFor(sol: SolutionInputs): (VendorDefaultEntry | undefined)[] {
  return [vendorTableFor(sol.model)[sol.name]];
}

// What the provider picker calls when the vendor changes (see the shared
// switchVendor).
export function switchVendor(sol: SolutionInputs, prevVendor: string | undefined, nextVendor: string): SolutionInputs {
  return sharedSwitchVendor(sol, prevVendor, nextVendor, vendorTableFor(sol.model), defaultSolution(sol.id, sol.name, sol.model));
}

export function fieldSourceInfo(sol: SolutionInputs, key: keyof SolutionInputs): FieldMeta | null {
  return sharedFieldSourceInfo(key, sol[key], vendorEntriesFor(sol));
}

export function confidenceSummary(sol: SolutionInputs): ConfidenceSummary {
  return sharedConfidenceSummary(sol.name, vendorTableFor(sol.model), sol.model === "cloud" ? "tierPrice" : "doorLicense");
}
