"use client";

import { List, Stack, Text } from "@mantine/core";
import { TEXT_MUTED } from "../lib/colors";
export default function MethodologyNotes({ notes }: { notes: string[] }) {
  return (
    <Stack gap={4} maw={860}>
      <Text size="xs" fw={700} c={TEXT_MUTED}>How this is calculated</Text>
      <List size="xs" c={TEXT_MUTED} spacing={2}>
        {notes.map((n) => <List.Item key={n}>{n}</List.Item>)}
      </List>
    </Stack>
  );
}
