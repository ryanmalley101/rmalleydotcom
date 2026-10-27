"use client";

import { useState, useSyncExternalStore } from "react";
import { ActionIcon, Anchor, Divider, Group, List, Modal, Paper, Stack, Text, Title, Button, UnstyledButton } from "@mantine/core";
import { ArrowRight, Trash2 } from "lucide-react";
import { TEXT_MUTED } from "../lib/colors";
import type { SavedComparisonsStore } from "../lib/savedComparisons";

export interface Highlight { icon: React.ElementType; text: string }

// A calculator's landing screen: what it does, how it calculates, and any
// comparisons saved in this browser.
export default function IntroScreen<State>({
  title, description, highlights, notes, store, onStart, onLoadSaved,
}: {
  title: string;
  description: string;
  highlights: Highlight[];
  notes: string[];
  store: SavedComparisonsStore<State>;
  onStart: () => void;
  onLoadSaved: (state: State) => void;
}) {
  // useSyncExternalStore (not useState+useEffect) because localStorage is an
  // external store the server can't see: the server snapshot is always an
  // empty array, matching what SSR renders, and the real client snapshot only
  // takes over post-hydration — avoids the hydration mismatch a populated
  // useState initializer would cause, without a synchronous setState-in-effect.
  const saved = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const [howOpen, setHowOpen] = useState(false);

  function handleDelete(id: string) {
    store.remove(id);
  }

  return (
    <Stack align="center" gap="lg" py={{ base: 40, sm: 80 }} maw={560} mx="auto" ta="center">
      <Title order={1} fz={{ base: "1.75rem", sm: "2.25rem" }}>
        {title}
      </Title>
      <Text c={TEXT_MUTED} size="lg">
        {description}
      </Text>
      <Stack gap={6} align="flex-start">
        {highlights.map(({ icon: Icon, text }) => (
          <Group gap={8} key={text} wrap="nowrap">
            <Icon size={15} color={TEXT_MUTED} style={{ flexShrink: 0 }} />
            <Text c={TEXT_MUTED} size="sm" ta="left">{text}</Text>
          </Group>
        ))}
      </Stack>
      <Button size="lg" rightSection={<ArrowRight size={18} />} onClick={onStart}>
        Start
      </Button>
      <Anchor component="button" type="button" size="sm" onClick={() => setHowOpen(true)}>
        How the numbers are calculated
      </Anchor>
      <Modal opened={howOpen} onClose={() => setHowOpen(false)} title="How the numbers are calculated" size="lg">
        <List size="sm" spacing={6}>
          {notes.map((n) => <List.Item key={n}>{n}</List.Item>)}
        </List>
      </Modal>
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
