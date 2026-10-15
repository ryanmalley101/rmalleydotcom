"use client";

import { Alert, Box, Group, NumberInput, SegmentedControl, Select, SimpleGrid, Text } from "@mantine/core";
import {
  AlertTriangle, ArrowRightLeft, BrainCircuit, CalendarRange, Camera, Clock, Cpu, DollarSign,
  FileText, Globe, Hammer, HardDrive, Headset, Hourglass, Layers, Percent,
  RefreshCw, Router, Search, Server, ShieldCheck, Tag, Truck, UserCog, Wrench,
} from "lucide-react";
import type { CloudMigrationStrategy, RaidLevel, RetentionPricing, ScenarioInputs, SolutionInputs } from "../lib/model";
import { TEXT_MUTED } from "../lib/colors";
import { fieldSourceInfo, vendorEntriesFor } from "../lib/vendorDefaults";
import InfoLabel from "./InfoLabel";
import SourceDot from "./SourceDot";
import SolutionField from "./SolutionField";
import MiscItemsEditor from "./MiscItemsEditor";
import CameraStrategyControl from "./CameraStrategyControl";
import { RAID_OPTIONS } from "../lib/fields";
import { RAID_HELP } from "../lib/fieldHelp";

const icon = (Icon: React.ElementType) => <Icon size={15} />;

const MIGRATION_STRATEGY_HELP =
  "\"Reuse cameras\" keeps the existing fleet running behind a connector/NVR-style box, swapping individual cameras only as they fail. \"Replace all cameras\" buys out the whole fleet with native ones on day one instead. On a new site with no cameras to reuse, a connector setup still buys its cameras at year 0, plus the connector.";


const LICENSE_HELP =
  "Before the retention multiplier. Billed as a lump sum at purchase and at every renewal (year 0, then every term-length years), not smoothed evenly across each year in between — the $/yr figure below is just an average for reference. Support, software updates, and analytics are assumed bundled into the license by default; use the add-on field below if this vendor prices any of that separately.";

const RETENTION_PRICING_HELP =
  "Whether this vendor charges more for its license as retention goes up. \"Rises with retention\" scales the license by (days/30)^0.4 above 30 days. \"Fixed\" is for vendors that record on the camera or a local appliance and sell longer retention as bigger hardware or a separate archive add-on; enter that cost in the camera or add-on fields.";

const RENEWAL_HELP =
  "How many years until the license already in place has to be renewed. After that it renews every term. Only shown for the incumbent: a new purchase buys its first term at year 0.";

// Groups related fields under a shared heading, since a flat list of ~25
// fields (this panel's old shape) reads as one undifferentiated wall of
// inputs. `first` drops the top margin so the very first section doesn't
// float away from the panel's top edge.
const SectionLabel = ({ children, first }: { children: React.ReactNode; first?: boolean }) => (
  <div style={{ gridColumn: "1 / -1" }}>
    <Text size="xs" fw={700} tt="uppercase" c={TEXT_MUTED} style={{ letterSpacing: 0.5 }} mt={first ? 0 : "sm"}>
      {children}
    </Text>
  </div>
);

// Warns when a solution's hardware-refresh timing means its whole refresh
// line (server/storage/analytics appliance, or the connector appliance) can
// never actually be charged within this comparison: an incumbent skips the
// year-0 buildout entirely (nothing new deployed for it), so refresh cycles
// are the *only* place that cost can still appear — and if the next refresh
// falls at or beyond the horizon, it never does. Silent otherwise, since a
// non-incumbent always pays at year 0 regardless of refresh timing, and a
// refresh past the horizon for it is a legitimate, harmless scenario, not a
// cost line quietly disappearing.
function StaleRefreshWarning({ isIncumbent, yearsUntilNextRefresh, horizonYears, what }: {
  isIncumbent: boolean; yearsUntilNextRefresh: number; horizonYears: number; what: string;
}) {
  if (!isIncumbent || yearsUntilNextRefresh < horizonYears) return null;
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <Alert color="yellow" variant="light" icon={<AlertTriangle size={16} />} p="xs">
        <Text size="xs">
          This solution is marked incumbent and its next refresh ({yearsUntilNextRefresh}yr) falls at or beyond the{" "}
          {horizonYears}-year horizon — {what} won&apos;t appear anywhere in this comparison.
        </Text>
      </Alert>
    </div>
  );
}

export default function AssumptionsPanel({ sol, onChange, scenario }: {
  sol: SolutionInputs; onChange: (v: SolutionInputs) => void; scenario: ScenarioInputs;
}) {
  const set = <K extends keyof SolutionInputs>(key: K, v: SolutionInputs[K]) => onChange({ ...sol, [key]: v });
  const isIncumbent = scenario.incumbent === sol.id;

  // Whichever vendor entries could plausibly have set a given field's current
  // value — on-prem splits license/server fields (VMS vendor) from camera
  // fields (camera vendor); cloud is a single vendor. fieldSourceInfo checks
  // each in turn and only returns metadata if the field wasn't edited away
  // from what that vendor's research actually produced.
  const vendorEntries = vendorEntriesFor(sol);

  const field = (key: keyof SolutionInputs, Icon?: React.ElementType) => (
    <SolutionField sol={sol} field={key} onChange={onChange} icon={Icon} />
  );
  const perYear = sol.tierPrice / Math.max(1, sol.tierYears);

  return (
    <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
      <SectionLabel first>Pricing</SectionLabel>
      {field("discountPct", Percent)}

      <SectionLabel>Camera hardware</SectionLabel>
      <CameraStrategyControl sol={sol} scenario={scenario} onChange={onChange} compact />
      {field("cameraCost", Camera)}
      {field("bulkInstallLaborCost", Wrench)}
      {field("replacementInstallLaborCost", Hammer)}
      {field("fleetHalfLifeYears", Hourglass)}
      {field("warrantyYears", ShieldCheck)}

      <SectionLabel>Licensing</SectionLabel>
      {sol.model === "cloud" ? (
        <>
          <div style={{ gridColumn: "1 / -1" }}>
            <Box mb={4}>
              <Group gap={6}>
                {icon(ArrowRightLeft)}
                <InfoLabel
                  label="Migration strategy" help={MIGRATION_STRATEGY_HELP} size="var(--mantine-font-size-xs)" color={TEXT_MUTED}
                  extra={<SourceDot meta={fieldSourceInfo("migrationStrategy", sol.migrationStrategy, ...vendorEntries)} />}
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
          {field("tierYears", CalendarRange)}
          {field("tierPrice", DollarSign)}
          <div style={{ gridColumn: "1 / -1" }}>
            <Box mb={4}>
              <InfoLabel
                label="License price vs. retention" help={RETENTION_PRICING_HELP} size="var(--mantine-font-size-xs)" color={TEXT_MUTED}
                extra={<SourceDot meta={fieldSourceInfo("retentionPricing", sol.retentionPricing, ...vendorEntries)} />}
              />
            </Box>
            <SegmentedControl
              fullWidth
              value={sol.retentionPricing ?? "scaled"}
              onChange={(v) => set("retentionPricing", v as RetentionPricing)}
              data={[
                { label: "Rises with retention", value: "scaled" },
                { label: "Fixed (stored on site)", value: "flat" },
              ]}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <InfoLabel label={`≈ $${perYear.toFixed(2)}/yr per camera`} help={LICENSE_HELP} size="var(--mantine-font-size-xs)" color={TEXT_MUTED} />
          </div>
          {field("supportAddonPerCamYr", Headset)}
          {isIncumbent && (
            <NumberInput
              label={<InfoLabel label="Years until license renewal" help={RENEWAL_HELP} />}
              leftSection={icon(Clock)}
              value={sol.yearsUntilLicenseRenewal ?? sol.tierYears}
              min={0} allowDecimal={false}
              onChange={(v) => set("yearsUntilLicenseRenewal", Number(v) || 0)}
            />
          )}
        </>
      ) : (
        <>
          {field("baseLicense", FileText)}
          {field("deviceLicense", Tag)}
          {field("carePct", ShieldCheck)}
        </>
      )}

      <SectionLabel>Infrastructure</SectionLabel>
      {sol.model === "cloud" ? (
        sol.migrationStrategy === "connector" && (
          <>
            {field("applianceCost", Router)}
            {field("applianceCapacity", Layers)}
            {field("applianceRefreshCycleYears", RefreshCw)}
            {isIncumbent && field("yearsUntilNextApplianceRefresh", Clock)}
            <StaleRefreshWarning
              isIncumbent={isIncumbent} yearsUntilNextRefresh={sol.yearsUntilNextApplianceRefresh}
              horizonYears={scenario.horizonYears} what="the connector appliance cost"
            />
          </>
        )
      ) : (
        <>
          {field("serverCost", Server)}
          {field("serverCapacity", Layers)}
          {field("serverSoftwareCost", FileText)}
          {field("managementServers", Server)}
          {field("storageCostPerTB", HardDrive)}
          <Select
            label={<InfoLabel label="Storage redundancy" help={RAID_HELP} extra={<SourceDot meta={fieldSourceInfo("raidLevel", sol.raidLevel, ...vendorEntries)} />} />}
            leftSection={icon(HardDrive)}
            data={RAID_OPTIONS}
            value={sol.raidLevel}
            allowDeselect={false}
            onChange={(v) => v && set("raidLevel", v as RaidLevel)}
          />
          {(sol.raidLevel === "raid5" || sol.raidLevel === "raid6") &&
            field("raidArrayDrives", HardDrive)}
          {field("refreshCycleYears", RefreshCw)}
          {isIncumbent && field("yearsUntilNextRefresh", Clock)}
          <StaleRefreshWarning
            isIncumbent={isIncumbent} yearsUntilNextRefresh={sol.yearsUntilNextRefresh}
            horizonYears={scenario.horizonYears} what="server, storage, and analytics appliance costs"
          />
        </>
      )}

      <SectionLabel>Operations</SectionLabel>
      {field("truckRollsPerSiteYr", Truck)}
      {field("networkCostPerSiteYr", Globe)}
      {field("adminHrsPerCamYr", UserCog)}
      {field("investigationHrsPerIncident", Search)}

      {sol.model === "onprem" && (
        <>
          <SectionLabel>Analytics</SectionLabel>
          {field("analyticsApplianceCost", Cpu)}
          {field("analyticsSoftwareCostPerCam", BrainCircuit)}
          {field("analyticsSoftwareCostPerCamYr", BrainCircuit)}
        </>
      )}

      <SectionLabel>Misc / other</SectionLabel>
      <MiscItemsEditor items={sol.miscItems} onChange={(miscItems) => onChange({ ...sol, miscItems })} />
    </SimpleGrid>
  );
}
