// The parts of a spreadsheet export that don't depend on what's being bought:
// a Summary sheet (totals, the category breakdown, and charts), a Year by
// year sheet (yearly and running totals, and where they cross), and a Notes
// sheet. Each calculator builds its own Inputs sheet and one cost-model sheet
// per solution with every cost line as a live formula, then hands this the
// positions of those lines. Everything here is a formula over them, so
// editing an input recalculates the whole workbook, charts included.
import { cellAt, lit, xrange, xref, type Workbook } from "./xlsx/workbook";

// Where one solution's yearly cost lines sit on its model sheet: one row per
// category, then the yearly total and the running total; one column per
// year from yearCol0, with each row's horizon total in totalCol.
export interface ModelSheetLayout<C extends string> {
  name: string;
  color: string;
  sheet: string;
  categoryRows: Record<C, number>;
  yearTotalRow: number;
  cumulativeRow: number;
  totalCol: number;
  yearCol0: number;
}

export interface ComparisonSheetsSpec<C extends string> {
  // e.g. "Video surveillance TCO comparison"
  title: string;
  subtitle: string;
  horizonYears: number;
  // Input cell holding the horizon, for the per-unit cost.
  horizonRef: string;
  categories: readonly C[];
  staffTimeCategories: readonly C[];
  outcomeCategories: readonly C[];
  // A per-unit, per-month line under the totals, e.g. cost per camera per month.
  perUnit?: { label: string; countRef: string };
  a: ModelSheetLayout<C>;
  b: ModelSheetLayout<C>;
  // How to read and edit this workbook, one paragraph each.
  guide: string[];
  // The calculator's methodology notes.
  notes: string[];
  // A link that reopens this comparison in the calculator.
  shareUrl?: string;
}

export const SUMMARY_SHEET = "Summary";
export const YEARS_SHEET = "Year by year";
export const NOTES_SHEET = "Notes";

// Adds the Summary, Year by year, and Notes sheets and moves the first two to
// the front. Call after the model sheets exist.
export function addComparisonSheets<C extends string>(wb: Workbook, spec: ComparisonSheetsSpec<C>): void {
  const { a, b } = spec;
  const H = spec.horizonYears;
  const sideCell = (side: ModelSheetLayout<C>, col: number, row: number) => xref(side.sheet, cellAt(col, row));
  const categoryTotal = (side: ModelSheetLayout<C>, c: C) => sideCell(side, side.totalCol, side.categoryRows[c]);

  // ---- Year by year -------------------------------------------------------
  const years = wb.add(YEARS_SHEET);
  years.set("A1", "Year by year", "title");
  years.set("A2", "Each solution's cost per year and running total, from the model sheets. The last columns track which side is ahead, to find where the running totals cross.", "note");
  const headRow = 3;
  const heads = ["Year", "Year #", `${a.name}: year`, `${a.name}: running total`, `${b.name}: year`, `${b.name}: running total`,
    "Running gap (A − B)", "Sign of gap", "Higher so far (sign)", "Lines cross (1 = yes)"];
  heads.forEach((h, i) => years.set(cellAt(i, headRow), h, i === 0 ? "header" : "headerRight"));
  [10, 8, 20, 20, 20, 20, 20, 12, 18, 18].forEach((w, i) => years.width(i, w));
  years.freeze = { cols: 1, rows: headRow + 1 };
  const first = headRow + 1;
  const last = first + H;
  for (let y = 0; y <= H; y++) {
    const r = first + y;
    const R = r + 1;
    years.set(cellAt(0, r), `Yr ${y}`, "bold");
    years.set(cellAt(1, r), y, "int");
    years.set(cellAt(2, r), { f: sideCell(a, a.yearCol0 + y, a.yearTotalRow) }, "usd");
    years.set(cellAt(3, r), { f: sideCell(a, a.yearCol0 + y, a.cumulativeRow) }, "usd");
    years.set(cellAt(4, r), { f: sideCell(b, b.yearCol0 + y, b.yearTotalRow) }, "usd");
    years.set(cellAt(5, r), { f: sideCell(b, b.yearCol0 + y, b.cumulativeRow) }, "usd");
    years.set(cellAt(6, r), { f: `D${R}-F${R}` }, "usd");
    // Rounded to the cent so floating-point noise in an exact tie isn't a sign.
    years.set(cellAt(7, r), { f: `SIGN(ROUND(G${R},2))` }, "flag");
    years.set(cellAt(8, r), { f: y === 0 ? `H${R}` : `IF(H${R}=0,I${R - 1},H${R})` }, "flag");
    years.set(cellAt(9, r), { f: y === 0 ? "0" : `IF(AND(I${R - 1}<>0,H${R}<>0,H${R}<>I${R - 1}),1,0)` }, "flag");
  }
  const yearsRange = (col: number) => xrange(YEARS_SHEET, cellAt(col, first), cellAt(col, last));

  // ---- Summary ------------------------------------------------------------
  const sum = wb.add(SUMMARY_SHEET);
  sum.showGridLines = false;
  [40, 20, 20, 20, 3].forEach((w, i) => sum.width(i, w));
  sum.set("A1", `${a.name} vs. ${b.name}`, "title");
  sum.set("A2", `${spec.title} · ${spec.subtitle}`, "subtitle");
  sum.set("A3", "Every figure here is a formula: edit the blue cells on the Inputs sheet and the workbook recalculates.", "note");

  const t0 = 4;
  ["Totals over the horizon", a.name, b.name, "Difference (B − A)"].forEach((h, i) => sum.set(cellAt(i, t0), h, i ? "headerRight" : "header"));
  const T = (row: number, col: number) => cellAt(col, t0 + row);
  const sumOf = (side: ModelSheetLayout<C>, cats: readonly C[]) => (cats.length ? cats.map((c) => categoryTotal(side, c)).join("+") : "0");
  const rows: [string, (side: ModelSheetLayout<C>, col: number) => string, "usd" | "usdBold" | "usdCents"][] = [
    ["Year 0 (buildout)", (s) => sideCell(s, s.yearCol0, s.yearTotalRow), "usd"],
    ["Years 1+ (ongoing)", (_, col) => `${T(6, col)}-${T(1, col)}`, "usd"],
    ["Cash costs", (_, col) => `${T(6, col)}-${T(4, col)}-${T(5, col)}`, "usd"],
    ["Estimated staff time", (s) => sumOf(s, spec.staffTimeCategories), "usd"],
    ["Estimated business impact", (s) => sumOf(s, spec.outcomeCategories), "usd"],
    ["Total cost of ownership", (s) => sideCell(s, s.totalCol, s.yearTotalRow), "usdBold"],
  ];
  if (spec.perUnit) {
    const unit = spec.perUnit;
    rows.push([unit.label, (_, col) => `${T(6, col)}/(MAX(1,${unit.countRef})*MAX(1,${spec.horizonRef})*12)`, "usdCents"]);
  }
  rows.forEach(([label, formula, style], i) => {
    const row = i + 1;
    sum.set(T(row, 0), label, style === "usdBold" ? "bold" : "text");
    sum.set(T(row, 1), { f: formula(a, 1) }, style);
    sum.set(T(row, 2), { f: formula(b, 2) }, style);
    sum.set(T(row, 3), { f: `${T(row, 2)}-${T(row, 1)}` }, style);
  });
  const totalA = T(6, 1), totalB = T(6, 2);
  let r = t0 + rows.length + 2;
  sum.set(cellAt(0, r), "Lower total", "bold");
  sum.set(cellAt(1, r), { f: `IF(ROUND(${totalA}-${totalB},0)=0,"Tie",IF(${totalA}<${totalB},${lit(a.name)},${lit(b.name)}))` }, "bold");
  r++;
  sum.set(cellAt(0, r), "Running totals first cross", "bold");
  sum.set(cellAt(1, r), { f: `IFERROR(INDEX(${yearsRange(0)},MATCH(1,${yearsRange(9)},0)),"Never")` }, "bold");
  r++;
  sum.set(cellAt(0, r), "Times the running totals cross", "bold");
  sum.set(cellAt(1, r), { f: `SUM(${yearsRange(9)})` }, "int");

  r += 2;
  const c0 = r;
  ["By category", a.name, b.name, "Difference (B − A)"].forEach((h, i) => sum.set(cellAt(i, c0), h, i ? "headerRight" : "header"));
  spec.categories.forEach((c, i) => {
    const row = c0 + 1 + i;
    sum.set(cellAt(0, row), c);
    sum.set(cellAt(1, row), { f: categoryTotal(a, c) }, "usd");
    sum.set(cellAt(2, row), { f: categoryTotal(b, c) }, "usd");
    sum.set(cellAt(3, row), { f: `${cellAt(2, row)}-${cellAt(1, row)}` }, "usd");
  });
  const cLast = c0 + spec.categories.length;
  sum.set(cellAt(0, cLast + 1), "Total", "bold");
  for (const col of [1, 2, 3]) sum.set(cellAt(col, cLast + 1), { f: `SUM(${cellAt(col, c0 + 1)}:${cellAt(col, cLast)})` }, "usdBold");

  // Charts sit to the right of the tables, below the title lines.
  const chartAt = (row: number, height: number) => ({ from: { col: 5, row }, to: { col: 14, row: row + height } });
  sum.charts.push({
    kind: "line", title: "Running total cost", categories: yearsRange(0),
    series: [{ name: a.name, values: yearsRange(3), color: a.color }, { name: b.name, values: yearsRange(5), color: b.color }],
    ...chartAt(4, 20),
  });
  sum.charts.push({
    kind: "column", title: "Cost per year", categories: yearsRange(0),
    series: [{ name: a.name, values: yearsRange(2), color: a.color }, { name: b.name, values: yearsRange(4), color: b.color }],
    ...chartAt(25, 20),
  });
  const catRange = (col: number) => xrange(SUMMARY_SHEET, cellAt(col, c0 + 1), cellAt(col, cLast));
  sum.charts.push({
    kind: "bar", title: "Total cost by category", categories: catRange(0),
    series: [{ name: a.name, values: catRange(1), color: a.color }, { name: b.name, values: catRange(2), color: b.color }],
    ...chartAt(46, 24),
  });

  // ---- Notes --------------------------------------------------------------
  const notes = wb.add(NOTES_SHEET);
  notes.width(0, 120);
  notes.set("A1", "About this workbook", "title");
  let n = 2;
  notes.set(cellAt(0, n++), "How to use it", "section");
  for (const line of spec.guide) notes.set(cellAt(0, n++), line, "wrap");
  if (spec.shareUrl) {
    notes.set(cellAt(0, n++), "Open this comparison in the calculator:", "wrap");
    notes.set(cellAt(0, n++), spec.shareUrl, "note");
  }
  n++;
  notes.set(cellAt(0, n++), "How the costs are calculated", "section");
  for (const line of spec.notes) notes.set(cellAt(0, n++), line, "wrap");

  wb.order([SUMMARY_SHEET, YEARS_SHEET]);
}
