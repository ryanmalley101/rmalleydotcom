"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Box, Button, Card, Group, Stepper, Text, Title } from "@mantine/core";
import { CalendarRange, KeyRound, Share2 } from "lucide-react";
import { SOLUTION_A_COLOR, SOLUTION_B_COLOR, TEXT_MUTED } from "../_tco-shared/lib/colors";
import { defaultIncumbentFor } from "../_tco-shared/lib/fields";
import IntroScreen from "../_tco-shared/components/IntroScreen";
import ShapeStep from "../_tco-shared/components/ShapeStep";
import BusinessImpactStep from "../_tco-shared/components/BusinessImpactStep";
import CalculatorFrame, { confirmLeaveSetup, useAddressBarSync } from "../_tco-shared/components/CalculatorFrame";
import { DEFAULT_SCENARIO, SHAPE_OPTIONS } from "./lib/defaults";
import type { ScenarioInputs, SolutionInputs } from "./lib/model";
import { decodeShareState, encodeShareState, isStaleModel, normalizeSharedState, type SharedState } from "./lib/shareState";
import { SAVED_COMPARISONS } from "./lib/savedComparisons";
import { METHODOLOGY_NOTES } from "./lib/methodology";
import { IMPACT } from "./lib/verticals";
import { IMPACT_COPY } from "./lib/impactCopy";
import { seedSolution } from "./lib/seeds";
import IncumbentPicker from "./components/IncumbentPicker";
import ScenarioStep from "./components/ScenarioStep";
import SolutionsStep from "./components/SolutionsStep";
import ResultsView from "./components/ResultsView";

type Phase = "intro" | "wizard" | "results";

// Index of the wizard's final step (business impact).
const LAST_STEP = 3;

const HIGHLIGHTS = [
  { icon: KeyRound, text: "Reuse of existing readers and controllers, decided per solution" },
  { icon: CalendarRange, text: "Model any horizon, from a 1-year pilot to a 15-year refresh cycle" },
  { icon: Share2, text: "Share a link with your numbers baked in, no login required" },
];

function AccessControlTcoInner() {
  const searchParams = useSearchParams();

  // A shared link is read once, at mount, as lazy initial state, so the
  // debounced address-bar sync can't re-hydrate over in-progress edits.
  const [initial] = useState(() => {
    const raw = searchParams.get("s");
    return raw ? decodeShareState(raw) : null;
  });
  // A link with ?step= is a wizard still in progress; without it, a link is
  // a finished comparison and opens on the results.
  const [initialStep] = useState(() => {
    const raw = searchParams.get("step");
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && n >= 0 && n <= LAST_STEP ? n : null;
  });
  const [phase, setPhase] = useState<Phase>(initial ? (initialStep !== null ? "wizard" : "results") : "intro");
  const [stepIndex, setStepIndex] = useState(initialStep ?? 0);
  const [shapeId, setShapeId] = useState<string | null>(initial?.shapeId ?? null);
  const [scenario, setScenario] = useState<ScenarioInputs>(initial?.scenario ?? DEFAULT_SCENARIO);
  const [solA, setSolA] = useState<SolutionInputs | null>(initial?.solA ?? null);
  const [solB, setSolB] = useState<SolutionInputs | null>(initial?.solB ?? null);
  const [colorA, setColorA] = useState(initial?.colorA ?? SOLUTION_A_COLOR);
  const [colorB, setColorB] = useState(initial?.colorB ?? SOLUTION_B_COLOR);
  const [staleModel, setStaleModel] = useState(initial ? isStaleModel(initial) : false);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !shapeId || !solA || !solB) return "";
    const json = encodeShareState({ shapeId, scenario, solA, solB, colorA, colorB });
    return `${window.location.origin}${window.location.pathname}?s=${encodeURIComponent(json)}`;
  }, [shapeId, scenario, solA, solB, colorA, colorB]);

  useAddressBarSync(phase, stepIndex, shareUrl);

  // Leaving from the wizard drops an unfinished setup, so ask first.
  function confirmLeave(e: React.MouseEvent) {
    if (phase === "wizard" && shapeId) confirmLeaveSetup(e);
  }

  function handleShapeChange(id: string) {
    const opt = SHAPE_OPTIONS.find((s) => s.id === id)!;
    // A different comparison shape invalidates any prior incumbent choice.
    if (id !== shapeId) setScenario((prev) => ({ ...prev, incumbent: defaultIncumbentFor(opt) }));
    setShapeId(id);
    setSolA((prev) => (prev && prev.model === opt.modelA ? prev : seedSolution("a", opt)));
    setSolB((prev) => (prev && prev.model === opt.modelB ? prev : seedSolution("b", opt)));
  }

  function next() {
    if (stepIndex < LAST_STEP) setStepIndex((i) => i + 1);
    else if (solA && solB) setPhase("results");
  }

  function handleLoadSaved(state: SharedState) {
    // Saved comparisons don't go through decodeShareState, so they need the
    // same missing-field backfill here.
    const normalized = normalizeSharedState(state);
    setShapeId(normalized.shapeId);
    setScenario(normalized.scenario);
    setSolA(normalized.solA);
    setSolB(normalized.solB);
    setColorA(normalized.colorA);
    setColorB(normalized.colorB);
    setStaleModel(isStaleModel(state));
    setPhase("results");
  }

  if (phase === "intro") {
    return (
      <CalculatorFrame size="lg">
        <IntroScreen
          title="Access Control TCO Calculator"
          description="Compare the true multi-year cost of two access control systems, cloud-managed or server-based, not just the sticker price. Door hardware, licensing, servers, credentials, cardholder admin, and door alarms all factor in, and every assumption behind the numbers is transparent and yours to edit."
          highlights={HIGHLIGHTS}
          notes={METHODOLOGY_NOTES}
          store={SAVED_COMPARISONS}
          onStart={() => setPhase("wizard")}
          onLoadSaved={handleLoadSaved}
        />
      </CalculatorFrame>
    );
  }

  if (phase === "results" && solA && solB) {
    return (
      <CalculatorFrame size="xl">
        <ResultsView
          shapeId={shapeId ?? ""}
          scenario={scenario}
          solA={solA}
          solB={solB}
          colorA={colorA}
          colorB={colorB}
          shareUrl={shareUrl}
          staleModel={staleModel}
          onColorAChange={setColorA}
          onColorBChange={setColorB}
          onDismissStaleModel={() => setStaleModel(false)}
          onScenarioChange={setScenario}
          onSolAChange={setSolA}
          onSolBChange={setSolB}
          onChangeComparison={() => {
            setPhase("wizard");
            setStepIndex(0);
          }}
        />
      </CalculatorFrame>
    );
  }

  return (
    <CalculatorFrame size="lg" onLeave={confirmLeave}>
      <Title order={2} mb={4}>Access Control TCO Wizard</Title>
      <Text c={TEXT_MUTED} size="sm" mb="xl">
        Four quick steps to set up your comparison. The last one is optional.
      </Text>

      <Stepper active={stepIndex} onStepClick={setStepIndex} allowNextStepsSelect={false} mb="xl">
        <Stepper.Step label="Comparison" description="What's being compared">
          <Box mt="xl">
            <ShapeStep options={SHAPE_OPTIONS} value={shapeId} onChange={handleShapeChange} />
            {/* Asked up front, not after the solution cards: incumbency and
                whether the doors are wired change every year-0 cost, and
                which fields later steps show. */}
            {solA && solB && shapeId && (
              <Card withBorder padding="lg" radius="md" mt="lg">
                <IncumbentPicker scenario={scenario} onScenarioChange={setScenario} nameA={solA.name} nameB={solB.name} />
              </Card>
            )}
          </Box>
        </Stepper.Step>
        <Stepper.Step label="Scenario" description="Doors and people">
          <Box mt="xl">
            <ScenarioStep value={scenario} onChange={setScenario} />
          </Box>
        </Stepper.Step>
        <Stepper.Step label="Solutions" description="Name & configure">
          <Box mt="xl">
            {solA && solB && (
              <SolutionsStep
                solA={solA} solB={solB} onChangeA={setSolA} onChangeB={setSolB}
                colorA={colorA} colorB={colorB} scenario={scenario}
              />
            )}
          </Box>
        </Stepper.Step>
        <Stepper.Step label="Business impact" description="Optional, by industry">
          <Box mt="xl">
            {solA && solB && (
              <BusinessImpactStep
                impact={IMPACT} copy={IMPACT_COPY}
                scenario={scenario} solA={solA} solB={solB} colorA={colorA} colorB={colorB}
                onScenarioChange={setScenario} onSolAChange={setSolA} onSolBChange={setSolB}
              />
            )}
          </Box>
        </Stepper.Step>
      </Stepper>

      <Group justify="flex-end">
        <Button variant="default" onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={stepIndex === 0}>
          Back
        </Button>
        <Button onClick={next} disabled={stepIndex === 0 && shapeId === null}>
          {stepIndex < LAST_STEP ? "Next" : "Generate comparison"}
        </Button>
      </Group>
    </CalculatorFrame>
  );
}

export default function AccessControlTcoPage() {
  return (
    <Suspense fallback={null}>
      <AccessControlTcoInner />
    </Suspense>
  );
}
