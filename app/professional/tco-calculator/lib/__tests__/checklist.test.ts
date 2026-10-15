import { test } from "node:test";
import assert from "node:assert/strict";
import { computeComparison } from "../model";
import { buildChecklist } from "../checklist";
import { seedOnprem, seedVerkada, scenario } from "./helpers";

test("the default comparison flags its soft spots", () => {
  const scn = scenario({ incumbent: "a" });
  const a = seedOnprem("a"), b = seedVerkada("b");
  const items = buildChecklist(scn, a, b, computeComparison(scn, a, b));
  assert.ok(items.some((i) => i.includes("Hrs per investigation")), "generic labor inputs");
  assert.ok(items.some((i) => i.includes("age of the existing cameras")), "fleet age left at 0");
  assert.ok(items.some((i) => i.includes("estimated staff time")), "staff time drives the gap");
});

test("filling in the flagged inputs clears those items", () => {
  const scn = scenario({ incumbent: "a", existingFleetAgeYears: 4 });
  const a = { ...seedOnprem("a"), yearsUntilNextRefresh: 1 };
  const b = seedVerkada("b");
  const items = buildChecklist(scn, a, b, computeComparison(scn, a, b));
  assert.ok(!items.some((i) => i.includes("age of the existing cameras")));
  assert.ok(!items.some((i) => i.includes("next due")));
});
