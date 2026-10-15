"use client";

import { List, Stack, Text } from "@mantine/core";
import { TEXT_MUTED } from "../lib/colors";
import { METHODOLOGY_NOTES } from "../lib/methodology";


export default function MethodologyNotes() {
  return (
    <Stack gap={4} maw={860}>
      <Text size="xs" fw={700} c={TEXT_MUTED}>How this is calculated</Text>
      <List size="xs" c={TEXT_MUTED} spacing={2}>
        {METHODOLOGY_NOTES.map((n) => <List.Item key={n}>{n}</List.Item>)}
      </List>
    </Stack>
  );
}
