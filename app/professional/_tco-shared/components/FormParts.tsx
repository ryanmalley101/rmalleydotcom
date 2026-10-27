"use client";

// Small pieces both calculators' solution forms use.
import { Alert, Badge, ColorInput, Group, Radio, Stack, Text, Tooltip } from "@mantine/core";
import { AlertTriangle } from "lucide-react";
import { COLOR_SWATCHES, TEXT_MUTED } from "../lib/colors";
import type { IncumbentChoice } from "../lib/engine";
import type { ConfidenceSummary } from "../lib/vendorData";
import InfoLabel from "./InfoLabel";

// A field label with its context icon in front, and a help tooltip when
// there's help text.
export function IconLabel({ icon: Icon, label, help, size, color, fw, extra }: {
  icon: React.ElementType; label: string; help?: string; size?: string; color?: string; fw?: number; extra?: React.ReactNode;
}) {
  return (
    <Group gap={6} wrap="nowrap" style={{ fontSize: size, color, fontWeight: fw }}>
      <Icon size={14} style={{ flexShrink: 0, opacity: 0.85 }} />
      {help ? <InfoLabel label={label} help={help} size={size} color={color} fw={fw} extra={extra} /> : <span>{label}</span>}
    </Group>
  );
}

// Groups related fields under a shared heading, since a flat list of ~25
// fields reads as one undifferentiated wall of inputs. `first` drops the top
// margin so the very first section doesn't float away from the panel's top
// edge.
export const SectionLabel = ({ children, first }: { children: React.ReactNode; first?: boolean }) => (
  <div style={{ gridColumn: "1 / -1" }}>
    <Text size="xs" fw={700} tt="uppercase" c={TEXT_MUTED} style={{ letterSpacing: 0.5 }} mt={first ? 0 : "sm"}>
      {children}
    </Text>
  </div>
);

// Warns when a solution's refresh timing means a whole cost line can never
// be charged within this comparison: an incumbent skips the year-0 buildout
// entirely, so refresh cycles are the *only* place that cost can still
// appear, and if the next refresh falls at or beyond the horizon, it never
// does. Silent otherwise, since a non-incumbent always pays at year 0, and a
// refresh past the horizon for it is a legitimate, harmless scenario.
export function StaleRefreshWarning({ isIncumbent, yearsUntilNextRefresh, horizonYears, what }: {
  isIncumbent: boolean; yearsUntilNextRefresh: number; horizonYears: number; what: string;
}) {
  if (!isIncumbent || yearsUntilNextRefresh < horizonYears) return null;
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <Alert color="yellow" variant="light" icon={<AlertTriangle size={16} />} p="xs">
        <Text size="xs">
          This solution is marked incumbent and its next refresh ({yearsUntilNextRefresh}yr) falls at or beyond the{" "}
          {horizonYears}-year horizon — {what} won&apos;t appear anywhere in this comparison.
        </Text>
      </Alert>
    </div>
  );
}

// How much of a picked vendor's pre-filled data is a real source vs. an
// estimate, at a glance.
export function ConfidenceBadge({ summary }: { summary: ConfidenceSummary }) {
  if (summary.total === 0 && summary.tone !== "estimated") return null;
  const color = summary.tone === "sourced" ? "teal" : summary.tone === "mixed" ? "yellow" : "gray";
  return (
    <Tooltip
      multiline w={260} withArrow
      events={{ hover: true, focus: true, touch: true }}
      label="How many of this vendor's pre-filled fields come from a real published/reseller source vs. an estimate. Every field is still fully editable either way, worth double-checking the estimated ones before trusting a close comparison."
    >
      <Badge variant="light" color={color} size="sm" style={{ cursor: "help", width: "fit-content" }}>
        {summary.label}
      </Badge>
    </Tooltip>
  );
}

// A provider dropdown's choices: the known names, then "Other…".
export const OTHER_PROVIDER = "other";
export function providerSelectData(options: string[]) {
  return [...options.map((p) => ({ value: p, label: p })), { value: OTHER_PROVIDER, label: "Other…" }];
}

// Chart line color for one solution, on the results page next to that
// solution's assumptions.
export function ChartColor({ color, onChange }: { color: string; onChange: (v: string) => void }) {
  return (
    <ColorInput
      label="Chart color" value={color} onChange={onChange} format="hex" size="xs" w={160} mb="sm"
      swatches={COLOR_SWATCHES}
    />
  );
}

const INCUMBENT_HELP =
  "The incumbent skips its year-0 buildout cost, since that hardware is already paid for. The other solution is still costed as a fresh deployment.";

// "Is either solution already deployed?" Each calculator adds its own reuse
// questions beside it.
export function IncumbentRadio({ value, onChange, nameA, nameB }: {
  value: IncumbentChoice; onChange: (v: IncumbentChoice) => void; nameA: string; nameB: string;
}) {
  return (
    <Stack gap={8}>
      <InfoLabel label="Is either solution already deployed?" help={INCUMBENT_HELP} fw={500} />
      <Radio.Group value={value} onChange={(v) => onChange(v as IncumbentChoice)}>
        <Group gap="lg">
          <Radio value="none" label="Neither (fresh comparison)" />
          <Radio value="a" label={`${nameA} is incumbent`} />
          <Radio value="b" label={`${nameB} is incumbent`} />
        </Group>
      </Radio.Group>
    </Stack>
  );
}
