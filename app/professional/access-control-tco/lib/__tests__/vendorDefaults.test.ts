import { test } from "node:test";
import assert from "node:assert/strict";
import { computeComparison } from "../model";
import { DEFAULT_SCENARIO, defaultSolution } from "../defaults";
import { CLOUD_PROVIDERS, ONPREM_PROVIDERS } from "../providers";
import { buildChecklist } from "../checklist";
import {
  CLOUD_VENDOR_DEFAULTS, LICENSE_READER_LIMITS, ONPREM_VENDOR_DEFAULTS, confidenceSummary, fieldSourceInfo, switchVendor,
} from "../vendorDefaults";

const tables = [
  { table: CLOUD_VENDOR_DEFAULTS, providers: CLOUD_PROVIDERS },
  { table: ONPREM_VENDOR_DEFAULTS, providers: ONPREM_PROVIDERS },
];

// Never set from vendor research (RESEARCH_PROMPT.md section 2): the
// operator's or integrator's numbers, or staff-time claims.
const OFF_LIMITS = [
  "adminHrsPerDoorYr", "cardholderChangeMinutes", "alarmMinutes", "truckRollsPerSiteYr", "serverAdminHrsPerYr",
  "hardwareHalfLifeYears", "doorHardwareCost", "newDoorInstallCost", "migrationLaborPerDoor", "replacementLaborPerDevice",
  "discountPct", "serverCount", "serverCost", "serverSoftwareCost", "refreshCycleYears", "cardCost",
];

test("every vendor entry follows the provenance rules", () => {
  for (const { table, providers } of tables) {
    for (const [name, entry] of Object.entries(table)) {
      assert.ok(providers.includes(name), `${name} isn't in the provider list`);
      assert.deepEqual(Object.keys(entry.fieldMeta).sort(), Object.keys(entry.values).sort(), `${name}: values and fieldMeta must pair up`);
      for (const [key, meta] of Object.entries(entry.fieldMeta)) {
        assert.equal(meta.value, (entry.values as Record<string, unknown>)[key], `${name}.${key}: meta value differs`);
        if (meta.status === "sourced") assert.ok(meta.sources.length > 0, `${name}.${key}: sourced without a URL`);
        else assert.ok(meta.reasoning, `${name}.${key}: estimated without reasoning`);
        assert.ok(!OFF_LIMITS.includes(key), `${name}.${key}: not a field vendor research may set`);
      }
    }
  }
});

test("picking a researched vendor applies its numbers with sources, and switching away resets them", () => {
  const generic = defaultSolution("b", "Solution B (Cloud)", "cloud");
  const verkada = { ...switchVendor(generic, generic.name, "Verkada"), name: "Verkada" };
  assert.equal(verkada.tierPrice, 249);
  assert.equal(verkada.mobileCostPerUserYr, 0);
  assert.equal(fieldSourceInfo(verkada, "tierPrice")?.status, "sourced");
  assert.equal(fieldSourceInfo(verkada, "adminHrsPerDoorYr"), null, "staff time stays generic");

  const edited = { ...verkada, readerCost: 400 };
  const rhombus = { ...switchVendor(edited, "Verkada", "Rhombus"), name: "Rhombus" };
  assert.equal(rhombus.tierPrice, 199);
  assert.equal(rhombus.readerCost, 299, "Rhombus's own reader price applies");
  const brivo = { ...switchVendor(verkada, "Verkada", "Brivo"), name: "Brivo" };
  assert.equal(brivo.tierPrice, generic.tierPrice, "Verkada's price doesn't carry over to a quote-only vendor");
  assert.equal(brivo.reusesControllers, true);
});

test("a quote-only vendor says its price isn't researched", () => {
  const brivo = { ...defaultSolution("b", "Brivo", "cloud"), reusesControllers: true };
  assert.equal(confidenceSummary(brivo).label, "Price not researched, using generic default");
  const rhombus = { ...defaultSolution("b", "Rhombus", "cloud") };
  assert.equal(confidenceSummary(rhombus).tone, "mixed");
});

test("the checklist warns when a tiered license is past its reader count", () => {
  const onguard = { ...defaultSolution("a", "LenelS2 OnGuard", "onprem"), ...ONPREM_VENDOR_DEFAULTS["LenelS2 OnGuard"].values };
  const cloud = defaultSolution("b", "Cloud", "cloud");
  const warns = (doors: number) => {
    const scenario = { ...DEFAULT_SCENARIO, doors, readersPerDoor: 1 };
    return buildChecklist(scenario, onguard, cloud, computeComparison(scenario, onguard, cloud)).some((i) => i.includes("researched license covers up to 64 readers"));
  };
  assert.equal(LICENSE_READER_LIMITS["LenelS2 OnGuard"].readers, 64);
  assert.equal(warns(50), false);
  assert.equal(warns(80), true);
});
