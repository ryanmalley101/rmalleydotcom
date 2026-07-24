"use client";

import { useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";
import { Paper, Stack } from "@mantine/core";
import type { ComparisonResult } from "../lib/model";
import { TEXT_MUTED, fmtUsdK } from "../lib/colors";

Chart.defaults.color = TEXT_MUTED;

export default function ChartsPanel({
  comparison, nameA, nameB, colorA, colorB,
}: { comparison: ComparisonResult; nameA: string; nameB: string; colorA: string; colorB: string }) {
  const cumRef = useRef<HTMLCanvasElement>(null);
  const catRef = useRef<HTMLCanvasElement>(null);
  const cumChart = useRef<Chart | null>(null);
  const catChart = useRef<Chart | null>(null);

  useEffect(() => {
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
          plugins: { legend: { display: true, position: "top", labels: { boxWidth: 12, boxHeight: 12, color: TEXT_MUTED } } },
          scales: {
            y: { ticks: { callback: (v) => fmtUsdK(Number(v)), color: TEXT_MUTED }, grid: { color: "rgba(255,255,255,0.1)" } },
            x: { ticks: { color: TEXT_MUTED }, grid: { display: false } },
          },
        },
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
  }, [comparison, nameA, nameB, colorA, colorB]);

  useEffect(() => {
    if (!catRef.current) return;
    const catsA = comparison.activeCategories.map((c) => Math.round(comparison.a.totalsByCategory[c]));
    const catsB = comparison.activeCategories.map((c) => Math.round(comparison.b.totalsByCategory[c]));
    if (!catChart.current) {
      catChart.current = new Chart(catRef.current, {
        type: "bar",
        data: {
          labels: [...comparison.activeCategories],
          datasets: [
            { label: nameA, data: catsA, backgroundColor: colorA, maxBarThickness: 20, borderRadius: 4 },
            { label: nameB, data: catsB, backgroundColor: colorB, maxBarThickness: 20, borderRadius: 4 },
          ],
        },
        options: {
          indexAxis: "y", responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { callback: (v) => fmtUsdK(Number(v)), color: TEXT_MUTED }, grid: { color: "rgba(255,255,255,0.1)" } },
            y: { ticks: { color: TEXT_MUTED }, grid: { display: false } },
          },
        },
      });
    } else {
      const c = catChart.current;
      c.data.labels = [...comparison.activeCategories];
      c.data.datasets[0].data = catsA;
      c.data.datasets[0].label = nameA;
      c.data.datasets[0].backgroundColor = colorA;
      c.data.datasets[1].data = catsB;
      c.data.datasets[1].label = nameB;
      c.data.datasets[1].backgroundColor = colorB;
      c.update("none");
    }
  }, [comparison, nameA, nameB, colorA, colorB]);

  useEffect(() => () => {
    cumChart.current?.destroy();
    cumChart.current = null;
    catChart.current?.destroy();
    catChart.current = null;
  }, []);

  return (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md" h={320} pos="relative">
        <canvas ref={cumRef} role="img" aria-label="Cumulative discounted cost by year for both solutions" />
      </Paper>
      <Paper withBorder p="md" radius="md" h={Math.max(280, comparison.activeCategories.length * 46)} pos="relative">
        <canvas ref={catRef} role="img" aria-label="Discounted cost by category for both solutions" />
      </Paper>
    </Stack>
  );
}
