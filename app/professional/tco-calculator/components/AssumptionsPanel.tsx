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
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
      {num("Discount off list (%)", "discountPct", { min: 0 })}
      {num("Replacement camera ($/cam)", "cameraCost")}
      {num("Bulk install labor ($/cam, year 0)", "bulkInstallLaborCost")}
      {num("Replacement install labor ($/cam)", "replacementInstallLaborCost")}
      {num(
        <InfoLabel label="Camera fleet half-life (yrs)" help="A rough estimate of camera lifespan. About half of today's cameras will have failed and been replaced by this many years from now, half of what's left by twice that many years, and so on, the same math as radioactive half-life." />,
        "fleetHalfLifeYears", { step: 0.5, decimalScale: 1, min: 0.5 }
      )}
      {num(
        <InfoLabel label="Warranty period (yrs)" help="How many years new camera hardware is covered by the manufacturer's warranty. A failure within this window is assumed to cost only the labor to swap the unit, not the hardware itself." />,
        "warrantyYears", { step: 0.5, decimalScale: 1 }
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
          {num("License cost for that term ($/cam)", "tierPrice")}
          <div style={{ gridColumn: "1 / -1" }}>
            <Text size="xs" c={TEXT_MUTED}>
              &asymp; ${perYear.toFixed(2)}/yr per camera before the retention multiplier. Other ongoing costs
              are assumed bundled into the license.
            </Text>
          </div>
          {sol.migrationStrategy === "connector" && (
            <>
              {num("Cloud connector appliance ($/unit)", "applianceCost")}
              {num("Cameras per appliance", "applianceCapacity", { min: 1 })}
            </>
          )}
        </>
      ) : (
        <>
          {num("Base license ($, owned)", "baseLicense")}
          {num("Device license ($/cam, owned)", "deviceLicense")}
          {num("Support renewal (% of license/yr)", "carePct")}
          {num("Recording server ($/unit)", "serverCost")}
          {num("Cameras per recording server", "serverCapacity", { min: 1 })}
          {num("Storage ($/TB usable)", "storageCostPerTB")}
          <Select
            label={<InfoLabel label="Storage redundancy" help={RAID_HELP} />}
            data={RAID_OPTIONS}
            value={sol.raidLevel}
            allowDeselect={false}
            onChange={(v) => v && set("raidLevel", v as RaidLevel)}
          />
          {num("Analytics appliance hardware ($)", "analyticsApplianceCost")}
          {num("Analytics software ($/yr)", "analyticsSoftwareCost")}
          {num("Hardware refresh cycle (yrs)", "refreshCycleYears", { min: 1 })}
          {num("Years until next refresh", "yearsUntilNextRefresh", { min: 0 })}
        </>
      )}
    </SimpleGrid>
  );
}
