"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, Button, Container, Group, Stepper, Text, Title } from "@mantine/core";
import { ArrowLeft } from "lucide-react";
import { SOLUTION_A_COLOR, SOLUTION_B_COLOR, TEXT_MUTED } from "./lib/colors";
import { DEFAULT_SCENARIO, SHAPE_OPTIONS, defaultSolution, type ShapeOption } from "./lib/defaults";
import type { IncumbentChoice, ScenarioInputs, SolutionInputs } from "./lib/model";
import { decodeShareState, encodeShareState } from "./lib/shareState";
import ShapeStep from "./components/ShapeStep";
import ScenarioStep from "./components/ScenarioStep";
import SolutionsStep from "./components/SolutionsStep";
import ResultsView from "./components/ResultsView";

type Phase = "wizard" | "results";

// Convenience defaults for this tool's primary audience: someone on the
// Verkada side comparing against whatever a prospect already runs. Neither
// is forced, both stay fully editable, they just save a click for the most
// common starting point instead of leaving every field blank.
function defaultNameFor(slot: "a" | "b", opt: ShapeOption): string {
  const model = slot === "a" ? opt.modelA : opt.modelB;
  if (model !== "cloud") return slot === "a" ? "Solution A (On-Prem)" : "Solution B (On-Prem)";
  const bothCloud = opt.modelA === "cloud" && opt.modelB === "cloud";
  if (bothCloud && slot === "b") return "Solution B (Cloud)"; // leave the "compared against" side open
  return "Verkada";
}

function defaultIncumbentFor(opt: ShapeOption): IncumbentChoice {
  if (opt.modelA === "onprem" && opt.modelB === "cloud") return "a";
  if (opt.modelA === "cloud" && opt.modelB === "onprem") return "b";
  return "none";
}

function TcoCalculatorInner() {
  const router = useRouter();
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

  const [phase, setPhase] = useState<Phase>(initial ? "results" : "wizard");
  const [stepIndex, setStepIndex] = useState(0);
  const [shapeId, setShapeId] = useState<string | null>(initial?.shapeId ?? null);
  const [scenario, setScenario] = useState<ScenarioInputs>(initial?.scenario ?? DEFAULT_SCENARIO);
  const [solA, setSolA] = useState<SolutionInputs | null>(initial?.solA ?? null);
  const [solB, setSolB] = useState<SolutionInputs | null>(initial?.solB ?? null);
  const [colorA, setColorA] = useState(initial?.colorA ?? SOLUTION_A_COLOR);
  const [colorB, setColorB] = useState(initial?.colorB ?? SOLUTION_B_COLOR);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !shapeId || !solA || !solB) return "";
    const json = encodeShareState({ shapeId, scenario, solA, solB, colorA, colorB });
    return `${window.location.origin}${window.location.pathname}?s=${encodeURIComponent(json)}`;
  }, [shapeId, scenario, solA, solB, colorA, colorB]);

  // Keep the address bar in sync so copying it directly also works, not just the Share button.
  useEffect(() => {
    if (phase !== "results" || !shareUrl) return;
    const t = setTimeout(() => {
      const url = new URL(shareUrl);
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    }, 400);
    return () => clearTimeout(t);
  }, [phase, shareUrl, router]);

  function handleShapeChange(id: string) {
    const opt = SHAPE_OPTIONS.find((s) => s.id === id)!;
    if (id !== shapeId) {
      // A different comparison shape invalidates any prior "which side is incumbent" choice;
      // re-seed with whichever default fits the new shape (see defaultIncumbentFor).
      setScenario((prev) => ({ ...prev, incumbent: defaultIncumbentFor(opt) }));
    }
    setShapeId(id);
    setSolA((prev) =>
      prev && prev.model === opt.modelA ? prev : defaultSolution("a", defaultNameFor("a", opt), opt.modelA)
    );
    setSolB((prev) =>
      prev && prev.model === opt.modelB ? prev : defaultSolution("b", defaultNameFor("b", opt), opt.modelB)
    );
  }

  function next() {
    if (stepIndex < 2) setStepIndex((i) => i + 1);
    else if (solA && solB) setPhase("results");
  }
  function back() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  const canProceed = stepIndex === 0 ? shapeId !== null : true;

  if (phase === "results" && solA && solB) {
    return (
      <Box style={{ minHeight: "100vh", background: "#0f1117" }} py="xl">
        <Container size="lg">
          <Button component={Link} href="/professional" leftSection={<ArrowLeft size={16} />} variant="subtle" mb="lg">
            Back
          </Button>
          <ResultsView
            scenario={scenario}
            solA={solA}
            solB={solB}
            colorA={colorA}
            colorB={colorB}
            shareUrl={shareUrl}
            onScenarioChange={setScenario}
            onSolAChange={setSolA}
            onSolBChange={setSolB}
            onEditSetup={() => {
              setPhase("wizard");
              setStepIndex(2);
            }}
          />
        </Container>
      </Box>
    );
  }

  return (
    <Box style={{ minHeight: "100vh", background: "#0f1117" }} py="xl">
      <Container size="lg">
        <Button component={Link} href="/professional" leftSection={<ArrowLeft size={16} />} variant="subtle" mb="lg">
          Back
        </Button>
        <Title order={2} mb={4}>TCO Comparison Wizard</Title>
        <Text c={TEXT_MUTED} size="sm" mb="xl" maw={700}>
          A quick setup for comparing the total cost of two video-management deployments over time. Works for
          on-prem vs. on-prem, cloud vs. cloud, or one of each. You name both sides and set the numbers. This is
          an independent estimate tool, not affiliated with or endorsed by any vendor named here.
        </Text>

        <Stepper active={stepIndex} onStepClick={setStepIndex} allowNextStepsSelect={false} mb="xl">
          <Stepper.Step label="Comparison" description="Pick a shape">
            <Box mt="xl">
              <ShapeStep value={shapeId} onChange={handleShapeChange} />
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
                  colorA={colorA} colorB={colorB} onColorAChange={setColorA} onColorBChange={setColorB}
                  scenario={scenario} onScenarioChange={setScenario}
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
            {stepIndex < 2 ? "Next" : "Generate comparison"}
          </Button>
        </Group>
      </Container>
    </Box>
  );
}

export default function TcoCalculatorPage() {
  return (
    <Suspense fallback={null}>
      <TcoCalculatorInner />
    </Suspense>
  );
}
