"use client";

import type { SolutionInputs } from "../lib/model";
import { SOLUTION_FIELD_MAP } from "../lib/fields";
import { withWarranty } from "../lib/defaults";
import { fieldSourceInfo, vendorEntriesFor } from "../lib/vendorDefaults";
import NumberField from "../../_tco-shared/components/NumberField";

// One numeric solution input, rendered from its definition in lib/fields.ts
// (label, help, range) with its source dot. Used by both the wizard and the
// results page, so a field looks and validates the same in both.
export default function SolutionField({ sol, field, onChange, icon }: {
  sol: SolutionInputs;
  field: keyof SolutionInputs;
  onChange: (v: SolutionInputs) => void;
  icon?: React.ElementType;
}) {
  return (
    <NumberField
      def={SOLUTION_FIELD_MAP[field]}
      value={sol[field] as number}
      meta={fieldSourceInfo(field, sol[field], ...vendorEntriesFor(sol))}
      icon={icon}
      // Warranty edits move the derived half-life along with them.
      onChange={(n) => onChange(field === "warrantyYears" ? withWarranty(sol, n) : { ...sol, [field]: n })}
    />
  );
}
