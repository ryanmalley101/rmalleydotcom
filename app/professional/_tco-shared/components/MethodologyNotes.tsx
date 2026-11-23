"use client";

import { Accordion, List, Text } from "@mantine/core";
import { TEXT_MUTED } from "../lib/colors";

// The calculation notes under the results, collapsed: they're reference
// material for anyone checking the math, not something to read every time.
export default function MethodologyNotes({ notes }: { notes: string[] }) {
  return (
    <Accordion variant="contained" maw={900}>
      <Accordion.Item value="notes">
        <Accordion.Control>
          <Text size="sm" fw={500}>How this is calculated <Text span size="xs" c={TEXT_MUTED}>({notes.length} notes)</Text></Text>
        </Accordion.Control>
        <Accordion.Panel>
          <List size="xs" c={TEXT_MUTED} spacing={4}>
            {notes.map((n) => <List.Item key={n}>{n}</List.Item>)}
          </List>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
