// Per-vendor researched defaults: the shape of a vendor entry and the
// helpers that apply one to a solution and report where each pre-filled
// number came from. Each calculator keeps its own tables of entries.

export type FieldStatus = "sourced" | "estimated";
export type Confidence = "high" | "medium" | "low";

export interface FieldMeta {
  value: unknown;
  status: FieldStatus;
  confidence: Confidence;
  sources: string[];
  reasoning?: string;
  checkedOn: string;
}

export interface VendorDefaultEntry<T> {
  values: Partial<T>;
  fieldMeta: Record<string, FieldMeta>;
  notes?: string;
}

// The values an entry applies. A calculator can derive extra ones (the
// video calculator derives camera half-life from warranty).
export type ValuesOf<T> = (entry: VendorDefaultEntry<T>) => Partial<T>;
const storedValues = <T,>(entry: VendorDefaultEntry<T>) => entry.values;

// Whether a field still holds a vendor's value. By value rather than
// identity, so a list (connector models) still matches after a share link
// or saved comparison has rebuilt it as a new array.
const sameValue = (a: unknown, b: unknown) =>
  a === b || (typeof a === "object" && a !== null && typeof b === "object" && b !== null && JSON.stringify(a) === JSON.stringify(b));

// Picking (or pre-seeding) a vendor with researched data merges its values
// on top of whatever's already filled in; vendors without an entry
// (including "Other") pass `sol` through untouched.
export function withVendorDefaults<T>(
  sol: T, vendorName: string, table: Record<string, VendorDefaultEntry<T>>, valuesOf: ValuesOf<T> = storedValues,
): T {
  const entry = table[vendorName];
  return entry ? { ...sol, ...valuesOf(entry) } : sol;
}

// What a provider picker calls when the vendor changes. Merging the new
// vendor on top of the current values (withVendorDefaults alone) would leave
// behind every field the previous vendor set and the new one doesn't, with
// no source dot to show where it came from. So first, any field still
// holding exactly the previous vendor's value goes back to `generic`; a
// field the user edited no longer matches that value and is kept. Then the
// new vendor's values apply. `nextVendor` may be "" or an unknown name
// ("Other"): the reset still happens and nothing new is applied.
export function switchVendor<T>(
  sol: T,
  prevVendor: string | undefined,
  nextVendor: string,
  table: Record<string, VendorDefaultEntry<T>>,
  generic: T,
  valuesOf: ValuesOf<T> = storedValues,
): T {
  const prev = prevVendor ? table[prevVendor] : undefined;
  const reset = { ...sol } as Record<string, unknown>;
  if (prev && prevVendor !== nextVendor) {
    const genericValues = generic as Record<string, unknown>;
    const current = sol as Record<string, unknown>;
    for (const [key, value] of Object.entries(valuesOf(prev))) {
      if (sameValue(current[key], value)) reset[key] = genericValues[key];
    }
  }
  return withVendorDefaults(reset as T, nextVendor, table, valuesOf);
}

// A single field's provenance across whichever vendor entries could have
// set it. Only returns metadata if the field's CURRENT value still matches
// what that vendor's research produced; if the user has since edited it,
// showing "sourced" next to a number they typed themselves would be a worse
// lie than showing nothing, so it deliberately goes stale the moment the
// value changes. `derivedMeta` explains a value an entry derives rather than
// stores (see ValuesOf).
export function fieldSourceInfo<T>(
  key: keyof T,
  currentValue: unknown,
  entries: (VendorDefaultEntry<T> | undefined)[],
  valuesOf: ValuesOf<T> = storedValues,
  derivedMeta?: (key: keyof T, entry: VendorDefaultEntry<T>, value: unknown) => FieldMeta | null,
): FieldMeta | null {
  for (const entry of entries) {
    if (!entry) continue;
    const values = valuesOf(entry) as Record<string, unknown>;
    if (!(key in values)) continue;
    if (!sameValue(values[key as string], currentValue)) continue;
    return entry.fieldMeta[key as string] ?? derivedMeta?.(key, entry, currentValue) ?? null;
  }
  return null;
}

export interface ConfidenceSummary {
  sourced: number;
  total: number;
  label: string;
  tone: "sourced" | "mixed" | "estimated" | "none";
}

// Collapses a vendor's per-field fieldMeta into a single at-a-glance figure.
// `total: 0` (no entry at all, or "Other") means generic, not-vendor-specific
// defaults, not zero sourced fields.
//
// `headlineField`, if given, is checked for presence in `values` first and
// short-circuits to a distinct "not researched" state if it's missing;
// otherwise a vendor whose price field was never researched could still show
// a reassuring "3/3 sourced" based only on the fields that *are* present.
export function confidenceSummary<T>(
  vendorName: string,
  table: Record<string, VendorDefaultEntry<T>>,
  headlineField?: keyof T,
): ConfidenceSummary {
  const entry = table[vendorName];
  if (!entry) return { sourced: 0, total: 0, label: "Generic defaults, not vendor-specific", tone: "none" };
  const metas = Object.values(entry.fieldMeta);
  const total = metas.length;
  const sourced = metas.filter((m) => m.status === "sourced").length;
  if (headlineField !== undefined && !(headlineField in entry.values)) {
    return { sourced, total, label: "Price not researched, using generic default", tone: "estimated" };
  }
  const tone: ConfidenceSummary["tone"] = total === 0 ? "none" : sourced === total ? "sourced" : sourced === 0 ? "estimated" : "mixed";
  return { sourced, total, label: total === 0 ? "Generic defaults, not vendor-specific" : `${sourced}/${total} fields sourced`, tone };
}
