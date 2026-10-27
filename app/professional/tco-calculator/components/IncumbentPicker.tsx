"use client";

import { NumberInput, Radio, Group, Stack } from "@mantine/core";
import type { ScenarioInputs } from "../lib/model";
import InfoLabel from "../../_tco-shared/components/InfoLabel";
import { IncumbentRadio } from "../../_tco-shared/components/FormParts";

const FLEET_AGE_HELP =
  "How many years the cameras already on site have been installed. Their warranty is counted from this age, so an older fleet's failures cost the camera as well as the labor sooner. Applies to the incumbent and to any solution that keeps those cameras. 0 treats them as brand new.";

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
      <IncumbentRadio value={scenario.incumbent} onChange={(incumbent) => onScenarioChange({ ...scenario, incumbent })} nameA={nameA} nameB={nameB} />
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
      {(scenario.incumbent !== "none" || scenario.existingCamerasReusable !== false) && (
        <NumberInput
          label={<InfoLabel label="Age of the existing cameras (yrs)" help={FLEET_AGE_HELP} />}
          value={scenario.existingFleetAgeYears ?? 0}
          min={0} max={30} step={1} w={260}
          onChange={(v) => onScenarioChange({ ...scenario, existingFleetAgeYears: typeof v === "number" ? v : 0 })}
        />
      )}
    </Stack>
  );
}
