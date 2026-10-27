"use client";

import { useMemo, useRef } from "react";
import { Accordion, Badge, Box, Group, Stack, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { HardwareFootprint, ScenarioInputs, SolutionInputs } from "../lib/model";
import { computeComparison } from "../lib/model";
import { TEXT_MUTED, fmtUsd } from "../../_tco-shared/lib/colors";
import { OUTCOME_NOTE, STAFF_TIME_NOTE } from "../lib/fieldHelp";
import InfoLabel from "../../_tco-shared/components/InfoLabel";
import { downloadText, exportSnapshot, openPrintable } from "../../_tco-shared/lib/exportSnapshot";
import { SAVED_COMPARISONS } from "../lib/savedComparisons";
import ScenarioStep from "./ScenarioStep";
import AssumptionsPanel from "./AssumptionsPanel";
import ChartsPanel from "../../_tco-shared/components/ChartsPanel";
import MethodologyNotes from "../../_tco-shared/components/MethodologyNotes";
import GapDrivers from "../../_tco-shared/components/GapDrivers";
import YearTable from "../../_tco-shared/components/YearTable";
import ShareChecklist from "../../_tco-shared/components/ShareChecklist";
import ResultsHeader from "../../_tco-shared/components/ResultsHeader";
import CostSummary from "../../_tco-shared/components/CostSummary";
import { ChartColor } from "../../_tco-shared/components/FormParts";
import { buildCsv, buildReportHtml } from "../lib/report";
import { METHODOLOGY_NOTES } from "../lib/methodology";
import { buildChecklist } from "../lib/checklist";
import { findFlipPoints } from "../lib/sensitivity";
import IncumbentPicker from "./IncumbentPicker";
import BusinessImpactStep from "../../_tco-shared/components/BusinessImpactStep";
import { IMPACT, considerationsFor, verticalFor } from "../lib/verticals";
import { IMPACT_COPY } from "../lib/impactCopy";

// What you actually end up owning/racking, not just what it costs — a cloud
// ripReplace solution with no local box at all renders nothing rather than a
// misleading "0 connector appliances".
function hardwareSummaryText(hw: HardwareFootprint): string | null {
  const parts: string[] = [];
  if (hw.unitsLabel && hw.units > 0) parts.push(`${hw.units.toLocaleString()} ${hw.unitsLabel.toLowerCase()}`);
  if (hw.managementServers > 0) parts.push(`${hw.managementServers} management server${hw.managementServers === 1 ? "" : "s"}`);
  if (hw.storageTB !== null && hw.storageTB > 0) {
    const tb = hw.storageTB >= 100 ? Math.round(hw.storageTB).toLocaleString() : hw.storageTB.toFixed(1);
    parts.push(`${tb} TB storage`);
  }
  return parts.length ? parts.join(" · ") : null;
}

export default function ResultsView({
  shapeId, scenario, solA, solB, colorA, colorB, shareUrl, staleModel = false, onDismissStaleModel, onColorAChange, onColorBChange,
  onScenarioChange, onSolAChange, onSolBChange, onEditSetup,
}: {
  shapeId: string;
  scenario: ScenarioInputs;
  solA: SolutionInputs;
  solB: SolutionInputs;
  colorA: string;
  colorB: string;
  shareUrl: string;
  staleModel?: boolean;
  onColorAChange: (v: string) => void;
  onColorBChange: (v: string) => void;
  onDismissStaleModel?: () => void;
  onScenarioChange: (v: ScenarioInputs) => void;
  onSolAChange: (v: SolutionInputs) => void;
  onSolBChange: (v: SolutionInputs) => void;
  onEditSetup: () => void;
}) {
  const comparison = useMemo(() => computeComparison(scenario, solA, solB), [scenario, solA, solB]);
  const flips = useMemo(() => findFlipPoints(scenario, solA, solB), [scenario, solA, solB]);
  const checklist = useMemo(() => buildChecklist(scenario, solA, solB, comparison), [scenario, solA, solB, comparison]);
  const { a, b, crossoverYear, laterCrossoverYears } = comparison;
  const snapshotRef = useRef<HTMLDivElement>(null);
  // Below this width the assumptions accordion is too cramped to sit beside the
  // chart, so it drops back to today's single stacked column instead; sticky
  // positioning is skipped entirely there rather than fighting a column that's
  // no longer meaningfully "beside" anything, which would just make the summary
  // float oddly over the fields as you scroll past it on a narrow screen.
  const isDesktop = useMediaQuery("(min-width: 75em)");

  // From the cost model's own camera cohorts, so the stat can't disagree
  // with what was charged.
  const fleetPctA = Math.round(a.hardware.originalFleetReplacedPct);
  const fleetPctB = Math.round(b.hardware.originalFleetReplacedPct);

  const fileBase = `${solA.name}-vs-${solB.name}-tco`.replace(/[^\w.-]+/g, "-");
  const exportState = { shapeId, scenario, solA, solB, colorA, colorB };

  const sideDetails = (sol: SolutionInputs, hw: HardwareFootprint) => {
    const hwText = hardwareSummaryText(hw);
    const considerations = considerationsFor(sol);
    return (
      <>
        {hwText && <Text size="xs" c={TEXT_MUTED}>{hwText}</Text>}
        {verticalFor(scenario) && considerations.length > 0 && (
          <InfoLabel
            label={`+ ${considerations.length} other consideration${considerations.length === 1 ? "" : "s"}, not in totals`}
            help={considerations.map((c) => c.label).join(" · ")}
            size="var(--mantine-font-size-xs)" color={TEXT_MUTED}
          />
        )}
      </>
    );
  };
  const perCamMo = (total: number) => `${fmtUsd(total / (Math.max(1, scenario.cameras) * Math.max(1, scenario.horizonYears) * 12))} / cam / mo`;

  return (
    <Stack gap="xl">
      <ResultsHeader
        title={`${solA.name} vs. ${solB.name}`}
        subtitle={
          `${scenario.cameras.toLocaleString()} cameras · ${scenario.sites.toLocaleString()} sites · ${scenario.horizonYears}-year horizon` +
          (scenario.incumbent !== "none" ? ` · ${scenario.incumbent === "a" ? solA.name : solB.name} is incumbent` : "")
        }
        shareUrl={shareUrl}
        staleModel={staleModel}
        onDismissStaleModel={onDismissStaleModel}
        defaultSaveName={`${solA.name} vs. ${solB.name}`}
        onSave={(name) => SAVED_COMPARISONS.save(name, exportState)}
        onSnapshot={async () => {
          if (snapshotRef.current) await exportSnapshot(snapshotRef.current, `${solA.name}-vs-${solB.name}-tco.png`.replace(/\s+/g, "-"));
        }}
        onCsv={() => downloadText(buildCsv(exportState, comparison), `${fileBase}.csv`, "text/csv;charset=utf-8")}
        onPrintable={() => openPrintable(buildReportHtml(exportState, comparison, METHODOLOGY_NOTES))}
        onEditSetup={onEditSetup}
      />

      <Box style={{ display: "flex", flexDirection: isDesktop ? "row" : "column", gap: "var(--mantine-spacing-xl)", alignItems: "flex-start" }}>
        <Box
          style={{
            flex: isDesktop ? "0 0 44%" : "1 1 auto",
            minWidth: 0,
            width: "100%",
            position: isDesktop ? "sticky" : "static",
            top: isDesktop ? 16 : undefined,
            // Capped and internally scrollable rather than left to clip against the
            // viewport edge: the summary card (the numbers this whole layout exists to
            // keep visible) sits first, so an uncapped sticky block taller than the
            // viewport would scroll the hero figure itself off the top well before the
            // chart below it did, the opposite of the point.
            maxHeight: isDesktop ? "calc(100vh - 32px)" : undefined,
            overflowY: isDesktop ? "auto" : undefined,
          }}
        >
          <Box ref={snapshotRef} style={{ background: "#0f1117" }}>
            <Stack gap="xl">
              <CostSummary
                sides={[
                  { id: "a", name: solA.name, result: a, isIncumbent: scenario.incumbent === "a", perUnit: perCamMo(a.total), details: sideDetails(solA, a.hardware) },
                  { id: "b", name: solB.name, result: b, isIncumbent: scenario.incumbent === "b", perUnit: perCamMo(b.total), details: sideDetails(solB, b.hardware) },
                ]}
                horizonYears={scenario.horizonYears}
                crossoverYear={crossoverYear}
                laterCrossoverYears={laterCrossoverYears}
                footerStats={[
                  { label: `${solA.name} fleet replaced`, value: fleetPctA + "%" },
                  { label: `${solB.name} fleet replaced`, value: fleetPctB + "%" },
                ]}
                staffTimeNote={STAFF_TIME_NOTE}
                outcomeNote={OUTCOME_NOTE}
              />

              <ChartsPanel comparison={comparison} nameA={solA.name} nameB={solB.name} colorA={colorA} colorB={colorB} />
              <GapDrivers comparison={comparison} flips={flips} nameA={solA.name} nameB={solB.name} colorA={colorA} colorB={colorB} />
            </Stack>
          </Box>
          <Box mt="xl">
            <YearTable comparison={comparison} nameA={solA.name} nameB={solB.name} />
          </Box>
        </Box>

        <Box style={{ flex: "1 1 0%", minWidth: 0, width: "100%" }}>
          {/* Scenario (camera count, sites, horizon, ...) is system-agnostic and stays
              open, since it's what the reviewer is most likely to want to check or tweak
              first; the two per-solution assumption panels are dense vendor-specific data
              that's more useful collapsed by default on this results/review screen, unlike
              the wizard's own editing steps where those same fields need to stay discoverable. */}
          <ShareChecklist items={checklist} />
          <Accordion variant="separated" multiple defaultValue={["scenario"]}>
            <Accordion.Item value="scenario">
              <Accordion.Control>
                <Text fw={500}>Scenario</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="lg">
                  <IncumbentPicker scenario={scenario} onScenarioChange={onScenarioChange} nameA={solA.name} nameB={solB.name} />
                  <ScenarioStep value={scenario} onChange={onScenarioChange} />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="solA">
              <Accordion.Control>
                <Group gap="xs">
                  <Badge variant="dot" color={colorA}>{solA.name}</Badge>
                  <Text fw={500} size="sm">assumptions</Text>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <ChartColor color={colorA} onChange={onColorAChange} />
                <AssumptionsPanel sol={solA} onChange={onSolAChange} scenario={scenario} />
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="solB">
              <Accordion.Control>
                <Group gap="xs">
                  <Badge variant="dot" color={colorB}>{solB.name}</Badge>
                  <Text fw={500} size="sm">assumptions</Text>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <ChartColor color={colorB} onChange={onColorBChange} />
                <AssumptionsPanel sol={solB} onChange={onSolBChange} scenario={scenario} />
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="impact">
              <Accordion.Control>
                <Text fw={500}>Business impact</Text>
              </Accordion.Control>
              <Accordion.Panel>
                <BusinessImpactStep
                  impact={IMPACT} copy={IMPACT_COPY}
                  scenario={scenario} solA={solA} solB={solB} colorA={colorA} colorB={colorB}
                  onScenarioChange={onScenarioChange} onSolAChange={onSolAChange} onSolBChange={onSolBChange}
                  showIntro={false}
                />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Box>
      </Box>

      <MethodologyNotes notes={METHODOLOGY_NOTES} />
    </Stack>
  );
}
