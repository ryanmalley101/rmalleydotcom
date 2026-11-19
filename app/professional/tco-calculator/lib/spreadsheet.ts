// The spreadsheet export: this calculator's cost model as live Excel
// formulas, so a comparison can be audited, tweaked, and extended without
// the app. An Inputs sheet holds every assumption (blue cells); one model
// sheet per solution derives each cost category year by year from them;
// the shared Summary and Year by year sheets (_tco-shared/lib/spreadsheet.ts)
// total and chart the two.
//
// The formulas themselves aren't here: each quantity in model.ts carries its
// formula beside the TypeScript the app runs (DERIVED, LINES, and the rest),
// and this file lays them out. Its own math is limited to the inputs table,
// the business impact table, and the yearly and running totals.
//
// What the export fixes rather than leaving live: the horizon (one column
// per year), each solution's deployment model (cloud and on-prem sheets
// have different lines), and how many misc items and business impact
// categories there are (each gets a row; a few blank misc rows are added
// for new items). Changing those means exporting again.
import {
  CATEGORIES, FLEET_SHEET, LINES, OUTCOME_CATEGORIES, RESIDUAL, RESIDUAL_LINES, SHEET_CHOICES, STAFF_TIME_CATEGORIES,
  derivedFor, linesFor,
  type Category, type DerivedDef, type LineDef, type LineEntry, type ModelRefs, type ScenarioInputs, type SolutionInputs,
} from "./model";
import { sanitizeScenario, sanitizeSolution } from "./sanitize";
import { SCENARIO_FIELDS, fieldsFor } from "./fields";
import { sourceStatus } from "./report";
import { METHODOLOGY_NOTES } from "./methodology";
import {
  NEW_COST_UNIT_LABEL, annualBaselinePerSite, baselineValue, changeValue, inputsInUse, isCategoryEnabled, outcomeReportRows, verticalFor,
} from "./verticals";
import type { SharedState } from "./shareState";
import { Workbook, cellAt, colName, xrange, xref, type Content } from "../../_tco-shared/lib/xlsx/workbook";
import { writeXlsx } from "../../_tco-shared/lib/xlsx/write";
import { addComparisonSheets, type ModelSheetLayout } from "../../_tco-shared/lib/spreadsheet";

const INPUTS = "Inputs";
const MODEL_SHEET = { a: "Model A", b: "Model B" } as const;
// Blank rows added under each solution's misc items, for new ones.
const SPARE_MISC_ROWS = 5;

// Choice fields as the spreadsheet shows them, which model.ts's formulas compare against.
const {
  yes: YES, no: NO, migration: MIGRATION, cameraStrategy: CAMERA_STRATEGY, retentionPricing: RETENTION_PRICING, raid: RAID, miscTiming: MISC_TIMING,
} = SHEET_CHOICES;

const USD_FIELDS = new Set<keyof SolutionInputs>([
  "cameraCost", "bulkInstallLaborCost", "replacementInstallLaborCost", "tierPrice", "applianceCost", "supportAddonPerCamYr",
  "baseLicense", "deviceLicense", "serverCost", "storageCostPerTB", "analyticsApplianceCost", "analyticsSoftwareCostPerCam",
  "analyticsSoftwareCostPerCamYr", "networkCostPerSiteYr", "serverSoftwareCost",
]);
const USD_SCENARIO = new Set<keyof ScenarioInputs>(["adminRate", "investigatorRate", "truckRollCost"]);

type Side = "a" | "b";
type Refs = Record<string, string>;

interface MiscRanges { amount: string; timing: string; year: string }

interface InputRefs {
  scen: Refs;
  sol: Record<Side, Refs>;
  misc: Record<Side, MiscRanges>;
  // Business impact: this side's yearly savings (negative) and added costs.
  impact: Record<Side, { savings: string; costs: string } | null>;
}

// ---------------------------------------------------------------------------
// Inputs sheet

function buildInputs(wb: Workbook, scenario: ScenarioInputs, sols: Record<Side, SolutionInputs>, raw: Record<Side, SolutionInputs>): InputRefs {
  const sh = wb.add(INPUTS);
  [48, 26, 26, 44, 44].forEach((w, i) => sh.width(i, w));
  sh.freeze = { cols: 1, rows: 0 };
  sh.set("A1", "Inputs", "title");
  sh.set("A2", "Blue cells are inputs: change any of them and every sheet recalculates. Gray cells are fixed by how the workbook was exported (see Notes).", "note");
  const names = { a: sols.a.name, b: sols.b.name };
  let r = 3;
  const ref = (col: number, row: number) => xref(INPUTS, cellAt(col, row));

  // ---- Scenario
  sh.set(cellAt(0, r), "Scenario", "section");
  r++;
  ["Input", "Value", "", "Notes"].forEach((h, i) => h && sh.set(cellAt(i, r), h, i === 1 ? "headerRight" : "header"));
  r++;
  const scen: Refs = {};
  for (const f of SCENARIO_FIELDS) {
    const key = f.key;
    const at = cellAt(1, r);
    sh.set(cellAt(0, r), f.label);
    let note = "";
    if (key === "incumbent") {
      sh.set(at, scenario.incumbent === "a" ? "A" : scenario.incumbent === "b" ? "B" : "Neither", "inText");
      sh.dropdown(at, ["A", "B", "Neither"]);
      note = `A = ${names.a}; B = ${names.b}. The incumbent is already installed: no year-0 buildout, no business impact change.`;
    } else if (key === "existingCamerasReusable" || key === "creditResidualValue") {
      sh.set(at, scenario[key] === false ? NO : YES, "inText");
      sh.dropdown(at, [YES, NO]);
    } else if (key === "horizonYears") {
      sh.set(at, scenario.horizonYears, "fixedNum");
      note = "Fixed: sets how many year columns the model sheets have.";
    } else {
      sh.set(at, scenario[key] as number, USD_SCENARIO.has(key) ? "inUsd" : "inNum");
    }
    if (note) sh.set(cellAt(3, r), note, "note");
    scen[key] = ref(1, r);
    r++;
  }

  // ---- Solutions
  r++;
  sh.set(cellAt(0, r), "Solutions", "section");
  r++;
  ["Input", names.a, names.b, `Source: ${names.a}`, `Source: ${names.b}`].forEach((h, i) => sh.set(cellAt(i, r), h, i === 1 || i === 2 ? "headerRight" : "header"));
  r++;
  const sol: Record<Side, Refs> = { a: {}, b: {} };
  const fields = [...fieldsFor(sols.a.model), ...fieldsFor(sols.b.model)];
  const keys = Array.from(new Set(fields.map((f) => f.key)));
  const labelFor = new Map(fields.map((f) => [f.key, f.label]));
  for (const key of keys) {
    sh.set(cellAt(0, r), labelFor.get(key) ?? key);
    (["a", "b"] as const).forEach((side, i) => {
      const s = sols[side];
      const at = cellAt(1 + i, r);
      const applies = fieldsFor(s.model).some((f) => f.key === key);
      sol[side][key] = ref(1 + i, r);
      if (!applies) {
        sh.set(at, "n/a", "fixed");
        return;
      }
      const choice = (value: string, options: string[]) => {
        sh.set(at, value, "inText");
        sh.dropdown(at, options);
      };
      switch (key) {
        case "model": sh.set(at, s.model === "cloud" ? "Cloud / hybrid" : "On-prem", "fixed"); break;
        case "vmsProvider": case "cameraProvider": sh.set(at, s[key] ?? "", "fixed"); break;
        case "migrationStrategy": choice(MIGRATION[s.migrationStrategy] ?? MIGRATION.connector, Object.values(MIGRATION)); break;
        case "onpremCameraStrategy": choice(CAMERA_STRATEGY[s.onpremCameraStrategy] ?? CAMERA_STRATEGY.reuse, Object.values(CAMERA_STRATEGY)); break;
        case "retentionPricing": choice(RETENTION_PRICING[s.retentionPricing] ?? RETENTION_PRICING.scaled, Object.values(RETENTION_PRICING)); break;
        case "raidLevel": choice(RAID[s.raidLevel] ?? RAID.raid5, Object.values(RAID)); break;
        case "analyticsEnabled": choice(s.analyticsEnabled === true ? YES : NO, [YES, NO]); break;
        case "yearsUntilLicenseRenewal": sh.set(at, s.yearsUntilLicenseRenewal ?? null, "inNum"); break;
        default: sh.set(at, s[key] as number, USD_FIELDS.has(key) ? "inUsd" : "inNum");
      }
      const source = sourceStatus(raw[side], key);
      if (source) sh.set(cellAt(3 + i, r), source, "note");
    });
    if (key === "yearsUntilLicenseRenewal") sh.set(cellAt(3, r), "Incumbent only; blank means a full term from year 0.", "note");
    r++;
  }

  // ---- Misc items
  const misc = {} as Record<Side, MiscRanges>;
  for (const side of ["a", "b"] as const) {
    r++;
    sh.set(cellAt(0, r), `Misc costs and credits: ${names[side]}`, "section");
    r++;
    sh.set(cellAt(0, r), "Upfront: year 0 only. Recurring: every year from year 1. Once: only in the year given. Grow with labor escalation; negative amounts are credits.", "note");
    r++;
    ["Item", "Amount ($)", "Timing", "Year (for Once)"].forEach((h, i) => sh.set(cellAt(i, r), h, i === 1 ? "headerRight" : "header"));
    r++;
    const items = Array.isArray(sols[side].miscItems) ? sols[side].miscItems : [];
    const first = r;
    for (let i = 0; i < items.length + SPARE_MISC_ROWS; i++, r++) {
      const it = items[i];
      sh.set(cellAt(0, r), it ? it.label || "Item" : null, "inText");
      sh.set(cellAt(1, r), it ? Number(it.amount) || 0 : null, "inUsd");
      sh.set(cellAt(2, r), it ? MISC_TIMING[it.timing] ?? null : null, "inText");
      sh.dropdown(cellAt(2, r), Object.values(MISC_TIMING));
      sh.set(cellAt(3, r), it && it.timing === "once" ? Math.round(Number(it.year) || 0) : null, "inNum");
    }
    const range = (col: number) => xrange(INPUTS, cellAt(col, first), cellAt(col, r - 1));
    misc[side] = { amount: range(1), timing: range(2), year: range(3) };
  }

  // ---- Business impact
  const impact: InputRefs["impact"] = { a: null, b: null };
  const vertical = verticalFor(scenario);
  const enabled = vertical ? vertical.categories.filter((c) => isCategoryEnabled(scenario, c.id)) : [];
  if (vertical) {
    r++;
    sh.set(cellAt(0, r), `Business impact: ${vertical.label}`, "section");
    r++;
    sh.set(cellAt(0, r), "Changes are from today's costs and start in year 1, growing with labor escalation. The incumbent has none: today's figures already reflect it.", "note");
    r++;
    const bi: Refs = {};
    const used = inputsInUse(scenario, vertical);
    if (used.length) {
      ["Today's business (per site)", "Value"].forEach((h, i) => sh.set(cellAt(i, r), h, i ? "headerRight" : "header"));
      r++;
      for (const input of used) {
        sh.set(cellAt(0, r), input.label);
        sh.set(cellAt(1, r), baselineValue(scenario, input), input.unit === "usd" ? "inUsd" : "inNum");
        bi[input.key] = ref(1, r);
        r++;
      }
      r++;
    }
    ["Category", "Change entered as", "Today's cost per site ($/yr)", `Change: ${names.a}`, `Change: ${names.b}`, `Yearly effect: ${names.a}`, `Yearly effect: ${names.b}`]
      .forEach((h, i) => sh.set(cellAt(i, r), h, i >= 2 ? "headerRight" : "header"));
    r++;
    const first = r;
    for (const c of enabled) {
      sh.set(cellAt(0, r), c.label);
      const base = cellAt(2, r);
      if (c.kind === "existing") {
        sh.set(cellAt(1, r), "% change", "fixed");
        const formula = c.formula?.replace(/\{([^}]+)\}/g, (_, key: string) => {
          if (key === "scenario.adminRate") return scen.adminRate;
          if (key === "scenario.investigatorRate") return scen.investigatorRate;
          if (!bi[key]) throw new Error(`Business impact formula for ${c.id} uses ${key}, which isn't an input in use`);
          return bi[key];
        });
        sh.set(base, formula ? { f: formula } : annualBaselinePerSite(scenario, vertical, c), formula ? "usd" : "fixed");
      } else {
        sh.set(cellAt(1, r), NEW_COST_UNIT_LABEL[c.unit], "fixed");
      }
      (["a", "b"] as const).forEach((side, i) => {
        const change = cellAt(3 + i, r);
        sh.set(change, changeValue(sols[side], c), "inNum");
        const letter = side === "a" ? "A" : "B";
        let amount: string;
        if (c.kind === "existing") amount = `${base}*${scen.sites}*${change}/100`;
        else if (c.unit === "usdPerYear") amount = change;
        else if (c.unit === "usdPerSiteMonth") amount = `${change}*12*${scen.sites}`;
        else amount = `${change}*52*${scen.sites}*${scen[c.rate ?? "investigatorRate"]}`;
        sh.set(cellAt(5 + i, r), { f: `IF(${scen.incumbent}="${letter}",0,${amount})` }, "usd");
      });
      r++;
    }
    if (enabled.length) {
      (["a", "b"] as const).forEach((side, i) => {
        const effects = xrange(INPUTS, cellAt(5 + i, first), cellAt(5 + i, r - 1));
        impact[side] = { savings: `SUMIF(${effects},"<0")`, costs: `SUMIF(${effects},">0")` };
      });
    }
    const considerations = outcomeReportRows(scenario, sols.a, sols.b).considerations;
    if (considerations.length) {
      r++;
      ["Other considerations (not in totals)", names.a, names.b].forEach((h, i) => sh.set(cellAt(i, r), h, i ? "headerRight" : "header"));
      r++;
      for (const [label, ca, cb] of considerations) {
        sh.set(cellAt(0, r), label);
        sh.set(cellAt(1, r), ca, "fixedNum");
        sh.set(cellAt(2, r), cb, "fixedNum");
        r++;
      }
    }
  }

  return { scen, sol, misc, impact };
}

// ---------------------------------------------------------------------------
// Model sheets: model.ts's DERIVED, LINES, RESIDUAL_LINES, RESIDUAL, and
// FLEET_SHEET, one row each, with each entry's `formula` as its cells. The
// math lives there, next to the app's own; this only decides where it goes.

type Row =
  | { kind: "blank" }
  | { kind: "section"; label: string }
  | { kind: "years" }
  | { kind: "derived"; def: DerivedDef }
  | { kind: "line"; def: LineDef }
  | { kind: "tally"; key: "yearTotal" | "cumulative"; label: string }
  // An install batch of cameras; k = 0 is the fleet in place at year 0.
  | { kind: "batch"; key: string; label: string; k: number };

const LABEL_COL = 0, VALUE_COL = 1, NOTE_COL = 2, YEAR0_COL = 3;
const TITLE_ROWS = 3;

function buildModelSheet(
  wb: Workbook, side: Side, scenario: ScenarioInputs, sol: SolutionInputs, refs: InputRefs, color: string,
): ModelSheetLayout<Category> {
  const sheetName = MODEL_SHEET[side];
  const sh = wb.add(sheetName);
  const H = scenario.horizonYears;

  const rows: Row[] = [];
  const addLines = (entries: LineEntry[]) => {
    for (const e of linesFor(entries, sol.model)) rows.push("key" in e ? { kind: "line", def: e } : { kind: "section", label: e.section });
  };
  rows.push({ kind: "section", label: "Derived quantities" });
  for (const def of derivedFor(sol.model)) rows.push({ kind: "derived", def });
  rows.push({ kind: "blank" }, { kind: "years" });
  addLines(LINES);
  rows.push({ kind: "tally", key: "yearTotal", label: "Total for the year" }, { kind: "tally", key: "cumulative", label: "Running total" });
  addLines(RESIDUAL_LINES);
  rows.push({ kind: "derived", def: RESIDUAL }, { kind: "blank" });
  rows.push({ kind: "section", label: "Camera failures by install batch (column B: batch size; column C: year installed)" });
  rows.push({ kind: "batch", key: "batch0", label: "Cameras in place at year 0", k: 0 });
  // A batch installed in the final year never fails within the horizon.
  for (let k = 1; k < H; k++) rows.push({ kind: "batch", key: `batch${k}`, label: `Replacements installed in year ${k}`, k });

  // Lay out first, so a formula can refer to a row further down.
  const row: Record<string, number> = {};
  rows.forEach((d, i) => {
    const r = TITLE_ROWS + i;
    if (d.kind === "derived" || d.kind === "line") row[d.def.key] = r;
    else if (d.kind === "tally" || d.kind === "batch") row[d.key] = r;
    else if (d.kind === "years") row.__years = r;
  });
  const rowOf = (key: string) => {
    if (row[key] === undefined) throw new Error(`${sheetName}: a formula refers to "${key}", which isn't on this sheet`);
    return row[key] + 1;
  };
  const colOf = (y: number) => colName(YEAR0_COL + y);
  const at = (key: string, y: number) => `${colOf(y)}${rowOf(key)}`;
  const lastBatch = H > 1 ? `batch${H - 1}` : null;
  const r: ModelRefs = {
    model: sol.model,
    H,
    S: refs.scen as ModelRefs["S"],
    P: refs.sol[side] as ModelRefs["P"],
    O: refs.sol[side === "a" ? "b" : "a"] as ModelRefs["O"],
    me: side === "a" ? "A" : "B",
    them: side === "a" ? "B" : "A",
    d: (key) => `$B$${rowOf(key)}`,
    at,
    span: (key) => `${at(key, 0)}:${at(key, H)}`,
    year: (y) => `${colOf(y)}$${rowOf("__years")}`,
    misc: refs.misc[side],
    impact: refs.impact[side],
    fleet: {
      start: (y) => at("batch0", y),
      batches: (y) => (lastBatch ? `${at("batch1", y)}:${at(lastBatch, y)}` : null),
      installed: lastBatch ? `$C$${rowOf("batch1")}:$C$${rowOf(lastBatch)}` : null,
    },
  };
  const content = (f: number | string): Content => (typeof f === "number" ? f : { f });

  // The categories sit together, in CATEGORIES order, so a year's total is one range.
  const firstCat = rowOf(CATEGORIES[0]), lastCat = rowOf(CATEGORIES[CATEGORIES.length - 1]);
  CATEGORIES.forEach((c, i) => {
    if (rowOf(c) !== firstCat + i) throw new Error(`model.ts LINES must list the categories together, in CATEGORIES order (${c})`);
  });

  sh.set("A1", `${sol.name}: cost model`, "title");
  sh.set("A2", `${sol.model === "cloud" ? "Cloud / hybrid" : "On-prem"} · every value is a formula over the Inputs sheet · year columns start at ${colOf(0)}`, "subtitle");
  sh.width(LABEL_COL, 52);
  sh.width(VALUE_COL, 16);
  sh.width(NOTE_COL, 12);
  for (let y = 0; y <= H; y++) sh.width(YEAR0_COL + y, 13);
  // Column C is too narrow beside the year columns, so a yearly line's note goes after the last year.
  const lineNote = (rr: number, note?: string) => note && sh.set(cellAt(YEAR0_COL + H + 1, rr), note, "note");

  rows.forEach((d, i) => {
    const rr = TITLE_ROWS + i;
    const R = rr + 1;
    switch (d.kind) {
      case "blank": return;
      case "section": sh.set(cellAt(LABEL_COL, rr), d.label, "section"); return;
      case "years":
        sh.set(cellAt(LABEL_COL, rr), "Year", "header");
        sh.set(cellAt(VALUE_COL, rr), "Horizon total", "headerRight");
        sh.set(cellAt(NOTE_COL, rr), "", "header");
        for (let y = 0; y <= H; y++) sh.set(cellAt(YEAR0_COL + y, rr), y, "headerRight");
        sh.freeze = { cols: YEAR0_COL, rows: rr + 1 };
        return;
      case "derived":
        sh.set(cellAt(LABEL_COL, rr), d.def.label);
        sh.set(cellAt(VALUE_COL, rr), content(d.def.formula(r)), d.def.format);
        if (d.def.note) sh.set(cellAt(NOTE_COL, rr), d.def.note, "note");
        return;
      case "line":
        sh.set(cellAt(LABEL_COL, rr), d.def.label);
        if (d.def.total) sh.set(cellAt(VALUE_COL, rr), { f: `SUM(${colOf(0)}${R}:${colOf(H)}${R})` }, d.def.format);
        for (let y = 0; y <= H; y++) sh.set(cellAt(YEAR0_COL + y, rr), content(d.def.formula(r, y)), d.def.format);
        lineNote(rr, d.def.note);
        return;
      case "tally":
        sh.set(cellAt(LABEL_COL, rr), d.label, d.key === "yearTotal" ? "bold" : "text");
        if (d.key === "yearTotal") sh.set(cellAt(VALUE_COL, rr), { f: `SUM(${colOf(0)}${R}:${colOf(H)}${R})` }, "usdBold");
        for (let y = 0; y <= H; y++) {
          const c = colOf(y);
          const f = d.key === "yearTotal" ? `SUM(${c}${firstCat}:${c}${lastCat})` : y === 0 ? at("yearTotal", 0) : `${at("cumulative", y - 1)}+${at("yearTotal", y)}`;
          sh.set(cellAt(YEAR0_COL + y, rr), { f }, d.key === "yearTotal" ? "usdBold" : "usd");
        }
        return;
      case "batch": {
        const size = `$B$${R}`, installed = `$C$${R}`;
        sh.set(cellAt(LABEL_COL, rr), d.label);
        sh.set(cellAt(VALUE_COL, rr), d.k === 0 ? { f: r.S.cameras } : { f: at("failed", d.k) }, "num");
        sh.set(cellAt(NOTE_COL, rr), d.k === 0 ? { f: r.d("startInstalled") } : d.k, "int");
        for (let y = 0; y <= H; y++) {
          const f = d.k === 0 ? FLEET_SHEET.start(r, size, y) : FLEET_SHEET.batch(r, size, installed, d.k, y);
          sh.set(cellAt(YEAR0_COL + y, rr), content(f), "num");
        }
        return;
      }
    }
  });

  return {
    name: sol.name,
    color,
    sheet: sheetName,
    categoryRows: Object.fromEntries(CATEGORIES.map((c) => [c, row[c]])) as Record<Category, number>,
    yearTotalRow: row.yearTotal,
    cumulativeRow: row.cumulative,
    totalCol: VALUE_COL,
    yearCol0: YEAR0_COL,
  };
}

// ---------------------------------------------------------------------------

const GUIDE = [
  "Summary: totals over the horizon, the breakdown by category, and charts. Year by year: each solution's cost per year and running total.",
  "Inputs: every assumption behind the comparison. Blue cells are yours to change (dropdowns where there's a fixed set of choices), and every other sheet recalculates, charts included. Source columns say where each pre-filled number came from.",
  "Model A and Model B: each solution's cost model, one column per year. Derived quantities sit at the top (unit counts, storage sizing, discounted prices, refresh timing), then the escalation factors, what's bought each year, every cost category, the residual-value credit, and the camera fleet's failures by install batch.",
  "Fixed by the export: the horizon (the number of year columns), each solution's deployment model, and which business impact categories are on. Each solution has five blank misc rows for new items. To change any of these, change them in the calculator and export again.",
  "Black numbers are formulas and gray ones are fixed; overwriting a formula breaks the link to the inputs for that cell.",
];

// The comparison as a workbook, ready to write. The charts use each side's
// color from the results page; `shareUrl`, if given, goes on the Notes sheet.
export function buildWorkbook(state: SharedState, shareUrl?: string): Workbook {
  const scenario = sanitizeScenario(state.scenario);
  const raw = { a: state.solA, b: state.solB };
  const sols = { a: sanitizeSolution(state.solA), b: sanitizeSolution(state.solB) };
  const wb = new Workbook();
  const refs = buildInputs(wb, scenario, sols, raw);
  const a = buildModelSheet(wb, "a", scenario, sols.a, refs, state.colorA);
  const b = buildModelSheet(wb, "b", scenario, sols.b, refs, state.colorB);
  const inc = scenario.incumbent === "a" ? sols.a.name : scenario.incumbent === "b" ? sols.b.name : null;
  addComparisonSheets(wb, {
    title: "Video surveillance TCO comparison",
    subtitle: `${scenario.cameras} cameras · ${scenario.sites} sites · ${scenario.horizonYears}-year horizon` + (inc ? ` · ${inc} is incumbent` : ""),
    horizonYears: scenario.horizonYears,
    horizonRef: refs.scen.horizonYears,
    categories: CATEGORIES,
    staffTimeCategories: STAFF_TIME_CATEGORIES,
    outcomeCategories: OUTCOME_CATEGORIES,
    perUnit: { label: "Per camera per month", countRef: refs.scen.cameras },
    a, b,
    guide: GUIDE,
    notes: METHODOLOGY_NOTES,
    shareUrl,
  });
  return wb;
}

export function buildSpreadsheet(state: SharedState, shareUrl?: string, created?: Date): Uint8Array {
  return writeXlsx(buildWorkbook(state, shareUrl), { title: `${state.solA.name} vs. ${state.solB.name} TCO`, created });
}
