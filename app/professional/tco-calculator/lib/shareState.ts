import { MODEL_VERSION, type ScenarioInputs, type SolutionInputs } from "./model";
import { DEFAULT_SCENARIO, SHAPE_OPTIONS, defaultSolution, normalizeScenario, normalizeSolution } from "./defaults";
import { CLOUD_VENDOR_DEFAULTS, ONPREM_CAMERA_VENDOR_DEFAULTS, ONPREM_VMS_VENDOR_DEFAULTS, withVendorDefaults } from "./vendorDefaults";
import { SOLUTION_A_COLOR, SOLUTION_B_COLOR } from "../../_tco-shared/lib/colors";
import { defaultIncumbentFor } from "../../_tco-shared/lib/fields";
import {
  decodeState, encodeState, isStaleState, normalizeComparisonState, type ComparisonState, type ShareCodec,
} from "../../_tco-shared/lib/shareState";

// A comparison as it travels in a share link or a local save. modelVersion
// is the cost-model version it was created under (see MODEL_VERSION).
export type SharedState = ComparisonState<ScenarioInputs, SolutionInputs>;

// True when the state was created under an older cost model than the one
// now running, or a link's defaults have changed since it was made, so its
// totals may differ from what the sender saw.
export function isStaleModel(state: Pick<SharedState, "modelVersion" | "defaultsChanged">): boolean {
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

// The values a solution starts from before the user edits anything: the
// generic defaults for its deployment model, plus the researched values of
// whichever vendors it names (the cloud vendor is the solution's name; on-prem
// has separate VMS and camera pickers). Same result as the wizard's seeding
// and provider pickers produce for an untouched solution.
export function solutionBaseline(seed: Partial<SolutionInputs>): SolutionInputs {
  const { id = "a", name = "", model = "cloud" } = seed;
  let sol = defaultSolution(id, name, model);
  if (model === "cloud") return withVendorDefaults(sol, name, CLOUD_VENDOR_DEFAULTS);
  if (seed.vmsProvider) sol = withVendorDefaults(sol, seed.vmsProvider, ONPREM_VMS_VENDOR_DEFAULTS);
  if (seed.cameraProvider) sol = withVendorDefaults(sol, seed.cameraProvider, ONPREM_CAMERA_VENDOR_DEFAULTS);
  return sol;
}

// Share links store only what differs from these (see ShareCodec).
const CODEC: ShareCodec<ScenarioInputs, SolutionInputs> = {
  modelVersion: MODEL_VERSION,
  seedKeys: ["id", "name", "model", "vmsProvider", "cameraProvider"],
  solutionBaseline,
  scenarioBaseline: (shapeId) => {
    const opt = SHAPE_OPTIONS.find((o) => o.id === shapeId);
    return opt ? { ...DEFAULT_SCENARIO, incumbent: defaultIncumbentFor(opt) } : DEFAULT_SCENARIO;
  },
  defaultColors: { a: SOLUTION_A_COLOR, b: SOLUTION_B_COLOR },
  normalize: normalizeSharedState,
};

export function encodeShareState(state: SharedState): string {
  return encodeState(state, CODEC);
}

export function decodeShareState(raw: string): SharedState | null {
  return decodeState(raw, CODEC);
}
