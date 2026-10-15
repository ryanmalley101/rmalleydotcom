"use client";

import { Anchor, Box, Popover, Stack, Text, UnstyledButton } from "@mantine/core";
import type { FieldMeta } from "../lib/vendorDefaults";

// Answers "which fields are actually sourced?" per-field, not just the
// aggregate "N/M fields sourced" badge on the provider Select; that badge
// tells you how much of a vendor's data is real, this tells you which
// specific number in front of you is one of them. Renders nothing when
// there's no vendor-researched value behind the current field (including
// when the user has edited it away from that value; see fieldSourceInfo).
//
// A real button opening a popover (not a hover-only tooltip): reachable by
// keyboard, works on touch, and the source links inside can be clicked.
export default function SourceDot({ meta }: { meta: FieldMeta | null }) {
  if (!meta) return null;
  const sourced = meta.status === "sourced";
  const color = sourced ? "teal" : "gray";
  const summary = sourced ? `Sourced (${meta.confidence} confidence)` : `Estimated (${meta.confidence} confidence)`;

  return (
    <Popover width={300} withArrow shadow="md" position="top">
      <Popover.Target>
        <UnstyledButton
          type="button"
          aria-label={`${summary}: show details`}
          style={{ display: "inline-flex", alignItems: "center", padding: 3, margin: -3, cursor: "pointer", lineHeight: 0, flexShrink: 0 }}
        >
          <Box
            component="span"
            style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: `var(--mantine-color-${color}-5)` }}
          />
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap={6}>
          <Text size="xs" fw={600}>{summary}</Text>
          {meta.reasoning && <Text size="xs">{meta.reasoning}</Text>}
          {meta.sources.length > 0 && (
            <Stack gap={2}>
              {meta.sources.map((src) => (
                <Anchor key={src} href={src} target="_blank" rel="noopener noreferrer" size="xs" style={{ wordBreak: "break-all" }}>
                  {src}
                </Anchor>
              ))}
            </Stack>
          )}
          {meta.checkedOn && <Text size="xs" c="dimmed">Checked {meta.checkedOn}</Text>}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
