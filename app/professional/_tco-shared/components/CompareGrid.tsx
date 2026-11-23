"use client";

import { createContext, useContext, useState } from "react";
import { Badge, Box, Button, ColorPicker, Group, Modal, Popover, SegmentedControl, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { History, Pencil } from "lucide-react";
import { COLOR_SWATCHES, TEXT_MUTED } from "../lib/colors";
import { IconLabel } from "./FormParts";
import { PAGE_BG, STRIP_HEIGHT } from "./layoutConstants";
import classes from "./CompareGrid.module.css";

// The results page's cost editor: one row per input, with each solution's
// value side by side, so the same field can be compared and edited across
// both without opening two panels and scrolling between them. Below the
// `sm` breakpoint there's no room for two inputs per row, so a toggle picks
// which solution's column shows.
//
// "Essential" (the default) shows only the inputs that most often decide a
// comparison and that a user can realistically supply from a quote or their
// own operations; "All inputs" adds the advanced ones (engineering detail,
// timing refinements, vendor-researched values). An advanced row still shows
// in Essential when it's been edited away from its default or the checklist
// flags it (the row's `keep`), so nothing that moves a total is ever hidden.

export interface CompareSide {
  id: "a" | "b";
  // Short display name, and the full one, shown on hover when they differ.
  name: string;
  fullName: string;
  color: string;
  onColorChange: (color: string) => void;
  modelLabel: string;
  isIncumbent: boolean;
}

type Mode = "both" | "a" | "b";

// Which solution shows on a narrow screen. The results page provides it, so
// its checklist's "go to the field" can switch to the right one; without a
// provider the grid keeps its own.
export const CompareSideContext = createContext<{ side: "a" | "b"; setSide: (s: "a" | "b") => void } | null>(null);
const ModeContext = createContext<{ mode: Mode; showAll: boolean }>({ mode: "both", showAll: true });

const COLUMNS: Record<"both" | "one", string> = {
  both: "minmax(170px, 1.2fr) minmax(0, 1fr) minmax(0, 1fr)",
  one: "minmax(130px, 1fr) minmax(0, 1.2fr)",
};
const BORDER = "1px solid var(--mantine-color-dark-4)";

function rowStyle(mode: Mode): React.CSSProperties {
  return { display: "grid", gridTemplateColumns: COLUMNS[mode === "both" ? "both" : "one"], columnGap: 12, alignItems: "center" };
}

// The chart color for one solution, set from its swatch in the header.
function ColorSwatch({ side }: { side: CompareSide }) {
  return (
    <Popover withArrow shadow="md" position="bottom-start">
      <Popover.Target>
        <UnstyledButton
          aria-label={`Chart color for ${side.name}`}
          style={{ width: 14, height: 14, borderRadius: "50%", background: side.color, flexShrink: 0, boxShadow: "0 0 0 2px rgba(255,255,255,0.15)" }}
        />
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap={6}>
          <Text size="xs" fw={600}>Chart color</Text>
          <ColorPicker format="hex" value={side.color} onChange={side.onColorChange} swatches={COLOR_SWATCHES} swatchesPerRow={8} size="sm" />
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function SideHeader({ side }: { side: CompareSide }) {
  const name = <Text fw={700} size="sm" truncate="end">{side.name}</Text>;
  return (
    <Stack gap={2} style={{ minWidth: 0 }}>
      <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
        <ColorSwatch side={side} />
        {side.fullName !== side.name ? <Tooltip label={side.fullName} withArrow>{name}</Tooltip> : name}
      </Group>
      <Group gap={4}>
        <Badge size="xs" variant="light" color="gray">{side.modelLabel}</Badge>
        {side.isIncumbent && <Badge size="xs" variant="outline" color="gray" leftSection={<History size={10} />}>Incumbent</Badge>}
      </Group>
    </Stack>
  );
}

export function CompareGrid({ sides, children }: { sides: [CompareSide, CompareSide]; children: React.ReactNode }) {
  const wide = useMediaQuery("(min-width: 48em)", true);
  const [ownPick, setOwnPick] = useState<"a" | "b">("a");
  const shared = useContext(CompareSideContext);
  const picked = shared?.side ?? ownPick;
  const setPicked = shared?.setSide ?? setOwnPick;
  const mode: Mode = wide ? "both" : picked;
  const shown = mode === "both" ? sides : sides.filter((s) => s.id === mode);
  const [showAll, setShowAll] = useState(false);

  return (
    <ModeContext.Provider value={{ mode, showAll }}>
      <Box>
        <Group justify="space-between" gap="xs" mb="sm" wrap="wrap">
          <SegmentedControl
            size="xs" value={showAll ? "all" : "essential"} onChange={(v) => setShowAll(v === "all")}
            data={[{ value: "essential", label: "Essential" }, { value: "all", label: "All inputs" }]}
          />
          <Text size="xs" c={TEXT_MUTED} style={{ flex: "1 1 220px" }} ta="right">
            {showAll
              ? "Every input, including engineering detail and vendor-researched values."
              : "The inputs that most often decide the result. Others appear here once edited or flagged."}
          </Text>
        </Group>
        {!wide && (
          <SegmentedControl
            fullWidth mb="sm" value={picked} onChange={(v) => setPicked(v as "a" | "b")}
            data={sides.map((s) => ({ value: s.id, label: s.name }))}
          />
        )}
        {/* Stays in view right under the verdict strip while scrolling the rows. */}
        <Box
          pt="sm" pb="xs"
          style={{
            ...rowStyle(mode), position: "sticky", top: STRIP_HEIGHT, zIndex: 3, alignItems: "start",
            background: PAGE_BG, borderBottom: BORDER,
          }}
        >
          <Text size="xs" c={TEXT_MUTED} pt={2}>Click a dot to change its chart color</Text>
          {shown.map((s) => <SideHeader key={s.id} side={s} />)}
        </Box>
        <Stack gap={0}>{children}</Stack>
      </Box>
    </ModeContext.Provider>
  );
}

// A titled group of rows; hidden whole when none of its rows are showing.
export function CompareSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box className={classes.section}>
      <Text size="xs" fw={700} tt="uppercase" c={TEXT_MUTED} pt="lg" pb={6} style={{ letterSpacing: 0.5 }}>
        {title}
      </Text>
      {children}
    </Box>
  );
}

const Missing = () => <Text size="sm" c="dimmed" aria-label="Not applicable">—</Text>;

// One input across both solutions. `null` means the field doesn't apply to
// that solution; a row that applies to neither isn't shown at all, and on a
// narrow screen a row is hidden when it doesn't apply to the solution shown.
// An `advanced` row shows only under "All inputs", unless `keep`.
export function CompareRow({ label, help, icon, a, b, hint, advanced, keep }: {
  label: string;
  help?: string;
  icon: React.ElementType;
  a: React.ReactNode | null;
  b: React.ReactNode | null;
  // Small text under the label (e.g. a derived per-year figure).
  hint?: React.ReactNode;
  advanced?: boolean;
  // Edited away from its default, or flagged by the checklist.
  keep?: boolean;
}) {
  const { mode, showAll } = useContext(ModeContext);
  if (a == null && b == null) return null;
  if (advanced && !showAll && !keep) return null;
  if (mode !== "both" && (mode === "a" ? a : b) == null) return null;
  const cells = mode === "both" ? [a, b] : [mode === "a" ? a : b];
  return (
    <Box py={6} className={classes.row} style={{ ...rowStyle(mode), borderTop: BORDER }}>
      <Stack gap={0} style={{ minWidth: 0 }}>
        <IconLabel icon={icon} label={label} help={help} size="var(--mantine-font-size-sm)" />
        {hint && <Text size="xs" c={TEXT_MUTED}>{hint}</Text>}
      </Stack>
      {cells.map((cell, i) => <Box key={i} style={{ minWidth: 0 }}>{cell == null ? <Missing /> : cell}</Box>)}
    </Box>
  );
}

// A full-width line between rows: warnings, explanations.
export function CompareNote({ children }: { children: React.ReactNode }) {
  return <Box py={6}>{children}</Box>;
}

// A cell for something too big to edit inline (a list of connector models,
// misc line items): a one-line summary, with the full editor in a dialog.
export function CompareModalCell({ summary, title, children, id }: {
  summary: React.ReactNode; title: string; children: React.ReactNode; id?: string;
}) {
  const [opened, { open, close }] = useDisclosure(false);
  return (
    <>
      <Stack gap={4} align="flex-start">
        <Text size="xs" c={TEXT_MUTED}>{summary}</Text>
        <Button id={id} size="compact-xs" variant="light" leftSection={<Pencil size={12} />} onClick={open}>Edit</Button>
      </Stack>
      <Modal opened={opened} onClose={close} title={title} size="xl" centered>
        {children}
      </Modal>
    </>
  );
}
