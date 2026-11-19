import { test } from "node:test";
import assert from "node:assert/strict";
import { HyperFormula } from "hyperformula";
import * as XLSX from "xlsx";
import { CATEGORIES, computeComparison, type ScenarioInputs, type SolutionInputs } from "../model";
import { buildSpreadsheet, buildWorkbook } from "../spreadsheet";
import { VERTICALS, annualBaselinePerSite } from "../verticals";
import { defaultSolution } from "../defaults";
import { computeCachedValues, parseAddress, valueAt, cellAt, type Workbook } from "../../../_tco-shared/lib/xlsx/workbook";
import { evaluateFormula, XlError } from "../../../_tco-shared/lib/xlsx/formula";
import type { SharedState } from "../shareState";
import { seedOnprem, seedVerkada, scenario, NO_ESCALATION } from "./helpers";

const ESCALATING = { laborEscalationPct: 3.5, hardwareEscalationPct: -2, licenseEscalationPct: 5 };
const ALL_RETAIL = VERTICALS.find((v) => v.id === "retail")!.categories.map((c) => c.id);

function state(scn: ScenarioInputs, solA: SolutionInputs, solB: SolutionInputs): SharedState {
  return { shapeId: "test", scenario: scn, solA, solB, colorA: "#56b4e9", colorB: "#cc79a7" };
}

const cloudB = (overrides: Partial<SolutionInputs> = {}) => ({ ...seedVerkada("b"), ...overrides });
const onpremA = (overrides: Partial<SolutionInputs> = {}) => ({ ...seedOnprem("a"), ...overrides });

const CASES: [string, SharedState][] = [
  ["default: on-prem incumbent vs. cloud", state(scenario({ incumbent: "a" }), onpremA(), cloudB())],
  ["new site, nobody incumbent, escalation", state(scenario({ incumbent: "none", existingCamerasReusable: false, ...ESCALATING }), onpremA(), cloudB())],
  ["cloud incumbent mid-term, on-prem buying new cameras", state(
    scenario({ incumbent: "b", existingFleetAgeYears: 4, ...ESCALATING }),
    onpremA({ onpremCameraStrategy: "replace", analyticsEnabled: true, analyticsSoftwareCostPerCamYr: 12 }),
    cloudB({ yearsUntilLicenseRenewal: 2, yearsUntilNextApplianceRefresh: 1, warrantyYears: 3 }),
  )],
  ["rip-and-replace cloud, flat pricing, no residual credit", state(
    scenario({ incumbent: "a", creditResidualValue: false, retentionDays: 90, horizonYears: 12 }),
    onpremA({ yearsUntilNextRefresh: 0 }),
    cloudB({ migrationStrategy: "ripReplace", retentionPricing: "flat", supportAddonPerCamYr: 15, networkCostPerSiteYr: 600 }),
  )],
  ["one-year horizon", state(scenario({ incumbent: "none", horizonYears: 1 }), onpremA(), cloudB())],
  ["thirty-year horizon, old fleet", state(scenario({ incumbent: "a", horizonYears: 30, existingFleetAgeYears: 9, ...ESCALATING }), onpremA(), cloudB())],
  ["cloud vs. cloud with misc items of every timing", state(
    scenario({ incumbent: "a", cameras: 37, sites: 6, retentionDays: 14 }),
    { ...defaultSolution("a", "Cloud A", "cloud"), miscItems: [
      { id: "1", label: "Migration consultant", amount: 12_000, timing: "upfront" },
      { id: "2", label: "Monitoring", amount: 2_400, timing: "recurring" },
      { id: "3", label: "Grant", amount: -5_000, timing: "once", year: 3 },
    ] },
    cloudB({ miscItems: [{ id: "4", label: "Year-0 credit, \"quoted\"", amount: -1_000, timing: "once", year: 0 }] }),
  )],
  ["on-prem vs. on-prem with business impact", state(
    scenario({ ...NO_ESCALATION, incumbent: "b", vertical: "retail", sites: 10, outcomeEnabled: ALL_RETAIL,
      outcomeBaseline: { "retail.salesPerSite": 2_000_000, "retail.shrinkPct": 1.8 } }),
    onpremA({ raidLevel: "raid10", outcomeChanges: Object.fromEntries(ALL_RETAIL.map((id, i) => [id, i % 3 === 0 ? -12 : i % 3 === 1 ? 5 : 3])) }),
    { ...seedOnprem("b"), name: "Other VMS", raidLevel: "raid6", serverCapacity: 7, outcomeChanges: { [ALL_RETAIL[0]]: -50 } },
  )],
  ["business impact with nobody incumbent", state(
    scenario({ ...ESCALATING, incumbent: "none", vertical: "retail", outcomeEnabled: ALL_RETAIL }),
    onpremA({ outcomeChanges: { [ALL_RETAIL[1]]: -20, [ALL_RETAIL[ALL_RETAIL.length - 1]]: 4 } }),
    cloudB({ outcomeChanges: { [ALL_RETAIL[0]]: -10, [ALL_RETAIL[ALL_RETAIL.length - 2]]: 200 } }),
  )],
  ...(["none", "raid0", "raid1", "raid10", "raid5", "raid6"] as const).map((raidLevel): [string, SharedState] => [
    `RAID level ${raidLevel}`,
    state(scenario({ incumbent: "none", cameras: 230, sites: 3, retentionDays: 45, bitrateMbps: 3.3 }),
      onpremA({ raidLevel, raidArrayDrives: 6, managementServers: 1, serverSoftwareCost: 900 }), cloudB()),
  ]),
];

const close = (actual: number, expected: number, what: string) =>
  assert.ok(Math.abs(actual - expected) <= 1e-6 * Math.max(1, Math.abs(expected)), `${what}: ${actual} vs. engine ${expected}`);

function num(wb: Workbook, sheet: string, address: string): number {
  const v = valueAt(wb, sheet, address);
  assert.equal(typeof v, "number", `${sheet}!${address} should be a number, got ${String(v)}`);
  return v as number;
}

// Finds a row by its column A label.
function rowOf(wb: Workbook, sheet: string, label: string): number {
  for (const [address, cell] of Array.from(wb.sheet(sheet).cells)) {
    const { col, row } = parseAddress(address);
    if (col === 0 && cell.value === label) return row;
  }
  throw new Error(`No row "${label}" on ${sheet}`);
}

for (const [name, st] of CASES) {
  test(`spreadsheet matches the cost model: ${name}`, () => {
    const c = computeComparison(st.scenario, st.solA, st.solB);
    const wb = buildWorkbook(st);
    computeCachedValues(wb);
    const H = c.labels.length - 1;
    for (const [side, sheet] of [["a", "Model A"], ["b", "Model B"]] as const) {
      const result = c[side];
      for (const cat of CATEGORIES) {
        const r = rowOf(wb, sheet, cat);
        for (let y = 0; y <= H; y++) close(num(wb, sheet, cellAt(3 + y, r)), result.byYear[y][cat], `${sheet} ${cat} year ${y}`);
      }
      const cum = rowOf(wb, sheet, "Running total");
      for (let y = 0; y <= H; y++) close(num(wb, sheet, cellAt(3 + y, cum)), result.cumulative[y], `${sheet} running total year ${y}`);
    }
    const col = { a: "B", b: "C" } as const;
    for (const side of ["a", "b"] as const) {
      const r = c[side];
      const at = (label: string) => num(wb, "Summary", `${col[side]}${rowOf(wb, "Summary", label) + 1}`);
      close(at("Total cost of ownership"), r.total, "total");
      close(at("Cash costs"), r.cashTotal, "cash");
      close(at("Estimated staff time"), r.staffTimeTotal, "staff time");
      close(at("Estimated business impact"), r.outcomeTotal, "business impact");
      close(at("Year 0 (buildout)"), (Object.values(r.byYear[0]) as number[]).reduce((s, x) => s + x, 0), "year 0");
    }
    const crossRow = rowOf(wb, "Summary", "Running totals first cross");
    assert.equal(valueAt(wb, "Summary", `B${crossRow + 1}`), c.crossoverYear === null ? "Never" : `Yr ${c.crossoverYear}`);
    const timesRow = rowOf(wb, "Summary", "Times the running totals cross");
    assert.equal(valueAt(wb, "Summary", `B${timesRow + 1}`), (c.crossoverYear === null ? 0 : 1) + c.laterCrossoverYears.length);
  });
}

// An independent engine, so a formula can't be wrong in Excel and right only
// in our own evaluator (which supplies the cached values).
function checkWithHyperFormula(wb: Workbook) {
  computeCachedValues(wb);
  const sheets: Record<string, (string | number | boolean | null)[][]> = {};
  for (const sheet of wb.sheets) {
    const rows: (string | number | boolean | null)[][] = [];
    for (const [address, cell] of Array.from(sheet.cells)) {
      const { col, row } = parseAddress(address);
      while (rows.length <= row) rows.push([]);
      rows[row][col] = cell.formula !== undefined ? `=${cell.formula}` : cell.value ?? null;
    }
    sheets[sheet.name] = rows.map((r) => Array.from({ length: r.length }, (_, i) => r[i] ?? null));
  }
  const hf = HyperFormula.buildFromSheets(sheets, { licenseKey: "gpl-v3" });
  let checked = 0;
  for (const sheet of wb.sheets) {
    const id = hf.getSheetId(sheet.name)!;
    for (const [address, cell] of Array.from(sheet.cells)) {
      if (cell.formula === undefined) continue;
      const { col, row } = parseAddress(address);
      const theirs = hf.getCellValue({ sheet: id, col, row });
      const ours = cell.cached;
      const where = `${sheet.name}!${address} =${cell.formula}`;
      assert.ok(!(ours instanceof XlError), `${where} is an error: ${String(ours)}`);
      if (typeof ours === "number") {
        assert.equal(typeof theirs, "number", `${where}: HyperFormula gave ${JSON.stringify(theirs)}`);
        assert.ok(Math.abs((theirs as number) - ours) <= 1e-9 * Math.max(1, Math.abs(ours)), `${where}: ${ours} vs. HyperFormula ${theirs}`);
      } else {
        assert.equal(theirs, ours, where);
      }
      checked++;
    }
  }
  hf.destroy();
  return checked;
}

test("every formula agrees with an independent spreadsheet engine", () => {
  for (const [name, st] of CASES) {
    const checked = checkWithHyperFormula(buildWorkbook(st));
    assert.ok(checked > 100, `${name}: only ${checked} formulas checked`);
  }
});

test("editing an input in the sheet recalculates like the model would", () => {
  const st = state(scenario({ incumbent: "a" }), onpremA(), cloudB());
  const wb = buildWorkbook(st);
  const inputs = wb.sheet("Inputs");
  const set = (label: string, col: "B" | "C", value: number | string) => {
    const r = rowOf(wb, "Inputs", label);
    const cell = inputs.get(`${col}${r + 1}`)!;
    cell.value = value;
  };
  set("Camera count", "B", 412);
  set("Incumbent", "B", "Neither");
  set("Discount off list (%)", "C", 22);
  set("Storage redundancy", "B", "RAID 6");
  computeCachedValues(wb);
  const c = computeComparison(
    { ...st.scenario, cameras: 412, incumbent: "none" },
    { ...st.solA, raidLevel: "raid6" },
    { ...st.solB, discountPct: 22 },
  );
  const at = (col: string) => num(wb, "Summary", `${col}${rowOf(wb, "Summary", "Total cost of ownership") + 1}`);
  close(at("B"), c.a.total, "A total after edits");
  close(at("C"), c.b.total, "B total after edits");
});

test("every business impact formula matches its calculation", () => {
  for (const vertical of VERTICALS) {
    for (const category of vertical.categories) {
      if (category.kind !== "existing") continue;
      assert.ok(category.formula, `${category.id} has no spreadsheet formula`);
      for (const seed of [0, 1, 2]) {
        const baseline: Record<string, number> = {};
        vertical.inputs.forEach((input, i) => { baseline[input.key] = seed === 0 ? input.default : ((i + 3) * (seed + 1.7)) % 97; });
        const scn = { ...scenario({ vertical: vertical.id, adminRate: 41 + seed, investigatorRate: 58 }), outcomeBaseline: baseline };
        const expected = annualBaselinePerSite(scn, vertical, category);
        const byKey = new Map(vertical.inputs.map((i) => [i.key, i]));
        const formula = category.formula!.replace(/\{([^}]+)\}/g, (_, key: string) => {
          if (key === "scenario.adminRate") return String(scn.adminRate);
          if (key === "scenario.investigatorRate") return String(scn.investigatorRate);
          assert.ok(byKey.has(key), `${category.id}: unknown input ${key}`);
          return String(baseline[key]);
        });
        const actual = evaluateFormula(formula, "x", () => null) as number;
        assert.ok(Math.abs(actual - expected) < 1e-9 * Math.max(1, expected), `${category.id}: ${actual} vs. ${expected}`);
      }
    }
  }
});

test("the file is a valid workbook with formulas, dropdowns, and charts", () => {
  const st = CASES.find(([name]) => name.startsWith("cloud vs. cloud"))![1];
  const bytes = buildSpreadsheet(st, "https://example.com/?s=1", new Date("2026-01-02T03:04:05Z"));
  const wb = XLSX.read(bytes, { type: "array", cellFormula: true });
  assert.deepEqual(wb.SheetNames, ["Summary", "Year by year", "Inputs", "Model A", "Model B", "Notes"]);
  const summary = wb.Sheets.Summary;
  assert.equal(summary.A1.v, `${st.solA.name} vs. ${st.solB.name}`);
  const totalRow = XLSX.utils.sheet_to_json<string[]>(summary, { header: 1 }).findIndex((r) => r[0] === "Total cost of ownership") + 1;
  assert.match(summary[`B${totalRow}`].f, /'Model A'!\$B\$\d+/);
  const c = computeComparison(st.scenario, st.solA, st.solB);
  close(summary[`B${totalRow}`].v, c.a.total, "cached total");
  const text = new TextDecoder().decode(bytes);
  assert.equal((text.match(/<c:chartSpace /g) ?? []).length, 3, "three charts");
  assert.ok(text.includes('<formula1>&quot;A,B,Neither&quot;</formula1>'), "incumbent dropdown");
  assert.ok(text.includes("Year-0 credit, &quot;quoted&quot;"), "user text is escaped");
  assert.ok(text.includes("https://example.com/?s=1"), "share link on the Notes sheet");
});
