"use client";

import { Box, Group, NumberInput, SegmentedControl, Select, SimpleGrid, Text } from "@mantine/core";
import {
  ArrowRightLeft, BrainCircuit, CalendarClock, CalendarRange, Camera, Clock, Cpu, DollarSign,
  FileText, Film, Hammer, HardDrive, Headset, Hourglass, Layers, PackagePlus, Percent,
  RefreshCw, Router, Search, Server, ShieldCheck, Tag, Truck, UserCog, Wrench,
} from "lucide-react";
import type { CloudMigrationStrategy, RaidLevel, SolutionInputs } from "../lib/model";
import { TEXT_MUTED } from "../lib/colors";
import { CLOUD_VENDOR_DEFAULTS, ONPREM_VMS_VENDOR_DEFAULTS, ONPREM_CAMERA_VENDOR_DEFAULTS, fieldSourceInfo } from "../lib/vendorDefaults";
import InfoLabel from "./InfoLabel";
import SourceDot from "./SourceDot";

const icon = (Icon: React.ElementType) => <Icon size={15} />;

const MIGRATION_STRATEGY_HELP =
  "\"Reuse cameras\" keeps the existing fleet running behind a connector/NVR-style box, swapping individual cameras only as they fail. \"Replace all cameras\" buys out the whole fleet with native ones on day one instead.";

const RAID_HELP =
  "How the on-prem storage is protected against a drive failure. No RAID and RAID 0 (striping) need only the usable capacity but have no redundancy, a single drive failure loses data. RAID 1 (mirroring) and RAID 10 (striped mirrors) roughly double the raw storage bought, to survive a drive failure.";

const RAID_OPTIONS: { value: RaidLevel; label: string }[] = [
  { value: "none", label: "No RAID" },
  { value: "raid0", label: "RAID 0 (striping)" },
  { value: "raid1", label: "RAID 1 (mirroring)" },
  { value: "raid10", label: "RAID 10 (striped mirrors)" },
];

const FRAMERATE_HELP =
  "Frames per second recorded per camera. Storage scales proportionally relative to the 24fps default; bitrate already captures most of the storage cost, this is a secondary adjustment on top of it.";

const LICENSE_HELP =
  "Before the retention multiplier. Support, software updates, and analytics are assumed bundled into the license by default; use the add-on field below if this vendor prices any of that separately.";

const ADDON_HELP =
  "Not every cloud vendor bundles everything into one flat license price the way this tool's defaults assume. If this vendor charges separately for support, analytics, or extended retention, add the per-camera annual cost here; leave at $0 if it's genuinely all-inclusive.";

const ONPREM_LICENSE_HELP =
  "Charged once at year 0, same as the hardware, unless this solution is marked incumbent above (already owned, not charged again). Only the support/care renewal below recurs afterward.";

const MISC_UPFRONT_HELP =
  "A catch-all for any one-time cost that doesn't fit a category above — professional services for initial setup, a custom integration, a one-off migration fee, etc. Flat, not per-camera. Zeroed out for the incumbent side and discounted like the rest of year 0's buildout cost, same as the fields above. Defaults to $0.";

const MISC_ANNUAL_HELP =
  "A catch-all for any recurring cost that doesn't fit a category above — a compliance/audit fee, a monitoring contract, anything ongoing that isn't admin labor, truck rolls, or a license renewal. Charged every year after year 0, escalating and discounting the same as the other recurring lines. Defaults to $0.";

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

export default function AssumptionsPanel({ sol, onChange }: { sol: SolutionInputs; onChange: (v: SolutionInputs) => void }) {
  const set = <K extends keyof SolutionInputs>(key: K, v: SolutionInputs[K]) => onChange({ ...sol, [key]: v });

  // Whichever vendor entries could plausibly have set a given field's current
  // value — on-prem splits license/server fields (VMS vendor) from camera
  // fields (camera vendor); cloud is a single vendor. fieldSourceInfo checks
  // each in turn and only returns metadata if the field wasn't edited away
  // from what that vendor's research actually produced.
  const vendorEntries =
    sol.model === "cloud"
      ? [CLOUD_VENDOR_DEFAULTS[sol.name]]
      : [sol.vmsProvider ? ONPREM_VMS_VENDOR_DEFAULTS[sol.vmsProvider] : undefined,
         sol.cameraProvider ? ONPREM_CAMERA_VENDOR_DEFAULTS[sol.cameraProvider] : undefined];

  const num = (
    label: React.ReactNode,
    key: keyof SolutionInputs,
    opts?: { step?: number; decimalScale?: number; min?: number; icon?: React.ElementType; help?: string }
  ) => {
    const meta = fieldSourceInfo(key, sol[key], ...vendorEntries);
    const dot = <SourceDot meta={meta} />;
    return (
      <NumberInput
        label={
          opts?.help
            ? <InfoLabel label={label as string} help={opts.help} extra={dot} />
            : <Group gap={4} wrap="nowrap">{label}{dot}</Group>
        }
        leftSection={opts?.icon ? icon(opts.icon) : undefined}
        value={sol[key] as number}
        min={opts?.min ?? 0}
        step={opts?.step}
        decimalScale={opts?.decimalScale}
        onChange={(v) => set(key, (Number(v) || 0) as SolutionInputs[typeof key])}
      />
    );
  };
  const perYear = sol.tierPrice / Math.max(1, sol.tierYears);

  return (
    <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
      <SectionLabel first>Pricing</SectionLabel>
      {num("Discount off list (%)", "discountPct", {
        min: 0, icon: Percent,
        help: "This vendor's own negotiated discount off list price. Applied broadly — camera, license, appliance/server, and analytics costs below are all discounted by this same percentage.",
      })}

      <SectionLabel>Camera hardware</SectionLabel>
      {num("Replacement camera ($/cam)", "cameraCost", { icon: Camera })}
      {num("Bulk install labor ($/cam)", "bulkInstallLaborCost", { icon: Wrench })}
      {num("Replacement install labor ($/cam)", "replacementInstallLaborCost", { icon: Hammer })}
      {num("Fleet half-life (yrs)", "fleetHalfLifeYears", {
        step: 0.5, decimalScale: 1, min: 0.5, icon: Hourglass,
        help: "A rough estimate of camera lifespan. About half of today's cameras will have failed and been replaced by this many years from now, half of what's left by twice that many years, and so on, the same math as radioactive half-life.",
      })}
      {num("Warranty (yrs)", "warrantyYears", {
        step: 0.5, decimalScale: 1, icon: ShieldCheck,
        help: "How many years new camera hardware is covered by the manufacturer's warranty. A failure within this window is assumed to cost only the labor to swap the unit, not the hardware itself.",
      })}
      {num("Framerate (fps)", "framerateFps", { step: 1, min: 1, icon: Film, help: FRAMERATE_HELP })}

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
          {num("License term (years)", "tierYears", { min: 1, icon: CalendarRange })}
          {num("License cost for term ($/cam)", "tierPrice", { icon: DollarSign })}
          <div style={{ gridColumn: "1 / -1" }}>
            <InfoLabel label={`≈ $${perYear.toFixed(2)}/yr per camera`} help={LICENSE_HELP} size="var(--mantine-font-size-xs)" color={TEXT_MUTED} />
          </div>
          {num("Support/analytics add-on ($/cam/yr)", "supportAddonPerCamYr", { icon: Headset, help: ADDON_HELP })}
        </>
      ) : (
        <>
          {num("Base license ($, one-time)", "baseLicense", { icon: FileText, help: ONPREM_LICENSE_HELP })}
          {num("Device license ($/cam, one-time)", "deviceLicense", { icon: Tag, help: ONPREM_LICENSE_HELP })}
          {num("Support renewal (%/yr)", "carePct", { icon: ShieldCheck })}
        </>
      )}

      <SectionLabel>Infrastructure</SectionLabel>
      {sol.model === "cloud" ? (
        sol.migrationStrategy === "connector" && (
          <>
            {num("Connector appliance ($/unit)", "applianceCost", { icon: Router })}
            {num("Cameras per appliance", "applianceCapacity", { min: 1, icon: Layers })}
            {num("Connector warranty (yrs)", "applianceWarrantyYears", {
              step: 0.5, decimalScale: 1, icon: ShieldCheck,
              help: "The manufacturer's hardware warranty on the connector/appliance itself, separate from the camera warranty above since the two commonly differ for the same vendor. Reference only, doesn't change the refresh cost below.",
            })}
            {num("Appliance refresh cycle (yrs)", "applianceRefreshCycleYears", { min: 1, icon: RefreshCw })}
            {num("Years until next refresh", "yearsUntilNextApplianceRefresh", { min: 0, icon: Clock })}
          </>
        )
      ) : (
        <>
          {num("Recording server ($/unit)", "serverCost", { icon: Server })}
          {num("Cameras per server", "serverCapacity", { min: 1, icon: Layers })}
          {num("Storage ($/TB usable)", "storageCostPerTB", { icon: HardDrive })}
          <Select
            label={<InfoLabel label="Storage redundancy" help={RAID_HELP} extra={<SourceDot meta={fieldSourceInfo("raidLevel", sol.raidLevel, ...vendorEntries)} />} />}
            leftSection={icon(HardDrive)}
            data={RAID_OPTIONS}
            value={sol.raidLevel}
            allowDeselect={false}
            onChange={(v) => v && set("raidLevel", v as RaidLevel)}
          />
          {num("Refresh cycle (yrs)", "refreshCycleYears", { min: 1, icon: RefreshCw })}
          {num("Years until next refresh", "yearsUntilNextRefresh", { min: 0, icon: Clock })}
        </>
      )}

      <SectionLabel>Operations</SectionLabel>
      {num("Truck rolls / site / yr", "truckRollsPerSiteYr", { step: 0.5, decimalScale: 1, icon: Truck })}
      {num("Admin labor (hrs/cam/yr)", "adminHrsPerCamYr", { step: 0.1, decimalScale: 1, icon: UserCog })}
      {num("Hrs per investigation", "investigationHrsPerIncident", { step: 0.25, decimalScale: 2, icon: Search })}

      {sol.model === "onprem" && (
        <>
          <SectionLabel>Analytics</SectionLabel>
          {num("Analytics appliance ($/site)", "analyticsApplianceCost", {
            icon: Cpu,
            help: "Per site, not per fleet: an on-prem analytics appliance runs against that site's own recording servers, so a multi-site deployment needs one at each site. Recurs on the same refresh cycle as the servers/storage above.",
          })}
          {num("Analytics software license ($/cam, one-time)", "analyticsSoftwareCostPerCam", {
            icon: BrainCircuit,
            help: "Per camera, not per site — analytics software is licensed per device analyzed, not per piece of infrastructure. Charged once at year 0, same as the base/device license, unless this solution is marked incumbent above (already owned, not charged again), and unlike the analytics appliance above, doesn't recur at hardware refresh — a software license isn't tied to the server hardware it happens to run on.",
          })}
          {num("Analytics software ($/cam/yr)", "analyticsSoftwareCostPerCamYr", {
            icon: BrainCircuit,
            help: "A separate, purely additive ongoing per-camera annual cost, for vendors that also charge a recurring analytics subscription on top of the one-time license above. Defaults to $0 (\"bundled into the one-time license\").",
          })}
        </>
      )}

      <SectionLabel>Misc / other</SectionLabel>
      {num("Upfront, one-time ($)", "miscUpfrontCost", { icon: PackagePlus, help: MISC_UPFRONT_HELP })}
      {num("Ongoing, per year ($)", "miscAnnualCost", { icon: CalendarClock, help: MISC_ANNUAL_HELP })}
    </SimpleGrid>
  );
}
