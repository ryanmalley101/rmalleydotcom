// The "Before you share this" checklist's item shape, shared by both
// calculators' lib/checklist.ts. Structured rather than plain sentences so
// the results page can group items by solution, mark the exact fields an
// item is about, and jump to where each one gets fixed.

// The results page's input tabs.
export type InputTab = "scenario" | "costs" | "impact";

export interface ChecklistItem {
  text: string;
  // The solution the item is about, if just one; items are grouped by it.
  side?: "a" | "b";
  // That solution's fields the item flags. Each gets a warning mark in the
  // cost editor, and the first is where "go to" lands.
  fields?: string[];
  // Where the inputs behind it are edited.
  tab: InputTab;
}

// The fields flagged for one solution, each with the item text explaining why.
export function flaggedFields(items: ChecklistItem[], side: "a" | "b"): Map<string, string> {
  const flagged = new Map<string, string>();
  for (const item of items) {
    if (item.side !== side) continue;
    for (const f of item.fields ?? []) if (!flagged.has(f)) flagged.set(f, item.text);
  }
  return flagged;
}

// DOM id of a solution field's input in the cost editor, for "go to".
export const fieldDomId = (side: "a" | "b", field: string) => `tco-field-${side}-${field}`;
