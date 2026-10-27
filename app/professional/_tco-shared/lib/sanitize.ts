// Clamps numeric inputs to a range a cost model can use, before any math
// runs. Inputs arrive straight from form fields, where a cleared box becomes
// 0 (or an older share link may be missing a field entirely), and a single
// bad value can poison every total: a 0 half-life turns them all into NaN, a
// 0 refresh cycle silently disables refreshes, a fractional device count
// produces odd partial units. Each calculator lists its own rules.

export interface Rule { min: number; max?: number; int?: boolean; fallback: number }

export function clamp(value: unknown, rule: Rule): number {
  let n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) n = rule.fallback;
  if (rule.int) n = Math.round(n);
  n = Math.max(rule.min, n);
  if (rule.max !== undefined) n = Math.min(rule.max, n);
  return n;
}

export function applyRules<T extends object>(input: T, rules: Partial<Record<keyof T, Rule>>): T {
  const out = { ...input } as Record<string, unknown>;
  for (const [key, rule] of Object.entries(rules) as [string, Rule][]) out[key] = clamp(out[key], rule);
  return out as T;
}
