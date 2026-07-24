"use client";

import { Radio, Group, Stack } from "@mantine/core";
import type { ScenarioInputs, IncumbentChoice } from "../lib/model";
import InfoLabel from "./InfoLabel";

const INCUMBENT_HELP =
  "The incumbent skips its year-0 buildout cost, since that hardware is already paid for. The other solution is still costed as a fresh deployment. For a cloud/hybrid solution reusing the incumbent's existing cameras, that upfront cost is usually just its connector/NVR-style appliance.";

export default function IncumbentPicker({
  scenario, onScenarioChange, nameA, nameB,
}: {
  scenario: ScenarioInputs;
  onScenarioChange: (v: ScenarioInputs) => void;
  nameA: string;
  nameB: string;
}) {
  return (
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
  );
}
