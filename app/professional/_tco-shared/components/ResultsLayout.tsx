"use client";

import { useRef, useState } from "react";
import { Box, Button, Container, Group, Paper, Stack, Tabs, Text, Title } from "@mantine/core";
import { useIntersection, useMediaQuery } from "@mantine/hooks";
import { CalendarDays, Gauge, LineChart, Undo2 } from "lucide-react";
import type { ComparisonTotals } from "../lib/engine";
import type { FlipPoint } from "../lib/sensitivity";
import type { ChecklistItem, InputTab } from "../lib/checklist";
import { fieldDomId } from "../lib/checklist";
import { TEXT_MUTED, fmtUsd } from "../lib/colors";
import { exportSnapshot } from "../lib/exportSnapshot";
import CostSummary, { type SummarySide } from "./CostSummary";
import CumulativeChart from "./CumulativeChart";
import GapDrivers from "./GapDrivers";
import YearTable from "./YearTable";
import ShareChecklist from "./ShareChecklist";
import MethodologyNotes from "./MethodologyNotes";
import { PAGE_BG, STICKY_TOP, STRIP_HEIGHT } from "./layoutConstants";
import { CompareSideContext } from "./CompareGrid";

// The results page both calculators share. Top to bottom:
//
// - the verdict, full width: who costs less and by how much, and each side's
//   total split into cash, staff time, and business impact; plus the
//   pre-share checklist and what the last edit did, with Undo;
// - a slim strip pinned to the top of the window once the verdict scrolls
//   away, so the bottom line stays in view while editing far down the page;
// - beside each other on a wide screen: "Why" (cost over time, which opens
//   first; what drives the difference and what would change the winner;
//   year by year) as tabs, kept in view as the page scrolls; and the inputs
//   (scenario, costs side by side, business impact) as tabs, edited live.
//
// The "Why" views used to be stacked in one capped, separately scrolling
// column, where everything below the first chart was out of sight unless you
// thought to scroll inside it. Tabs keep each one fully visible.
//
// Each calculator supplies its own pieces (labels, inputs, checklist) and
// keeps its own ResultsView as a thin wrapper around this.

const WIDE = "(min-width: 75em)";

function fmtDelta(n: number) {
  if (Math.abs(n) < 0.5) return "no change";
  return `${n > 0 ? "+" : "−"}${fmtUsd(Math.abs(n))}`;
}

// What the most recent edit did to each total, with Undo.
function LastChange({ comparison, previous, nameA, nameB, onUndo, compact }: {
  comparison: ComparisonTotals; previous: ComparisonTotals | null; nameA: string; nameB: string; onUndo: () => void; compact?: boolean;
}) {
  if (!previous) return null;
  const dA = comparison.a.total - previous.a.total;
  const dB = comparison.b.total - previous.b.total;
  const undo = (
    <Button size="compact-xs" variant="subtle" leftSection={<Undo2 size={12} />} onClick={onUndo}>
      Undo
    </Button>
  );
  if (compact) {
    return (
      <Group gap={6} wrap="nowrap">
        <Text size="xs" c={TEXT_MUTED} visibleFrom="md">Last change: {nameA} {fmtDelta(dA)} · {nameB} {fmtDelta(dB)}</Text>
        {undo}
      </Group>
    );
  }
  return (
    <Group gap={6} wrap="wrap">
      <Text size="xs" c={TEXT_MUTED}>
        Last change: {nameA} <Text span size="xs" ff="monospace" c="var(--mantine-color-text)">{fmtDelta(dA)}</Text>
        {" · "}{nameB} <Text span size="xs" ff="monospace" c="var(--mantine-color-text)">{fmtDelta(dB)}</Text>
      </Text>
      {undo}
    </Group>
  );
}

// The verdict in one line, pinned once the full card is scrolled past.
function VerdictStrip({ sides, horizonYears, children }: { sides: [SummarySide, SummarySide]; horizonYears: number; children?: React.ReactNode }) {
  const [a, b] = sides;
  const cheaper = a.result.total <= b.result.total ? a : b;
  const diff = Math.abs(a.result.total - b.result.total);
  return (
    <Box
      style={{
        position: "fixed", top: 0, left: 0, right: 0, height: STRIP_HEIGHT, zIndex: 50,
        background: "rgba(15,17,23,0.94)", backdropFilter: "blur(6px)", borderBottom: "1px solid var(--mantine-color-dark-4)",
        display: "flex", alignItems: "center",
      }}
    >
      <Container size="xl" w="100%">
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Group gap="lg" wrap="nowrap" style={{ minWidth: 0 }}>
            <Text size="sm" fw={600} truncate="end">
              {diff < 0.5 ? `Both cost the same over ${horizonYears} yrs` : `${cheaper.name} costs ${fmtUsd(diff)} less over ${horizonYears} yrs`}
            </Text>
            <Group gap="md" wrap="nowrap" visibleFrom="sm">
              {sides.map((s) => (
                <Group key={s.id} gap={6} wrap="nowrap">
                  <Box style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                  <Text size="xs" c={TEXT_MUTED} truncate="end" maw={160}>{s.name}</Text>
                  <Text size="xs" ff="monospace">{fmtUsd(s.result.total)}</Text>
                </Group>
              ))}
            </Group>
          </Group>
          {children}
        </Group>
      </Container>
    </Box>
  );
}

export interface ResultsLayoutProps {
  // The title row; gets the snapshot export to wire to its button.
  header: (takeSnapshot: () => Promise<void>) => React.ReactNode;
  // For the snapshot image, which has no header of its own.
  title: string;
  subtitle: string;
  snapshotFileName: string;
  summary: {
    sides: [SummarySide, SummarySide];
    horizonYears: number;
    staffTimeNote: string;
    outcomeNote: string;
  };
  comparison: ComparisonTotals;
  // Totals before the most recent edit, or null when there's nothing to undo.
  previous: ComparisonTotals | null;
  onUndo: () => void;
  flips: FlipPoint[];
  checklist: ChecklistItem[];
  inputs: Record<InputTab, React.ReactNode>;
  notes: string[];
}

export default function ResultsLayout({
  header, title, subtitle, snapshotFileName, summary, comparison, previous, onUndo, flips, checklist, inputs, notes,
}: ResultsLayoutProps) {
  const wide = useMediaQuery(WIDE);
  const [a, b] = summary.sides;
  const names = { nameA: a.name, nameB: b.name, colorA: a.color, colorB: b.color };
  const [inputTab, setInputTab] = useState<InputTab>("costs");
  const [compareSide, setCompareSide] = useState<"a" | "b">("a");
  const inputsRef = useRef<HTMLDivElement>(null);
  const { ref: verdictRef, entry } = useIntersection({ threshold: 0 });
  const showStrip = entry !== null && !entry.isIntersecting && entry.boundingClientRect.top < 0;

  // The snapshot is drawn from its own copy of the verdict, chart, and
  // drivers, rendered only while exporting: on the page they're split across
  // tabs, and the verdict carries live controls that don't belong in an image.
  const [snapshotting, setSnapshotting] = useState(false);
  const snapshotRef = useRef<HTMLDivElement>(null);
  async function takeSnapshot() {
    setSnapshotting(true);
    try {
      // Long enough for React to mount it and Chart.js to draw (no animation).
      await new Promise((r) => setTimeout(r, 200));
      if (snapshotRef.current) await exportSnapshot(snapshotRef.current, snapshotFileName);
    } finally {
      setSnapshotting(false);
    }
  }

  function goTo(item: ChecklistItem) {
    setInputTab(item.tab);
    if (item.side) setCompareSide(item.side);
    // After the tab (and, on a phone, the solution) has switched.
    setTimeout(() => {
      const field = item.side && item.fields?.[0] ? document.getElementById(fieldDomId(item.side, item.fields[0])) : null;
      const target = field ?? inputsRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: field ? "center" : "start" });
      field?.focus({ preventScroll: true });
    }, 60);
  }

  const lastChange = (compact?: boolean) => (
    <LastChange comparison={comparison} previous={previous} nameA={a.name} nameB={b.name} onUndo={onUndo} compact={compact} />
  );

  const why = (
    <Paper withBorder radius="md" p={0}>
      <Tabs defaultValue="time" keepMounted={false}>
        <Tabs.List grow>
          <Tabs.Tab value="time" leftSection={<LineChart size={14} />}>Over time</Tabs.Tab>
          <Tabs.Tab value="drivers" leftSection={<Gauge size={14} />}>Drivers</Tabs.Tab>
          <Tabs.Tab value="years" leftSection={<CalendarDays size={14} />}>By year</Tabs.Tab>
        </Tabs.List>
        <Box
          p="md"
          style={wide ? { maxHeight: `calc(100vh - ${STICKY_TOP + 16 + 44}px)`, overflowY: "auto" } : undefined}
        >
          <Tabs.Panel value="drivers">
            <GapDrivers comparison={comparison} flips={flips} {...names} />
          </Tabs.Panel>
          <Tabs.Panel value="time">
            <CumulativeChart comparison={comparison} {...names} height={wide ? 380 : 300} />
          </Tabs.Panel>
          <Tabs.Panel value="years">
            <YearTable comparison={comparison} nameA={a.name} nameB={b.name} />
          </Tabs.Panel>
        </Box>
      </Tabs>
    </Paper>
  );

  return (
    <CompareSideContext.Provider value={{ side: compareSide, setSide: setCompareSide }}>
      <Stack gap="xl">
        {header(takeSnapshot)}

        <div ref={verdictRef}>
          <CostSummary
            {...summary}
            crossoverYear={comparison.crossoverYear}
            laterCrossoverYears={comparison.laterCrossoverYears}
            footer={
              <Group justify="space-between" gap="sm">
                <ShareChecklist items={checklist} nameA={a.name} nameB={b.name} onGoTo={goTo} />
                {lastChange()}
              </Group>
            }
          />
        </div>
        {showStrip && <VerdictStrip sides={summary.sides} horizonYears={summary.horizonYears}>{lastChange(true)}</VerdictStrip>}

        <Box style={{ display: "flex", flexDirection: wide ? "row" : "column", gap: "var(--mantine-spacing-xl)", alignItems: "flex-start" }}>
          <Box style={{ flex: wide ? "0 0 42%" : "1 1 auto", minWidth: 0, width: "100%", position: wide ? "sticky" : "static", top: wide ? STICKY_TOP : undefined }}>
            {why}
          </Box>

          <Box ref={inputsRef} style={{ flex: "1 1 0%", minWidth: 0, width: "100%", scrollMarginTop: STICKY_TOP }}>
            <Tabs value={inputTab} onChange={(v) => v && setInputTab(v as InputTab)} variant="pills">
              <Group justify="space-between" align="baseline" mb="xs" gap="xs">
                <Title order={5}>Inputs</Title>
                <Text size="xs" c={TEXT_MUTED}>Every change updates the totals above as you type.</Text>
              </Group>
              <Tabs.List grow mb="md">
                <Tabs.Tab value="scenario">Scenario</Tabs.Tab>
                <Tabs.Tab value="costs">Costs</Tabs.Tab>
                <Tabs.Tab value="impact">Business impact</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="scenario">{inputs.scenario}</Tabs.Panel>
              <Tabs.Panel value="costs">{inputs.costs}</Tabs.Panel>
              <Tabs.Panel value="impact">{inputs.impact}</Tabs.Panel>
            </Tabs>
          </Box>
        </Box>

        <MethodologyNotes notes={notes} />
      </Stack>

      {snapshotting && (
        <Box
          ref={snapshotRef} p="lg" w={800}
          style={{ position: "fixed", top: 0, left: 0, zIndex: -1, pointerEvents: "none", background: PAGE_BG }}
          aria-hidden
        >
          <Stack gap="lg">
            <div>
              <Title order={3}>{title}</Title>
              <Text size="sm" c={TEXT_MUTED}>{subtitle}</Text>
            </div>
            <CostSummary {...summary} crossoverYear={comparison.crossoverYear} laterCrossoverYears={comparison.laterCrossoverYears} />
            <Paper withBorder p="md" radius="md"><CumulativeChart comparison={comparison} {...names} height={300} animate={false} /></Paper>
            <Paper withBorder p="md" radius="md"><GapDrivers comparison={comparison} flips={flips} {...names} /></Paper>
          </Stack>
        </Box>
      )}
    </CompareSideContext.Provider>
  );
}
