import { MODEL_VERSION, type ScenarioInputs, type SolutionInputs } from "./model";
import { DEFAULT_SCENARIO, SHAPE_OPTIONS, defaultSolution, normalizeScenario, normalizeSolution } from "./defaults";
import { switchVendor } from "./vendorDefaults";
import { SOLUTION_A_COLOR, SOLUTION_B_COLOR } from "../../_tco-shared/lib/colors";
import { defaultIncumbentFor } from "../../_tco-shared/lib/fields";
import {
  decodeState, encodeState, isStaleState, normalizeComparisonState, type ComparisonState, type ShareCodec,
} from "../../_tco-shared/lib/shareState";

// A comparison as it travels in a share link or a local save.
export type SharedState = ComparisonState<ScenarioInputs, SolutionInputs>;

export const isStaleModel = (state: Pick<SharedState, "modelVersion" | "defaultsChanged">) => isStaleState(state, MODEL_VERSION);

// Backfills fields an older link or save predates. Saved comparisons don't
// go through decodeShareState, so their loader calls this itself.
export const normalizeSharedState = (state: SharedState): SharedState =>
  normalizeComparisonState(state, normalizeScenario, normalizeSolution);

// The values a solution starts from before the user edits anything: the
// generic defaults for its deployment model plus the researched values of
// the vendor it's named after, as the wizard's seeding and provider picker
// produce for an untouched solution.
export function solutionBaseline(seed: Partial<SolutionInputs>): SolutionInputs {
  const { id = "a", name = "", model = "cloud" } = seed;
  return switchVendor(defaultSolution(id, name, model), undefined, name);
}

// Share links store only what differs from these (see ShareCodec).
const CODEC: ShareCodec<ScenarioInputs, SolutionInputs> = {
  modelVersion: MODEL_VERSION,
  seedKeys: ["id", "name", "model"],
  solutionBaseline,
  scenarioBaseline: (shapeId) => {
    const opt = SHAPE_OPTIONS.find((o) => o.id === shapeId);
    return opt ? { ...DEFAULT_SCENARIO, incumbent: defaultIncumbentFor(opt) } : DEFAULT_SCENARIO;
  },
  defaultColors: { a: SOLUTION_A_COLOR, b: SOLUTION_B_COLOR },
  normalize: normalizeSharedState,
};

export const encodeShareState = (state: SharedState) => encodeState(state, CODEC);
export const decodeShareState = (raw: string) => decodeState(raw, CODEC);
