"use client";

import { Card, SimpleGrid, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import { SHAPE_OPTIONS } from "../lib/defaults";
import { TEXT_MUTED } from "../lib/colors";

export default function ShapeStep({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  return (
    <Stack gap="md">
      <div>
        <Title order={4} mb={4}>What are you comparing?</Title>
        <Text size="sm" c={TEXT_MUTED}>
          Pick the shape of the comparison. Either side can represent any vendor, the wizard just sets up
          the cost structure that matches how that kind of deployment is typically priced.
        </Text>
      </div>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {SHAPE_OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <UnstyledButton key={opt.id} onClick={() => onChange(opt.id)}>
              <Card
                withBorder
                padding="lg"
                radius="md"
                h="100%"
                style={{
                  borderColor: selected ? "var(--mantine-primary-color-filled)" : undefined,
                  borderWidth: selected ? 2 : 1,
                }}
              >
                <Stack gap="xs" h="100%">
                  <Text fw={600}>{opt.label}</Text>
                  <Text size="sm" c={TEXT_MUTED}>{opt.description}</Text>
                  <Stack gap={2} mt="sm">
                    <Text size="xs" fw={700} tt="uppercase" c={TEXT_MUTED} style={{ letterSpacing: 0.5 }}>
                      Often cited as strengths
                    </Text>
                    {opt.pros.map((p) => (
                      <Text key={p} size="xs" c={TEXT_MUTED}>&bull; {p}</Text>
                    ))}
                  </Stack>
                  <Stack gap={2} mt="xs">
                    <Text size="xs" fw={700} tt="uppercase" c={TEXT_MUTED} style={{ letterSpacing: 0.5 }}>
                      Often cited as tradeoffs
                    </Text>
                    {opt.cons.map((c) => (
                      <Text key={c} size="xs" c={TEXT_MUTED}>&bull; {c}</Text>
                    ))}
                  </Stack>
                </Stack>
              </Card>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
