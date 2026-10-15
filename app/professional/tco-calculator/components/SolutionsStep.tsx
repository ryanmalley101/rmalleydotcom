"use client";

import { Badge, Box, Card, Group, NumberInput, Select, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Title, Tooltip } from "@mantine/core";
import {
  ArrowRightLeft, CalendarRange, Camera, DollarSign, FileText, HardDrive, Headset, Hourglass, Layers, Percent, Router, Search, Server, ShieldCheck, Tag, Truck, UserCog,
} from "lucide-react";
import type { CloudMigrationStrategy, RaidLevel, ScenarioInputs, SolutionInputs } from "../lib/model";
import { TEXT_MUTED } from "../lib/colors";
import { CLOUD_PROVIDERS, ONPREM_VMS_PROVIDERS, ONPREM_CAMERA_PROVIDERS } from "../lib/providers";
import {
  CLOUD_VENDOR_DEFAULTS, ONPREM_VMS_VENDOR_DEFAULTS, ONPREM_CAMERA_VENDOR_DEFAULTS,
  switchVendor, confidenceSummary, fieldSourceInfo, vendorEntriesFor, type VendorDefaultEntry,
} from "../lib/vendorDefaults";
import IncumbentPicker from "./IncumbentPicker";
import CameraStrategyControl from "./CameraStrategyControl";
import { RAID_OPTIONS } from "../lib/fields";
import { ADMIN_HOURS_HELP, HALF_LIFE_HELP, RAID_HELP, INVESTIGATION_HOURS_HELP, STORAGE_PRICE_HELP, TRUCK_ROLLS_HELP } from "../lib/fieldHelp";
import { withWarranty } from "../lib/defaults";
import InfoLabel from "./InfoLabel";
import SourceDot from "./SourceDot";


const OTHER = "other";
const PLACEHOLDER_NAMES = ["Solution A (Cloud)", "Solution A (On-Prem)", "Solution B (Cloud)", "Solution B (On-Prem)"];

const WARRANTY_HELP =
  "How many years new camera hardware is covered by the manufacturer's warranty. A failure within this window is assumed to cost only the labor to swap the unit, not the hardware itself.";

const MIGRATION_STRATEGY_HELP =
  "\"Reuse cameras\" keeps the existing fleet running behind a connector/NVR-style box, swapping individual cameras only as they fail. \"Replace all cameras\" buys out the whole fleet with native ones on day one instead. On a new site with no cameras to reuse, a connector setup still buys its cameras at year 0, plus the connector.";

const ONPREM_LICENSE_HELP =
  "Charged once at year 0, same as the hardware, unless this solution is marked incumbent below (already owned, not charged again). Only the support renewal recurs afterward.";


const ADDON_HELP =
  "Not every cloud vendor bundles everything into one flat license price the way this tool's defaults assume. If this vendor charges separately for support, analytics, or extended retention, add the per-camera annual cost here; leave at $0 if it's genuinely all-inclusive.";

const icon = (Icon: React.ElementType) => <Icon size={15} />;

function selectData(options: string[]) {
  return [...options.map((p) => ({ value: p, label: p })), { value: OTHER, label: "Other…" }];
}

// How much of a picked vendor's pre-filled data is a real source vs. an
// estimate — the fieldMeta this reads already exists per-field, this just
// surfaces it at a glance instead of it sitting invisible in the data file.
function ConfidenceBadge({
  vendorName, table, headlineField,
}: { vendorName: string; table: Record<string, VendorDefaultEntry>; headlineField?: keyof SolutionInputs }) {
  const summary = confidenceSummary(vendorName, table, headlineField);
  if (summary.total === 0 && summary.tone !== "estimated") return null;
  const color = summary.tone === "sourced" ? "teal" : summary.tone === "mixed" ? "yellow" : "gray";
  return (
    <Tooltip
      multiline w={260} withArrow
      events={{ hover: true, focus: true, touch: true }}
      label="How many of this vendor's pre-filled fields come from a real published/reseller source vs. an estimate. Every field is still fully editable either way, worth double-checking the estimated ones before trusting a close comparison."
    >
      <Badge variant="light" color={color} size="sm" style={{ cursor: "help", width: "fit-content" }}>
        {summary.label}
      </Badge>
    </Tooltip>
  );
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
          const next = v === OTHER ? "" : v;
          onChange({ ...switchVendor(sol, sol.name, next, CLOUD_VENDOR_DEFAULTS), name: next });
        }}
      />
      {selectValue && selectValue !== OTHER && <ConfidenceBadge vendorName={selectValue} table={CLOUD_VENDOR_DEFAULTS} headlineField="tierPrice" />}
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
    const withDefaults = switchVendor(sol, vms, v, ONPREM_VMS_VENDOR_DEFAULTS);
    onChange({ ...withDefaults, vmsProvider: v, name: composeOnPremName(sol.id, v, camera ?? "") });
  }
  function updateCamera(v: string) {
    const withDefaults = switchVendor(sol, camera, v, ONPREM_CAMERA_VENDOR_DEFAULTS);
    onChange({ ...withDefaults, cameraProvider: v, name: composeOnPremName(sol.id, vms ?? "", v) });
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
      {vmsSelectValue && vmsSelectValue !== OTHER && <ConfidenceBadge vendorName={vmsSelectValue} table={ONPREM_VMS_VENDOR_DEFAULTS} headlineField="deviceLicense" />}
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
      {cameraSelectValue && cameraSelectValue !== OTHER && <ConfidenceBadge vendorName={cameraSelectValue} table={ONPREM_CAMERA_VENDOR_DEFAULTS} headlineField="cameraCost" />}
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
  const entries = vendorEntriesFor(sol);

  return (
    <>
      <div>
        <Box mb={4}>
          <Group gap={6}>
            {icon(ArrowRightLeft)}
            <InfoLabel
              label="Migration strategy" help={MIGRATION_STRATEGY_HELP} size="var(--mantine-font-size-sm)"
              extra={<SourceDot meta={fieldSourceInfo("migrationStrategy", sol.migrationStrategy, ...entries)} />}
            />
          </Group>
        </Box>
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
          label={<Group gap={4} wrap="nowrap">License term (years)<SourceDot meta={fieldSourceInfo("tierYears", sol.tierYears, ...entries)} /></Group>}
          leftSection={icon(CalendarRange)}
          value={sol.tierYears}
          min={1}
          allowDecimal={false}
          onChange={(v) => set("tierYears", num(v) || 1)}
        />
        <NumberInput
          label={<Group gap={4} wrap="nowrap">License cost for that term ($/cam)<SourceDot meta={fieldSourceInfo("tierPrice", sol.tierPrice, ...entries)} /></Group>}
          leftSection={icon(DollarSign)}
          value={sol.tierPrice}
          min={0}
          onChange={(v) => set("tierPrice", num(v))}
        />
      </Group>
      <Box mt={-8}>
        <InfoLabel
          label={`≈ $${perYear.toFixed(2)}/yr per camera`}
          help="Before the retention multiplier. Support, software updates, and analytics are assumed bundled into the license by default; use the add-on field below if this vendor prices any of that separately."
          size="var(--mantine-font-size-xs)"
          color={TEXT_MUTED}
        />
      </Box>
      <NumberInput
        label={
          <InfoLabel
            label="Support/analytics add-on ($/cam/yr)" help={ADDON_HELP} size="var(--mantine-font-size-sm)"
            extra={<SourceDot meta={fieldSourceInfo("supportAddonPerCamYr", sol.supportAddonPerCamYr, ...entries)} />}
          />
        }
        leftSection={icon(Headset)}
        value={sol.supportAddonPerCamYr}
        min={0}
        onChange={(v) => set("supportAddonPerCamYr", num(v))}
      />
      {sol.migrationStrategy === "connector" && (
        <Group grow align="flex-start">
          <NumberInput
            label={<Group gap={4} wrap="nowrap">Cloud connector appliance ($/unit)<SourceDot meta={fieldSourceInfo("applianceCost", sol.applianceCost, ...entries)} /></Group>}
            leftSection={icon(Router)}
            value={sol.applianceCost}
            min={0}
            onChange={(v) => set("applianceCost", num(v))}
          />
          <NumberInput
            label={<Group gap={4} wrap="nowrap">Cameras per appliance<SourceDot meta={fieldSourceInfo("applianceCapacity", sol.applianceCapacity, ...entries)} /></Group>}
            leftSection={icon(Layers)}
            value={sol.applianceCapacity}
            min={1} allowDecimal={false}
            onChange={(v) => set("applianceCapacity", num(v) || 1)}
          />
        </Group>
      )}
    </>
  );
}

function SolutionCard({
  sol, onChange, color, scenario,
}: {
  sol: SolutionInputs; onChange: (v: SolutionInputs) => void; color: string;
  scenario: ScenarioInputs;
}) {
  const set = <K extends keyof SolutionInputs>(key: K, v: SolutionInputs[K]) => onChange({ ...sol, [key]: v });
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  const entries = vendorEntriesFor(sol);

  return (
    <Card withBorder padding="lg" radius="md" style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Text fw={700} fz="1.05rem">{sol.name || "Unnamed solution"}</Text>
          <Group gap="xs">
            <Badge variant="light" color={sol.model === "cloud" ? "blue" : "grape"}>
              {sol.model === "cloud" ? "Cloud / Hybrid" : "On-Prem"}
            </Badge>
          </Group>
        </Group>

        {sol.model === "cloud" ? <CloudNaming sol={sol} onChange={onChange} /> : <OnPremNaming sol={sol} onChange={onChange} />}

        <Group grow align="flex-start">
          <NumberInput
            label={<Group gap={4} wrap="nowrap">Discount off list (%)<SourceDot meta={fieldSourceInfo("discountPct", sol.discountPct, ...entries)} /></Group>}
            leftSection={icon(Percent)}
            value={sol.discountPct}
            min={0} max={100}
            onChange={(v) => set("discountPct", num(v))}
          />
          <NumberInput
            label={<InfoLabel label="Camera fleet half-life (yrs)" help={HALF_LIFE_HELP} extra={<SourceDot meta={fieldSourceInfo("fleetHalfLifeYears", sol.fleetHalfLifeYears, ...entries)} />} />}
            leftSection={icon(Hourglass)}
            value={sol.fleetHalfLifeYears}
            min={0.5} step={0.5} decimalScale={1}
            onChange={(v) => set("fleetHalfLifeYears", num(v))}
          />
        </Group>

        {sol.model === "cloud" ? (
          <>
            <Group grow align="flex-start">
              <NumberInput
                label={<Group gap={4} wrap="nowrap">Camera ($/cam)<SourceDot meta={fieldSourceInfo("cameraCost", sol.cameraCost, ...entries)} /></Group>}
                leftSection={icon(Camera)}
                value={sol.cameraCost}
                min={0}
                onChange={(v) => set("cameraCost", num(v))}
              />
              <NumberInput
                label={<InfoLabel label="Warranty period (yrs)" help={WARRANTY_HELP} extra={<SourceDot meta={fieldSourceInfo("warrantyYears", sol.warrantyYears, ...entries)} />} />}
                leftSection={icon(ShieldCheck)}
                value={sol.warrantyYears}
                min={0} step={0.5} decimalScale={1}
                onChange={(v) => onChange(withWarranty(sol, num(v)))}
              />
            </Group>
            <CloudLicenseFields sol={sol} onChange={onChange} />
          </>
        ) : (
          <>
            <CameraStrategyControl sol={sol} scenario={scenario} onChange={onChange} />
            {/* VMS-vendor fields first, camera-vendor fields second, matching the
                order the two provider pickers are shown in above (OnPremNaming). */}
            <NumberInput
              label={<InfoLabel label="Base license ($, one-time)" help={ONPREM_LICENSE_HELP} size="var(--mantine-font-size-sm)" extra={<SourceDot meta={fieldSourceInfo("baseLicense", sol.baseLicense, ...entries)} />} />}
              leftSection={icon(FileText)}
              value={sol.baseLicense}
              min={0}
              onChange={(v) => set("baseLicense", num(v))}
            />
            <Group grow>
              <NumberInput
                label={<InfoLabel label="Device license ($/cam, one-time)" help={ONPREM_LICENSE_HELP} size="var(--mantine-font-size-sm)" extra={<SourceDot meta={fieldSourceInfo("deviceLicense", sol.deviceLicense, ...entries)} />} />}
                leftSection={icon(Tag)}
                value={sol.deviceLicense}
                min={0}
                onChange={(v) => set("deviceLicense", num(v))}
              />
              <NumberInput
                label={<Group gap={4} wrap="nowrap">Support renewal (% of license/yr)<SourceDot meta={fieldSourceInfo("carePct", sol.carePct, ...entries)} /></Group>}
                leftSection={icon(ShieldCheck)}
                value={sol.carePct}
                min={0}
                onChange={(v) => set("carePct", num(v))}
              />
            </Group>
            <Group grow align="flex-start">
              <NumberInput
                label={<Group gap={4} wrap="nowrap">Recording server ($/unit)<SourceDot meta={fieldSourceInfo("serverCost", sol.serverCost, ...entries)} /></Group>}
                leftSection={icon(Server)}
                value={sol.serverCost}
                min={0}
                onChange={(v) => set("serverCost", num(v))}
              />
              <NumberInput
                label={<InfoLabel label="Storage ($/TB raw)" help={STORAGE_PRICE_HELP} extra={<SourceDot meta={fieldSourceInfo("storageCostPerTB", sol.storageCostPerTB, ...entries)} />} />}
                leftSection={icon(HardDrive)}
                value={sol.storageCostPerTB}
                min={0}
                onChange={(v) => set("storageCostPerTB", num(v))}
              />
            </Group>
            <Select
              label={
                <InfoLabel
                  label="Storage redundancy" help={RAID_HELP} size="var(--mantine-font-size-sm)"
                  extra={<SourceDot meta={fieldSourceInfo("raidLevel", sol.raidLevel, ...entries)} />}
                />
              }
              leftSection={icon(HardDrive)}
              data={RAID_OPTIONS}
              value={sol.raidLevel}
              allowDeselect={false}
              onChange={(v) => v && set("raidLevel", v as RaidLevel)}
            />
            <Group grow align="flex-start">
              <NumberInput
                label={<Group gap={4} wrap="nowrap">Camera ($/cam)<SourceDot meta={fieldSourceInfo("cameraCost", sol.cameraCost, ...entries)} /></Group>}
                leftSection={icon(Camera)}
                value={sol.cameraCost}
                min={0}
                onChange={(v) => set("cameraCost", num(v))}
              />
              <NumberInput
                label={<InfoLabel label="Warranty period (yrs)" help={WARRANTY_HELP} extra={<SourceDot meta={fieldSourceInfo("warrantyYears", sol.warrantyYears, ...entries)} />} />}
                leftSection={icon(ShieldCheck)}
                value={sol.warrantyYears}
                min={0} step={0.5} decimalScale={1}
                onChange={(v) => onChange(withWarranty(sol, num(v)))}
              />
            </Group>
          </>
        )}

        <Group grow>
          <NumberInput
            label={<InfoLabel label="Truck rolls / site / yr" help={TRUCK_ROLLS_HELP} extra={<SourceDot meta={fieldSourceInfo("truckRollsPerSiteYr", sol.truckRollsPerSiteYr, ...entries)} />} />}
            leftSection={icon(Truck)}
            value={sol.truckRollsPerSiteYr}
            min={0}
            step={0.5}
            decimalScale={1}
            onChange={(v) => set("truckRollsPerSiteYr", num(v))}
          />
          <NumberInput
            label={<InfoLabel label="Admin hrs / cam / yr" help={ADMIN_HOURS_HELP} extra={<SourceDot meta={fieldSourceInfo("adminHrsPerCamYr", sol.adminHrsPerCamYr, ...entries)} />} />}
            leftSection={icon(UserCog)}
            value={sol.adminHrsPerCamYr}
            min={0}
            step={0.1}
            decimalScale={1}
            onChange={(v) => set("adminHrsPerCamYr", num(v))}
          />
        </Group>
        <NumberInput
          label={<InfoLabel label="Hrs per investigation" help={INVESTIGATION_HOURS_HELP} extra={<SourceDot meta={fieldSourceInfo("investigationHrsPerIncident", sol.investigationHrsPerIncident, ...entries)} />} />}
          leftSection={icon(Search)}
          value={sol.investigationHrsPerIncident}
          min={0}
          step={0.25}
          decimalScale={2}
          onChange={(v) => set("investigationHrsPerIncident", num(v))}
        />
      </Stack>
    </Card>
  );
}

export default function SolutionsStep({
  solA, solB, onChangeA, onChangeB, colorA, colorB, scenario, onScenarioChange,
}: {
  solA: SolutionInputs; solB: SolutionInputs;
  onChangeA: (v: SolutionInputs) => void; onChangeB: (v: SolutionInputs) => void;
  colorA: string; colorB: string;
  scenario: ScenarioInputs; onScenarioChange: (v: ScenarioInputs) => void;
}) {
  return (
    <Stack gap="md">
      <div>
        <Title order={4} mb={4}>Name & configure each solution</Title>
        <Text size="sm" c={TEXT_MUTED}>
          Pick a provider for each side and adjust what matters most. Everything else stays editable later.
        </Text>
      </div>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <SolutionCard sol={solA} onChange={onChangeA} color={colorA} scenario={scenario} />
        <SolutionCard sol={solB} onChange={onChangeB} color={colorB} scenario={scenario} />
      </SimpleGrid>
      <Card withBorder padding="lg" radius="md">
        <IncumbentPicker scenario={scenario} onScenarioChange={onScenarioChange} nameA={solA.name} nameB={solB.name} />
      </Card>
    </Stack>
  );
}
