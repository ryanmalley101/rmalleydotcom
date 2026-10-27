"use client";

import { useMemo, useRef } from "react";
import { Accordion, Badge, Box, Group, Stack, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { computeComparison, type HardwareFootprint, type ScenarioInputs, type SolutionInputs } from "../lib/model";
import { OUTCOME_NOTE, STAFF_TIME_NOTE } from "../lib/fields";
import { SAVED_COMPARISONS } from "../lib/savedComparisons";
import { buildCsv, buildReportHtml } from "../lib/report";
import { METHODOLOGY_NOTES } from "../lib/methodology";
import { buildChecklist } from "../lib/checklist";
import { findFlipPoints } from "../lib/sensitivity";
import { IMPACT, considerationsFor, verticalFor } from "../lib/verticals";
import { IMPACT_COPY } from "../lib/impactCopy";
import { TEXT_MUTED, fmtUsd } from "../../_tco-shared/lib/colors";
import { downloadText, exportSnapshot, openPrintable } from "../../_tco-shared/lib/exportSnapshot";
import InfoLabel from "../../_tco-shared/components/InfoLabel";
import ChartsPanel from "../../_tco-shared/components/ChartsPanel";
import MethodologyNotes from "../../_tco-shared/components/MethodologyNotes";
import GapDrivers from "../../_tco-shared/components/GapDrivers";
import YearTable from "../../_tco-shared/components/YearTable";
import ShareChecklist from "../../_tco-shared/components/ShareChecklist";
import ResultsHeader from "../../_tco-shared/components/ResultsHeader";
import CostSummary from "../../_tco-shared/components/CostSummary";
import MiscItemsEditor from "../../_tco-shared/components/MiscItemsEditor";
import BusinessImpactStep from "../../_tco-shared/components/BusinessImpactStep";
import { ChartColor, SectionLabel } from "../../_tco-shared/components/FormParts";
import IncumbentPicker from "./IncumbentPicker";
import ScenarioStep from "./ScenarioStep";
import SolutionForm from "./SolutionForm";

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

// What the deployment ends up with, from the same counts that were costed.
function hardwareSummaryText(hw: HardwareFootprint): string {
  const parts = [plural(hw.readers, "reader"), plural(hw.controllers, "controller")];
  if (hw.servers > 0) parts.push(plural(hw.servers, "server"));
  return parts.join(" · ");
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
  // Below this width the assumptions column drops under the summary instead
  // of sitting beside it, and the summary stops being sticky.
  const isDesktop = useMediaQuery("(min-width: 75em)");

  const fileBase = `${solA.name}-vs-${solB.name}-access-tco`.replace(/[^\w.-]+/g, "-");
  const exportState = { shapeId, scenario, solA, solB, colorA, colorB };
  const perDoorMo = (total: number) => `${fmtUsd(total / (Math.max(1, scenario.doors) * Math.max(1, scenario.horizonYears) * 12))} / door / mo`;

  const sideDetails = (sol: SolutionInputs, hw: HardwareFootprint) => {
    const considerations = considerationsFor(sol);
    return (
      <>
        <Text size="xs" c={TEXT_MUTED}>{hardwareSummaryText(hw)}</Text>
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

  const assumptions = (sol: SolutionInputs, color: string, onColor: (v: string) => void, onSol: (v: SolutionInputs) => void) => (
    <>
      <ChartColor color={color} onChange={onColor} />
      <SolutionForm sol={sol} onChange={onSol} scenario={scenario} compact />
      <Box mt="sm">
        <SectionLabel>Misc / other</SectionLabel>
        <Box mt={6}>
          <MiscItemsEditor items={sol.miscItems} onChange={(miscItems) => onSol({ ...sol, miscItems })} />
        </Box>
      </Box>
    </>
  );

  return (
    <Stack gap="xl">
      <ResultsHeader
        title={`${solA.name} vs. ${solB.name}`}
        subtitle={
          `${plural(scenario.doors, "door")} · ${plural(scenario.sites, "site")} · ${plural(scenario.cardholders, "cardholder")} · ${scenario.horizonYears}-year horizon` +
          (scenario.incumbent !== "none" ? ` · ${scenario.incumbent === "a" ? solA.name : solB.name} is incumbent` : "")
        }
        shareUrl={shareUrl}
        staleModel={staleModel}
        onDismissStaleModel={onDismissStaleModel}
        defaultSaveName={`${solA.name} vs. ${solB.name}`}
        onSave={(name) => SAVED_COMPARISONS.save(name, exportState)}
        onSnapshot={async () => {
          if (snapshotRef.current) await exportSnapshot(snapshotRef.current, `${fileBase}.png`);
        }}
        onCsv={() => downloadText(buildCsv(exportState, comparison), `${fileBase}.csv`, "text/csv;charset=utf-8")}
        onPrintable={() => openPrintable(buildReportHtml(exportState, comparison))}
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
            // Capped and scrollable, so the headline figure never scrolls off
            // the top before the chart under it does.
            maxHeight: isDesktop ? "calc(100vh - 32px)" : undefined,
            overflowY: isDesktop ? "auto" : undefined,
          }}
        >
          <Box ref={snapshotRef} style={{ background: "#0f1117" }}>
            <Stack gap="xl">
              <CostSummary
                sides={[
                  { id: "a", name: solA.name, result: a, isIncumbent: scenario.incumbent === "a", perUnit: perDoorMo(a.total), details: sideDetails(solA, a.hardware) },
                  { id: "b", name: solB.name, result: b, isIncumbent: scenario.incumbent === "b", perUnit: perDoorMo(b.total), details: sideDetails(solB, b.hardware) },
                ]}
                horizonYears={scenario.horizonYears}
                crossoverYear={crossoverYear}
                laterCrossoverYears={laterCrossoverYears}
                footerStats={[
                  { label: `${solA.name} hardware replaced`, value: Math.round(a.hardware.originalHardwareReplacedPct) + "%" },
                  { label: `${solB.name} hardware replaced`, value: Math.round(b.hardware.originalHardwareReplacedPct) + "%" },
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
          <ShareChecklist items={checklist} />
          <Accordion variant="separated" multiple defaultValue={["scenario"]}>
            <Accordion.Item value="scenario">
              <Accordion.Control><Text fw={500}>Scenario</Text></Accordion.Control>
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
              <Accordion.Panel>{assumptions(solA, colorA, onColorAChange, onSolAChange)}</Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="solB">
              <Accordion.Control>
                <Group gap="xs">
                  <Badge variant="dot" color={colorB}>{solB.name}</Badge>
                  <Text fw={500} size="sm">assumptions</Text>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>{assumptions(solB, colorB, onColorBChange, onSolBChange)}</Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="impact">
              <Accordion.Control><Text fw={500}>Business impact</Text></Accordion.Control>
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
