"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Box, Button, Card, Group, Stepper, Text, Title } from "@mantine/core";
import { CalendarRange, Database, Share2 } from "lucide-react";
import { SOLUTION_A_COLOR, SOLUTION_B_COLOR, TEXT_MUTED } from "../_tco-shared/lib/colors";
import { DEFAULT_SCENARIO, SHAPE_OPTIONS, defaultSolution, type ShapeOption } from "./lib/defaults";
import type { ScenarioInputs, SolutionInputs } from "./lib/model";
import { decodeShareState, encodeShareState, isStaleModel, normalizeSharedState, type SharedState } from "./lib/shareState";
import { CLOUD_VENDOR_DEFAULTS, ONPREM_VMS_VENDOR_DEFAULTS, ONPREM_CAMERA_VENDOR_DEFAULTS, withVendorDefaults } from "./lib/vendorDefaults";
import { SAVED_COMPARISONS } from "./lib/savedComparisons";
import { METHODOLOGY_NOTES } from "./lib/methodology";
import { IMPACT } from "./lib/verticals";
import { IMPACT_COPY } from "./lib/impactCopy";
import { defaultIncumbentFor } from "../_tco-shared/lib/fields";
import IntroScreen from "../_tco-shared/components/IntroScreen";
import ShapeStep from "../_tco-shared/components/ShapeStep";
import CalculatorFrame, { confirmLeaveSetup, useAddressBarSync } from "../_tco-shared/components/CalculatorFrame";
import ScenarioStep from "./components/ScenarioStep";
import SolutionsStep from "./components/SolutionsStep";
import ResultsView from "./components/ResultsView";
import BusinessImpactStep from "../_tco-shared/components/BusinessImpactStep";
import IncumbentPicker from "./components/IncumbentPicker";

type Phase = "intro" | "wizard" | "results";

// Index of the wizard's final step (business impact).
const LAST_STEP = 3;

const HIGHLIGHTS = [
  { icon: Database, text: "Real vendor pricing pre-filled where it's been researched" },
  { icon: CalendarRange, text: "Model any horizon, from a 1-year pilot to a 15-year refresh cycle" },
  { icon: Share2, text: "Share a link with your numbers baked in, no login required" },
];

// Convenience defaults for this tool's actual primary audience, comparing
// against whatever a prospect already runs. Neither is forced, both stay
// fully editable, they just save a click for the most common starting
// point instead of leaving every field blank. On-prem defaults to
// Milestone/Axis (the same pairing the original single-vendor tool's
// numeric defaults were drawn from), so the name lines up with the numbers
// rather than sitting under a generic placeholder. Runs the same
// withVendorDefaults() merge the wizard's Selects use, so a pre-filled
// vendor with researched data (e.g. Milestone, Axis) starts from its real
// numbers instead of the generic defaults, same as picking it manually would.
function seedSolution(slot: "a" | "b", opt: ShapeOption): SolutionInputs {
  const model = slot === "a" ? opt.modelA : opt.modelB;
  const bothSameModel = opt.modelA === opt.modelB;
  const leaveOpen = bothSameModel && slot === "b"; // the "compared against" side, when both sides share a model

  if (model === "cloud") {
    if (leaveOpen) return defaultSolution(slot, "Solution B (Cloud)", model);
    return withVendorDefaults(defaultSolution(slot, "Verkada", model), "Verkada", CLOUD_VENDOR_DEFAULTS);
  }
  if (leaveOpen) return defaultSolution(slot, "Solution B (On-Prem)", model);
  let sol = defaultSolution(slot, "", model);
  sol = withVendorDefaults(sol, "Milestone XProtect", ONPREM_VMS_VENDOR_DEFAULTS);
  sol = withVendorDefaults(sol, "Axis Communications", ONPREM_CAMERA_VENDOR_DEFAULTS);
  return { ...sol, vmsProvider: "Milestone XProtect", cameraProvider: "Axis Communications", name: "Milestone XProtect · Axis Communications cameras" };
}

function TcoCalculatorInner() {
  const searchParams = useSearchParams();

  // Read a shared link once, at mount, as lazy initial state rather than via
  // an effect: this is genuinely "what should this component start as," not
  // a synchronization with an external system, and a lazy initializer only
  // ever runs on the very first render regardless of later searchParams
  // changes (e.g. our own debounced address-bar sync below), so it can't
  // re-hydrate and clobber in-progress edits the way an effect + ref could.
  const [initial] = useState(() => {
    const raw = searchParams.get("s");
    return raw ? decodeShareState(raw) : null;
  });

  // A link with ?step= is a wizard still in progress (the address bar keeps
  // it there so a refresh doesn't lose the setup); without it, a link is a
  // finished comparison and opens on the results.
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
  // A shared link or saved comparison made under an older cost model gets a
  // one-line notice that its totals were recalculated, rather than silently
  // showing numbers that differ from what its sender saw.
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
    if (id !== shapeId) {
      // A different comparison shape invalidates any prior "which side is incumbent" choice;
      // re-seed with whichever default fits the new shape (see defaultIncumbentFor).
      setScenario((prev) => ({ ...prev, incumbent: defaultIncumbentFor(opt) }));
    }
    setShapeId(id);
    setSolA((prev) => (prev && prev.model === opt.modelA ? prev : seedSolution("a", opt)));
    setSolB((prev) => (prev && prev.model === opt.modelB ? prev : seedSolution("b", opt)));
  }

  function next() {
    if (stepIndex < LAST_STEP) setStepIndex((i) => i + 1);
    else if (solA && solB) setPhase("results");
  }
  function back() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function handleLoadSaved(state: SharedState) {
    // Saved comparisons (localStorage) don't go through decodeShareState, so
    // they need the same missing-field backfill applied here explicitly —
    // a save made before a newer field existed would otherwise leave it
    // undefined and NaN out the whole comparison once loaded.
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

  const canProceed = stepIndex === 0 ? shapeId !== null : true;

  if (phase === "intro") {
    return (
      <CalculatorFrame size="lg">
        <IntroScreen
          title="Video Surveillance TCO Calculator"
          description="Compare the true multi-year cost of two video-management deployments, cloud, on-prem, or a mix, not just the sticker price. Hardware, licensing, storage, admin labor, and truck rolls all factor in, and every assumption behind the numbers is transparent and yours to edit."
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
            onEditSetup={() => {
              setPhase("wizard");
              setStepIndex(2);
            }}
          />
      </CalculatorFrame>
    );
  }

  return (
    <CalculatorFrame size="lg" onLeave={confirmLeave}>
        <Title order={2} mb={4}>TCO Comparison Wizard</Title>
        <Text c={TEXT_MUTED} size="sm" mb="xl">
          Four quick steps to set up your comparison. The last one is optional.
        </Text>

        <Stepper active={stepIndex} onStepClick={setStepIndex} allowNextStepsSelect={false} mb="xl">
          <Stepper.Step label="Comparison" description="What's being compared">
            <Box mt="xl">
              <ShapeStep options={SHAPE_OPTIONS} value={shapeId} onChange={handleShapeChange} />
              {/* Asked up front, not after the solution cards: incumbency and
                  camera reuse change how every year-0 cost is treated, and
                  which fields later steps need to show. */}
              {solA && solB && shapeId && (
                <Card withBorder padding="lg" radius="md" mt="lg">
                  <IncumbentPicker scenario={scenario} onScenarioChange={setScenario} nameA={solA.name} nameB={solB.name} />
                </Card>
              )}
            </Box>
          </Stepper.Step>
          <Stepper.Step label="Scenario" description="Key variables">
            <Box mt="xl">
              <ScenarioStep value={scenario} onChange={setScenario} />
            </Box>
          </Stepper.Step>
          <Stepper.Step label="Solutions" description="Name & configure">
            <Box mt="xl">
              {solA && solB && (
                <SolutionsStep
                  solA={solA} solB={solB} onChangeA={setSolA} onChangeB={setSolB}
                  colorA={colorA} colorB={colorB}
                  scenario={scenario}
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
          <Button variant="default" onClick={back} disabled={stepIndex === 0}>
            Back
          </Button>
          <Button onClick={next} disabled={!canProceed}>
            {stepIndex < LAST_STEP ? "Next" : "Generate comparison"}
          </Button>
        </Group>
    </CalculatorFrame>
  );
}

export default function TcoCalculatorPage() {
  return (
    <Suspense fallback={null}>
      <TcoCalculatorInner />
    </Suspense>
  );
}
