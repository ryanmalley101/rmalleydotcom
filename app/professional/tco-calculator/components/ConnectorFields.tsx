"use client";

import { ActionIcon, Anchor, Badge, Button, Group, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import { CalendarRange, DollarSign, Layers, Plus, Router, Tag, Trash2 } from "lucide-react";
import { applianceOptionFit, chooseApplianceOption, type ApplianceOption, type ScenarioInputs, type SolutionInputs } from "../lib/model";
import { sanitizeScenario, sanitizeSolution } from "../lib/sanitize";
import { fieldSourceInfo, vendorEntriesFor } from "../lib/vendorDefaults";
import { TEXT_MUTED } from "../../_tco-shared/lib/colors";
import InfoLabel from "../../_tco-shared/components/InfoLabel";
import SourceDot from "../../_tco-shared/components/SourceDot";
import SolutionField from "./SolutionField";

const icon = (Icon: React.ElementType) => <Icon size={15} />;

const MODELS_HELP =
  "The vendor's connector models, when it sells several sizes or storage tiers. The cheapest that covers your cameras at the scenario's retention is used, at least one unit per site. \"Days\" is the retention each model holds with every channel in use; longer retention spreads the same storage over fewer cameras. Leave it blank if a model's capacity doesn't depend on retention.";

// A cloud connector solution's appliance pricing: one price and capacity, or
// a list of models to pick the cheapest fit from (see ApplianceOption).
// Shared by the setup step and the results page's assumptions panel.
export default function ConnectorFields({ sol, scenario, onChange }: {
  sol: SolutionInputs; scenario: ScenarioInputs; onChange: (v: SolutionInputs) => void;
}) {
  const options = Array.isArray(sol.applianceOptions) ? sol.applianceOptions : [];
  const setOptions = (applianceOptions: ApplianceOption[]) => onChange({ ...sol, applianceOptions });

  if (options.length === 0) {
    return (
      <Stack gap={4} style={{ gridColumn: "1 / -1" }}>
        <Group grow align="flex-start">
          <SolutionField sol={sol} field="applianceCost" onChange={onChange} icon={Router} />
          <SolutionField sol={sol} field="applianceCapacity" onChange={onChange} icon={Layers} />
        </Group>
        <Anchor
          component="button" type="button" size="xs" style={{ alignSelf: "flex-start" }}
          onClick={() => setOptions([{ id: crypto.randomUUID(), label: "", cost: sol.applianceCost, capacity: sol.applianceCapacity, retentionDays: null }])}
        >
          This vendor sells several connector models
        </Anchor>
      </Stack>
    );
  }

  // Sized on the same clamped inputs the cost model uses.
  const scn = sanitizeScenario(scenario);
  const clean = sanitizeSolution(sol).applianceOptions;
  const chosen = chooseApplianceOption(clean, scn);
  const update = (id: string, patch: Partial<ApplianceOption>) => setOptions(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  return (
    <Stack gap="xs" style={{ gridColumn: "1 / -1" }}>
      <InfoLabel
        label="Connector models" help={MODELS_HELP} size="var(--mantine-font-size-sm)"
        extra={<SourceDot meta={fieldSourceInfo("applianceOptions", sol.applianceOptions, ...vendorEntriesFor(sol))} />}
      />
      {chosen && (
        <Text size="xs" c={TEXT_MUTED}>
          At {scn.retentionDays} days for {scn.cameras.toLocaleString()} cameras across {scn.sites.toLocaleString()} sites, the cheapest fit is{" "}
          {chosen.units.toLocaleString()} × {chosen.option.label || "an unnamed model"} (${chosen.total.toLocaleString()} list).
        </Text>
      )}
      {options.map((o, i) => {
        const fit = applianceOptionFit(clean[i], scn);
        const used = chosen?.option.id === clean[i].id;
        return (
          <Stack key={o.id} gap={2}>
            <Group gap="xs" wrap="wrap" align="flex-end">
              <TextInput
                label="Model" leftSection={icon(Tag)} placeholder="e.g. CC500-8TB"
                value={o.label} onChange={(e) => update(o.id, { label: e.currentTarget.value })}
                style={{ flex: "2 1 120px", minWidth: 0 }}
              />
              <NumberInput
                label="Price ($)" leftSection={icon(DollarSign)} min={0} thousandSeparator=","
                value={o.cost} onChange={(v) => update(o.id, { cost: typeof v === "number" ? v : 0 })}
                style={{ flex: "1 1 100px", minWidth: 0 }}
              />
              <NumberInput
                label="Cameras" leftSection={icon(Layers)} min={1} allowDecimal={false}
                value={o.capacity} onChange={(v) => update(o.id, { capacity: typeof v === "number" ? v : 1 })}
                style={{ flex: "1 1 80px", minWidth: 0 }}
              />
              <NumberInput
                label="Days" leftSection={icon(CalendarRange)} min={1} allowDecimal={false} placeholder="any"
                value={o.retentionDays ?? ""} onChange={(v) => update(o.id, { retentionDays: typeof v === "number" && v > 0 ? v : null })}
                style={{ flex: "1 1 80px", minWidth: 0 }}
              />
              <ActionIcon color="red" variant="subtle" onClick={() => setOptions(options.filter((x) => x.id !== o.id))} aria-label="Remove model" mb={4}>
                <Trash2 size={16} />
              </ActionIcon>
            </Group>
            <Group gap={6}>
              <Text size="xs" c={TEXT_MUTED}>
                {fit.effCap.toLocaleString()} cameras per unit at {scn.retentionDays} days · {fit.units.toLocaleString()} units · ${fit.total.toLocaleString()}
              </Text>
              {used && <Badge size="xs" variant="light" color="teal">Used</Badge>}
            </Group>
          </Stack>
        );
      })}
      <Group gap="xs">
        <Button
          variant="light" size="xs" leftSection={<Plus size={14} />}
          onClick={() => setOptions([...options, { id: crypto.randomUUID(), label: "", cost: 0, capacity: 1, retentionDays: null }])}
        >
          Add model
        </Button>
        <Button variant="subtle" size="xs" onClick={() => setOptions([])}>
          Use one price instead
        </Button>
      </Group>
    </Stack>
  );
}
