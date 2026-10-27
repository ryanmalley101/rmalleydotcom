"use client";

import { Group, NumberInput } from "@mantine/core";
import type { FieldDef } from "../lib/fields";
import type { FieldMeta } from "../lib/vendorData";
import InfoLabel from "./InfoLabel";
import SourceDot from "./SourceDot";

// One numeric input rendered from its definition (label, help, range), with
// the source dot for a vendor-researched value. Each calculator wraps it for
// its own solution fields, so a field looks and validates the same in the
// wizard and on the results page. `iconInLabel` puts the icon beside the
// label text instead of inside the input.
export default function NumberField({ def, value, meta, onChange, icon: Icon, iconInLabel }: {
  def: FieldDef<string>;
  value: number;
  meta: FieldMeta | null;
  onChange: (n: number) => void;
  icon?: React.ElementType;
  iconInLabel?: boolean;
}) {
  const dot = <SourceDot meta={meta} />;
  const text = def.help ? <InfoLabel label={def.label} help={def.help} extra={dot} /> : <Group gap={4} wrap="nowrap">{def.label}{dot}</Group>;
  return (
    <NumberInput
      label={Icon && iconInLabel ? <Group gap={6} wrap="nowrap"><Icon size={14} style={{ flexShrink: 0, opacity: 0.85 }} />{text}</Group> : text}
      leftSection={Icon && !iconInLabel ? <Icon size={15} /> : undefined}
      value={value}
      min={def.min ?? 0}
      max={def.max}
      step={def.step}
      decimalScale={def.decimalScale}
      allowDecimal={!def.int}
      onChange={(v) => onChange(typeof v === "number" ? v : Number(v) || 0)}
    />
  );
}
