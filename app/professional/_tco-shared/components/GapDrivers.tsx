"use client";

import { Box, Group, Stack, Table, Text } from "@mantine/core";
import type { ComparisonTotals } from "../lib/engine";
import type { FlipPoint } from "../lib/sensitivity";
import { TEXT_MUTED, fmtUsd } from "../lib/colors";
import InfoLabel from "./InfoLabel";

const DRIVERS_HELP =
  "Each line is one cost category's difference between the two solutions over the whole horizon, largest first, in the color of the solution it favors.";
const FLIPS_HELP =
  "For the inputs that most often decide a comparison, the value at which the other solution would become cheaper, changing only that input. Closest first. Inputs that can't flip the result on their own within a plausible range aren't listed.";

function fmtValue(unit: FlipPoint["unit"], n: number): string {
  switch (unit) {
    case "usd": return fmtUsd(n);
    case "hours": return `${n.toFixed(2)} hrs`;
    case "pct": return `${n.toFixed(1)}%`;
    case "years": return `${n.toFixed(1)} yrs`;
    case "minutes": return `${n.toFixed(1)} min`;
    default: return n.toFixed(1);
  }
}

// What drives the gap between two solutions: each category's difference,
// in the color of the side it favors.
export function DriversList({ comparison, nameA, nameB, colorA, colorB }: {
  comparison: ComparisonTotals; nameA: string; nameB: string; colorA: string; colorB: string;
}) {
  const { a, b, activeCategories } = comparison;
  // Positive: favors B (A costs more in that category). Negative: favors A.
  const drivers = activeCategories
    .map((c) => ({ category: c, diff: a.totalsByCategory[c] - b.totalsByCategory[c] }))
    .filter((d) => Math.abs(d.diff) >= 1)
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
  const max = Math.max(1, ...drivers.map((d) => Math.abs(d.diff)));

  return (
    <Stack gap={8}>
      <InfoLabel label="What drives the difference" help={DRIVERS_HELP} fw={600} />
      {drivers.map((d) => {
        const favorsB = d.diff > 0;
        return (
          <Box key={d.category}>
            <Group justify="space-between" gap="xs" wrap="nowrap" mb={2}>
              <Text size="xs">{d.category}</Text>
              <Text size="xs" c={TEXT_MUTED} ta="right">
                <Text span ff="monospace" size="xs" c="var(--mantine-color-text)">{fmtUsd(Math.abs(d.diff))}</Text> favors {favorsB ? nameB : nameA}
              </Text>
            </Group>
            <Box style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <Box style={{ height: "100%", width: `${(Math.abs(d.diff) / max) * 100}%`, borderRadius: 3, background: favorsB ? colorB : colorA }} />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

// Which single inputs would flip the winner, and at what value, from the
// calculator's own sensitivity search.
export function TippingPoints({ comparison, flips, nameA, nameB }: {
  comparison: ComparisonTotals; flips: FlipPoint[]; nameA: string; nameB: string;
}) {
  const aCheaper = comparison.a.total <= comparison.b.total;
  const otherName = aCheaper ? nameB : nameA;
  const inputLabel = (f: FlipPoint) =>
    f.owner ? `${f.owner === "a" ? nameA : nameB}: ${f.label}` : f.label.charAt(0).toUpperCase() + f.label.slice(1);

  return (
    <Stack gap={6}>
      <InfoLabel label="What would change the winner" help={FLIPS_HELP} fw={600} />
      {flips.length === 0 ? (
        <Text size="xs" c={TEXT_MUTED}>
          No single input on its own makes {otherName} cheaper within a plausible range. The gap comes from several lines together.
        </Text>
      ) : (
        <>
          <Text size="xs" c={TEXT_MUTED}>Any one of these changes, on its own, would make {otherName} the cheaper option:</Text>
          <Table fz="xs" verticalSpacing={4} horizontalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Input</Table.Th>
                <Table.Th ta="right">Now</Table.Th>
                <Table.Th ta="right">Flips at</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {flips.map((f) => (
                <Table.Tr key={`${f.owner}-${f.label}`}>
                  <Table.Td>{inputLabel(f)}</Table.Td>
                  <Table.Td ta="right" ff="monospace" c={TEXT_MUTED} style={{ whiteSpace: "nowrap" }}>{fmtValue(f.unit, f.current)}</Table.Td>
                  <Table.Td ta="right" ff="monospace" fw={600} style={{ whiteSpace: "nowrap" }}>{fmtValue(f.unit, f.flipAt)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  );
}

// Both together, as the "What drives it" view and in the snapshot.
export default function GapDrivers(props: {
  comparison: ComparisonTotals; flips: FlipPoint[]; nameA: string; nameB: string; colorA: string; colorB: string;
}) {
  return (
    <Stack gap="lg">
      <DriversList {...props} />
      <TippingPoints {...props} />
    </Stack>
  );
}
