"use client";

import { List, Paper, Stack, Text } from "@mantine/core";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { TEXT_MUTED } from "../lib/colors";

// "Before you share this": each calculator builds its own items from the
// comparison; an empty list means nothing stood out.
export default function ShareChecklist({ items }: { items: string[] }) {
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
