"use client";

import { Group, Stack, Text, Title, Button } from "@mantine/core";
import { ArrowRight, CalendarRange, Database, Share2 } from "lucide-react";
import { TEXT_MUTED } from "../lib/colors";

const HIGHLIGHTS = [
  { icon: Database, text: "Real vendor pricing pre-filled where it's been researched" },
  { icon: CalendarRange, text: "Model any horizon, from a 1-year pilot to a 15-year refresh cycle" },
  { icon: Share2, text: "Share a link with your numbers baked in, no login required" },
];

export default function IntroScreen({ onStart }: { onStart: () => void }) {
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
    </Stack>
  );
}
