"use client";

import { Box, Tooltip } from "@mantine/core";
import type { FieldMeta } from "../lib/vendorDefaults";

// Answers "which fields are actually sourced?" per-field, not just the
// aggregate "N/M fields sourced" badge on the provider Select; that badge
// tells you how much of a vendor's data is real, this tells you which
// specific number in front of you is one of them. Renders nothing when
// there's no vendor-researched value behind the current field (including
// when the user has edited it away from that value; see fieldSourceInfo).
export default function SourceDot({ meta }: { meta: FieldMeta | null }) {
  if (!meta) return null;
  const sourced = meta.status === "sourced";
  const color = sourced ? "teal" : "gray";
  const parts = [
    sourced ? `Sourced (${meta.confidence} confidence)` : `Estimated (${meta.confidence} confidence)`,
    meta.reasoning,
    sourced && meta.sources.length ? meta.sources[0] : null,
    `Checked ${meta.checkedOn}`,
  ].filter((p): p is string => Boolean(p));

  const label = (
    <Box>
      {parts.map((part, i) => (
        <Box key={i} mt={i > 0 ? 4 : 0}>
          {part}
        </Box>
      ))}
    </Box>
  );

  return (
    <Tooltip multiline w={280} withArrow events={{ hover: true, focus: true, touch: true }} label={label}>
      <Box
        component="span"
        role="img"
        aria-label={sourced ? "This value is sourced" : "This value is estimated"}
        style={{
          display: "inline-block",
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: `var(--mantine-color-${color}-5)`,
          cursor: "help",
          flexShrink: 0,
        }}
      />
    </Tooltip>
  );
}
