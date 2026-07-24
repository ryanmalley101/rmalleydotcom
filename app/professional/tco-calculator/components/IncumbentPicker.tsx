"use client";

import { Radio, Group, Stack, Text } from "@mantine/core";
import type { ScenarioInputs, IncumbentChoice } from "../lib/model";
import { TEXT_MUTED } from "../lib/colors";

export default function IncumbentPicker({
  scenario, onScenarioChange, nameA, nameB,
}: {
  scenario: ScenarioInputs;
  onScenarioChange: (v: ScenarioInputs) => void;
  nameA: string;
  nameB: string;
}) {
  return (
    <Stack gap={6}>
      <Text size="sm" fw={500}>Is either solution already deployed?</Text>
      <Text size="xs" c={TEXT_MUTED}>
        The incumbent skips its year-0 buildout cost, since that hardware is already paid for. The other
        solution is still costed as a fresh deployment. For a cloud/hybrid solution reusing the incumbent&apos;s
        existing cameras, that upfront cost is usually just its connector/NVR-style appliance.
      </Text>
      <Radio.Group
        value={scenario.incumbent}
        onChange={(v) => onScenarioChange({ ...scenario, incumbent: v as IncumbentChoice })}
      >
        <Group gap="lg" mt={4}>
          <Radio value="none" label="Neither (fresh comparison)" />
          <Radio value="a" label={`${nameA} is incumbent`} />
          <Radio value="b" label={`${nameB} is incumbent`} />
        </Group>
      </Radio.Group>
    </Stack>
  );
}
