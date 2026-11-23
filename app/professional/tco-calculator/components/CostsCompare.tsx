"use client";

import { Select, Stack, Switch, Text } from "@mantine/core";
import {
  ArrowRightLeft, BrainCircuit, CalendarRange, Camera, Clock, Cpu, Database, DollarSign, FileText, Globe, Hammer, HardDrive,
  Headset, Hourglass, Layers, ListPlus, Percent, RefreshCw, Router, Search, Server, ShieldCheck, Tag, Truck, UserCog, Wrench, Zap,
} from "lucide-react";
import type { CloudMigrationStrategy, OnpremCameraStrategy, RaidLevel, RetentionPricing, ScenarioInputs, SolutionInputs } from "../lib/model";
import { chooseApplianceOption } from "../lib/model";
import { SOLUTION_FIELD_MAP, RAID_OPTIONS } from "../lib/fields";
import { RAID_HELP } from "../lib/fieldHelp";
import { defaultSolution, withAnalytics } from "../lib/defaults";
import { sanitizeScenario, sanitizeSolution } from "../lib/sanitize";
import { fieldSourceInfo, vendorEntriesFor } from "../lib/vendorDefaults";
import { fmtUsd, TEXT_MUTED } from "../../_tco-shared/lib/colors";
import { fieldDomId, flaggedFields, type ChecklistItem } from "../../_tco-shared/lib/checklist";
import { CompareGrid, CompareModalCell, CompareNote, CompareRow, CompareSection, type CompareSide } from "../../_tco-shared/components/CompareGrid";
import { StaleRefreshWarning } from "../../_tco-shared/components/FormParts";
import MiscItemsEditor from "../../_tco-shared/components/MiscItemsEditor";
import NumberField from "../../_tco-shared/components/NumberField";
import SourceDot from "../../_tco-shared/components/SourceDot";
import SolutionField from "./SolutionField";
import ConnectorFields from "./ConnectorFields";

const CAMERAS_HELP =
  "Whether a newly deployed solution keeps the cameras already on site or buys a new fleet at year 0. A cloud system keeps them behind a connector appliance, swapping cameras only as they fail; an on-prem VMS adds them directly. On a new site with no cameras to reuse, an on-prem solution always buys cameras, and a cloud connector setup buys them plus the connector.";
const RETENTION_PRICING_HELP =
  "Whether this vendor charges more for its license as retention goes up. \"Rises with retention\" scales the license by (days/30)^0.4 above 30 days. \"Fixed\" is for vendors that record on the camera or a local appliance and sell longer retention as bigger hardware or a separate archive add-on; enter that cost in the camera or add-on fields.";
const RENEWAL_HELP =
  "How many years until the license already in place has to be renewed; 0 means it's due now and is bought at year 0. After that it renews every term. Only for the incumbent: a new purchase buys its first term at year 0.";
const CONNECTOR_HELP =
  "Connector appliances for keeping existing cameras on a cloud system: at least one per site, more if the camera count needs it. With several models, the cheapest that covers the cameras at the scenario's retention is used.";
const ANALYTICS_HELP =
  "Whether this on-prem solution includes AI video search. On adds the analytics hardware and software below and moves hours per investigation to the faster with-search default. Cloud solutions are assumed to bundle search in their license.";
const MISC_HELP =
  "Your own cost or savings line items, for anything in a real quote that doesn't fit a field here. A negative amount is a cost offset.";

export const modelLabel = (sol: SolutionInputs) => (sol.model === "cloud" ? "Cloud / Hybrid" : "On-Prem");

// Every cost input for both solutions, one row per field (see CompareGrid).
// Replaces the two separate per-solution assumption panels the results page
// used to have, where comparing one input across both meant opening both and
// scrolling between them. Same fields, labels, and help as the wizard's
// solution cards, from lib/fields.ts. Each row is essential or `advanced`
// (see CompareGrid): essential ones are the inputs the flip-point search and
// the checklist treat as deciding a comparison, that a user can supply from a
// quote or their own operations.
export default function CostsCompare({ solA, solB, scenario, onChangeA, onChangeB, sides, checklist }: {
  solA: SolutionInputs;
  solB: SolutionInputs;
  scenario: ScenarioInputs;
  onChangeA: (v: SolutionInputs) => void;
  onChangeB: (v: SolutionInputs) => void;
  sides: [CompareSide, CompareSide];
  checklist: ChecklistItem[];
}) {
  const sols = { a: solA, b: solB };
  const onChange = { a: onChangeA, b: onChangeB };
  const flags = { a: flaggedFields(checklist, "a"), b: flaggedFields(checklist, "b") };
  const nameOf = { a: sides[0].name, b: sides[1].name };
  const isIncumbent = (sol: SolutionInputs) => scenario.incumbent === sol.id;
  const applies = (sol: SolutionInputs, key: keyof SolutionInputs) => {
    const models = SOLUTION_FIELD_MAP[key].models;
    return !models || models.includes(sol.model);
  };
  // Still on what it started as: the generic default, or the picked vendor's
  // researched value. Anything else was edited, and an edited advanced row
  // stays visible in Essential so a change to a total is never hidden.
  const generic = { a: defaultSolution("a", solA.name, solA.model), b: defaultSolution("b", solB.name, solB.model) };
  const atDefault = (sol: SolutionInputs, key: keyof SolutionInputs) =>
    sol[key] === generic[sol.id][key] || fieldSourceInfo(key, sol[key], ...vendorEntriesFor(sol)) !== null;
  const keep = (key: keyof SolutionInputs, shown: (sol: SolutionInputs) => boolean = () => true) =>
    [solA, solB].some((sol) => shown(sol) && (flags[sol.id].has(key) || !atDefault(sol, key)));

  const input = (sol: SolutionInputs, key: keyof SolutionInputs) => (
    <SolutionField
      sol={sol} field={key} onChange={onChange[sol.id]} bare
      id={fieldDomId(sol.id, key)} ariaLabel={`${SOLUTION_FIELD_MAP[key].label}, ${nameOf[sol.id]}`} flag={flags[sol.id].get(key)}
    />
  );
  // A numeric field's row: shown for a side when the field belongs to its
  // deployment model and `when` holds.
  const row = (
    key: keyof SolutionInputs, icon: React.ElementType, advanced = false,
    when: (sol: SolutionInputs) => boolean = () => true, hint?: (sol: SolutionInputs) => string,
  ) => {
    const cell = (sol: SolutionInputs) => {
      if (!applies(sol, key) || !when(sol)) return null;
      if (!hint) return input(sol, key);
      return <Stack gap={2}>{input(sol, key)}<Text size="xs" c={TEXT_MUTED}>{hint(sol)}</Text></Stack>;
    };
    const def = SOLUTION_FIELD_MAP[key];
    return (
      <CompareRow
        key={key} label={def.label} help={def.help} icon={icon} a={cell(solA)} b={cell(solB)}
        advanced={advanced} keep={advanced && keep(key, (sol) => applies(sol, key) && when(sol))}
      />
    );
  };
  const select = <V extends string>(sol: SolutionInputs, key: keyof SolutionInputs, value: V, data: { value: V; label: string }[], set: (v: V) => SolutionInputs) => (
    <Select
      id={fieldDomId(sol.id, key)} aria-label={`${SOLUTION_FIELD_MAP[key].label}, ${nameOf[sol.id]}`}
      data={data} value={value} allowDeselect={false} onChange={(v) => v && onChange[sol.id](set(v as V))}
      leftSection={<SourceDot meta={fieldSourceInfo(key, sol[key], ...vendorEntriesFor(sol))} />}
      leftSectionPointerEvents="auto"
    />
  );

  const camerasCell = (sol: SolutionInputs) => {
    if (sol.model === "cloud") {
      return select<CloudMigrationStrategy>(sol, "migrationStrategy", sol.migrationStrategy, [
        { value: "connector", label: "Reuse (connector)" },
        { value: "ripReplace", label: "Replace all" },
      ], (v) => ({ ...sol, migrationStrategy: v }));
    }
    if (scenario.existingCamerasReusable === false) return null;
    return select<OnpremCameraStrategy>(sol, "onpremCameraStrategy", sol.onpremCameraStrategy ?? "reuse", [
      { value: "reuse", label: "Reuse existing" },
      { value: "replace", label: "Buy new" },
    ], (v) => ({ ...sol, onpremCameraStrategy: v }));
  };

  const connectorCell = (sol: SolutionInputs) => {
    if (sol.model !== "cloud" || sol.migrationStrategy !== "connector") return null;
    const scn = sanitizeScenario(scenario);
    const chosen = sol.applianceOptions?.length ? chooseApplianceOption(sanitizeSolution(sol).applianceOptions, scn) : null;
    const units = Math.max(scn.sites, Math.ceil(scn.cameras / Math.max(1, sol.applianceCapacity)));
    const summary = chosen
      ? `${chosen.units.toLocaleString()} × ${chosen.option.label || "unnamed model"}, ${fmtUsd(chosen.total)} list (cheapest of ${sol.applianceOptions.length} models)`
      : `${units.toLocaleString()} × ${fmtUsd(sol.applianceCost)}, ${sol.applianceCapacity} cameras each`;
    return (
      <CompareModalCell id={fieldDomId(sol.id, "applianceCost")} summary={summary} title={`Connector appliances: ${nameOf[sol.id]}`}>
        <ConnectorFields sol={sol} scenario={scenario} onChange={onChange[sol.id]} />
      </CompareModalCell>
    );
  };

  const renewalCell = (sol: SolutionInputs) => {
    if (sol.model !== "cloud" || !isIncumbent(sol)) return null;
    return (
      <NumberField
        bare id={fieldDomId(sol.id, "yearsUntilLicenseRenewal")} ariaLabel={`Years until license renewal, ${nameOf[sol.id]}`}
        def={{ ...SOLUTION_FIELD_MAP.yearsUntilLicenseRenewal, min: 0, int: true }} meta={null}
        flag={flags[sol.id].get("yearsUntilLicenseRenewal")}
        value={sol.yearsUntilLicenseRenewal ?? sol.tierYears}
        onChange={(n) => onChange[sol.id]({ ...sol, yearsUntilLicenseRenewal: n })}
      />
    );
  };

  const staleWarnings = (["a", "b"] as const).map((id) => {
    const sol = sols[id];
    const cloudConnector = sol.model === "cloud" && sol.migrationStrategy === "connector";
    if (sol.model === "cloud" && !cloudConnector) return null;
    return (
      <StaleRefreshWarning
        key={id} name={nameOf[id]} isIncumbent={isIncumbent(sol)} horizonYears={scenario.horizonYears}
        yearsUntilNextRefresh={cloudConnector ? sol.yearsUntilNextApplianceRefresh : sol.yearsUntilNextRefresh}
        what={cloudConnector ? "the connector appliance cost" : "server, storage, and any analytics appliance costs"}
      />
    );
  });

  const miscCell = (sol: SolutionInputs) => {
    const items = sol.miscItems ?? [];
    return (
      <CompareModalCell
        id={fieldDomId(sol.id, "miscItems")} title={`Misc / other items: ${nameOf[sol.id]}`}
        summary={items.length ? `${items.length} item${items.length === 1 ? "" : "s"}: ${items.map((i) => i.label || "unnamed").join(", ")}` : "None"}
      >
        <MiscItemsEditor items={items} onChange={(miscItems) => onChange[sol.id]({ ...sol, miscItems })} />
      </CompareModalCell>
    );
  };

  const onprem = (sol: SolutionInputs) => sol.model === "onprem";
  const connector = (sol: SolutionInputs) => sol.model === "cloud" && sol.migrationStrategy === "connector";

  const cloudSide = (sol: SolutionInputs) => sol.model === "cloud";
  const analyticsOn = (sol: SolutionInputs) => sol.analyticsEnabled === true;
  const retentionCell = (sol: SolutionInputs) =>
    cloudSide(sol) ? select<RetentionPricing>(sol, "retentionPricing", sol.retentionPricing ?? "scaled", RETENTION_OPTIONS, (v) => ({ ...sol, retentionPricing: v })) : null;
  const raidCell = (sol: SolutionInputs) =>
    onprem(sol) ? select<RaidLevel>(sol, "raidLevel", sol.raidLevel, RAID_OPTIONS, (v) => ({ ...sol, raidLevel: v })) : null;
  const analyticsCell = (sol: SolutionInputs) =>
    onprem(sol) ? (
      <Switch
        aria-label={`AI video search, ${nameOf[sol.id]}`} checked={analyticsOn(sol)}
        onChange={(e) => onChange[sol.id](withAnalytics(sol, e.currentTarget.checked))}
      />
    ) : null;

  return (
    <CompareGrid sides={sides}>
      <CompareSection title="Pricing">
        {row("discountPct", Percent)}
        {row("licenseDiscountPct", Percent)}
      </CompareSection>

      <CompareSection title="Camera hardware">
        <CompareRow label="Existing cameras" help={CAMERAS_HELP} icon={ArrowRightLeft} a={camerasCell(solA)} b={camerasCell(solB)} />
        {row("cameraCost", Camera)}
        {row("bulkInstallLaborCost", Wrench, true)}
        {row("replacementInstallLaborCost", Hammer, true)}
        {row("fleetHalfLifeYears", Hourglass, true)}
        {row("warrantyYears", ShieldCheck, true)}
      </CompareSection>

      <CompareSection title="Licensing">
        {row("tierYears", CalendarRange)}
        {row("tierPrice", DollarSign, false, undefined, (sol) => `≈ $${(sol.tierPrice / Math.max(1, sol.tierYears)).toFixed(2)}/yr per camera, before retention`)}
        <CompareRow
          label={SOLUTION_FIELD_MAP.retentionPricing.label} help={RETENTION_PRICING_HELP} icon={Database}
          a={retentionCell(solA)} b={retentionCell(solB)} advanced keep={keep("retentionPricing", cloudSide)}
        />
        {row("supportAddonPerCamYr", Headset, true)}
        <CompareRow label="Years until license renewal" help={RENEWAL_HELP} icon={Clock} a={renewalCell(solA)} b={renewalCell(solB)} />
        {row("baseLicense", FileText)}
        {row("deviceLicense", Tag)}
        {row("carePct", ShieldCheck)}
      </CompareSection>

      <CompareSection title="Infrastructure">
        <CompareRow label="Connector appliances" help={CONNECTOR_HELP} icon={Router} a={connectorCell(solA)} b={connectorCell(solB)} />
        {row("applianceRefreshCycleYears", RefreshCw, true, connector)}
        {row("yearsUntilNextApplianceRefresh", Clock, false, (sol) => connector(sol) && isIncumbent(sol))}
        {row("serverCost", Server)}
        {row("serverCapacity", Layers, true)}
        {row("serverSoftwareCost", FileText, true)}
        {row("managementServers", Server, true)}
        {row("storageCostPerTB", HardDrive, true)}
        <CompareRow
          label="Storage redundancy" help={RAID_HELP} icon={HardDrive}
          a={raidCell(solA)} b={raidCell(solB)} advanced keep={keep("raidLevel", onprem)}
        />
        {row("raidArrayDrives", HardDrive, true, (sol) => sol.raidLevel === "raid5" || sol.raidLevel === "raid6")}
        {row("refreshCycleYears", RefreshCw, true)}
        {row("yearsUntilNextRefresh", Clock, false, isIncumbent)}
        {staleWarnings.some(Boolean) && <CompareNote><Stack gap={6}>{staleWarnings}</Stack></CompareNote>}
      </CompareSection>

      <CompareSection title="Operations">
        {row("truckRollsPerSiteYr", Truck)}
        {row("networkCostPerSiteYr", Globe, true)}
        {row("powerWattsPerCam", Zap, true)}
        {row("adminHrsPerCamYr", UserCog)}
        {row("investigationHrsPerIncident", Search)}
      </CompareSection>

      <CompareSection title="Analytics">
        <CompareRow label={SOLUTION_FIELD_MAP.analyticsEnabled.label} help={ANALYTICS_HELP} icon={BrainCircuit} a={analyticsCell(solA)} b={analyticsCell(solB)} />
        {row("analyticsApplianceCost", Cpu, false, analyticsOn)}
        {row("analyticsApplianceCapacity", Layers, true, analyticsOn)}
        {row("analyticsSoftwareCostPerCam", BrainCircuit, true, analyticsOn)}
        {row("analyticsSoftwareCostPerCamYr", BrainCircuit, true, analyticsOn)}
      </CompareSection>

      <CompareSection title="Misc / other">
        <CompareRow
          label="Your own line items" help={MISC_HELP} icon={ListPlus} a={miscCell(solA)} b={miscCell(solB)}
          advanced keep={(solA.miscItems?.length ?? 0) + (solB.miscItems?.length ?? 0) > 0}
        />
      </CompareSection>
    </CompareGrid>
  );
}

const RETENTION_OPTIONS: { value: RetentionPricing; label: string }[] = [
  { value: "scaled", label: "Rises with retention" },
  { value: "flat", label: "Fixed (stored on site)" },
];
