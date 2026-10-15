"use client";

import { List, Stack, Text } from "@mantine/core";
import { TEXT_MUTED } from "../lib/colors";

// Plain-language summary of how lib/model.ts computes a comparison. Keep this
// in step with the model: every change to the cost math should update the
// matching line here (and the README's cost-model section).
const NOTES: string[] = [
  "Year 0 is the buildout. A solution marked incumbent pays nothing then, since it's already installed. Every other solution pays its hardware, first license term or perpetual license, and install or onboarding labor.",
  "Whether a newly deployed solution buys cameras depends on the scenario: on a new site every one does, and with reusable cameras only those set to replace them do.",
  "Hardware refreshes repeat on each solution's refresh cycle. The incumbent's first refresh follows its \"years until next refresh\"; a newly bought system's comes one full cycle after year 0.",
  "Cloud license terms are paid as a lump sum at purchase and at each renewal. The license price scales with retention along a gentle curve, (days/30)^0.4, since storage is only part of what it covers.",
  "On-prem storage is sized from bitrate, retention, and overhead, multiplied for RAID redundancy, and billed in whole drives.",
  "Cameras fail at a steady rate set by each fleet's half-life. A failure under warranty costs only replacement labor. Replacement cameras are assumed not to fail again within the horizon.",
  "On-prem support renewals and all other recurring costs are charged every year, and every recurring cost grows by the annual escalation rate.",
  "Purchases with a fixed service life that runs past the horizon are credited for their unused share in the final year, unless that option is turned off.",
  "Admin and investigation labor are estimates of staff time, shown separately from cash costs.",
  "Defaults are directional placeholders, not quotes. This tool is not affiliated with or endorsed by any vendor named here.",
];

export default function MethodologyNotes() {
  return (
    <Stack gap={4} maw={860}>
      <Text size="xs" fw={700} c={TEXT_MUTED}>How this is calculated</Text>
      <List size="xs" c={TEXT_MUTED} spacing={2}>
        {NOTES.map((n) => <List.Item key={n}>{n}</List.Item>)}
      </List>
    </Stack>
  );
}
