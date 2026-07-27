"use client";

import { useSyncExternalStore } from "react";
import { ActionIcon, Divider, Group, Paper, Stack, Text, Title, Button, UnstyledButton } from "@mantine/core";
import { ArrowRight, CalendarRange, Database, Share2, Trash2 } from "lucide-react";
import { TEXT_MUTED } from "../lib/colors";
import {
  getSavedComparisonsSnapshot, getSavedComparisonsServerSnapshot, subscribeSavedComparisons, deleteSavedComparison,
} from "../lib/savedComparisons";
import type { SharedState } from "../lib/shareState";

const HIGHLIGHTS = [
  { icon: Database, text: "Real vendor pricing pre-filled where it's been researched" },
  { icon: CalendarRange, text: "Model any horizon, from a 1-year pilot to a 15-year refresh cycle" },
  { icon: Share2, text: "Share a link with your numbers baked in, no login required" },
];

export default function IntroScreen({
  onStart, onLoadSaved,
}: { onStart: () => void; onLoadSaved: (state: SharedState) => void }) {
  // useSyncExternalStore (not useState+useEffect) because localStorage is an
  // external store the server can't see: the server snapshot is always an
  // empty array, matching what SSR renders, and the real client snapshot only
  // takes over post-hydration — avoids the hydration mismatch a populated
  // useState initializer would cause, without a synchronous setState-in-effect.
  const saved = useSyncExternalStore(subscribeSavedComparisons, getSavedComparisonsSnapshot, getSavedComparisonsServerSnapshot);

  function handleDelete(id: string) {
    deleteSavedComparison(id);
  }

  return (
    <Stack align="center" gap="lg" py={{ base: 40, sm: 80 }} maw={560} mx="auto" ta="center">
      <Title order={1} fz={{ base: "1.75rem", sm: "2.25rem" }}>
        Video Surveillance TCO Calculator
      </Title>
      <Text c={TEXT_MUTED} size="lg">
        Compare the true multi-year cost of two video-management deployments, cloud, on-prem, or a
        mix, not just the sticker price. Hardware, licensing, storage, admin labor, and truck rolls
        all factor in, and every assumption behind the numbers is transparent and yours to edit.
      </Text>
      <Stack gap={6} align="flex-start">
        {HIGHLIGHTS.map(({ icon: Icon, text }) => (
          <Group gap={8} key={text} wrap="nowrap">
            <Icon size={15} color={TEXT_MUTED} style={{ flexShrink: 0 }} />
            <Text c={TEXT_MUTED} size="sm" ta="left">{text}</Text>
          </Group>
        ))}
      </Stack>
      <Button size="lg" rightSection={<ArrowRight size={18} />} onClick={onStart}>
        Start
      </Button>
      <Text c={TEXT_MUTED} size="xs" maw={420}>
        Independent estimate tool. Not affiliated with or endorsed by any vendor named here.
      </Text>

      {saved.length > 0 && (
        <>
          <Divider label="Or pick up a saved comparison" labelPosition="center" w="100%" mt="md" />
          <Stack gap="xs" w="100%">
            {saved.map((s) => (
              <Paper key={s.id} withBorder p="sm" radius="md">
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <UnstyledButton onClick={() => onLoadSaved(s.state)} style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <Text size="sm" fw={600} truncate>{s.name}</Text>
                    <Text size="xs" c={TEXT_MUTED}>{new Date(s.savedAt).toLocaleDateString()}</Text>
                  </UnstyledButton>
                  <ActionIcon
                    variant="subtle" color="red" aria-label={`Delete "${s.name}"`}
                    onClick={() => handleDelete(s.id)}
                  >
                    <Trash2 size={15} />
                  </ActionIcon>
                </Group>
              </Paper>
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}
