"use client";

import { Accordion, NumberInput, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { Activity, Building2, Camera, CalendarRange, Database, DollarSign, Percent, Search, TrendingUp, Truck, Zap } from "lucide-react";
import type { ScenarioInputs } from "../lib/model";
import { TEXT_MUTED } from "../lib/colors";
import InfoLabel from "./InfoLabel";

const RETENTION_LABEL = (
  <InfoLabel
    label="Retention (days)"
    help="How many days of footage are kept before it's overwritten. Longer retention needs more storage, which raises cost, but not in a straight line: storage is only part of what a license or server covers, and tends to get cheaper per unit at higher volumes."
  />
);

const NPV_LABEL = (
  <InfoLabel
    label="NPV discount (%)"
    help="How much future spending is discounted to reflect that a dollar spent later is worth less than a dollar spent today. Higher rates shrink the weight of costs further out in the horizon; 0% treats every year's dollars the same."
  />
);

const ESCALATION_LABEL = (
  <InfoLabel
    label="Annual cost escalation (%)"
    help="How much recurring costs (subscriptions, labor, truck rolls, refreshes) grow each year. NPV discounting alone only accounts for the time value of money, not that prices themselves tend to rise over a long horizon."
  />
);

const icon = (Icon: React.ElementType) => <Icon size={15} />;

export default function ScenarioStep({ value, onChange }: { value: ScenarioInputs; onChange: (v: ScenarioInputs) => void }) {
  const set = <K extends keyof ScenarioInputs>(key: K, v: ScenarioInputs[K]) => onChange({ ...value, [key]: v });
  const num = (v: unknown) => (typeof v === "number" ? v : 0);

  return (
    <Stack gap="lg">
      <div>
        <Title order={4} mb={4}>Key variables</Title>
        <Text size="sm" c={TEXT_MUTED}>
          Shared facts for both solutions. Defaults are placeholders, adjust as needed.
        </Text>
      </div>
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg">
        <NumberInput label="Camera count" leftSection={icon(Camera)} value={value.cameras} min={1} thousandSeparator=","
          onChange={(v) => set("cameras", num(v))} />
        <NumberInput label="Sites / buildings" leftSection={icon(Building2)} value={value.sites} min={1} thousandSeparator=","
          onChange={(v) => set("sites", num(v))} />
        <NumberInput label={RETENTION_LABEL} leftSection={icon(Database)} value={value.retentionDays} min={1}
          onChange={(v) => set("retentionDays", num(v))} />
        <NumberInput label="Horizon (years)" leftSection={icon(CalendarRange)} value={value.horizonYears} min={1} max={30}
          onChange={(v) => set("horizonYears", num(v))} />
        <NumberInput label="Bitrate/cam (Mbps)" leftSection={icon(Activity)} value={value.bitrateMbps} min={0.1} step={0.5} decimalScale={1}
          onChange={(v) => set("bitrateMbps", num(v))} />
        <NumberInput label="Investigations/mo" leftSection={icon(Search)} value={value.investigationsPerMonth} min={0}
          onChange={(v) => set("investigationsPerMonth", num(v))} />
        <NumberInput label={NPV_LABEL} leftSection={icon(Percent)} value={value.npvDiscountPct} min={0} max={100} step={0.5} decimalScale={1}
          onChange={(v) => set("npvDiscountPct", num(v))} />
        <NumberInput label={ESCALATION_LABEL} leftSection={icon(TrendingUp)}
          value={value.annualEscalationPct} min={0} max={100} step={0.5} decimalScale={1}
          onChange={(v) => set("annualEscalationPct", num(v))} />
      </SimpleGrid>

      <Accordion variant="separated" defaultValue="rates">
        <Accordion.Item value="rates">
          <Accordion.Control>
            <Text size="sm" fw={500}>Market rates (labor, truck rolls, electricity)</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
              <NumberInput label="Admin ($/hr)" leftSection={icon(DollarSign)} value={value.adminRate} min={0} onChange={(v) => set("adminRate", num(v))} />
              <NumberInput label="Investigator ($/hr)" leftSection={icon(DollarSign)} value={value.investigatorRate} min={0} onChange={(v) => set("investigatorRate", num(v))} />
              <NumberInput label="Truck roll ($)" leftSection={icon(Truck)} value={value.truckRollCost} min={0} onChange={(v) => set("truckRollCost", num(v))} />
              <NumberInput label="Electricity ($/kWh)" leftSection={icon(Zap)} value={value.electricityRate} min={0} step={0.01} decimalScale={2}
                onChange={(v) => set("electricityRate", num(v))} />
            </SimpleGrid>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
