"use client";

import { Box, Group, SegmentedControl } from "@mantine/core";
import { Camera } from "lucide-react";
import type { OnpremCameraStrategy, ScenarioInputs, SolutionInputs } from "../lib/model";
import { TEXT_MUTED } from "../lib/colors";
import InfoLabel from "./InfoLabel";

const HELP =
  "Keep the cameras already on site and add them to this VMS, paying onboarding labor only, or buy a new camera fleet at year 0. Only shown when the scenario says existing cameras can be reused; otherwise a newly deployed solution always buys cameras.";

// On-prem counterpart of the cloud "migration strategy" control. Renders
// nothing when it can't matter: on a new site every newly deployed side buys
// cameras regardless.
export default function CameraStrategyControl({ sol, scenario, onChange, compact }: {
  sol: SolutionInputs; scenario: ScenarioInputs; onChange: (v: SolutionInputs) => void; compact?: boolean;
}) {
  if (sol.model !== "onprem" || scenario.existingCamerasReusable === false) return null;
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <Box mb={4}>
        <Group gap={6}>
          <Camera size={15} />
          <InfoLabel
            label="Cameras" help={HELP}
            size={compact ? "var(--mantine-font-size-xs)" : "var(--mantine-font-size-sm)"}
            color={compact ? TEXT_MUTED : undefined}
          />
        </Group>
      </Box>
      <SegmentedControl
        fullWidth
        value={sol.onpremCameraStrategy ?? "reuse"}
        onChange={(v) => onChange({ ...sol, onpremCameraStrategy: v as OnpremCameraStrategy })}
        data={[
          { label: "Reuse existing cameras", value: "reuse" },
          { label: "Buy new cameras", value: "replace" },
        ]}
      />
    </div>
  );
}
