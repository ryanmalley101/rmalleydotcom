"use client";

import { useMemo } from "react";
import { Box, Group, List, Paper, Stack, Text } from "@mantine/core";
import type { ComparisonResult, ScenarioInputs, SolutionInputs } from "../lib/model";
import { findFlipPoints, type FlipPoint } from "../lib/sensitivity";
import { TEXT_MUTED, fmtUsd } from "../lib/colors";
import InfoLabel from "./InfoLabel";

const DRIVERS_HELP =
  "Each line is one cost category's difference between the two solutions over the whole horizon, largest first, labeled with the solution it favors.";
const FLIPS_HELP =
  "For the inputs that most often decide a comparison, the value at which the other solution would become cheaper, changing only that input. Closest first. Inputs that can't flip the result on their own within a plausible range aren't listed.";

function fmtValue(unit: FlipPoint["unit"], n: number): string {
  switch (unit) {
    case "usd": return fmtUsd(n);
    case "hours": return `${n.toFixed(2)} hrs`;
    case "pct": return `${n.toFixed(1)}%`;
    case "years": return `${n.toFixed(1)} yrs`;
    default: return n.toFixed(1);
  }
}

export default function GapDrivers({ comparison, scenario, solA, solB, colorA, colorB }: {
  comparison: ComparisonResult; scenario: ScenarioInputs; solA: SolutionInputs; solB: SolutionInputs; colorA: string; colorB: string;
}) {
  const { a, b, activeCategories } = comparison;
  // Positive: favors B (A costs more in that category). Negative: favors A.
  const drivers = activeCategories
    .map((c) => ({ category: c, diff: a.totalsByCategory[c] - b.totalsByCategory[c] }))
    .filter((d) => Math.abs(d.diff) >= 1)
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
  const max = Math.max(1, ...drivers.map((d) => Math.abs(d.diff)));
  const flips = useMemo(() => findFlipPoints(scenario, solA, solB), [scenario, solA, solB]);
  const cheaperName = a.total <= b.total ? solA.name : solB.name;
  const otherName = a.total <= b.total ? solB.name : solA.name;

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Stack gap={6}>
          <InfoLabel label="What drives the difference" help={DRIVERS_HELP} fw={600} />
          {drivers.map((d) => {
            const favorsB = d.diff > 0;
            return (
              <Box key={d.category}>
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text size="xs">{d.category}</Text>
                  <Text size="xs" c={TEXT_MUTED} ta="right">
                    {fmtUsd(Math.abs(d.diff))} in favor of {favorsB ? solB.name : solA.name}
                  </Text>
                </Group>
                <Box style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <Box style={{ height: "100%", width: `${(Math.abs(d.diff) / max) * 100}%`, borderRadius: 3, background: favorsB ? colorB : colorA }} />
                </Box>
              </Box>
            );
          })}
        </Stack>
        <Stack gap={6}>
          <InfoLabel label="What would change the winner" help={FLIPS_HELP} fw={600} />
          {flips.length === 0 ? (
            <Text size="xs" c={TEXT_MUTED}>
              No single input on its own makes {otherName} cheaper within a plausible range. The gap comes from several lines together.
            </Text>
          ) : (
            <List size="xs" spacing={4}>
              {flips.map((f) => (
                <List.Item key={`${f.owner}-${f.label}`}>
                  {f.owner ? `${f.owner === "a" ? solA.name : solB.name}'s ${f.label}` : f.label.charAt(0).toUpperCase() + f.label.slice(1)}
                  {" "}at {fmtValue(f.unit, f.flipAt)} instead of {fmtValue(f.unit, f.current)} would make{" "}
                  {otherName} cheaper than {cheaperName}.
                </List.Item>
              ))}
            </List>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
