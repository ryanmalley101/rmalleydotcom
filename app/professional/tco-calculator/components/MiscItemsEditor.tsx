"use client";

import { ActionIcon, Button, Group, NumberInput, SegmentedControl, Stack, Text, TextInput } from "@mantine/core";
import { Plus, Trash2 } from "lucide-react";
import type { MiscCostItem, MiscItemTiming } from "../lib/model";
import { TEXT_MUTED } from "../lib/colors";

// Free-form list editor for a solution's miscItems — the escape valve for
// whatever a real quote (or a value-justification argument) contains that
// doesn't fit any category above, without this tool having to name/model
// every oddball line item in advance. Each row is independently labeled and
// timed; `amount` deliberately has no `min`, unlike every other NumberInput
// in this wizard — a negative amount is a cost *offset* (a workers' comp
// claim reduction, a productivity credit, anything that reduces TCO), the
// same mechanism as a misc cost, just the other sign.
export default function MiscItemsEditor({ items, onChange }: { items: MiscCostItem[]; onChange: (items: MiscCostItem[]) => void }) {
  const safeItems = items ?? [];

  const update = (id: string, patch: Partial<MiscCostItem>) =>
    onChange(safeItems.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const remove = (id: string) => onChange(safeItems.filter((it) => it.id !== id));
  const add = () =>
    onChange([...safeItems, { id: crypto.randomUUID(), label: "", amount: 0, timing: "upfront" }]);

  return (
    <Stack gap="xs" style={{ gridColumn: "1 / -1" }}>
      <Text size="xs" c={TEXT_MUTED}>
        Add your own cost or savings line items — enter a negative amount for a cost offset (e.g. a
        workers&apos; comp claim reduction). Choose whether each applies once at deployment or every year.
      </Text>
      {safeItems.map((item) => (
        <Group key={item.id} gap="xs" wrap="nowrap" align="flex-end">
          <TextInput
            label="Label"
            placeholder="e.g. Workers comp claim reduction"
            value={item.label}
            onChange={(e) => update(item.id, { label: e.currentTarget.value })}
            style={{ flex: 2, minWidth: 0 }}
          />
          <NumberInput
            label="Amount ($)"
            placeholder="0"
            value={item.amount}
            onChange={(v) => update(item.id, { amount: typeof v === "number" ? v : 0 })}
            thousandSeparator=","
            style={{ flex: 1, minWidth: 0 }}
          />
          <SegmentedControl
            value={item.timing}
            onChange={(v) => update(item.id, { timing: v as MiscItemTiming })}
            data={[
              { label: "Upfront", value: "upfront" },
              { label: "Recurring", value: "recurring" },
            ]}
          />
          <ActionIcon color="red" variant="subtle" onClick={() => remove(item.id)} aria-label="Remove item" mb={4}>
            <Trash2 size={16} />
          </ActionIcon>
        </Group>
      ))}
      <Button variant="light" size="xs" leftSection={<Plus size={14} />} onClick={add} style={{ alignSelf: "flex-start" }}>
        Add misc item
      </Button>
    </Stack>
  );
}
