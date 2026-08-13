"use client";

import { Accordion, NumberInput, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  Activity, Building2, Camera, CalendarClock, CalendarRange, Database, DollarSign,
  HardDrive, Layers, Router, Search, Server, TrendingUp, Truck, Zap,
} from "lucide-react";
import type { ScenarioInputs } from "../lib/model";
import { TEXT_MUTED } from "../lib/colors";
import InfoLabel from "./InfoLabel";

const RETENTION_LABEL = (
  <InfoLabel
    label="Retention (days)"
    help="How many days of footage are kept before it's overwritten. Longer retention needs more storage, which raises cost, but not in a straight line: storage is only part of what a license or server covers, and tends to get cheaper per unit at higher volumes."
  />
);

const ESCALATION_LABEL = (
  <InfoLabel
    label="Annual cost escalation (%)"
    help="How much recurring costs (subscriptions, labor, truck rolls, refreshes) grow each year, since prices don't tend to hold flat over a long horizon."
  />
);

const CONNECTOR_BUFFER_HELP =
  "How many days of footage a cloud connector/NVR-style appliance is assumed to hold locally before/regardless of cloud sync — not the full cloud retention window, just a short rolling buffer for outage resilience. Drives the connector's own drive-power cost in \"Power/facilities\".";

const STORAGE_OVERHEAD_HELP =
  "Multiplier on top of the raw video-bitrate math for metadata/audio/keyframe-indexing overhead beyond the encoded video stream itself. Feeds on-prem storage sizing (cost and power draw) and the cloud connector's local-buffer sizing. 1.3 (30% overhead) is a general placeholder — some VMSes run leaner or heavier than this.";

const SPARE_SERVERS_HELP =
  "On-prem recording servers bought beyond whatever capacity actually requires, as hot-spare/headroom. Applies once per solution, not once per site.";

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
      </SimpleGrid>

      {/* Collapsed by default, deliberately: escalation, market rates, electricity, and
          the per-device wattage assumptions are all real inputs, but not ones a first
          pass at a comparison needs — burying them behind one accordion keeps the main
          form to the handful of facts that actually define the comparison. */}
      <Accordion variant="separated">
        <Accordion.Item value="advanced">
          <Accordion.Control>
            <Text size="sm" fw={500}>Advanced (escalation, market rates, electricity)</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
              <NumberInput label={ESCALATION_LABEL} leftSection={icon(TrendingUp)}
                value={value.annualEscalationPct} min={0} max={100} step={0.5} decimalScale={1}
                onChange={(v) => set("annualEscalationPct", num(v))} />
              <NumberInput label="Admin ($/hr)" leftSection={icon(DollarSign)} value={value.adminRate} min={0} onChange={(v) => set("adminRate", num(v))} />
              <NumberInput label="Investigator ($/hr)" leftSection={icon(DollarSign)} value={value.investigatorRate} min={0} onChange={(v) => set("investigatorRate", num(v))} />
              <NumberInput label="Truck roll ($)" leftSection={icon(Truck)} value={value.truckRollCost} min={0} onChange={(v) => set("truckRollCost", num(v))} />
              <NumberInput label="Electricity ($/kWh)" leftSection={icon(Zap)} value={value.electricityRate} min={0} step={0.01} decimalScale={2}
                onChange={(v) => set("electricityRate", num(v))} />
              <NumberInput label="Server watts (W/server)" leftSection={icon(Server)} value={value.serverWatts} min={0}
                onChange={(v) => set("serverWatts", num(v))} />
              <NumberInput label="Camera watts (W/cam)" leftSection={icon(Camera)} value={value.cameraWatts} min={0}
                onChange={(v) => set("cameraWatts", num(v))} />
              <NumberInput label="Drive watts (W/drive)" leftSection={icon(HardDrive)} value={value.driveWatts} min={0}
                onChange={(v) => set("driveWatts", num(v))} />
              <NumberInput label="Drive capacity (TB/drive)" leftSection={icon(HardDrive)} value={value.driveCapacityTb} min={1}
                onChange={(v) => set("driveCapacityTb", num(v))} />
              <NumberInput label="Appliance watts (W/appliance)" leftSection={icon(Router)} value={value.applianceWatts} min={0}
                onChange={(v) => set("applianceWatts", num(v))} />
              <NumberInput
                label={<InfoLabel label="Connector local buffer (days)" help={CONNECTOR_BUFFER_HELP} />}
                leftSection={icon(CalendarClock)} value={value.connectorBufferDays} min={0}
                onChange={(v) => set("connectorBufferDays", num(v))}
              />
              <NumberInput
                label={<InfoLabel label="Storage overhead (x)" help={STORAGE_OVERHEAD_HELP} />}
                leftSection={icon(Layers)} value={value.storageOverheadMultiplier} min={1} step={0.05} decimalScale={2}
                onChange={(v) => set("storageOverheadMultiplier", num(v))}
              />
              <NumberInput
                label={<InfoLabel label="Spare recording servers" help={SPARE_SERVERS_HELP} />}
                leftSection={icon(Server)} value={value.spareServers} min={0}
                onChange={(v) => set("spareServers", num(v))}
              />
            </SimpleGrid>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
