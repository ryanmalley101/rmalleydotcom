"use client";

import type { SolutionInputs } from "../lib/model";
import { SOLUTION_FIELD_MAP } from "../lib/fields";
import { fieldSourceInfo } from "../lib/vendorDefaults";
import NumberField from "../../_tco-shared/components/NumberField";

// One numeric solution input, rendered from its definition in lib/fields.ts
// with its icon in the label and its source dot. Used by both the wizard and
// the results page.
export default function SolutionField({ sol, field, onChange, icon }: {
  sol: SolutionInputs;
  field: keyof SolutionInputs;
  onChange: (v: SolutionInputs) => void;
  icon: React.ElementType;
}) {
  return (
    <NumberField
      def={SOLUTION_FIELD_MAP[field]}
      value={sol[field] as number}
      meta={fieldSourceInfo(sol, field)}
      icon={icon}
      iconInLabel
      onChange={(n) => onChange({ ...sol, [field]: n })}
    />
  );
}
