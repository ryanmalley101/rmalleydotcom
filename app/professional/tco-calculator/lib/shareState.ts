import LZString from "lz-string";
import { MODEL_VERSION, type ScenarioInputs, type SolutionInputs } from "./model";
import { normalizeScenario, normalizeSolution } from "./defaults";

export interface SharedState {
  shapeId: string;
  scenario: ScenarioInputs;
  solA: SolutionInputs;
  solB: SolutionInputs;
  colorA: string;
  colorB: string;
  // Cost-model version this state was created under (see MODEL_VERSION).
  // Absent on links/saves from before versioning, which count as version 1.
  modelVersion?: number;
}

// True when the state was created under an older cost model than the one
// now running, so its totals may differ from what the sender saw.
export function isStaleModel(state: Pick<SharedState, "modelVersion">): boolean {
  return (state.modelVersion ?? 1) < MODEL_VERSION;
}

// Backfills any fields missing from a SharedState produced by an older
// version of the app — a share link or a locally-saved comparison, both of
// which are just JSON that can predate a newer field — with current
// defaults. Called by decodeShareState below for share links; saved
// comparisons load from localStorage directly (see savedComparisons.ts), so
// callers on that path need to run this themselves before applying the state.
export function normalizeSharedState(state: SharedState): SharedState {
  return {
    ...state,
    scenario: normalizeScenario(state.scenario),
    solA: normalizeSolution(state.solA),
    solB: normalizeSolution(state.solB),
  };
}

// LZ-string's compressToEncodedURIComponent is synchronous (unlike the
// browser's native CompressionStream), which matters: decodeShareState runs
// inside a React lazy useState initializer on first render, where an async
// API isn't usable. Typically shrinks a two-on-prem-solution payload from
// ~2.7KB to under 1KB, well clear of old link-unfurler/SMS/proxy URL limits.
export function encodeShareState(state: SharedState): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify({ ...state, modelVersion: MODEL_VERSION }));
}

export function decodeShareState(raw: string): SharedState | null {
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(raw);
    const json = decompressed ?? raw; // fall back to old (pre-compression) uncompressed share links
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.shapeId || !parsed.scenario || !parsed.solA || !parsed.solB) return null;
    return normalizeSharedState(parsed as SharedState);
  } catch {
    return null;
  }
}
