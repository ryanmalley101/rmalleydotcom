"use client";

import { Group, NumberInput } from "@mantine/core";
import type { SolutionInputs } from "../lib/model";
import { SOLUTION_FIELD_MAP } from "../lib/fields";
import { withWarranty } from "../lib/defaults";
import { fieldSourceInfo, vendorEntriesFor } from "../lib/vendorDefaults";
import InfoLabel from "./InfoLabel";
import SourceDot from "./SourceDot";

// One numeric solution input, rendered from its definition in lib/fields.ts
// (label, help, range) with its source dot. Used by both the wizard and the
// results page, so a field looks and validates the same in both.
export default function SolutionField({ sol, field, onChange, icon: Icon }: {
  sol: SolutionInputs;
  field: keyof SolutionInputs;
  onChange: (v: SolutionInputs) => void;
  icon?: React.ElementType;
}) {
  const def = SOLUTION_FIELD_MAP[field];
  const dot = <SourceDot meta={fieldSourceInfo(field, sol[field], ...vendorEntriesFor(sol))} />;
  return (
    <NumberInput
      label={def.help ? <InfoLabel label={def.label} help={def.help} extra={dot} /> : <Group gap={4} wrap="nowrap">{def.label}{dot}</Group>}
      leftSection={Icon ? <Icon size={15} /> : undefined}
      value={sol[field] as number}
      min={def.min ?? 0}
      max={def.max}
      step={def.step}
      decimalScale={def.decimalScale}
      allowDecimal={!def.int}
      onChange={(v) => {
        const n = typeof v === "number" ? v : Number(v) || 0;
        // Warranty edits move the derived half-life along with them.
        onChange(field === "warrantyYears" ? withWarranty(sol, n) : { ...sol, [field]: n });
      }}
    />
  );
}
