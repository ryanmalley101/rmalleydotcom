"use client";

import { Group, Tooltip, UnstyledButton } from "@mantine/core";
import { HelpCircle } from "lucide-react";

export default function InfoLabel({
  label, help, size, color, fw, extra,
}: { label: string; help: string; size?: string; color?: string; fw?: number | string; extra?: React.ReactNode }) {
  return (
    <Group gap={4} wrap="nowrap" style={{ fontSize: size, color, fontWeight: fw }}>
      <span>{label}</span>
      {extra}
      <Tooltip multiline w={260} withArrow label={help} events={{ hover: true, focus: true, touch: true }}>
        <UnstyledButton
          type="button"
          aria-label={`More info about ${label}`}
          style={{ display: "inline-flex", cursor: "help", opacity: 0.75, flexShrink: 0, lineHeight: 0 }}
        >
          <HelpCircle size={13} aria-hidden="true" />
        </UnstyledButton>
      </Tooltip>
    </Group>
  );
}
