import { test } from "node:test";
import assert from "node:assert/strict";
import { computeComparison } from "../model";
import { buildCsv, buildReportHtml, upfrontAndOngoing } from "../report";
import { METHODOLOGY_NOTES } from "../methodology";
import { seedOnprem, seedVerkada, scenario } from "./helpers";

const state = { shapeId: "onprem-cloud", scenario: scenario({ incumbent: "a" as const }), solA: seedOnprem("a"), solB: seedVerkada("b"), colorA: "#000000", colorB: "#ffffff" };
const c = computeComparison(state.scenario, state.solA, state.solB);

test("buildout plus ongoing equals the total", () => {
  const s = upfrontAndOngoing(c.b);
  assert.equal(Math.round(s.upfront + s.ongoing), Math.round(c.b.total));
  assert.equal(upfrontAndOngoing(c.a).upfront, 0, "the incumbent has no buildout");
});

test("the CSV carries inputs, sources, years, and totals", () => {
  const csv = buildCsv(state, c);
  assert.match(csv, /Camera count,100/);
  assert.match(csv, /sourced \(high confidence\)/);
  assert.match(csv, /Yr 10,/);
  assert.match(csv, new RegExp(`Total,${Math.round(c.a.total * 100) / 100},`));
  assert.match(csv, /"Milestone XProtect · Axis Communications cameras|Milestone XProtect · Axis Communications cameras/);
});

test("the printable report escapes user-entered names", () => {
  const html = buildReportHtml({ ...state, solB: { ...state.solB, name: "<script>x</script>" } }, c, METHODOLOGY_NOTES);
  assert.ok(!html.includes("<script>x</script>"));
  assert.match(html, /&lt;script&gt;/);
});
