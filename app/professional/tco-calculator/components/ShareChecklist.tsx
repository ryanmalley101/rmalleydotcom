"use client";

import { useMemo } from "react";
import { List, Paper, Stack, Text } from "@mantine/core";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ComparisonResult, ScenarioInputs, SolutionInputs } from "../lib/model";
import { buildChecklist } from "../lib/checklist";
import { TEXT_MUTED } from "../lib/colors";

export default function ShareChecklist({ scenario, solA, solB, comparison }: {
  scenario: ScenarioInputs; solA: SolutionInputs; solB: SolutionInputs; comparison: ComparisonResult;
}) {
  const items = useMemo(() => buildChecklist(scenario, solA, solB, comparison), [scenario, solA, solB, comparison]);
  return (
    <Paper withBorder p="md" radius="md" mb="md">
      <Stack gap={6}>
        <Text size="sm" fw={600}>Before you share this</Text>
        {items.length === 0 ? (
          <Text size="xs" c={TEXT_MUTED}><CheckCircle2 size={12} style={{ verticalAlign: -2 }} /> Nothing stands out in the inputs.</Text>
        ) : (
          <List size="xs" spacing={4} icon={<AlertTriangle size={12} color="var(--mantine-color-yellow-5)" />}>
            {items.map((i) => <List.Item key={i}>{i}</List.Item>)}
          </List>
        )}
      </Stack>
    </Paper>
  );
}
