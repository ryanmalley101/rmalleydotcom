"use client";

import { useState } from "react";
import { Anchor, Button, Group, Popover, ScrollArea, Stack, Text } from "@mantine/core";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import type { ChecklistItem } from "../lib/checklist";
import { TEXT_MUTED } from "../lib/colors";

// "Before you share this", as one button in the verdict card rather than a
// list at the top of the page: with generic defaults it's never empty, and a
// block of warnings beside the headline number reads as noise. Items are
// grouped by solution, each with a link to the input it's about; the cost
// editor also marks those fields where they're edited.
export default function ShareChecklist({ items, nameA, nameB, onGoTo }: {
  items: ChecklistItem[];
  nameA: string;
  nameB: string;
  onGoTo: (item: ChecklistItem) => void;
}) {
  const [opened, setOpened] = useState(false);

  if (items.length === 0) {
    return (
      <Group gap={6}>
        <CheckCircle2 size={14} color="var(--mantine-color-teal-5)" />
        <Text size="xs" c={TEXT_MUTED}>Nothing in the inputs needs checking before you share this.</Text>
      </Group>
    );
  }

  const groups = [
    { title: nameA, items: items.filter((i) => i.side === "a") },
    { title: nameB, items: items.filter((i) => i.side === "b") },
    { title: "Both solutions", items: items.filter((i) => !i.side) },
  ].filter((g) => g.items.length > 0);

  return (
    <Popover opened={opened} onChange={setOpened} width="min(460px, calc(100vw - 32px))" position="bottom-start" withArrow shadow="md"
      middlewares={{ flip: false, shift: true }}>
      <Popover.Target>
        <Button
          size="xs" variant="light" color="yellow" onClick={() => setOpened((o) => !o)}
          leftSection={<AlertTriangle size={14} />}
        >
          {items.length} {items.length === 1 ? "input" : "inputs"} to check before sharing
        </Button>
      </Popover.Target>
      <Popover.Dropdown p="sm">
        <ScrollArea.Autosize mah="60vh" type="auto">
          <Stack gap="sm">
            <Text size="sm" fw={600}>Before you share this</Text>
            {groups.map((g) => (
              <Stack key={g.title} gap={6}>
                <Text size="xs" fw={700} tt="uppercase" c={TEXT_MUTED} style={{ letterSpacing: 0.5 }}>{g.title}</Text>
                {g.items.map((item) => (
                  <Group key={item.text} gap={8} wrap="nowrap" align="flex-start">
                    <AlertTriangle size={12} color="var(--mantine-color-yellow-5)" style={{ flexShrink: 0, marginTop: 3 }} />
                    <Stack gap={2}>
                      <Text size="xs">{item.text}</Text>
                      <Anchor
                        component="button" type="button" size="xs" style={{ alignSelf: "flex-start" }}
                        onClick={() => { setOpened(false); onGoTo(item); }}
                      >
                        <Group gap={4} wrap="nowrap" component="span">
                          {item.fields?.length ? "Go to the field" : item.tab === "impact" ? "Go to business impact" : item.tab === "scenario" ? "Go to the scenario" : "Go to the costs"}
                          <ArrowRight size={12} />
                        </Group>
                      </Anchor>
                    </Stack>
                  </Group>
                ))}
              </Stack>
            ))}
          </Stack>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
