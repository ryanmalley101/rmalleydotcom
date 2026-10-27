// Building blocks shared by every two-solution TCO model in /professional
// (video surveillance, access control): the parts of the year-by-year math
// that don't depend on what's being bought. Each calculator's own model.ts
// decides what lands in which category each year; these handle misc items,
// refresh timing, failure cohorts, the residual-value credit, totals, and
// crossover detection the same way everywhere.

// "cloud": cloud-managed or hybrid. "onprem": server-based, managed on site.
export type DeploymentModel = "cloud" | "onprem";
// Which solution (if either) is already deployed. The incumbent skips its
// year-0 buildout cost; the other solution pays it as a fresh deployment.
export type IncumbentChoice = "none" | "a" | "b";

// A free-form misc cost/credit line item — the escape valve for whatever a
// real quote (or a value-justification argument) contains that doesn't fit
// any category, without inventing a new named category for every oddball
// line a user might want. `amount` can be negative — a workers' comp claim
// reduction, a productivity credit, or any other cost *offset* is just a
// misc item with a negative amount, same mechanism as a misc cost. Applied
// at face value, not multiplied by the vendor's discountPct — these are
// user-authored numbers unrelated to vendor pricing, not a vendor SKU.
export type MiscItemTiming = "upfront" | "recurring" | "once";
export interface MiscCostItem {
  id: string;
  label: string;
  amount: number;
  // "upfront": once at year 0. "recurring": every year after year 0,
  // escalating like the other recurring lines. "once": a single charge in
  // `year` (0 to the horizon), for a known future event. All three apply to
  // the incumbent too: these are the user's own numbers, not buildout costs.
  timing: MiscItemTiming;
  year?: number;
}

// Unescalated misc total for year `y`: "upfront" items in year 0,
// "recurring" ones in years 1+, and a "once" item in its own year.
export function miscForYear(items: MiscCostItem[] | undefined, y: number): number {
  const list = Array.isArray(items) ? items : [];
  return list.reduce((sum, it) => {
    const amount = Number(it.amount) || 0;
    if (it.timing === "upfront") return y === 0 ? sum + amount : sum;
    if (it.timing === "recurring") return y > 0 ? sum + amount : sum;
    if (it.timing === "once") return Math.round(Number(it.year) || 0) === y ? sum + amount : sum;
    return sum;
  }, 0);
}

// Whether a purchase on a `cycle`-year cadence starting at year `first`
// lands in year `y`. Never in the horizon's final year: there's no benefit
// renewing or refreshing something that won't be used.
export const isRefreshYear = (y: number, first: number, cycle: number, horizonYears: number) =>
  y >= first && (y - first) % cycle === 0 && y < horizonYears;

// A lump purchase with a fixed service life, for the residual-value credit.
// A purchase in year p serves years p+1 through p+life.
export interface Lump { year: number; amount: number; life: number }

// The unused share of every lump that outlasts the horizon, straight-line.
export function residualCredit(lumps: Lump[], horizonYears: number): number {
  return lumps.reduce((sum, l) => {
    const unused = l.life - Math.min(l.life, Math.max(0, horizonYears - l.year));
    return sum + (l.amount * unused) / l.life;
  }, 0);
}

// A batch of devices installed in the same year (cameras, readers,
// controllers). Each fails at a constant yearly rate set by its half-life,
// and a failure inside the batch's warranty window costs only labor.
export interface Cohort { size: number; installedYear: number; halfLife: number; warrantyYears: number }

// Ages every cohort by one year (year `y`), removing its failures, and adds
// those failures back as a new cohort installed in year `y` on the
// replacement hardware's own half-life and warranty, so replacements can
// fail in turn. Returns how many failed and how many of those were already
// out of warranty (the ones whose hardware has to be paid for).
export function advanceCohorts(
  cohorts: Cohort[],
  y: number,
  replacement: { halfLife: number; warrantyYears: number },
): { failed: number; outOfWarranty: number } {
  let failed = 0;
  let outOfWarranty = 0;
  for (const cohort of cohorts) {
    const fails = cohort.size * (1 - Math.pow(0.5, 1 / cohort.halfLife));
    cohort.size -= fails;
    failed += fails;
    if (y - cohort.installedYear > cohort.warrantyYears) outOfWarranty += fails;
  }
  cohorts.push({ size: failed, installedYear: y, halfLife: replacement.halfLife, warrantyYears: replacement.warrantyYears });
  return { failed, outOfWarranty };
}

export function emptyYear<C extends string>(categories: readonly C[]): Record<C, number> {
  return Object.fromEntries(categories.map((c) => [c, 0])) as Record<C, number>;
}

export interface YearlyTotals<C extends string> {
  totalsByCategory: Record<C, number>;
  cumulative: number[]; // escalated running total, index = year
  // Escalated cost per category for each year, index = year. The residual
  // credit, if any, sits in the final year.
  byYear: Record<C, number>[];
  total: number;
}

// Sums already-escalated per-year category costs into totals and a running
// cumulative, then applies a residual credit (if positive) to
// `creditCategory` in the final year.
export function tallyYears<C extends string>(
  categories: readonly C[],
  years: Record<C, number>[],
  credit: number,
  creditCategory: C,
): YearlyTotals<C> {
  const totalsByCategory = emptyYear(categories);
  const cumulative: number[] = [];
  const byYear: Record<C, number>[] = [];
  let running = 0;
  for (const yearCosts of years) {
    let yearTotal = 0;
    const year = emptyYear(categories);
    for (const c of categories) {
      year[c] = yearCosts[c];
      totalsByCategory[c] += yearCosts[c];
      yearTotal += yearCosts[c];
    }
    byYear.push(year);
    running += yearTotal;
    cumulative.push(running);
  }
  if (credit > 0) {
    totalsByCategory[creditCategory] = -credit;
    cumulative[cumulative.length - 1] -= credit;
    byYear[byYear.length - 1][creditCategory] = -credit;
  }
  const total = (Object.values(totalsByCategory) as number[]).reduce((a, b) => a + b, 0);
  return { totalsByCategory, cumulative, byYear, total };
}

// Every year the cumulative lines cross. The baseline side is taken from the
// first year with a nonzero gap (not year 1): with an incumbent, one side
// often starts at $0 and can cross the other before year 1. Each later flip
// is relative to the side it flipped to most recently.
export function findCrossovers(a: number[], b: number[]): number[] {
  const years: number[] = [];
  let currentSign = 0;
  let baselineFound = false;
  for (let y = 0; y < a.length; y++) {
    const sign = Math.sign(a[y] - b[y]);
    if (sign === 0) continue;
    if (!baselineFound) {
      currentSign = sign;
      baselineFound = true;
    } else if (sign !== currentSign) {
      years.push(y);
      currentSign = sign;
    }
  }
  return years;
}

// Categories either side actually spent (or was credited) anything in.
// Math.abs: credits (residual value, negative misc items, business impact
// savings) are real lines too.
export function activeCategories<C extends string>(
  categories: readonly C[],
  a: { totalsByCategory: Record<C, number> },
  b: { totalsByCategory: Record<C, number> },
): C[] {
  return categories.filter((c) => Math.abs(a.totalsByCategory[c]) > 0.5 || Math.abs(b.totalsByCategory[c]) > 0.5);
}

// What every calculator's results report, so the shared results, chart,
// table, and export components can read either one.
export interface SolutionTotals<C extends string = string> extends YearlyTotals<C> {
  // total split into money paid out, estimated internal staff time, and
  // estimated business impact; cashTotal + staffTimeTotal + outcomeTotal === total.
  cashTotal: number;
  staffTimeTotal: number;
  outcomeTotal: number;
}

export interface ComparisonTotals<C extends string = string, R extends SolutionTotals<C> = SolutionTotals<C>> {
  a: R;
  b: R;
  labels: string[];
  crossoverYear: number | null;
  /** Additional sign flips after the first one, if the lines cross more than once. */
  laterCrossoverYears: number[];
  activeCategories: C[];
}

// Splits a result's total into cash, staff time, and business impact.
export function splitTotals<C extends string>(
  t: YearlyTotals<C>,
  staffTimeCategories: readonly C[],
  outcomeCategories: readonly C[],
): SolutionTotals<C> {
  const staffTimeTotal = staffTimeCategories.reduce((sum, c) => sum + t.totalsByCategory[c], 0);
  const outcomeTotal = outcomeCategories.reduce((sum, c) => sum + t.totalsByCategory[c], 0);
  return { ...t, cashTotal: t.total - staffTimeTotal - outcomeTotal, staffTimeTotal, outcomeTotal };
}

// Year labels, crossovers, and active categories for two computed sides.
export function compareTotals<C extends string, R extends SolutionTotals<C>>(
  categories: readonly C[],
  a: R,
  b: R,
  horizonYears: number,
): ComparisonTotals<C, R> {
  const labels = Array.from({ length: horizonYears + 1 }, (_, y) => "Yr " + y);
  const crossoverYears = findCrossovers(a.cumulative, b.cumulative);
  return {
    a, b, labels,
    crossoverYear: crossoverYears[0] ?? null,
    laterCrossoverYears: crossoverYears.slice(1),
    activeCategories: activeCategories(categories, a, b),
  };
}
