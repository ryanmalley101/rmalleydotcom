"use client";

import { Alert, Box, Group, NumberInput, SegmentedControl, Select, SimpleGrid, Text } from "@mantine/core";
import {
  AlertTriangle, ArrowRightLeft, BrainCircuit, CalendarRange, Camera, Clock, Cpu, DollarSign,
  FileText, Hammer, HardDrive, Headset, Hourglass, Layers, Percent,
  RefreshCw, Router, Search, Server, ShieldCheck, Tag, Truck, UserCog, Wrench,
} from "lucide-react";
import type { CloudMigrationStrategy, RaidLevel, ScenarioInputs, SolutionInputs } from "../lib/model";
import { TEXT_MUTED } from "../lib/colors";
import { CLOUD_VENDOR_DEFAULTS, ONPREM_VMS_VENDOR_DEFAULTS, ONPREM_CAMERA_VENDOR_DEFAULTS, fieldSourceInfo } from "../lib/vendorDefaults";
import InfoLabel from "./InfoLabel";
import SourceDot from "./SourceDot";
import MiscItemsEditor from "./MiscItemsEditor";
import CameraStrategyControl from "./CameraStrategyControl";
import { ADMIN_HOURS_HELP, HALF_LIFE_HELP, INVESTIGATION_HOURS_HELP, STORAGE_PRICE_HELP, TRUCK_ROLLS_HELP } from "../lib/fieldHelp";
import { withWarranty } from "../lib/defaults";

const icon = (Icon: React.ElementType) => <Icon size={15} />;

const MIGRATION_STRATEGY_HELP =
  "\"Reuse cameras\" keeps the existing fleet running behind a connector/NVR-style box, swapping individual cameras only as they fail. \"Replace all cameras\" buys out the whole fleet with native ones on day one instead. On a new site with no cameras to reuse, a connector setup still buys its cameras at year 0, plus the connector.";

const RAID_HELP =
  "How the on-prem storage is protected against a drive failure. No RAID and RAID 0 (striping) need only the usable capacity but have no redundancy, a single drive failure loses data. RAID 1 (mirroring) and RAID 10 (striped mirrors) roughly double the raw storage bought, to survive a drive failure.";

const RAID_OPTIONS: { value: RaidLevel; label: string }[] = [
  { value: "none", label: "No RAID" },
  { value: "raid0", label: "RAID 0 (striping)" },
  { value: "raid1", label: "RAID 1 (mirroring)" },
  { value: "raid10", label: "RAID 10 (striped mirrors)" },
];

const LICENSE_HELP =
  "Before the retention multiplier. Billed as a lump sum at purchase and at every renewal (year 0, then every term-length years), not smoothed evenly across each year in between — the $/yr figure below is just an average for reference. Support, software updates, and analytics are assumed bundled into the license by default; use the add-on field below if this vendor prices any of that separately.";

const ADDON_HELP =
  "Not every cloud vendor bundles everything into one flat license price the way this tool's defaults assume. If this vendor charges separately for support, analytics, or extended retention, add the per-camera annual cost here; leave at $0 if it's genuinely all-inclusive.";

const NEXT_REFRESH_HELP =
  "How many years until the already-installed hardware is next replaced. Only shown for the incumbent: a solution bought new at year 0 gets its first refresh one full refresh cycle later.";

const ONPREM_LICENSE_HELP =
  "Charged once at year 0, same as the hardware, unless this solution is marked incumbent above (already owned, not charged again). Only the support/care renewal below recurs afterward.";

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
  const vendorEntries =
    sol.model === "cloud"
      ? [CLOUD_VENDOR_DEFAULTS[sol.name]]
      : [sol.vmsProvider ? ONPREM_VMS_VENDOR_DEFAULTS[sol.vmsProvider] : undefined,
         sol.cameraProvider ? ONPREM_CAMERA_VENDOR_DEFAULTS[sol.cameraProvider] : undefined];

  const num = (
    label: React.ReactNode,
    key: keyof SolutionInputs,
    opts?: {
      step?: number; decimalScale?: number; min?: number; icon?: React.ElementType; help?: string; int?: boolean;
      onValue?: (v: number) => void;
    }
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
        allowDecimal={!opts?.int}
        onChange={(v) => (opts?.onValue ? opts.onValue(Number(v) || 0) : set(key, (Number(v) || 0) as SolutionInputs[typeof key]))}
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
      <CameraStrategyControl sol={sol} scenario={scenario} onChange={onChange} compact />
      {num("Camera ($/cam)", "cameraCost", { icon: Camera, help: "Price of one camera, used for a new fleet at year 0 and for out-of-warranty replacements." })}
      {num("Year-0 install / onboarding ($/cam)", "bulkInstallLaborCost", {
        icon: Wrench,
        help: "Labor per camera when this solution is first deployed: a planned install for new cameras, or onboarding existing cameras onto the new system. Not charged for the incumbent.",
      })}
      {num("Replacement install labor ($/cam)", "replacementInstallLaborCost", { icon: Hammer })}
      {num("Fleet half-life (yrs)", "fleetHalfLifeYears", {
        step: 0.5, decimalScale: 1, min: 0.5, icon: Hourglass,
        help: HALF_LIFE_HELP,
      })}
      {num("Warranty (yrs)", "warrantyYears", {
        step: 0.5, decimalScale: 1, icon: ShieldCheck, onValue: (w) => onChange(withWarranty(sol, w)),
        help: "How many years new camera hardware is covered by the manufacturer's warranty. A failure within this window is assumed to cost only the labor to swap the unit, not the hardware itself.",
      })}

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
          {num("License term (years)", "tierYears", { min: 1, int: true, icon: CalendarRange })}
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
            {num("Cameras per appliance", "applianceCapacity", { min: 1, int: true, icon: Layers })}
            {num("Connector warranty (yrs)", "applianceWarrantyYears", {
              step: 0.5, decimalScale: 1, icon: ShieldCheck,
              help: "The manufacturer's hardware warranty on the connector/appliance itself, separate from the camera warranty above since the two commonly differ for the same vendor. Reference only, doesn't change the refresh cost below.",
            })}
            {num("Appliance refresh cycle (yrs)", "applianceRefreshCycleYears", { min: 1, int: true, icon: RefreshCw })}
            {isIncumbent && num("Years until next refresh", "yearsUntilNextApplianceRefresh", { min: 0, int: true, icon: Clock, help: NEXT_REFRESH_HELP })}
            <StaleRefreshWarning
              isIncumbent={isIncumbent} yearsUntilNextRefresh={sol.yearsUntilNextApplianceRefresh}
              horizonYears={scenario.horizonYears} what="the connector appliance cost"
            />
          </>
        )
      ) : (
        <>
          {num("Recording server ($/unit)", "serverCost", { icon: Server })}
          {num("Cameras per server", "serverCapacity", { min: 1, int: true, icon: Layers })}
          {num("Storage ($/TB raw)", "storageCostPerTB", { icon: HardDrive, help: STORAGE_PRICE_HELP })}
          <Select
            label={<InfoLabel label="Storage redundancy" help={RAID_HELP} extra={<SourceDot meta={fieldSourceInfo("raidLevel", sol.raidLevel, ...vendorEntries)} />} />}
            leftSection={icon(HardDrive)}
            data={RAID_OPTIONS}
            value={sol.raidLevel}
            allowDeselect={false}
            onChange={(v) => v && set("raidLevel", v as RaidLevel)}
          />
          {num("Refresh cycle (yrs)", "refreshCycleYears", { min: 1, int: true, icon: RefreshCw })}
          {isIncumbent && num("Years until next refresh", "yearsUntilNextRefresh", { min: 0, int: true, icon: Clock, help: NEXT_REFRESH_HELP })}
          <StaleRefreshWarning
            isIncumbent={isIncumbent} yearsUntilNextRefresh={sol.yearsUntilNextRefresh}
            horizonYears={scenario.horizonYears} what="server, storage, and analytics appliance costs"
          />
        </>
      )}

      <SectionLabel>Operations</SectionLabel>
      {num("Truck rolls / site / yr", "truckRollsPerSiteYr", { step: 0.5, decimalScale: 1, icon: Truck, help: TRUCK_ROLLS_HELP })}
      {num("Admin hrs / cam / yr", "adminHrsPerCamYr", { step: 0.1, decimalScale: 1, icon: UserCog, help: ADMIN_HOURS_HELP })}
      {num("Hrs per investigation", "investigationHrsPerIncident", { step: 0.25, decimalScale: 2, icon: Search, help: INVESTIGATION_HOURS_HELP })}

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
      <MiscItemsEditor items={sol.miscItems} onChange={(miscItems) => onChange({ ...sol, miscItems })} />
    </SimpleGrid>
  );
}
