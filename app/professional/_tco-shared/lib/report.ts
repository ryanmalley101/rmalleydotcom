// Builds the downloadable/printable versions of a comparison: a CSV and a
// standalone HTML report. Both include every input with its source status,
// the year-by-year costs, and the totals, so a shared copy can be audited
// without the app. Pure functions; the browser side just saves or prints.
// Each calculator turns its own inputs into a ReportSpec.
import type { ComparisonTotals, MiscCostItem, SolutionTotals } from "./engine";
import type { ImpactReportRows } from "./impact";

export interface ReportSpec<C extends string> {
  // First cell of the CSV, e.g. "Video surveillance TCO comparison".
  title: string;
  nameA: string;
  nameB: string;
  // One line under the printable report's heading, e.g. "100 cameras · 5 sites · 10-year horizon".
  subtitle: string;
  scenarioRows: [string, unknown][];
  // Each solution input with its value and source status per side; a field
  // that doesn't apply to a side carries "n/a" and no source.
  inputRows: { label: string; a: unknown; aSource: string; b: unknown; bSource: string }[];
  miscA: MiscCostItem[];
  miscB: MiscCostItem[];
  impact: ImpactReportRows;
  categories: readonly C[];
  notes: string[];
}

const yearTotal = (r: SolutionTotals, y: number) => (Object.values(r.byYear[y] ?? {}) as number[]).reduce((a, b) => a + b, 0);

export function upfrontAndOngoing(r: SolutionTotals): { upfront: number; ongoing: number } {
  const upfront = yearTotal(r, 0);
  return { upfront, ongoing: r.total - upfront };
}

function display(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => `${v.label || "item"}: ${v.amount} (${v.timing}${v.timing === "once" ? " yr " + v.year : ""})`).join("; ");
  if (typeof value === "boolean") return value ? "yes" : "no";
  return value === undefined || value === null ? "" : String(value);
}

const csvCell = (v: unknown) => {
  const s = typeof v === "number" ? String(Math.round(v * 100) / 100) : display(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildCsv<C extends string>(spec: ReportSpec<C>, c: ComparisonTotals<C>): string {
  const { nameA, nameB, categories, impact } = spec;
  const a = c.a as SolutionTotals<C>, b = c.b as SolutionTotals<C>;
  const rows: unknown[][] = [];
  rows.push([spec.title, `${nameA} vs. ${nameB}`]);
  rows.push([]);
  rows.push(["Scenario", "Value"]);
  for (const row of spec.scenarioRows) rows.push(row);
  rows.push([]);
  rows.push(["Input", nameA, "Source", nameB, "Source"]);
  for (const r of spec.inputRows) rows.push([r.label, r.a, r.aSource, r.b, r.bSource]);
  rows.push(["Misc items", spec.miscA, "", spec.miscB, ""]);
  rows.push([]);
  rows.push(["Business impact industry", impact.industry]);
  for (const [label, v] of impact.inputs) rows.push([label, v]);
  if (impact.changes.length) rows.push(["Business impact change", nameA, "", nameB, ""]);
  for (const [label, va, vb] of impact.changes) rows.push([label, va, "", vb, ""]);
  if (impact.considerations.length) rows.push(["Other considerations (not in totals)", nameA, "", nameB, ""]);
  for (const [label, va, vb] of impact.considerations) rows.push([label, va, "", vb, ""]);
  rows.push([]);
  rows.push(["Year", ...categories.map((cat) => `${nameA}: ${cat}`), `${nameA}: year total`, `${nameA}: cumulative`,
    ...categories.map((cat) => `${nameB}: ${cat}`), `${nameB}: year total`, `${nameB}: cumulative`]);
  c.labels.forEach((label, y) => {
    rows.push([label,
      ...categories.map((cat) => a.byYear[y][cat]), yearTotal(a, y), a.cumulative[y],
      ...categories.map((cat) => b.byYear[y][cat]), yearTotal(b, y), b.cumulative[y]]);
  });
  rows.push([]);
  rows.push(["Totals", nameA, nameB]);
  const sa = upfrontAndOngoing(a), sb = upfrontAndOngoing(b);
  rows.push(["Year 0 (buildout)", sa.upfront, sb.upfront]);
  rows.push(["Years 1+ (ongoing)", sa.ongoing, sb.ongoing]);
  rows.push(["Cash costs", a.cashTotal, b.cashTotal]);
  rows.push(["Estimated staff time", a.staffTimeTotal, b.staffTimeTotal]);
  rows.push(["Estimated business impact", a.outcomeTotal, b.outcomeTotal]);
  rows.push(["Total", a.total, b.total]);
  return rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

const esc = (s: unknown) => display(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const usd = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");

export function buildReportHtml<C extends string>(spec: ReportSpec<C>, c: ComparisonTotals<C>): string {
  const { nameA, nameB, impact } = spec;
  const a = c.a as SolutionTotals<C>, b = c.b as SolutionTotals<C>;
  const sa = upfrontAndOngoing(a), sb = upfrontAndOngoing(b);
  const cell = (value: unknown, source: string) => `${esc(value)}${source ? `<div class="src">${esc(source)}</div>` : ""}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(nameA)} vs. ${esc(nameB)} TCO</title>
<style>
body{font:13px/1.45 system-ui,sans-serif;color:#111;margin:32px;max-width:1000px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px}
table{border-collapse:collapse;width:100%;margin-bottom:8px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}.src{color:#666;font-size:11px;word-break:break-all}
.muted{color:#555}ul{padding-left:18px}@media print{body{margin:0}}
</style></head><body>
<h1>${esc(nameA)} vs. ${esc(nameB)}</h1>
<div class="muted">${esc(spec.subtitle)}</div>
<h2>Totals</h2>
<table><tr><th></th><th class="n">${esc(nameA)}</th><th class="n">${esc(nameB)}</th></tr>
<tr><td>Year 0 (buildout)</td><td class="n">${usd(sa.upfront)}</td><td class="n">${usd(sb.upfront)}</td></tr>
<tr><td>Years 1+ (ongoing)</td><td class="n">${usd(sa.ongoing)}</td><td class="n">${usd(sb.ongoing)}</td></tr>
<tr><td>Cash costs</td><td class="n">${usd(a.cashTotal)}</td><td class="n">${usd(b.cashTotal)}</td></tr>
<tr><td>Estimated staff time</td><td class="n">${usd(a.staffTimeTotal)}</td><td class="n">${usd(b.staffTimeTotal)}</td></tr>
<tr><td>Estimated business impact</td><td class="n">${usd(a.outcomeTotal)}</td><td class="n">${usd(b.outcomeTotal)}</td></tr>
<tr><th>Total</th><th class="n">${usd(a.total)}</th><th class="n">${usd(b.total)}</th></tr></table>
<h2>By category</h2>
<table><tr><th>Category</th><th class="n">${esc(nameA)}</th><th class="n">${esc(nameB)}</th></tr>
${c.activeCategories.map((cat) => `<tr><td>${cat}</td><td class="n">${usd(a.totalsByCategory[cat])}</td><td class="n">${usd(b.totalsByCategory[cat])}</td></tr>`).join("")}</table>
<h2>Year by year</h2>
<table><tr><th>Year</th><th class="n">${esc(nameA)}</th><th class="n">Cumulative</th><th class="n">${esc(nameB)}</th><th class="n">Cumulative</th></tr>
${c.labels.map((l, y) => `<tr><td>${l}</td><td class="n">${usd(yearTotal(a, y))}</td><td class="n">${usd(a.cumulative[y])}</td><td class="n">${usd(yearTotal(b, y))}</td><td class="n">${usd(b.cumulative[y])}</td></tr>`).join("")}</table>
<h2>Scenario inputs</h2>
<table>${spec.scenarioRows.map(([label, v]) => `<tr><td>${label}</td><td>${esc(v)}</td></tr>`).join("")}</table>
<h2>Solution inputs</h2>
<table><tr><th>Input</th><th>${esc(nameA)}</th><th>${esc(nameB)}</th></tr>
${spec.inputRows.map((r) => `<tr><td>${r.label}</td><td>${cell(r.a, r.aSource)}</td><td>${cell(r.b, r.bSource)}</td></tr>`).join("")}
<tr><td>Misc items</td><td>${esc(spec.miscA)}</td><td>${esc(spec.miscB)}</td></tr></table>
${impact.changes.length ? `<h2>Business impact: ${esc(impact.industry)}</h2>
<table>${impact.inputs.map(([l, v]) => `<tr><td>${esc(l)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
<table><tr><th>Change</th><th>${esc(nameA)}</th><th>${esc(nameB)}</th></tr>
${impact.changes.map(([l, va, vb]) => `<tr><td>${esc(l)}</td><td>${esc(va)}</td><td>${esc(vb)}</td></tr>`).join("")}</table>` : ""}
${impact.considerations.length ? `<h2>Other considerations (not in totals)</h2>
<table><tr><th>Consideration</th><th>${esc(nameA)}</th><th>${esc(nameB)}</th></tr>
${impact.considerations.map(([l, va, vb]) => `<tr><td>${esc(l)}</td><td>${esc(va)}</td><td>${esc(vb)}</td></tr>`).join("")}</table>` : ""}
<h2>How this is calculated</h2>
<ul>${spec.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
</body></html>`;
}
