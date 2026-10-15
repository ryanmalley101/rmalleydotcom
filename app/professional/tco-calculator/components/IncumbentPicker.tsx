"use client";

import { Radio, Group, Stack } from "@mantine/core";
import type { ScenarioInputs, IncumbentChoice } from "../lib/model";
import InfoLabel from "./InfoLabel";

const INCUMBENT_HELP =
  "The incumbent skips its year-0 buildout cost, since that hardware is already paid for. The other solution is still costed as a fresh deployment.";

const EXISTING_CAMERAS_HELP =
  "Yes: a newly deployed solution can keep the cameras already on site, through a cloud connector or by adding them to a new on-prem VMS, and each solution's own setting decides whether it does. No: a new site, or cameras that have to go, so every newly deployed solution buys its full camera fleet at year 0.";

export default function IncumbentPicker({
  scenario, onScenarioChange, nameA, nameB,
}: {
  scenario: ScenarioInputs;
  onScenarioChange: (v: ScenarioInputs) => void;
  nameA: string;
  nameB: string;
}) {
  return (
    <Stack gap="md">
      <Stack gap={8}>
        <InfoLabel label="Is either solution already deployed?" help={INCUMBENT_HELP} fw={500} />
        <Radio.Group
          value={scenario.incumbent}
          onChange={(v) => onScenarioChange({ ...scenario, incumbent: v as IncumbentChoice })}
        >
          <Group gap="lg">
            <Radio value="none" label="Neither (fresh comparison)" />
            <Radio value="a" label={`${nameA} is incumbent`} />
            <Radio value="b" label={`${nameB} is incumbent`} />
          </Group>
        </Radio.Group>
      </Stack>
      <Stack gap={8}>
        <InfoLabel label="Can the existing cameras be reused?" help={EXISTING_CAMERAS_HELP} fw={500} />
        <Radio.Group
          value={scenario.existingCamerasReusable === false ? "no" : "yes"}
          onChange={(v) => onScenarioChange({ ...scenario, existingCamerasReusable: v === "yes" })}
        >
          <Group gap="lg">
            <Radio value="yes" label="Yes, cameras are already installed" />
            <Radio value="no" label="No, new cameras are needed" />
          </Group>
        </Radio.Group>
      </Stack>
    </Stack>
  );
}
