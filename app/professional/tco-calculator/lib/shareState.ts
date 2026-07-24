import type { ScenarioInputs, SolutionInputs } from "./model";

export interface SharedState {
  shapeId: string;
  scenario: ScenarioInputs;
  solA: SolutionInputs;
  solB: SolutionInputs;
  colorA: string;
  colorB: string;
}

export function encodeShareState(state: SharedState): string {
  return JSON.stringify(state);
}

export function decodeShareState(raw: string): SharedState | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.shapeId || !parsed.scenario || !parsed.solA || !parsed.solB) return null;
    return parsed as SharedState;
  } catch {
    return null;
  }
}
