// "What would flip the result": for a handful of the inputs that most often
// decide a comparison, finds the value at which the cheaper solution would
// stop being cheaper, holding everything else fixed. Each input is searched
// by bisection over a plausible range, assuming total cost moves one way as
// the input moves. Each calculator lists its own inputs.

export type FlipUnit = "usd" | "hours" | "pct" | "years" | "count" | "minutes";

export interface FlipParam<T> {
  key: string;
  label: string;
  unit: FlipUnit;
  // Limits a solution input to the solutions it applies to (e.g. one
  // deployment model).
  applies?: (owner: T) => boolean;
  // Search range as a function of the current value.
  range: (current: number) => [number, number];
}

export const upTo = (factor: number, floor: number) => (c: number): [number, number] => [0, Math.max(floor, c * factor)];

export interface FlipPoint {
  label: string;
  // Which solution the input belongs to, or null for a shared scenario input.
  owner: "a" | "b" | null;
  unit: FlipUnit;
  current: number;
  flipAt: number;
  // Relative distance from the current value, for ranking (smaller = closer to flipping).
  distance: number;
}

function bisect(gap: (x: number) => number, lo: number, hi: number, signAtLo: number): number {
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(gap(mid)) === signAtLo) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Finds where gap(x) changes sign starting from `current`, searching toward
// whichever end of the range has the opposite sign.
function findFlip(gap: (x: number) => number, current: number, [min, max]: [number, number]): number | null {
  const s0 = Math.sign(gap(current));
  if (s0 === 0) return null;
  if (max > current && Math.sign(gap(max)) === -s0) return bisect(gap, current, max, s0);
  if (min < current && Math.sign(gap(min)) === -s0) return bisect((x) => gap(x), current, min, s0);
  return null;
}

export function findFlipPoints<S extends object, T extends object>(
  scenario: S,
  solA: T,
  solB: T,
  config: {
    solutionParams: FlipParam<T>[];
    scenarioParams: FlipParam<S>[];
    // Total of A minus total of B.
    gap: (scenario: S, solA: T, solB: T) => number;
  },
  limit = 5,
): FlipPoint[] {
  const points: FlipPoint[] = [];
  const read = (o: object, key: string) => Number((o as Record<string, unknown>)[key]) || 0;

  for (const [owner, sol] of [["a", solA], ["b", solB]] as const) {
    for (const p of config.solutionParams) {
      if (p.applies && !p.applies(sol)) continue;
      const current = read(sol, p.key);
      const gap = (x: number) => {
        const changed = { ...sol, [p.key]: x } as T;
        return owner === "a" ? config.gap(scenario, changed, solB) : config.gap(scenario, solA, changed);
      };
      const flipAt = findFlip(gap, current, p.range(current));
      if (flipAt !== null) points.push({ label: p.label, owner, unit: p.unit, current, flipAt, distance: Math.abs(flipAt - current) / Math.max(Math.abs(current), 1e-6) });
    }
  }
  for (const p of config.scenarioParams) {
    const current = read(scenario, p.key);
    const gap = (x: number) => config.gap({ ...scenario, [p.key]: x } as S, solA, solB);
    const flipAt = findFlip(gap, current, p.range(current));
    if (flipAt !== null) points.push({ label: p.label, owner: null, unit: p.unit, current, flipAt, distance: Math.abs(flipAt - current) / Math.max(Math.abs(current), 1e-6) });
  }
  return points.sort((x, y) => x.distance - y.distance).slice(0, limit);
}
