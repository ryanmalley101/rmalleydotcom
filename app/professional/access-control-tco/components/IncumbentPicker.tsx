"use client";

import { Group, NumberInput, Radio, Stack } from "@mantine/core";
import { Cable, Hourglass } from "lucide-react";
import type { ScenarioInputs } from "../lib/model";
import { IconLabel, IncumbentRadio } from "../../_tco-shared/components/FormParts";

const WIRED_HELP =
  "Yes: the doors already have locks, sensors, and cabling for access control. That hardware stays whoever wins, and each newly deployed solution's own settings decide whether it keeps the readers and controllers. No: new construction, or doors that never had access control, so every newly deployed solution buys door hardware, readers, and controllers, and pays a full install.";

const AGE_HELP =
  "How many years the readers and controllers already on site have been installed. Their warranty is counted from this age. Applies to the incumbent and to any solution that keeps that hardware. 0 treats them as brand new.";

// Asked up front: incumbency and whether the doors are wired change every
// year-0 cost, and which fields later steps show.
export default function IncumbentPicker({ scenario, onScenarioChange, nameA, nameB }: {
  scenario: ScenarioInputs; onScenarioChange: (v: ScenarioInputs) => void; nameA: string; nameB: string;
}) {
  const wired = scenario.existingDoorsInstalled !== false;
  return (
    <Stack gap="md">
      <IncumbentRadio value={scenario.incumbent} onChange={(incumbent) => onScenarioChange({ ...scenario, incumbent })} nameA={nameA} nameB={nameB} />
      <Stack gap={8}>
        <IconLabel icon={Cable} label="Are the doors already wired for access control?" help={WIRED_HELP} fw={500} />
        <Radio.Group
          value={wired ? "yes" : "no"}
          onChange={(v) => onScenarioChange({ ...scenario, existingDoorsInstalled: v === "yes" })}
        >
          <Group gap="lg">
            <Radio value="yes" label="Yes, doors are already wired" />
            <Radio value="no" label="No, new doors or new construction" />
          </Group>
        </Radio.Group>
      </Stack>
      {wired && (
        <NumberInput
          label={<IconLabel icon={Hourglass} label="Age of the existing readers and controllers (yrs)" help={AGE_HELP} />}
          value={scenario.existingHardwareAgeYears ?? 0}
          min={0} max={30} step={1} w={320}
          onChange={(v) => onScenarioChange({ ...scenario, existingHardwareAgeYears: typeof v === "number" ? v : 0 })}
        />
      )}
    </Stack>
  );
}
