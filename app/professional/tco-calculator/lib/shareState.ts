import { MODEL_VERSION, type ScenarioInputs, type SolutionInputs } from "./model";
import { normalizeScenario, normalizeSolution } from "./defaults";
import {
  decodeState, encodeState, isStaleState, normalizeComparisonState, type ComparisonState,
} from "../../_tco-shared/lib/shareState";

// A comparison as it travels in a share link or a local save. modelVersion
// is the cost-model version it was created under (see MODEL_VERSION).
export type SharedState = ComparisonState<ScenarioInputs, SolutionInputs>;

// True when the state was created under an older cost model than the one
// now running, so its totals may differ from what the sender saw.
export function isStaleModel(state: Pick<SharedState, "modelVersion">): boolean {
  return isStaleState(state, MODEL_VERSION);
}

// Backfills any fields missing from a SharedState produced by an older
// version of the app — a share link or a locally-saved comparison, both of
// which are just JSON that can predate a newer field — with current
// defaults. Called by decodeShareState below for share links; saved
// comparisons load from localStorage directly, so callers on that path need
// to run this themselves before applying the state.
export function normalizeSharedState(state: SharedState): SharedState {
  return normalizeComparisonState(state, normalizeScenario, normalizeSolution);
}

export function encodeShareState(state: SharedState): string {
  return encodeState(state, MODEL_VERSION);
}

export function decodeShareState(raw: string): SharedState | null {
  return decodeState(raw, normalizeSharedState);
}
