"use client";

import { Switch } from "@mantine/core";
import type { SolutionInputs } from "../lib/model";
import { withAnalytics } from "../lib/defaults";
import InfoLabel from "./InfoLabel";

const HELP =
  "Whether this on-prem solution includes AI video search (people and vehicle search, analytics). Off: no analytics costs, and investigations take the slower default time. On: adds the analytics hardware and software below, and moves hours per investigation to the faster with-search default. Cloud solutions are assumed to bundle search in their license.";

// On-prem only: the cost of analytics and its benefit (faster
// investigations) switch on together. Renders nothing for cloud.
export default function AnalyticsToggle({ sol, onChange }: { sol: SolutionInputs; onChange: (v: SolutionInputs) => void }) {
  if (sol.model !== "onprem") return null;
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <Switch
        checked={sol.analyticsEnabled === true}
        onChange={(e) => onChange(withAnalytics(sol, e.currentTarget.checked))}
        label={<InfoLabel label="Includes AI video search (analytics)" help={HELP} />}
      />
    </div>
  );
}
