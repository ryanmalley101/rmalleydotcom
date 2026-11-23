"use client";

import { Badge, Box, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";
import { Check, History } from "lucide-react";
import type { SolutionTotals } from "../lib/engine";
import { TEXT_MUTED, fmtUsd } from "../lib/colors";
import { upfrontAndOngoing } from "../lib/report";
import InfoLabel from "./InfoLabel";

export interface SummarySide {
  id: "a" | "b";
  // Short display name (see lib/names.ts).
  name: string;
  // The solution's own chart color. Every place a solution is drawn uses
  // it, the bars here included, so a side is one color across the page.
  color: string;
  result: SolutionTotals;
  isIncumbent: boolean;
  // e.g. "$12 / cam / mo"
  perUnit: string;
  // Lines under the totals: what you end up owning, and the like.
  details?: React.ReactNode;
}

// Hex color at some opacity, written out as rgba rather than color-mix() so
// the PNG snapshot (html2canvas) can draw it.
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Cash, staff time, and business impact as segments of one bar, so how much
// of a total is estimated staff time is visible without reading the numbers.
const STAFF_ALPHA = 0.5;
const IMPACT_ALPHA = 0.25;
const OFFSET_PATTERN = "repeating-linear-gradient(135deg, rgba(15,17,23,0.85) 0 3px, transparent 3px 6px)";

function gross(r: SolutionTotals) {
  return Math.max(0, r.cashTotal) + Math.max(0, r.staffTimeTotal) + Math.max(0, r.outcomeTotal);
}

function SplitBar({ result, color, scale }: { result: SolutionTotals; color: string; scale: number }) {
  const g = gross(result);
  const pct = (n: number) => `${scale > 0 ? (Math.max(0, n) / scale) * 100 : 0}%`;
  // Business impact savings offset part of the costs: hatched over the end
  // of the bar, so the solid part is the net total.
  const offset = result.outcomeTotal < 0 ? Math.min(g, -result.outcomeTotal) : 0;
  return (
    <Box style={{ height: 10, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <Box style={{ position: "relative", display: "flex", height: "100%", width: pct(g) }}>
        <Box style={{ width: `${g > 0 ? (Math.max(0, result.cashTotal) / g) * 100 : 0}%`, background: color }} />
        <Box style={{ width: `${g > 0 ? (Math.max(0, result.staffTimeTotal) / g) * 100 : 0}%`, background: withAlpha(color, STAFF_ALPHA) }} />
        <Box style={{ width: `${g > 0 ? (Math.max(0, result.outcomeTotal) / g) * 100 : 0}%`, background: withAlpha(color, IMPACT_ALPHA) }} />
        {offset > 0 && (
          <Box style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: `${(offset / g) * 100}%`, background: OFFSET_PATTERN }} />
        )}
      </Box>
    </Box>
  );
}

function LegendKey({ label, background }: { label: string; background: string }) {
  return (
    <Group gap={5} wrap="nowrap">
      <Box style={{ width: 10, height: 10, borderRadius: 2, background, border: "1px solid rgba(255,255,255,0.25)" }} />
      <Text size="xs" c={TEXT_MUTED}>{label}</Text>
    </Group>
  );
}

// The headline: which side costs less and by how much, when it takes the
// lead, and each side's total split into cash, staff time, and business
// impact, plus what it costs up front versus over time. `footer` holds the
// page's live controls (checklist, last change), left out of the snapshot.
export default function CostSummary({
  sides, horizonYears, crossoverYear, laterCrossoverYears, staffTimeNote, outcomeNote, footer,
}: {
  sides: [SummarySide, SummarySide];
  horizonYears: number;
  crossoverYear: number | null;
  laterCrossoverYears: number[];
  staffTimeNote: string;
  outcomeNote: string;
  footer?: React.ReactNode;
}) {
  const [a, b] = sides;
  const cheaper = a.result.total <= b.result.total ? a : b;
  const pricier = cheaper === a ? b : a;
  const diff = Math.abs(a.result.total - b.result.total);
  const maxTotal = Math.max(a.result.total, b.result.total);
  const pctSaved = maxTotal > 0 ? Math.round((diff / maxTotal) * 100) : 0;
  // Business impact savings can push a total below zero (the system saves
  // more than it costs), where "N% less" stops meaning anything.
  const bothPositive = a.result.total > 0 && b.result.total > 0;
  const yearsLabel = `${horizonYears} ${horizonYears === 1 ? "year" : "years"}`;
  const isTie = diff < 0.5;
  // The last sign flip is when the eventual winner took the lead for good.
  const allCrossovers = crossoverYear === null ? [] : [crossoverYear, ...laterCrossoverYears];
  const leadYear = allCrossovers.length ? allCrossovers[allCrossovers.length - 1] : null;
  // Either solution's name, wherever the headline mentions it: bold, in its
  // own chart color, so it reads as the same solution as its line and bars.
  const winner = <Text span inherit fw={700} c={cheaper.color}>{cheaper.name}</Text>;
  const loser = <Text span inherit fw={700} c={pricier.color}>{pricier.name}</Text>;
  const timingSentence = isTie
    ? null
    : allCrossovers.length > 1
      ? <>The lead changes hands in years {allCrossovers.join(", ")}, and {winner} stays cheaper from year {leadYear}.</>
      : leadYear !== null
        ? <>{winner} becomes the cheaper option in year {leadYear}.</>
        : <>{winner} is cheaper in every year.</>;

  const scale = Math.max(gross(a.result), gross(b.result));
  const anyImpact = sides.some((s) => Math.abs(s.result.outcomeTotal) > 0.5);
  const anyOffset = sides.some((s) => s.result.outcomeTotal < -0.5);

  return (
    <Paper withBorder p="lg" radius="md">
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" verticalSpacing="lg">
        <Stack gap={6} justify="center">
          {isTie ? (
            <Text size="xl" fw={700}>Both cost the same over {yearsLabel}</Text>
          ) : (
            <Text size="lg" fw={600} lh={1.3}>
              <Text span inherit fz="1.9rem" fw={800} c={cheaper.color} style={{ wordBreak: "break-word" }}>{cheaper.name}</Text>
              {" "}costs less over {yearsLabel}, by
            </Text>
          )}
          {!isTie && (
            <Text ff="monospace" fw={700} size="2.6rem" lh={1.1}>
              {fmtUsd(diff)}
            </Text>
          )}
          {!isTie && (
            <Text size="md" c={TEXT_MUTED}>
              {bothPositive
                ? <>That&apos;s {pctSaved}% less than {loser}. </>
                : cheaper.result.total < 0 && <>{winner}&apos;s estimated savings exceed its costs. </>}
              {timingSentence}
            </Text>
          )}
        </Stack>

        <Stack gap="md">
          {sides.map((side) => {
            const { result } = side;
            const { upfront, ongoing } = upfrontAndOngoing(result);
            return (
              <Stack key={side.id} gap={4}>
                {/* Wraps instead of truncating: on a phone the totals drop below the name. */}
                <Group justify="space-between" wrap="wrap" gap="xs" style={{ rowGap: 2 }}>
                  <Group gap={6} wrap="wrap" style={{ minWidth: 0, flex: "1 1 160px", rowGap: 2 }}>
                    <Text size="sm" fw={600} style={{ wordBreak: "break-word" }}>{side.name}</Text>
                    {side === cheaper && !isTie && (
                      <Badge size="xs" variant="light" color="gray" leftSection={<Check size={10} />}>Lower cost</Badge>
                    )}
                    {side.isIncumbent && (
                      <Badge size="xs" variant="outline" color="gray" leftSection={<History size={10} />}>Incumbent</Badge>
                    )}
                  </Group>
                  <Group gap={8} wrap="nowrap">
                    <Text ff="monospace" fw={700} size="sm">{fmtUsd(result.total)}</Text>
                    <Text size="xs" c={TEXT_MUTED}>{side.perUnit}</Text>
                  </Group>
                </Group>
                <SplitBar result={result} color={side.color} scale={scale} />
                <Text size="xs" c={TEXT_MUTED}>
                  {fmtUsd(upfront)} at year 0 · {fmtUsd(ongoing)} over years 1–{horizonYears}
                </Text>
                <InfoLabel
                  label={
                    `${fmtUsd(result.cashTotal)} cash · ${fmtUsd(result.staffTimeTotal)} est. staff time` +
                    (Math.abs(result.outcomeTotal) > 0.5 ? ` · ${fmtUsd(result.outcomeTotal)} est. business impact` : "")
                  }
                  help={Math.abs(result.outcomeTotal) > 0.5 ? `${staffTimeNote} ${outcomeNote}` : staffTimeNote}
                  size="var(--mantine-font-size-xs)" color={TEXT_MUTED}
                />
                {side.details}
              </Stack>
            );
          })}
          <Group gap="md">
            <LegendKey label="Cash" background={TEXT_MUTED} />
            <LegendKey label="Est. staff time" background={withAlpha(TEXT_MUTED, STAFF_ALPHA)} />
            {anyImpact && <LegendKey label="Est. business impact" background={withAlpha(TEXT_MUTED, IMPACT_ALPHA)} />}
            {anyOffset && <LegendKey label="Offset by impact savings" background={`${OFFSET_PATTERN}, ${TEXT_MUTED}`} />}
          </Group>
        </Stack>
      </SimpleGrid>
      {footer && (
        <Box mt="md" pt="sm" style={{ borderTop: "1px solid var(--mantine-color-dark-4)" }}>
          {footer}
        </Box>
      )}
    </Paper>
  );
}
