"use client";

import { Badge, Box, Group, Paper, Stack, Text } from "@mantine/core";
import { Check, History } from "lucide-react";
import type { SolutionTotals } from "../lib/engine";
import { TEXT_MUTED, fmtUsd } from "../lib/colors";
import InfoLabel from "./InfoLabel";

// Color by meaning (which side actually costs less), not by A/B slot or
// hardcoded to any vendor — computed fresh from the totals every render, so
// it's correct regardless of which side wins. Deliberately not the
// solutions' own chart colors: those stay exactly as the user set them, this
// is a separate, computed-only accent scoped to this summary.
const CHEAPER_COLOR = "var(--mantine-color-teal-5)";
const PRICIER_COLOR = "var(--mantine-color-gray-5)";

export interface SummarySide {
  id: "a" | "b";
  name: string;
  result: SolutionTotals;
  isIncumbent: boolean;
  // e.g. "$12 / cam / mo"
  perUnit: string;
  // Lines under the cash/staff-time split: what you end up owning, and the like.
  details?: React.ReactNode;
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0} align="center">
      <Text ff="monospace" fw={600} size="sm">{value}</Text>
      <Text size="xs" c={TEXT_MUTED} ta="center" maw={180} lineClamp={2}>{label}</Text>
    </Stack>
  );
}

// The headline card: which side costs less and by how much, when it takes
// the lead, and each side's total split into cash, staff time, and business
// impact.
export default function CostSummary({
  sides, horizonYears, crossoverYear, laterCrossoverYears, footerStats, staffTimeNote, outcomeNote,
}: {
  sides: [SummarySide, SummarySide];
  horizonYears: number;
  crossoverYear: number | null;
  laterCrossoverYears: number[];
  footerStats: { label: string; value: string }[];
  staffTimeNote: string;
  outcomeNote: string;
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
  const timingSentence = isTie
    ? null
    : allCrossovers.length > 1
      ? `The lead changes hands in years ${allCrossovers.join(", ")}, and ${cheaper.name} stays cheaper from year ${leadYear}.`
      : leadYear !== null
        ? `${cheaper.name} becomes the cheaper option in year ${leadYear}.`
        : `${cheaper.name} is cheaper in every year.`;

  return (
    <Paper withBorder p="xl" radius="md">
      <Stack gap="xl">
        <Stack gap={4} align="center" ta="center">
          <Text size="sm" fw={600}>
            {isTie ? `Both cost the same over ${yearsLabel}` : `${cheaper.name} costs less over ${yearsLabel}, by`}
          </Text>
          {!isTie && (
            <Text ff="monospace" fw={700} size="2.75rem" c="teal" lh={1.1}>
              {fmtUsd(diff)}
            </Text>
          )}
          {!isTie && (
            <Text size="sm" c={TEXT_MUTED}>
              {bothPositive
                ? <>That&apos;s {pctSaved}% less than {pricier.name}. </>
                : cheaper.result.total < 0 && `${cheaper.name}'s estimated savings exceed its costs. `}
              {timingSentence}
            </Text>
          )}
        </Stack>

        <Stack gap="md">
          {sides.map((side) => {
            const isCheaper = side === cheaper;
            const { result } = side;
            return (
              <div key={side.id}>
                {/* Wraps instead of truncating: on a phone the totals drop below the
                    name rather than squeezing it down to a single letter. */}
                <Group justify="space-between" mb={6} wrap="wrap" gap="xs" style={{ rowGap: 2 }}>
                  <Group gap={6} wrap="wrap" style={{ minWidth: 0, flex: "1 1 200px", rowGap: 2 }}>
                    <Text size="sm" fw={600} c={isCheaper ? undefined : TEXT_MUTED} lineClamp={2} style={{ wordBreak: "break-word" }}>{side.name}</Text>
                    {isCheaper && (
                      <Badge size="xs" variant="light" color="teal" leftSection={<Check size={10} />} style={{ flexShrink: 0 }}>
                        Lower cost
                      </Badge>
                    )}
                    {side.isIncumbent && (
                      <Badge size="xs" variant="outline" color="gray" leftSection={<History size={10} />} style={{ flexShrink: 0 }}>
                        Incumbent
                      </Badge>
                    )}
                  </Group>
                  <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
                    <Text ff="monospace" fw={700} size="sm" c={isCheaper ? "teal" : TEXT_MUTED}>{fmtUsd(result.total)}</Text>
                    <Text size="xs" c={TEXT_MUTED}>{side.perUnit}</Text>
                  </Group>
                </Group>
                <Box style={{ height: isCheaper ? 8 : 5, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <Box
                    style={{
                      height: "100%",
                      width: `${maxTotal > 0 ? (Math.max(0, result.total) / maxTotal) * 100 : 0}%`,
                      borderRadius: 4,
                      background: isCheaper ? CHEAPER_COLOR : PRICIER_COLOR,
                    }}
                  />
                </Box>
                <Box mt={4}>
                  <InfoLabel
                    label={
                      `${fmtUsd(result.cashTotal)} cash · ${fmtUsd(result.staffTimeTotal)} est. staff time` +
                      (Math.abs(result.outcomeTotal) > 0.5 ? ` · ${fmtUsd(result.outcomeTotal)} est. business impact` : "")
                    }
                    help={Math.abs(result.outcomeTotal) > 0.5 ? `${staffTimeNote} ${outcomeNote}` : staffTimeNote}
                    size="var(--mantine-font-size-xs)" color={TEXT_MUTED}
                  />
                </Box>
                {side.details}
              </div>
            );
          })}
        </Stack>

        <Group justify="center" gap="xl" pt="md" style={{ borderTop: "1px solid var(--mantine-color-dark-4)" }}>
          <FooterStat label="Crossover" value={crossoverYear === null ? "None" : "Yr " + crossoverYear} />
          {footerStats.map((s) => <FooterStat key={s.label} label={s.label} value={s.value} />)}
          <FooterStat label="Horizon" value={`${horizonYears} yrs`} />
        </Group>
      </Stack>
    </Paper>
  );
}
