"use client";

import { useState } from "react";
import { Checkbox, NumberInput, SimpleGrid, Switch, Text } from "@mantine/core";
import {
  CalendarRange, CircuitBoard, Clock, CreditCard, DollarSign, DoorClosed, FileText, Globe, Hammer, HardDrive, Hourglass,
  IdCard, Layers, Percent, RefreshCw, ScanLine, Server, ShieldCheck, Smartphone, Store, Tag, Truck, UserCog, Users, BellRing,
  Wrench,
} from "lucide-react";
import type { ScenarioInputs, SolutionInputs } from "../lib/model";
import { SOLUTION_FIELD_MAP } from "../lib/fields";
import { TEXT_MUTED } from "../../_tco-shared/lib/colors";
import { IconLabel, SectionLabel, StaleRefreshWarning } from "../../_tco-shared/components/FormParts";
import SolutionField from "./SolutionField";

const REUSE_HELP: Record<"reusesReaders" | "reusesControllers", string> = {
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
  "How many years until the license already in place has to be renewed; 0 means it's due now and is bought at year 0. After that it renews every term. Only shown for the incumbent: a new purchase buys its first term at year 0.";

// Every input for one solution, in themed sections. The wizard shows it in
// each solution's card; the results page shows it in each solution's
// assumptions panel (`compact`, three columns, with the misc items below).
export default function SolutionForm({ sol, onChange, scenario, compact }: {
  sol: SolutionInputs; onChange: (v: SolutionInputs) => void; scenario: ScenarioInputs; compact?: boolean;
}) {
  const field = (key: keyof SolutionInputs, icon: React.ElementType) => <SolutionField sol={sol} field={key} onChange={onChange} icon={icon} />;
  const toggleLabel = (key: keyof SolutionInputs, icon: React.ElementType, help: string) => (
    <IconLabel icon={icon} label={SOLUTION_FIELD_MAP[key].label} help={help} />
  );
  const isIncumbent = scenario.incumbent === sol.id;
  const wired = scenario.existingDoorsInstalled !== false;
  const cloud = sol.model === "cloud";
  // Shown while on, or once ticked; unticking also zeros the share, so an
  // unticked section never counts toward a total.
  const [mobileOpen, setMobileOpen] = useState(sol.mobileSharePct > 0);
  const perYear = sol.tierPrice / Math.max(1, sol.tierYears);

  return (
    <SimpleGrid cols={compact ? { base: 2, sm: 3 } : { base: 1, xs: 2 }} spacing="sm">
      <SectionLabel first>Pricing</SectionLabel>
      {field("discountPct", Percent)}

      <SectionLabel>Readers & controllers</SectionLabel>
      {wired && !isIncumbent && (
        <div style={{ gridColumn: "1 / -1" }}>
          <Switch
            checked={sol.reusesReaders}
            onChange={(e) => onChange({ ...sol, reusesReaders: e.currentTarget.checked })}
            label={toggleLabel("reusesReaders", ScanLine, REUSE_HELP.reusesReaders)}
            mb="xs"
          />
          <Switch
            checked={sol.reusesControllers}
            onChange={(e) => onChange({ ...sol, reusesControllers: e.currentTarget.checked })}
            label={toggleLabel("reusesControllers", CircuitBoard, REUSE_HELP.reusesControllers)}
          />
        </div>
      )}
      {field("readerCost", ScanLine)}
      {field("controllerCost", CircuitBoard)}
      {field("doorsPerController", Layers)}
      {field("warrantyYears", ShieldCheck)}
      {field("hardwareHalfLifeYears", Hourglass)}
      {field("replacementLaborPerDevice", Hammer)}

      <SectionLabel>{wired ? "Migration" : "New doors"}</SectionLabel>
      {wired ? (
        field("migrationLaborPerDoor", Wrench)
      ) : (
        <>
          {field("doorHardwareCost", DoorClosed)}
          {field("newDoorInstallCost", Wrench)}
        </>
      )}

      <SectionLabel>Licensing</SectionLabel>
      {cloud ? (
        <>
          {field("tierYears", CalendarRange)}
          {field("tierPrice", DollarSign)}
          {field("siteFeePerYr", Store)}
          <div style={{ gridColumn: "1 / -1" }}>
            <Text size="xs" c={TEXT_MUTED}>≈ ${perYear.toFixed(2)}/yr per door, before the discount</Text>
          </div>
          {isIncumbent && (
            <NumberInput
              label={<IconLabel icon={Clock} label="Years until license renewal" help={RENEWAL_HELP} />}
              value={sol.yearsUntilLicenseRenewal ?? sol.tierYears}
              min={0} allowDecimal={false}
              onChange={(v) => onChange({ ...sol, yearsUntilLicenseRenewal: Number(v) || 0 })}
            />
          )}
        </>
      ) : (
        <>
          {field("baseLicense", FileText)}
          {field("doorLicense", Tag)}
          {field("carePct", ShieldCheck)}
        </>
      )}

      {!cloud && (
        <>
          <SectionLabel>Servers</SectionLabel>
          {field("serverCount", Server)}
          {field("serverCost", HardDrive)}
          {field("serverSoftwareCost", FileText)}
          {field("serverAdminHrsPerYr", UserCog)}
          {field("refreshCycleYears", RefreshCw)}
          {isIncumbent && field("yearsUntilNextRefresh", Clock)}
          <StaleRefreshWarning
            isIncumbent={isIncumbent} yearsUntilNextRefresh={sol.yearsUntilNextRefresh}
            horizonYears={scenario.horizonYears} what="the server cost"
          />
        </>
      )}

      <SectionLabel>Credentials</SectionLabel>
      {field("cardCost", CreditCard)}
      <div style={{ gridColumn: "1 / -1" }}>
        <Checkbox
          checked={mobileOpen}
          onChange={(e) => {
            const on = e.currentTarget.checked;
            setMobileOpen(on);
            if (!on) onChange({ ...sol, mobileSharePct: 0 });
          }}
          label={<IconLabel icon={Smartphone} label="Mobile credentials" help={MOBILE_HELP} />}
        />
      </div>
      {mobileOpen && (
        <>
          {field("mobileSharePct", Users)}
          {field("mobileCostPerUserYr", Smartphone)}
        </>
      )}
      {wired && !isIncumbent && (
        <div style={{ gridColumn: "1 / -1" }}>
          <Checkbox
            checked={sol.reissueCredentials}
            onChange={(e) => onChange({ ...sol, reissueCredentials: e.currentTarget.checked })}
            label={toggleLabel("reissueCredentials", IdCard, REISSUE_HELP)}
          />
        </div>
      )}

      <SectionLabel>Operations</SectionLabel>
      {field("adminHrsPerDoorYr", UserCog)}
      {field("cardholderChangeMinutes", Users)}
      {field("alarmMinutes", BellRing)}
      {field("truckRollsPerSiteYr", Truck)}
      {field("networkCostPerSiteYr", Globe)}
    </SimpleGrid>
  );
}
