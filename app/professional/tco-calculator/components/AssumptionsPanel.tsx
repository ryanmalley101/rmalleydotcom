"use client";

import { Box, NumberInput, SegmentedControl, Select, SimpleGrid, Text } from "@mantine/core";
import type { CloudMigrationStrategy, RaidLevel, SolutionInputs } from "../lib/model";
import { TEXT_MUTED } from "../lib/colors";
import InfoLabel from "./InfoLabel";

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

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{ gridColumn: "1 / -1" }}>
    <Text size="xs" fw={700} tt="uppercase" c={TEXT_MUTED} style={{ letterSpacing: 0.5 }} mt="xs">
      {children}
    </Text>
  </div>
);

export default function AssumptionsPanel({ sol, onChange }: { sol: SolutionInputs; onChange: (v: SolutionInputs) => void }) {
  const set = <K extends keyof SolutionInputs>(key: K, v: SolutionInputs[K]) => onChange({ ...sol, [key]: v });
  const num = (
    label: React.ReactNode,
    key: keyof SolutionInputs,
    opts?: { step?: number; decimalScale?: number; min?: number }
  ) => (
    <NumberInput
      label={label}
      value={sol[key] as number}
      min={opts?.min ?? 0}
      step={opts?.step}
      decimalScale={opts?.decimalScale}
      onChange={(v) => set(key, (Number(v) || 0) as SolutionInputs[typeof key])}
    />
  );
  const perYear = sol.tierPrice / Math.max(1, sol.tierYears);

  return (
    <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
      {num("Discount off list (%)", "discountPct", { min: 0 })}
      {num("Replacement camera ($/cam)", "cameraCost")}
      {num("Bulk install labor ($/cam)", "bulkInstallLaborCost")}
      {num("Replacement install labor ($/cam)", "replacementInstallLaborCost")}
      {num(
        <InfoLabel label="Fleet half-life (yrs)" help="A rough estimate of camera lifespan. About half of today's cameras will have failed and been replaced by this many years from now, half of what's left by twice that many years, and so on, the same math as radioactive half-life." />,
        "fleetHalfLifeYears", { step: 0.5, decimalScale: 1, min: 0.5 }
      )}
      {num(
        <InfoLabel label="Warranty (yrs)" help="How many years new camera hardware is covered by the manufacturer's warranty. A failure within this window is assumed to cost only the labor to swap the unit, not the hardware itself." />,
        "warrantyYears", { step: 0.5, decimalScale: 1 }
      )}
      {num(
        <InfoLabel label="Framerate (fps)" help={FRAMERATE_HELP} />,
        "framerateFps", { step: 1, min: 1 }
      )}
      {num("Truck rolls / site / yr", "truckRollsPerSiteYr", { step: 0.5, decimalScale: 1 })}
      {num("Admin labor (hrs/cam/yr)", "adminHrsPerCamYr", { step: 0.1, decimalScale: 1 })}
      {num("Hrs per investigation", "investigationHrsPerIncident", { step: 0.25, decimalScale: 2 })}

      {sol.model === "cloud" ? (
        <>
          <div style={{ gridColumn: "1 / -1" }}>
            <Box mb={4}>
              <InfoLabel label="Migration strategy" help={MIGRATION_STRATEGY_HELP} size="var(--mantine-font-size-xs)" color={TEXT_MUTED} />
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
          {num("License term (years)", "tierYears", { min: 1 })}
          {num("License cost for term ($/cam)", "tierPrice")}
          <div style={{ gridColumn: "1 / -1" }}>
            <InfoLabel label={`≈ $${perYear.toFixed(2)}/yr per camera`} help={LICENSE_HELP} size="var(--mantine-font-size-xs)" color={TEXT_MUTED} />
          </div>
          {num(<InfoLabel label="Support/analytics add-on ($/cam/yr)" help={ADDON_HELP} />, "supportAddonPerCamYr")}
          {sol.migrationStrategy === "connector" && (
            <>
              {num("Connector appliance ($/unit)", "applianceCost")}
              {num("Cameras per appliance", "applianceCapacity", { min: 1 })}
              {num("Appliance refresh cycle (yrs)", "applianceRefreshCycleYears", { min: 1 })}
              {num("Years until next refresh", "yearsUntilNextApplianceRefresh", { min: 0 })}
            </>
          )}
        </>
      ) : (
        <>
          {num(<InfoLabel label="Base license ($, one-time)" help={ONPREM_LICENSE_HELP} />, "baseLicense")}
          {num(<InfoLabel label="Device license ($/cam, one-time)" help={ONPREM_LICENSE_HELP} />, "deviceLicense")}
          {num("Support renewal (%/yr)", "carePct")}
          {num("Recording server ($/unit)", "serverCost")}
          {num("Cameras per server", "serverCapacity", { min: 1 })}
          {num("Storage ($/TB usable)", "storageCostPerTB")}
          <Select
            label={<InfoLabel label="Storage redundancy" help={RAID_HELP} />}
            data={RAID_OPTIONS}
            value={sol.raidLevel}
            allowDeselect={false}
            onChange={(v) => v && set("raidLevel", v as RaidLevel)}
          />
          {num("Refresh cycle (yrs)", "refreshCycleYears", { min: 1 })}
          {num("Years until next refresh", "yearsUntilNextRefresh", { min: 0 })}

          <SectionLabel>Analytics</SectionLabel>
          {num("Analytics appliance ($)", "analyticsApplianceCost")}
          {num("Analytics software ($/yr)", "analyticsSoftwareCost")}
        </>
      )}
    </SimpleGrid>
  );
}
