// Builds the downloadable/printable versions of a comparison: a CSV and a
// standalone HTML report. Both include every input with its source status,
// the year-by-year costs, and the totals, so a shared copy can be audited
// without the app. Pure functions; the browser side just saves or prints.
import { CATEGORIES, type ComparisonResult, type SolutionInputs, type SolutionResult } from "./model";
import type { SharedState } from "./shareState";
import { SCENARIO_FIELDS, fieldsFor } from "./fields";
import { fieldSourceInfo, vendorEntriesFor } from "./vendorDefaults";

export function sourceStatus(sol: SolutionInputs, key: keyof SolutionInputs): string {
  const meta = fieldSourceInfo(key, sol[key], ...vendorEntriesFor(sol));
  if (!meta) return "";
  return `${meta.status} (${meta.confidence} confidence)${meta.sources[0] ? " " + meta.sources[0] : ""}`;
}

// Scenario values as a reader should see them: the incumbent by name.
function scenarioValue(state: SharedState, key: keyof SharedState["scenario"]): unknown {
  const v = state.scenario[key];
  if (key === "incumbent") return v === "a" ? state.solA.name : v === "b" ? state.solB.name : "Neither";
  return v;
}

const yearTotal = (r: SolutionResult, y: number) => Object.values(r.byYear[y] ?? {}).reduce((a, b) => a + b, 0);

export function upfrontAndOngoing(r: SolutionResult): { upfront: number; ongoing: number } {
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

export function buildCsv(state: SharedState, c: ComparisonResult): string {
  const { solA, solB } = state;
  const rows: unknown[][] = [];
  rows.push(["Video surveillance TCO comparison", `${solA.name} vs. ${solB.name}`]);
  rows.push([]);
  rows.push(["Scenario", "Value"]);
  for (const f of SCENARIO_FIELDS) rows.push([f.label, scenarioValue(state, f.key)]);
  rows.push([]);
  rows.push(["Input", solA.name, "Source", solB.name, "Source"]);
  const keys = Array.from(new Set([...fieldsFor(solA.model), ...fieldsFor(solB.model)].map((f) => f.key)));
  const labelFor = new Map([...fieldsFor(solA.model), ...fieldsFor(solB.model)].map((f) => [f.key, f.label]));
  const applies = (sol: SolutionInputs, key: keyof SolutionInputs) => fieldsFor(sol.model).some((f) => f.key === key);
  for (const key of keys) {
    rows.push([
      labelFor.get(key),
      applies(solA, key) ? solA[key] : "n/a", applies(solA, key) ? sourceStatus(solA, key) : "",
      applies(solB, key) ? solB[key] : "n/a", applies(solB, key) ? sourceStatus(solB, key) : "",
    ]);
  }
  rows.push(["Misc items", solA.miscItems, "", solB.miscItems, ""]);
  rows.push([]);
  rows.push(["Year", ...CATEGORIES.map((cat) => `${solA.name}: ${cat}`), `${solA.name}: year total`, `${solA.name}: cumulative`,
    ...CATEGORIES.map((cat) => `${solB.name}: ${cat}`), `${solB.name}: year total`, `${solB.name}: cumulative`]);
  c.labels.forEach((label, y) => {
    rows.push([label,
      ...CATEGORIES.map((cat) => c.a.byYear[y][cat]), yearTotal(c.a, y), c.a.cumulative[y],
      ...CATEGORIES.map((cat) => c.b.byYear[y][cat]), yearTotal(c.b, y), c.b.cumulative[y]]);
  });
  rows.push([]);
  rows.push(["Totals", solA.name, solB.name]);
  const sa = upfrontAndOngoing(c.a), sb = upfrontAndOngoing(c.b);
  rows.push(["Year 0 (buildout)", sa.upfront, sb.upfront]);
  rows.push(["Years 1+ (ongoing)", sa.ongoing, sb.ongoing]);
  rows.push(["Cash costs", c.a.cashTotal, c.b.cashTotal]);
  rows.push(["Estimated staff time", c.a.staffTimeTotal, c.b.staffTimeTotal]);
  rows.push(["Total", c.a.total, c.b.total]);
  return rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

const esc = (s: unknown) => display(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const usd = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");

export function buildReportHtml(state: SharedState, c: ComparisonResult, notes: string[]): string {
  const { scenario, solA, solB } = state;
  const sa = upfrontAndOngoing(c.a), sb = upfrontAndOngoing(c.b);
  const applies = (sol: SolutionInputs, key: keyof SolutionInputs) => fieldsFor(sol.model).some((f) => f.key === key);
  const keys = Array.from(new Set([...fieldsFor(solA.model), ...fieldsFor(solB.model)].map((f) => f.key)));
  const labelFor = new Map([...fieldsFor(solA.model), ...fieldsFor(solB.model)].map((f) => [f.key, f.label]));
  const cell = (sol: SolutionInputs, key: keyof SolutionInputs) =>
    applies(sol, key) ? `${esc(sol[key])}${sourceStatus(sol, key) ? `<div class="src">${esc(sourceStatus(sol, key))}</div>` : ""}` : "n/a";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(solA.name)} vs. ${esc(solB.name)} TCO</title>
<style>
body{font:13px/1.45 system-ui,sans-serif;color:#111;margin:32px;max-width:1000px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px}
table{border-collapse:collapse;width:100%;margin-bottom:8px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}.src{color:#666;font-size:11px;word-break:break-all}
.muted{color:#555}ul{padding-left:18px}@media print{body{margin:0}}
</style></head><body>
<h1>${esc(solA.name)} vs. ${esc(solB.name)}</h1>
<div class="muted">${scenario.cameras} cameras · ${scenario.sites} sites · ${scenario.horizonYears}-year horizon</div>
<h2>Totals</h2>
<table><tr><th></th><th class="n">${esc(solA.name)}</th><th class="n">${esc(solB.name)}</th></tr>
<tr><td>Year 0 (buildout)</td><td class="n">${usd(sa.upfront)}</td><td class="n">${usd(sb.upfront)}</td></tr>
<tr><td>Years 1+ (ongoing)</td><td class="n">${usd(sa.ongoing)}</td><td class="n">${usd(sb.ongoing)}</td></tr>
<tr><td>Cash costs</td><td class="n">${usd(c.a.cashTotal)}</td><td class="n">${usd(c.b.cashTotal)}</td></tr>
<tr><td>Estimated staff time</td><td class="n">${usd(c.a.staffTimeTotal)}</td><td class="n">${usd(c.b.staffTimeTotal)}</td></tr>
<tr><th>Total</th><th class="n">${usd(c.a.total)}</th><th class="n">${usd(c.b.total)}</th></tr></table>
<h2>By category</h2>
<table><tr><th>Category</th><th class="n">${esc(solA.name)}</th><th class="n">${esc(solB.name)}</th></tr>
${c.activeCategories.map((cat) => `<tr><td>${cat}</td><td class="n">${usd(c.a.totalsByCategory[cat])}</td><td class="n">${usd(c.b.totalsByCategory[cat])}</td></tr>`).join("")}</table>
<h2>Year by year</h2>
<table><tr><th>Year</th><th class="n">${esc(solA.name)}</th><th class="n">Cumulative</th><th class="n">${esc(solB.name)}</th><th class="n">Cumulative</th></tr>
${c.labels.map((l, y) => `<tr><td>${l}</td><td class="n">${usd(yearTotal(c.a, y))}</td><td class="n">${usd(c.a.cumulative[y])}</td><td class="n">${usd(yearTotal(c.b, y))}</td><td class="n">${usd(c.b.cumulative[y])}</td></tr>`).join("")}</table>
<h2>Scenario inputs</h2>
<table>${SCENARIO_FIELDS.map((f) => `<tr><td>${f.label}</td><td>${esc(scenarioValue(state, f.key))}</td></tr>`).join("")}</table>
<h2>Solution inputs</h2>
<table><tr><th>Input</th><th>${esc(solA.name)}</th><th>${esc(solB.name)}</th></tr>
${keys.map((k) => `<tr><td>${labelFor.get(k)}</td><td>${cell(solA, k)}</td><td>${cell(solB, k)}</td></tr>`).join("")}
<tr><td>Misc items</td><td>${esc(solA.miscItems)}</td><td>${esc(solB.miscItems)}</td></tr></table>
<h2>How this is calculated</h2>
<ul>${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
</body></html>`;
}
