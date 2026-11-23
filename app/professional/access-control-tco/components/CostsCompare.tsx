"use client";

import { useState } from "react";
import { Stack, Switch, Text } from "@mantine/core";
import {
  BellRing, CalendarRange, CircuitBoard, Clock, CreditCard, DollarSign, DoorClosed, FileText, Globe, Hammer, HardDrive,
  Hourglass, IdCard, Layers, ListPlus, Percent, RefreshCw, ScanLine, Server, ShieldCheck, Smartphone, Store, Tag, Truck,
  UserCog, Users, Wrench,
} from "lucide-react";
import type { ScenarioInputs, SolutionInputs } from "../lib/model";
import { SOLUTION_FIELD_MAP } from "../lib/fields";
import { defaultSolution } from "../lib/defaults";
import { fieldSourceInfo } from "../lib/vendorDefaults";
import { TEXT_MUTED } from "../../_tco-shared/lib/colors";
import { fieldDomId, flaggedFields, type ChecklistItem } from "../../_tco-shared/lib/checklist";
import { CompareGrid, CompareModalCell, CompareNote, CompareRow, CompareSection, type CompareSide } from "../../_tco-shared/components/CompareGrid";
import { StaleRefreshWarning } from "../../_tco-shared/components/FormParts";
import MiscItemsEditor from "../../_tco-shared/components/MiscItemsEditor";
import NumberField from "../../_tco-shared/components/NumberField";
import SolutionField from "./SolutionField";

const REUSE_HELP = {
  reusesReaders:
    "On wired doors: keep the readers already installed, which is common when they're Wiegand or OSDP and this platform supports them, or buy new ones at year 0. Kept readers fail on the existing hardware's age and reliability.",
  reusesControllers:
    "On wired doors: keep the controllers (panels) already installed, or buy new ones at year 0. Many platforms, cloud and server-based alike, run on Mercury-compatible panels and can keep them; others only work with their own. Off by default; confirm against the vendor's supported hardware.",
};
const MOBILE_HELP =
  "Some cardholders use their phone instead of a card. They need no card, but a vendor may charge a yearly fee per mobile user.";
const REISSUE_HELP =
  "Issue a new card to every card-carrying cardholder at year 0, for example to move off 125 kHz proximity cards to secure ones, with the staff time to enroll each. That usually needs readers that can read the new cards. New doors always issue credentials.";
const RENEWAL_HELP =
  "How many years until the license already in place has to be renewed; 0 means it's due now and is bought at year 0. After that it renews every term. Only for the incumbent: a new purchase buys its first term at year 0.";
const MISC_HELP =
  "Your own cost or savings line items, for anything in a real quote that doesn't fit a field here. A negative amount is a cost offset.";

export const modelLabel = (sol: SolutionInputs) => (sol.model === "cloud" ? "Cloud" : "Server-based");

// Every cost input for both solutions, one row per field (see CompareGrid).
// Same fields, labels, and help as the wizard's SolutionForm, from
// lib/fields.ts; replaces the two per-solution panels the results page had.
// Each row is essential or `advanced` (see CompareGrid): essential ones are
// the inputs the flip-point search and the checklist treat as deciding a
// comparison, that a user can supply from a quote or their own operations.
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
  const wired = scenario.existingDoorsInstalled !== false;
  const isIncumbent = (sol: SolutionInputs) => scenario.incumbent === sol.id;
  const cloud = (sol: SolutionInputs) => sol.model === "cloud";
  // Shown while on, or once switched on; switching off zeros the share, so a
  // hidden mobile section never counts toward a total.
  const [mobileOn, setMobileOn] = useState({ a: solA.mobileSharePct > 0, b: solB.mobileSharePct > 0 });

  const applies = (sol: SolutionInputs, key: keyof SolutionInputs) => {
    const models = SOLUTION_FIELD_MAP[key].models;
    return !models || models.includes(sol.model);
  };
  // Still on what it started as: the generic default, or the picked vendor's
  // researched value. Anything else was edited, and an edited advanced row
  // stays visible in Essential so a change to a total is never hidden.
  const generic = { a: defaultSolution("a", solA.name, solA.model), b: defaultSolution("b", solB.name, solB.model) };
  const atDefault = (sol: SolutionInputs, key: keyof SolutionInputs) =>
    sol[key] === generic[sol.id][key] || fieldSourceInfo(sol, key) !== null;
  const keep = (key: keyof SolutionInputs, shown: (sol: SolutionInputs) => boolean) =>
    [solA, solB].some((sol) => shown(sol) && (flags[sol.id].has(key) || !atDefault(sol, key)));
  const row = (
    key: keyof SolutionInputs, icon: React.ElementType, advanced = false,
    when: (sol: SolutionInputs) => boolean = () => true, hint?: (sol: SolutionInputs) => string,
  ) => {
    const cell = (sol: SolutionInputs) => {
      if (!applies(sol, key) || !when(sol)) return null;
      const field = (
        <SolutionField
          sol={sol} field={key} onChange={onChange[sol.id]} bare
          id={fieldDomId(sol.id, key)} ariaLabel={`${SOLUTION_FIELD_MAP[key].label}, ${nameOf[sol.id]}`} flag={flags[sol.id].get(key)}
        />
      );
      return hint ? <Stack gap={2}>{field}<Text size="xs" c={TEXT_MUTED}>{hint(sol)}</Text></Stack> : field;
    };
    const def = SOLUTION_FIELD_MAP[key];
    return (
      <CompareRow
        key={key} label={def.label} help={def.help} icon={icon} a={cell(solA)} b={cell(solB)}
        advanced={advanced} keep={advanced && keep(key, (sol) => applies(sol, key) && when(sol))}
      />
    );
  };
  // A yes/no row: a switch per side, where `when` holds.
  const toggle = (key: "reusesReaders" | "reusesControllers" | "reissueCredentials", icon: React.ElementType, help: string, when: (sol: SolutionInputs) => boolean) => {
    const cell = (sol: SolutionInputs) => {
      if (!when(sol)) return null;
      const flag = flags[sol.id].get(key);
      return (
        <Stack gap={2}>
          <Switch
            id={fieldDomId(sol.id, key)} aria-label={`${SOLUTION_FIELD_MAP[key].label}, ${nameOf[sol.id]}`}
            checked={sol[key]} onChange={(e) => onChange[sol.id]({ ...sol, [key]: e.currentTarget.checked })}
            label={sol[key] ? "Yes" : "No"}
          />
          {flag && <Text size="xs" c="yellow.5">Confirm with the vendor</Text>}
        </Stack>
      );
    };
    return <CompareRow label={SOLUTION_FIELD_MAP[key].label} help={help} icon={icon} a={cell(solA)} b={cell(solB)} />;
  };
  const mobileCell = (sol: SolutionInputs) => (
    <Switch
      aria-label={`Mobile credentials, ${nameOf[sol.id]}`} checked={mobileOn[sol.id]} label={mobileOn[sol.id] ? "Yes" : "No"}
      onChange={(e) => {
        const on = e.currentTarget.checked;
        setMobileOn((m) => ({ ...m, [sol.id]: on }));
        if (!on) onChange[sol.id]({ ...sol, mobileSharePct: 0 });
      }}
    />
  );
  const renewalCell = (sol: SolutionInputs) => {
    if (!cloud(sol) || !isIncumbent(sol)) return null;
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
  const staleWarnings = (["a", "b"] as const).map((id) => {
    const sol = sols[id];
    if (cloud(sol)) return null;
    return (
      <StaleRefreshWarning
        key={id} name={nameOf[id]} isIncumbent={isIncumbent(sol)} yearsUntilNextRefresh={sol.yearsUntilNextRefresh}
        horizonYears={scenario.horizonYears} what="the server cost"
      />
    );
  });
  const newDeployment = (sol: SolutionInputs) => wired && !isIncumbent(sol);

  return (
    <CompareGrid sides={sides}>
      <CompareSection title="Pricing">
        {row("discountPct", Percent)}
      </CompareSection>

      <CompareSection title="Readers & controllers">
        {toggle("reusesReaders", ScanLine, REUSE_HELP.reusesReaders, newDeployment)}
        {toggle("reusesControllers", CircuitBoard, REUSE_HELP.reusesControllers, newDeployment)}
        {row("readerCost", ScanLine)}
        {row("controllerCost", CircuitBoard)}
        {row("doorsPerController", Layers, true)}
        {row("warrantyYears", ShieldCheck, true)}
        {row("hardwareHalfLifeYears", Hourglass, true)}
        {row("replacementLaborPerDevice", Hammer, true)}
      </CompareSection>

      <CompareSection title={wired ? "Migration" : "New doors"}>
        {wired ? row("migrationLaborPerDoor", Wrench) : (
          <>
            {row("doorHardwareCost", DoorClosed, true)}
            {row("newDoorInstallCost", Wrench, true)}
          </>
        )}
      </CompareSection>

      <CompareSection title="Licensing">
        {row("tierYears", CalendarRange)}
        {row("tierPrice", DollarSign, false, undefined, (sol) => `≈ $${(sol.tierPrice / Math.max(1, sol.tierYears)).toFixed(2)}/yr per door, before the discount`)}
        {row("siteFeePerYr", Store)}
        <CompareRow label="Years until license renewal" help={RENEWAL_HELP} icon={Clock} a={renewalCell(solA)} b={renewalCell(solB)} />
        {row("baseLicense", FileText)}
        {row("doorLicense", Tag)}
        {row("carePct", ShieldCheck)}
      </CompareSection>

      <CompareSection title="Servers">
        {row("serverCount", Server)}
        {row("serverCost", HardDrive, true)}
        {row("serverSoftwareCost", FileText, true)}
        {row("serverAdminHrsPerYr", UserCog)}
        {row("refreshCycleYears", RefreshCw, true)}
        {row("yearsUntilNextRefresh", Clock, false, isIncumbent)}
        {staleWarnings.some(Boolean) && <CompareNote><Stack gap={6}>{staleWarnings}</Stack></CompareNote>}
      </CompareSection>

      <CompareSection title="Credentials">
        {row("cardCost", CreditCard, true)}
        <CompareRow
          label="Mobile credentials" help={MOBILE_HELP} icon={Smartphone} a={mobileCell(solA)} b={mobileCell(solB)}
          advanced keep={mobileOn.a || mobileOn.b}
        />
        {row("mobileSharePct", Users, false, (sol) => mobileOn[sol.id])}
        {row("mobileCostPerUserYr", Smartphone, false, (sol) => mobileOn[sol.id])}
        {toggle("reissueCredentials", IdCard, REISSUE_HELP, newDeployment)}
      </CompareSection>

      <CompareSection title="Operations">
        {row("adminHrsPerDoorYr", UserCog)}
        {row("cardholderChangeMinutes", Users)}
        {row("alarmMinutes", BellRing)}
        {row("truckRollsPerSiteYr", Truck)}
        {row("networkCostPerSiteYr", Globe, true)}
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
