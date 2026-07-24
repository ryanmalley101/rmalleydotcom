"use client";

import { Badge, Box, Card, ColorInput, Group, NumberInput, Select, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import type { CloudMigrationStrategy, ScenarioInputs, SolutionInputs } from "../lib/model";
import { COLOR_SWATCHES, TEXT_MUTED } from "../lib/colors";
import { CLOUD_PROVIDERS, ONPREM_VMS_PROVIDERS, ONPREM_CAMERA_PROVIDERS } from "../lib/providers";
import IncumbentPicker from "./IncumbentPicker";
import InfoLabel from "./InfoLabel";

const OTHER = "other";
const PLACEHOLDER_NAMES = ["Solution A (Cloud)", "Solution A (On-Prem)", "Solution B (Cloud)", "Solution B (On-Prem)"];

const HALF_LIFE_LABEL = (
  <InfoLabel
    label="Camera fleet half-life (yrs)"
    help="A rough estimate of camera lifespan. About half of today's cameras will have failed and been replaced by this many years from now, half of what's left by twice that many years, and so on, the same math as radioactive half-life."
  />
);

const WARRANTY_LABEL = (
  <InfoLabel
    label="Warranty period (yrs)"
    help="How many years new camera hardware is covered by the manufacturer's warranty. A failure within this window is assumed to cost only the labor to swap the unit, not the hardware itself."
  />
);

const MIGRATION_STRATEGY_HELP =
  "\"Reuse cameras\" keeps the existing fleet running behind a connector/NVR-style box, swapping individual cameras only as they fail. \"Replace all cameras\" buys out the whole fleet with native ones on day one instead.";

function selectData(options: string[]) {
  return [...options.map((p) => ({ value: p, label: p })), { value: OTHER, label: "Other…" }];
}

function composeOnPremName(id: "a" | "b", vms: string, camera: string) {
  if (vms && camera) return `${vms} · ${camera} cameras`;
  if (vms) return `${vms} VMS`;
  if (camera) return `${camera} cameras`;
  return id === "a" ? "Solution A (On-Prem)" : "Solution B (On-Prem)";
}

function CloudNaming({ sol, onChange }: { sol: SolutionInputs; onChange: (v: SolutionInputs) => void }) {
  const isPlaceholder = PLACEHOLDER_NAMES.includes(sol.name);
  const known = CLOUD_PROVIDERS.includes(sol.name);
  const selectValue = isPlaceholder ? null : known ? sol.name : OTHER;

  return (
    <>
      <Select
        label="Provider"
        placeholder="Choose a provider…"
        data={selectData(CLOUD_PROVIDERS)}
        value={selectValue}
        onChange={(v) => {
          if (!v) return;
          onChange({ ...sol, name: v === OTHER ? "" : v });
        }}
      />
      {selectValue === OTHER && (
        <TextInput
          placeholder="Type a provider name"
          value={sol.name === "" ? "" : sol.name}
          onChange={(e) => onChange({ ...sol, name: e.currentTarget.value })}
        />
      )}
    </>
  );
}

function OnPremNaming({ sol, onChange }: { sol: SolutionInputs; onChange: (v: SolutionInputs) => void }) {
  const vms = sol.vmsProvider;
  const camera = sol.cameraProvider;
  const vmsKnown = vms !== undefined && ONPREM_VMS_PROVIDERS.includes(vms);
  const cameraKnown = camera !== undefined && ONPREM_CAMERA_PROVIDERS.includes(camera);
  const vmsSelectValue = vms === undefined ? null : vmsKnown ? vms : OTHER;
  const cameraSelectValue = camera === undefined ? null : cameraKnown ? camera : OTHER;

  function updateVms(v: string) {
    onChange({ ...sol, vmsProvider: v, name: composeOnPremName(sol.id, v, camera ?? "") });
  }
  function updateCamera(v: string) {
    onChange({ ...sol, cameraProvider: v, name: composeOnPremName(sol.id, vms ?? "", v) });
  }

  return (
    <>
      <Select
        label="VMS software"
        placeholder="Choose a VMS…"
        data={selectData(ONPREM_VMS_PROVIDERS)}
        value={vmsSelectValue}
        onChange={(v) => { if (v) updateVms(v === OTHER ? "" : v); }}
      />
      {vmsSelectValue === OTHER && (
        <TextInput placeholder="Type a VMS name" value={vms ?? ""} onChange={(e) => updateVms(e.currentTarget.value)} />
      )}
      <Select
        label="Camera hardware"
        placeholder="Choose camera hardware…"
        data={selectData(ONPREM_CAMERA_PROVIDERS)}
        value={cameraSelectValue}
        onChange={(v) => { if (v) updateCamera(v === OTHER ? "" : v); }}
      />
      {cameraSelectValue === OTHER && (
        <TextInput placeholder="Type a camera vendor" value={camera ?? ""} onChange={(e) => updateCamera(e.currentTarget.value)} />
      )}
    </>
  );
}

function CloudLicenseFields({ sol, onChange }: { sol: SolutionInputs; onChange: (v: SolutionInputs) => void }) {
  const set = <K extends keyof SolutionInputs>(key: K, v: SolutionInputs[K]) => onChange({ ...sol, [key]: v });
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  const perYear = sol.tierPrice / Math.max(1, sol.tierYears);

  return (
    <>
      <div>
        <Box mb={4}><InfoLabel label="Migration strategy" help={MIGRATION_STRATEGY_HELP} size="var(--mantine-font-size-sm)" /></Box>
        <SegmentedControl
          fullWidth
          value={sol.migrationStrategy}
          onChange={(v) => set("migrationStrategy", v as CloudMigrationStrategy)}
          data={[
            { label: "Reuse cameras (connector)", value: "connector" },
            { label: "Replace all cameras", value: "ripReplace" },
          ]}
        />
      </div>
      <Group grow align="flex-start">
        <NumberInput
          label="License term (years)"
          value={sol.tierYears}
          min={1}
          onChange={(v) => set("tierYears", num(v) || 1)}
        />
        <NumberInput
          label="License cost for that term ($/cam)"
          value={sol.tierPrice}
          min={0}
          onChange={(v) => set("tierPrice", num(v))}
        />
      </Group>
      <Text size="xs" c={TEXT_MUTED} mt={-8}>
        &asymp; ${perYear.toFixed(2)}/yr per camera before the retention multiplier. Other ongoing costs
        (support, software updates) are assumed bundled into the license.
      </Text>
      {sol.migrationStrategy === "connector" && (
        <NumberInput
          label="Cloud connector appliance ($/unit)"
          value={sol.applianceCost}
          min={0}
          onChange={(v) => set("applianceCost", num(v))}
        />
      )}
    </>
  );
}

function SolutionCard({
  sol, onChange, color, onColorChange,
}: {
  sol: SolutionInputs; onChange: (v: SolutionInputs) => void; color: string; onColorChange: (v: string) => void;
}) {
  const set = <K extends keyof SolutionInputs>(key: K, v: SolutionInputs[K]) => onChange({ ...sol, [key]: v });
  const num = (v: unknown) => (typeof v === "number" ? v : 0);

  return (
    <Card withBorder padding="lg" radius="md" style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Text fw={700} fz="1.05rem">{sol.name || "Unnamed solution"}</Text>
          <Group gap="xs">
            <ColorInput
              value={color}
              onChange={onColorChange}
              format="hex"
              size="xs"
              w={110}
              swatches={COLOR_SWATCHES}
              aria-label="Chart color for this solution"
            />
            <Badge variant="light" color={sol.model === "cloud" ? "blue" : "grape"}>
              {sol.model === "cloud" ? "Cloud / Hybrid" : "On-Prem"}
            </Badge>
          </Group>
        </Group>

        {sol.model === "cloud" ? <CloudNaming sol={sol} onChange={onChange} /> : <OnPremNaming sol={sol} onChange={onChange} />}

        <Group grow align="flex-start">
          <NumberInput
            label="Discount off list (%)"
            value={sol.discountPct}
            min={0} max={100}
            onChange={(v) => set("discountPct", num(v))}
          />
          <NumberInput
            label={HALF_LIFE_LABEL}
            value={sol.fleetHalfLifeYears}
            min={0.5} step={0.5} decimalScale={1}
            onChange={(v) => set("fleetHalfLifeYears", num(v))}
          />
        </Group>

        <Group grow align="flex-start">
          <NumberInput
            label="Replacement camera ($/cam)"
            value={sol.cameraCost}
            min={0}
            onChange={(v) => set("cameraCost", num(v))}
          />
          <NumberInput
            label={WARRANTY_LABEL}
            value={sol.warrantyYears}
            min={0} step={0.5} decimalScale={1}
            onChange={(v) => set("warrantyYears", num(v))}
          />
        </Group>

        {sol.model === "cloud" ? (
          <CloudLicenseFields sol={sol} onChange={onChange} />
        ) : (
          <>
            <NumberInput
              label="Base license ($, owned)"
              value={sol.baseLicense}
              min={0}
              onChange={(v) => set("baseLicense", num(v))}
            />
            <Group grow>
              <NumberInput
                label="Device license ($/cam, owned)"
                value={sol.deviceLicense}
                min={0}
                onChange={(v) => set("deviceLicense", num(v))}
              />
              <NumberInput
                label="Support renewal (% of license/yr)"
                value={sol.carePct}
                min={0}
                onChange={(v) => set("carePct", num(v))}
              />
            </Group>
          </>
        )}

        <Group grow>
          <NumberInput
            label="Truck rolls / site / yr"
            value={sol.truckRollsPerSiteYr}
            min={0}
            step={0.5}
            decimalScale={1}
            onChange={(v) => set("truckRollsPerSiteYr", num(v))}
          />
          <NumberInput
            label="Admin hrs / cam / yr"
            value={sol.adminHrsPerCamYr}
            min={0}
            step={0.1}
            decimalScale={1}
            onChange={(v) => set("adminHrsPerCamYr", num(v))}
          />
        </Group>
      </Stack>
    </Card>
  );
}

export default function SolutionsStep({
  solA, solB, onChangeA, onChangeB, colorA, colorB, onColorAChange, onColorBChange, scenario, onScenarioChange,
}: {
  solA: SolutionInputs; solB: SolutionInputs;
  onChangeA: (v: SolutionInputs) => void; onChangeB: (v: SolutionInputs) => void;
  colorA: string; colorB: string;
  onColorAChange: (v: string) => void; onColorBChange: (v: string) => void;
  scenario: ScenarioInputs; onScenarioChange: (v: ScenarioInputs) => void;
}) {
  return (
    <Stack gap="md">
      <div>
        <Title order={4} mb={4}>Name & configure each solution</Title>
        <Text size="sm" c={TEXT_MUTED}>
          Pick a provider for each side (or choose &quot;Other&quot; to type your own) and adjust the numbers that
          matter most. Every other assumption stays editable on the results page.
        </Text>
      </div>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <SolutionCard sol={solA} onChange={onChangeA} color={colorA} onColorChange={onColorAChange} />
        <SolutionCard sol={solB} onChange={onChangeB} color={colorB} onColorChange={onColorBChange} />
      </SimpleGrid>
      <Card withBorder padding="lg" radius="md">
        <IncumbentPicker scenario={scenario} onScenarioChange={onScenarioChange} nameA={solA.name} nameB={solB.name} />
      </Card>
    </Stack>
  );
}
