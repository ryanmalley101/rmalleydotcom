import type { SharedState } from "./shareState";
import { MODEL_VERSION } from "./model";
import { createSavedComparisonsStore } from "../../_tco-shared/lib/savedComparisons";

// This calculator's saved comparisons, in this browser only, under their own
// key so they don't mix with the video calculator's.
export const SAVED_COMPARISONS = createSavedComparisonsStore<SharedState>("access-control-tco:saved-comparisons", MODEL_VERSION);
