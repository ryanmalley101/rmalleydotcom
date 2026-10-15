"use client";

import { Accordion, NumberInput, SimpleGrid, Stack, Switch, Text, Title } from "@mantine/core";
import {
  Activity, Building2, Camera, CalendarRange, Database, DollarSign,
  HardDrive, Layers, Search, Server, TrendingUp, Truck,
} from "lucide-react";
import type { ScenarioInputs } from "../lib/model";
import { TEXT_MUTED } from "../lib/colors";
import InfoLabel from "./InfoLabel";
import { BITRATE_HELP, INVESTIGATIONS_PER_MONTH_HELP } from "../lib/fieldHelp";

const RETENTION_LABEL = (
  <InfoLabel
    label="Retention (days)"
    help="How many days of footage are kept before it's overwritten. Longer retention needs more storage, which raises cost, but not in a straight line: storage is only part of what a license or server covers, and tends to get cheaper per unit at higher volumes."
  />
);

const ESCALATION_FIELDS = [
  {
    key: "laborEscalationPct" as const, label: "Labor escalation (%/yr)",
    help: "Yearly growth in labor and service costs: install and replacement labor, truck rolls, admin and investigation time, and your misc items. Tends to track wages.",
  },
  {
    key: "hardwareEscalationPct" as const, label: "Hardware escalation (%/yr)",
    help: "Yearly change in hardware prices for cameras, servers, storage, and appliances bought later in the horizon. Often flat or negative per unit, since storage in particular gets cheaper over time.",
  },
  {
    key: "licenseEscalationPct" as const, label: "License escalation (%/yr)",
    help: "Yearly growth in license, subscription, and support-renewal prices. Check your contracts: some lock renewal pricing, others allow annual increases.",
  },
];

const STORAGE_OVERHEAD_HELP =
  "Multiplier on top of the raw video-bitrate math for metadata/audio/keyframe-indexing overhead beyond the encoded video stream itself. Feeds on-prem storage sizing. 1.3 (30% overhead) is a general placeholder — some VMSes run leaner or heavier than this.";

const SPARE_SERVERS_HELP =
  "On-prem recording servers bought beyond whatever capacity actually requires, as hot-spare/headroom. Applies once per solution, not once per site.";

const RESIDUAL_HELP =
  "Gives back the unused share of anything bought with a fixed service life that runs past the end of the horizon: cloud license terms, server and storage refreshes, and connectors. Straight-line over the service life, shown as its own credit line in the final year. Without it, a purchase late in the horizon is billed in full for a year or two of use.";

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
        <NumberInput label="Camera count" leftSection={icon(Camera)} allowDecimal={false} value={value.cameras} min={1} thousandSeparator=","
          onChange={(v) => set("cameras", num(v))} />
        <NumberInput label="Sites / buildings" leftSection={icon(Building2)} allowDecimal={false} value={value.sites} min={1} thousandSeparator=","
          onChange={(v) => set("sites", num(v))} />
        <NumberInput label={RETENTION_LABEL} leftSection={icon(Database)} allowDecimal={false} value={value.retentionDays} min={1}
          onChange={(v) => set("retentionDays", num(v))} />
        <NumberInput label="Horizon (years)" leftSection={icon(CalendarRange)} allowDecimal={false} value={value.horizonYears} min={1} max={30}
          onChange={(v) => set("horizonYears", num(v))} />
        <NumberInput label={<InfoLabel label="Avg bitrate/cam (Mbps)" help={BITRATE_HELP} />} leftSection={icon(Activity)} value={value.bitrateMbps} min={0.1} step={0.5} decimalScale={1}
          onChange={(v) => set("bitrateMbps", num(v))} />
        <NumberInput label={<InfoLabel label="Investigations/mo" help={INVESTIGATIONS_PER_MONTH_HELP} />} leftSection={icon(Search)} value={value.investigationsPerMonth} min={0}
          onChange={(v) => set("investigationsPerMonth", num(v))} />
      </SimpleGrid>

      {/* Collapsed by default, deliberately: escalation, market rates, and the
          storage-sizing assumptions are all real inputs, but not ones a first
          pass at a comparison needs — burying them behind one accordion keeps the
          main form to the handful of facts that actually define the comparison. */}
      <Accordion variant="separated">
        <Accordion.Item value="advanced">
          <Accordion.Control>
            <Text size="sm" fw={500}>Advanced (price escalation, market rates, storage sizing)</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
              {ESCALATION_FIELDS.map((f) => (
                <NumberInput key={f.key} label={<InfoLabel label={f.label} help={f.help} />} leftSection={icon(TrendingUp)}
                  value={value[f.key]} min={-20} max={100} step={0.5} decimalScale={1}
                  onChange={(v) => set(f.key, num(v))} />
              ))}
              <NumberInput label="Admin ($/hr)" leftSection={icon(DollarSign)} value={value.adminRate} min={0} onChange={(v) => set("adminRate", num(v))} />
              <NumberInput label="Investigator ($/hr)" leftSection={icon(DollarSign)} value={value.investigatorRate} min={0} onChange={(v) => set("investigatorRate", num(v))} />
              <NumberInput label="Truck roll ($)" leftSection={icon(Truck)} value={value.truckRollCost} min={0} onChange={(v) => set("truckRollCost", num(v))} />
              <NumberInput label="Drive capacity (TB/drive)" leftSection={icon(HardDrive)} value={value.driveCapacityTb} min={1}
                onChange={(v) => set("driveCapacityTb", num(v))} />
              <NumberInput
                label={<InfoLabel label="Storage overhead (x)" help={STORAGE_OVERHEAD_HELP} />}
                leftSection={icon(Layers)} value={value.storageOverheadMultiplier} min={1} step={0.05} decimalScale={2}
                onChange={(v) => set("storageOverheadMultiplier", num(v))}
              />
              <NumberInput
                label={<InfoLabel label="Spare recording servers" help={SPARE_SERVERS_HELP} />}
                leftSection={icon(Server)} allowDecimal={false} value={value.spareServers} min={0}
                onChange={(v) => set("spareServers", num(v))}
              />
            </SimpleGrid>
            <Switch
              mt="md"
              checked={value.creditResidualValue !== false}
              onChange={(e) => set("creditResidualValue", e.currentTarget.checked)}
              label={<InfoLabel label="Credit unused service life at the end of the horizon" help={RESIDUAL_HELP} />}
            />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
