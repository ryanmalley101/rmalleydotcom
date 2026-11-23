"use client";

import { useMemo } from "react";
import { Stack, Text } from "@mantine/core";
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
import { downloadText, openPrintable } from "../../_tco-shared/lib/exportSnapshot";
import { shortNames } from "../../_tco-shared/lib/names";
import { useEditHistory } from "../../_tco-shared/lib/useEditHistory";
import InfoLabel from "../../_tco-shared/components/InfoLabel";
import ResultsHeader from "../../_tco-shared/components/ResultsHeader";
import ResultsLayout from "../../_tco-shared/components/ResultsLayout";
import BusinessImpactStep from "../../_tco-shared/components/BusinessImpactStep";
import IncumbentPicker from "./IncumbentPicker";
import ScenarioStep from "./ScenarioStep";
import CostsCompare, { modelLabel } from "./CostsCompare";

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

// What the deployment ends up with, from the same counts that were costed.
function hardwareSummaryText(hw: HardwareFootprint): string {
  const parts = [plural(hw.readers, "reader"), plural(hw.controllers, "controller")];
  if (hw.servers > 0) parts.push(plural(hw.servers, "server"));
  parts.push(`${Math.round(hw.originalHardwareReplacedPct)}% of the original hardware replaced`);
  return parts.join(" · ");
}

type Inputs = { scenario: ScenarioInputs; solA: SolutionInputs; solB: SolutionInputs };

export default function ResultsView({
  shapeId, scenario, solA, solB, colorA, colorB, shareUrl, staleModel = false, onDismissStaleModel, onColorAChange, onColorBChange,
  onScenarioChange, onSolAChange, onSolBChange, onChangeComparison,
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
  onChangeComparison: () => void;
}) {
  const comparison = useMemo(() => computeComparison(scenario, solA, solB), [scenario, solA, solB]);
  const flips = useMemo(() => findFlipPoints(scenario, solA, solB), [scenario, solA, solB]);
  const checklist = useMemo(() => buildChecklist(scenario, solA, solB, comparison), [scenario, solA, solB, comparison]);

  const history = useEditHistory<Inputs>({ scenario, solA, solB }, (s) => {
    onScenarioChange(s.scenario);
    onSolAChange(s.solA);
    onSolBChange(s.solB);
  });
  const previous = useMemo(
    () => (history.previous ? computeComparison(history.previous.scenario, history.previous.solA, history.previous.solB) : null),
    [history.previous],
  );
  const setScenario = history.edit(onScenarioChange);
  const setSolA = history.edit(onSolAChange);
  const setSolB = history.edit(onSolBChange);

  const { a, b } = comparison;
  const [nameA, nameB] = shortNames(solA.name, solB.name);
  const fileBase = `${solA.name}-vs-${solB.name}-access-tco`.replace(/[^\w.-]+/g, "-");
  const exportState = { shapeId, scenario, solA, solB, colorA, colorB };
  const perDoorMo = (total: number) => `${fmtUsd(total / (Math.max(1, scenario.doors) * Math.max(1, scenario.horizonYears) * 12))} / door / mo`;
  const incumbentName = scenario.incumbent === "a" ? nameA : scenario.incumbent === "b" ? nameB : null;
  const title = `${nameA} vs. ${nameB}`;
  const subtitle =
    `${plural(scenario.doors, "door")} · ${plural(scenario.sites, "site")} · ${plural(scenario.cardholders, "cardholder")} · ${scenario.horizonYears}-year horizon` +
    (incumbentName ? ` · ${incumbentName} is incumbent` : "");

  const sideDetails = (sol: SolutionInputs, hw: HardwareFootprint) => {
    const considerations = considerationsFor(sol);
    return (
      <Stack gap={0}>
        <Text size="xs" c={TEXT_MUTED}>{hardwareSummaryText(hw)}</Text>
        {verticalFor(scenario) && considerations.length > 0 && (
          <InfoLabel
            label={`+ ${considerations.length} other consideration${considerations.length === 1 ? "" : "s"}, not in totals`}
            help={considerations.map((c) => c.label).join(" · ")}
            size="var(--mantine-font-size-xs)" color={TEXT_MUTED}
          />
        )}
      </Stack>
    );
  };

  const sides = [
    { id: "a" as const, name: nameA, fullName: solA.name, color: colorA, onColorChange: onColorAChange, modelLabel: modelLabel(solA), isIncumbent: scenario.incumbent === "a" },
    { id: "b" as const, name: nameB, fullName: solB.name, color: colorB, onColorChange: onColorBChange, modelLabel: modelLabel(solB), isIncumbent: scenario.incumbent === "b" },
  ] as const;

  return (
    <ResultsLayout
      header={(takeSnapshot) => (
        <ResultsHeader
          title={title}
          subtitle={subtitle}
          shareUrl={shareUrl}
          staleModel={staleModel}
          onDismissStaleModel={onDismissStaleModel}
          defaultSaveName={`${solA.name} vs. ${solB.name}`}
          onSave={(name) => SAVED_COMPARISONS.save(name, exportState)}
          onSnapshot={takeSnapshot}
          onCsv={() => downloadText(buildCsv(exportState, comparison), `${fileBase}.csv`, "text/csv;charset=utf-8")}
          onPrintable={() => openPrintable(buildReportHtml(exportState, comparison))}
          onChangeComparison={onChangeComparison}
        />
      )}
      title={title}
      subtitle={subtitle}
      snapshotFileName={`${fileBase}.png`}
      summary={{
        sides: [
          { id: "a", name: nameA, color: colorA, result: a, isIncumbent: scenario.incumbent === "a", perUnit: perDoorMo(a.total), details: sideDetails(solA, a.hardware) },
          { id: "b", name: nameB, color: colorB, result: b, isIncumbent: scenario.incumbent === "b", perUnit: perDoorMo(b.total), details: sideDetails(solB, b.hardware) },
        ],
        horizonYears: scenario.horizonYears,
        staffTimeNote: STAFF_TIME_NOTE,
        outcomeNote: OUTCOME_NOTE,
      }}
      comparison={comparison}
      previous={previous}
      onUndo={history.undo}
      flips={flips}
      checklist={checklist}
      notes={METHODOLOGY_NOTES}
      inputs={{
        scenario: (
          <Stack gap="lg">
            <IncumbentPicker scenario={scenario} onScenarioChange={setScenario} nameA={nameA} nameB={nameB} />
            <ScenarioStep value={scenario} onChange={setScenario} showIntro={false} />
          </Stack>
        ),
        costs: (
          <CostsCompare
            solA={solA} solB={solB} scenario={scenario} onChangeA={setSolA} onChangeB={setSolB}
            sides={[sides[0], sides[1]]} checklist={checklist}
          />
        ),
        impact: (
          <BusinessImpactStep
            impact={IMPACT} copy={IMPACT_COPY}
            scenario={scenario} solA={{ ...solA, name: nameA }} solB={{ ...solB, name: nameB }} colorA={colorA} colorB={colorB}
            onScenarioChange={setScenario}
            onSolAChange={(s) => setSolA({ ...s, name: solA.name })}
            onSolBChange={(s) => setSolB({ ...s, name: solB.name })}
            showIntro={false}
          />
        ),
      }}
    />
  );
}
