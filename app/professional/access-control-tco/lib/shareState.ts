import { MODEL_VERSION, type ScenarioInputs, type SolutionInputs } from "./model";
import { normalizeScenario, normalizeSolution } from "./defaults";
import {
  decodeState, encodeState, isStaleState, normalizeComparisonState, type ComparisonState,
} from "../../_tco-shared/lib/shareState";

// A comparison as it travels in a share link or a local save.
export type SharedState = ComparisonState<ScenarioInputs, SolutionInputs>;

export const isStaleModel = (state: Pick<SharedState, "modelVersion">) => isStaleState(state, MODEL_VERSION);

// Backfills fields an older link or save predates. Saved comparisons don't
// go through decodeShareState, so their loader calls this itself.
export const normalizeSharedState = (state: SharedState): SharedState =>
  normalizeComparisonState(state, normalizeScenario, normalizeSolution);

export const encodeShareState = (state: SharedState) => encodeState(state, MODEL_VERSION);
export const decodeShareState = (raw: string) => decodeState(raw, normalizeSharedState);
