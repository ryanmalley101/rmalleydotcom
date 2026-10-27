import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceCohorts, findCrossovers, isRefreshYear, miscForYear, residualCredit, tallyYears, type Cohort } from "../engine";

test("misc items land by timing", () => {
  const items = [
    { id: "1", label: "u", amount: 100, timing: "upfront" as const },
    { id: "2", label: "r", amount: 10, timing: "recurring" as const },
    { id: "3", label: "o", amount: 1000, timing: "once" as const, year: 3 },
  ];
  assert.deepEqual([0, 1, 2, 3].map((y) => miscForYear(items, y)), [100, 10, 10, 1010]);
  assert.equal(miscForYear(undefined, 0), 0);
});

test("refreshes never land in the horizon's final year", () => {
  const years = Array.from({ length: 11 }, (_, y) => y).filter((y) => isRefreshYear(y, 5, 5, 10));
  assert.deepEqual(years, [5]);
});

test("residual credit is the unused share past the horizon", () => {
  assert.equal(residualCredit([{ year: 7, amount: 1000, life: 5 }], 10), 400);
  assert.equal(residualCredit([{ year: 0, amount: 1000, life: 5 }], 10), 0);
});

test("cohorts fail at their half-life, and replacements join as a new cohort", () => {
  const cohorts: Cohort[] = [{ size: 100, installedYear: 0, halfLife: 1, warrantyYears: 0 }];
  const first = advanceCohorts(cohorts, 1, { halfLife: 1, warrantyYears: 5 });
  assert.equal(first.failed, 50);
  assert.equal(first.outOfWarranty, 50);
  assert.equal(cohorts.length, 2);
  const second = advanceCohorts(cohorts, 2, { halfLife: 1, warrantyYears: 5 });
  assert.equal(second.failed, 50, "25 originals and 25 replacements");
  assert.equal(second.outOfWarranty, 25, "replacements are still under warranty");
});

test("tallies keep every category and put the credit in the final year", () => {
  const cats = ["x", "credit"] as const;
  const t = tallyYears(cats, [{ x: 10, credit: 0 }, { x: 5, credit: 0 }], 3, "credit");
  assert.deepEqual(t.cumulative, [10, 12]);
  assert.equal(t.total, 12);
  assert.equal(t.byYear[1].credit, -3);
});

test("crossovers start from the first nonzero gap and report every flip", () => {
  assert.deepEqual(findCrossovers([0, 5, 10, 30], [0, 8, 9, 20]), [2]);
  assert.deepEqual(findCrossovers([0, 5, 10, 30], [1, 4, 11, 20]), [1, 2, 3]);
  assert.deepEqual(findCrossovers([1, 2], [1, 2]), []);
});
