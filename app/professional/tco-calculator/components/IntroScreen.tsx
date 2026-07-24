"use client";

import { Button, Stack, Text, Title } from "@mantine/core";
import { ArrowRight } from "lucide-react";
import { TEXT_MUTED } from "../lib/colors";

export default function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <Stack align="center" gap="lg" py={{ base: 40, sm: 80 }} maw={560} mx="auto" ta="center">
      <Title order={1} fz={{ base: "1.75rem", sm: "2.25rem" }}>
        Video Surveillance TCO Calculator
      </Title>
      <Text c={TEXT_MUTED} size="lg">
        Compare the total cost of ownership between two video-management deployments, cloud, on-prem,
        or a mix, over a multi-year horizon.
      </Text>
      <Button size="lg" rightSection={<ArrowRight size={18} />} onClick={onStart}>
        Start
      </Button>
      <Text c={TEXT_MUTED} size="xs" maw={420}>
        Independent estimate tool. Not affiliated with or endorsed by any vendor named here.
      </Text>
    </Stack>
  );
}
