"use client";

import { useEffect, useRef } from "react";
import { Chart, type Plugin } from "chart.js/auto";
import { Box } from "@mantine/core";
import type { ComparisonTotals } from "../lib/engine";
import { TEXT_MUTED, fmtUsdK } from "../lib/colors";

Chart.defaults.color = TEXT_MUTED;

// Amber, deliberately distinct from either solution's line color (which the
// user can change) — a crossover is its own kind of event, not "belonging"
// to either solution's color.
const CROSSOVER_COLOR = "#f59e0b";

// Custom draw instead of a plugin dependency (chartjs-plugin-annotation etc.)
// for one vertical marker — reads from a ref so it always draws the current
// crossover years even though the chart instance itself is created once and
// mutated in place via update("none"), not recreated on every data change.
function makeCrossoverPlugin(yearsRef: { current: number[] }): Plugin<"line"> {
  return {
    id: "crossoverMarker",
    afterDatasetsDraw(chart) {
      const years = yearsRef.current;
      if (!years.length) return;
      const { ctx, chartArea, scales } = chart;
      const xScale = scales.x;
      if (!chartArea || !xScale) return;
      ctx.save();
      years.forEach((year) => {
        const x = xScale.getPixelForValue(year);
        if (x < chartArea.left || x > chartArea.right) return;

        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = CROSSOVER_COLOR;
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        const label = "Crossover";
        ctx.font = "600 10px system-ui, sans-serif";
        const textWidth = ctx.measureText(label).width;
        const padX = 5;
        const boxW = textWidth + padX * 2;
        const boxH = 15;
        let boxX = x - boxW / 2;
        boxX = Math.max(chartArea.left, Math.min(chartArea.right - boxW, boxX));
        const boxY = chartArea.top + 4;

        ctx.fillStyle = CROSSOVER_COLOR;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 3);
        ctx.fill();

        ctx.fillStyle = "#0f1117";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, boxX + boxW / 2, boxY + boxH / 2 + 1);
      });
      ctx.restore();
    },
  };
}

// Cumulative cost by year for both solutions, with the crossover marked.
// The per-category comparison that used to sit under it is the "What drives
// the difference" list now, which shows the same numbers as signed, sorted
// differences. `animate: false` for the snapshot, which is captured as soon
// as it's drawn.
export default function CumulativeChart({
  comparison, nameA, nameB, colorA, colorB, height = 300, animate = true,
}: { comparison: ComparisonTotals; nameA: string; nameB: string; colorA: string; colorB: string; height?: number; animate?: boolean }) {
  const cumRef = useRef<HTMLCanvasElement>(null);
  const cumChart = useRef<Chart | null>(null);
  const crossoverYearsRef = useRef<number[]>([]);

  useEffect(() => {
    crossoverYearsRef.current =
      comparison.crossoverYear === null ? [] : [comparison.crossoverYear, ...comparison.laterCrossoverYears];

    if (!cumRef.current) return;
    if (!cumChart.current) {
      cumChart.current = new Chart(cumRef.current, {
        type: "line",
        data: {
          labels: comparison.labels,
          datasets: [
            { label: nameA, data: comparison.a.cumulative, borderColor: colorA, backgroundColor: colorA + "1f", borderWidth: 2, pointRadius: 0, tension: 0.15 },
            { label: nameB, data: comparison.b.cumulative, borderColor: colorB, backgroundColor: colorB + "1f", borderWidth: 2, borderDash: [6, 4], pointRadius: 0, tension: 0.15 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: animate ? undefined : false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: true, position: "top", labels: { boxWidth: 12, boxHeight: 12, color: TEXT_MUTED } },
            tooltip: { callbacks: { label: (item) => `${item.dataset.label}: ${fmtUsdK(Number(item.raw))}` } },
          },
          scales: {
            y: { ticks: { callback: (v) => fmtUsdK(Number(v)), color: TEXT_MUTED }, grid: { color: "rgba(255,255,255,0.1)" } },
            x: { ticks: { color: TEXT_MUTED }, grid: { display: false } },
          },
        },
        plugins: [makeCrossoverPlugin(crossoverYearsRef)],
      });
    } else {
      const c = cumChart.current;
      c.data.labels = comparison.labels;
      c.data.datasets[0].data = comparison.a.cumulative;
      c.data.datasets[0].label = nameA;
      c.data.datasets[0].borderColor = colorA;
      c.data.datasets[0].backgroundColor = colorA + "1f";
      c.data.datasets[1].data = comparison.b.cumulative;
      c.data.datasets[1].label = nameB;
      c.data.datasets[1].borderColor = colorB;
      c.data.datasets[1].backgroundColor = colorB + "1f";
      c.update("none");
    }
  }, [comparison, nameA, nameB, colorA, colorB, animate]);

  useEffect(() => () => {
    cumChart.current?.destroy();
    cumChart.current = null;
  }, []);

  return (
    <Box h={height} pos="relative">
      <canvas ref={cumRef} role="img" aria-label="Cumulative cost by year for both solutions" />
    </Box>
  );
}
