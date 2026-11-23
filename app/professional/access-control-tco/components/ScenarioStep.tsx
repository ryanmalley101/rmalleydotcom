"use client";

import { Accordion, Button, Group, NumberInput, SimpleGrid, Stack, Switch, Text, Title } from "@mantine/core";
import {
  BellRing, Building2, CalendarRange, DollarSign, DoorOpen, KeyRound, Repeat, ScanLine, TrendingUp, Truck, UserCog,
  UserMinus, Users,
} from "lucide-react";
import type { ScenarioInputs } from "../lib/model";
import { SCENARIO_FIELD_MAP } from "../lib/fields";
import { SCENARIO_PRESETS } from "../lib/presets";
import { TEXT_MUTED } from "../../_tco-shared/lib/colors";
import { IconLabel } from "../../_tco-shared/components/FormParts";

const ESCALATION_HELP: Record<"laborEscalationPct" | "hardwareEscalationPct" | "licenseEscalationPct", string> = {
  laborEscalationPct: "Yearly growth in labor and service costs: installation, replacement labor, truck rolls, staff time, and your misc items. Tends to track wages.",
  hardwareEscalationPct: "Yearly change in prices for readers, controllers, servers, door hardware, and cards bought later in the horizon.",
  licenseEscalationPct: "Yearly growth in license, subscription, support-renewal, and mobile credential prices. Check your contracts: some lock renewal pricing, others allow annual increases.",
};

const RATE_HELP: Partial<Record<keyof ScenarioInputs, string>> = {
  adminRate: "Loaded hourly cost of whoever administers the system and its cardholders.",
  operatorRate: "Loaded hourly cost of whoever looks at door alarms: a security operator, or front-desk staff.",
  truckRollCost: "What one paid site visit costs, travel included.",
};

const RESIDUAL_HELP =
  "Gives back the unused share of anything bought with a fixed service life that runs past the end of the horizon: cloud license terms and server refreshes. Straight-line over the service life, shown as its own credit line in the final year.";

type NumericKey = {
  [K in keyof ScenarioInputs]: ScenarioInputs[K] extends number ? K : never;
}[keyof ScenarioInputs];

// `showIntro` is off on the results page: the heading, the "defaults are
// placeholders" note, and the example sizes are for setting up a comparison,
// and an example size clicked there would silently resize a finished one.
export default function ScenarioStep({ value, onChange, showIntro = true }: {
  value: ScenarioInputs; onChange: (v: ScenarioInputs) => void; showIntro?: boolean;
}) {
  const field = (key: NumericKey, icon: React.ElementType, help?: string) => {
    const def = SCENARIO_FIELD_MAP[key];
    return (
      <NumberInput
        key={key}
        label={<IconLabel icon={icon} label={def.label} help={help ?? def.help} />}
        value={value[key]}
        min={def.min ?? 0}
        max={def.max}
        step={def.step}
        decimalScale={def.decimalScale}
        allowDecimal={!def.int}
        thousandSeparator=","
        onChange={(v) => onChange({ ...value, [key]: typeof v === "number" ? v : 0 })}
      />
    );
  };

  return (
    <Stack gap="lg">
      {showIntro && (
        <div>
          <Title order={4} mb={4}>Key variables</Title>
          <Text size="sm" c={TEXT_MUTED}>
            Shared facts for both solutions. Defaults are placeholders, adjust as needed.
          </Text>
          <Group gap="xs" mt="sm">
            <Text size="xs" c={TEXT_MUTED}>Example sizes:</Text>
            {SCENARIO_PRESETS.map((p) => (
              <Button key={p.id} size="compact-xs" variant="light" title={p.description} onClick={() => onChange({ ...value, ...p.values })}>
                {p.label}
              </Button>
            ))}
          </Group>
        </div>
      )}
      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="lg">
        {field("doors", DoorOpen)}
        {field("readersPerDoor", ScanLine)}
        {field("sites", Building2)}
        {field("cardholders", Users)}
        {field("turnoverPct", UserMinus)}
        {field("horizonYears", CalendarRange)}
        {/* Staff rates are up here rather than under Advanced: estimated staff
            time is often most of a total, and every staff-hour input is
            multiplied by one of these. */}
        {field("adminRate", UserCog, RATE_HELP.adminRate)}
        {field("operatorRate", DollarSign, RATE_HELP.operatorRate)}
      </SimpleGrid>

      {/* Collapsed by default: real inputs, but not ones a first pass at a
          comparison needs. */}
      <Accordion variant="separated">
        <Accordion.Item value="advanced">
          <Accordion.Control>
            <Text size="sm" fw={500}>Advanced (cardholder activity, door alarms, truck rolls, price escalation)</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
              {field("accessChangesPerCardholderYr", Repeat)}
              {field("lostCredentialPct", KeyRound)}
              {field("doorAlarmsPerDoorMonth", BellRing)}
              {field("truckRollCost", Truck, RATE_HELP.truckRollCost)}
              {field("laborEscalationPct", TrendingUp, ESCALATION_HELP.laborEscalationPct)}
              {field("hardwareEscalationPct", TrendingUp, ESCALATION_HELP.hardwareEscalationPct)}
              {field("licenseEscalationPct", TrendingUp, ESCALATION_HELP.licenseEscalationPct)}
            </SimpleGrid>
            <Switch
              mt="md"
              checked={value.creditResidualValue !== false}
              onChange={(e) => onChange({ ...value, creditResidualValue: e.currentTarget.checked })}
              label={<IconLabel icon={CalendarRange} label="Credit unused service life at the end of the horizon" help={RESIDUAL_HELP} />}
            />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
