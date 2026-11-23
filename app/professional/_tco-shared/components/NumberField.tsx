"use client";

import { Group, NumberInput, Tooltip } from "@mantine/core";
import { AlertTriangle } from "lucide-react";
import type { FieldDef } from "../lib/fields";
import type { FieldMeta } from "../lib/vendorData";
import InfoLabel from "./InfoLabel";
import SourceDot from "./SourceDot";

// One numeric input rendered from its definition (label, help, range), with
// the source dot for a vendor-researched value. Each calculator wraps it for
// its own solution fields, so a field looks and validates the same in the
// wizard and on the results page. `iconInLabel` puts the icon beside the
// label text instead of inside the input.
//
// `bare` drops the label for the results page's side-by-side editor, whose
// row already names the field: the source dot, or the checklist's warning
// when `flag` explains why the value needs checking, moves into the input.
export default function NumberField({ def, value, meta, onChange, icon: Icon, iconInLabel, bare, ariaLabel, flag, id }: {
  def: FieldDef<string>;
  value: number;
  meta: FieldMeta | null;
  onChange: (n: number) => void;
  icon?: React.ElementType;
  iconInLabel?: boolean;
  bare?: boolean;
  ariaLabel?: string;
  flag?: string;
  id?: string;
}) {
  const dot = <SourceDot meta={meta} />;
  const warning = flag ? (
    <Tooltip multiline w={280} withArrow label={flag} events={{ hover: true, focus: true, touch: true }}>
      <span role="img" aria-label={`Needs checking: ${flag}`} style={{ display: "inline-flex", cursor: "help", lineHeight: 0 }}>
        <AlertTriangle size={14} color="var(--mantine-color-yellow-5)" />
      </span>
    </Tooltip>
  ) : null;
  const common = {
    id,
    value,
    min: def.min ?? 0,
    max: def.max,
    step: def.step,
    decimalScale: def.decimalScale,
    allowDecimal: !def.int,
    thousandSeparator: ",",
    onChange: (v: string | number) => onChange(typeof v === "number" ? v : Number(v) || 0),
  };

  if (bare) {
    return (
      <NumberInput
        {...common}
        aria-label={ariaLabel ?? def.label}
        leftSection={warning ?? (meta ? dot : undefined)}
        leftSectionPointerEvents="auto"
        leftSectionWidth={warning || meta ? 28 : undefined}
        styles={flag ? { input: { borderColor: "var(--mantine-color-yellow-8)" } } : undefined}
      />
    );
  }

  const text = def.help ? <InfoLabel label={def.label} help={def.help} extra={dot} /> : <Group gap={4} wrap="nowrap">{def.label}{dot}</Group>;
  return (
    <NumberInput
      {...common}
      label={Icon && iconInLabel ? <Group gap={6} wrap="nowrap"><Icon size={14} style={{ flexShrink: 0, opacity: 0.85 }} />{text}</Group> : text}
      leftSection={Icon && !iconInLabel ? <Icon size={15} /> : undefined}
    />
  );
}
