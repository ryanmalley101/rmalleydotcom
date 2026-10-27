import type { SharedState } from "./shareState";
import { MODEL_VERSION } from "./model";
import { createSavedComparisonsStore } from "../../_tco-shared/lib/savedComparisons";

// This calculator's saved comparisons, in this browser only (see the shared
// store for why that's deliberate).
export const SAVED_COMPARISONS = createSavedComparisonsStore<SharedState>("tco-calculator:saved-comparisons", MODEL_VERSION);
