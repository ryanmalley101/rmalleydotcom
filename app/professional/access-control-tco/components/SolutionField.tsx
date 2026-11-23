"use client";

import type { SolutionInputs } from "../lib/model";
import { SOLUTION_FIELD_MAP } from "../lib/fields";
import { fieldSourceInfo } from "../lib/vendorDefaults";
import NumberField from "../../_tco-shared/components/NumberField";

// One numeric solution input, rendered from its definition in lib/fields.ts
// with its icon in the label and its source dot. Used by both the wizard and
// the results page.
// `bare`, `id`, `ariaLabel`, and `flag` are for the results page's
// side-by-side editor (see NumberField).
export default function SolutionField({ sol, field, onChange, icon, bare, id, ariaLabel, flag }: {
  sol: SolutionInputs;
  field: keyof SolutionInputs;
  onChange: (v: SolutionInputs) => void;
  bare?: boolean;
  id?: string;
  ariaLabel?: string;
  flag?: string;
  icon?: React.ElementType;
}) {
  return (
    <NumberField
      def={SOLUTION_FIELD_MAP[field]}
      value={sol[field] as number}
      meta={fieldSourceInfo(sol, field)}
      icon={icon}
      bare={bare}
      id={id}
      ariaLabel={ariaLabel}
      flag={flag}
      iconInLabel
      onChange={(n) => onChange({ ...sol, [field]: n })}
    />
  );
}
