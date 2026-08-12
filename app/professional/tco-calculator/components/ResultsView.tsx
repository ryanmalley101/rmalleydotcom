"use client";

import { useMemo, useRef, useState } from "react";
import { Accordion, Badge, Box, Button, CopyButton, Group, Modal, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { Check, Copy, Download, History, RotateCcw, Save } from "lucide-react";
import type { HardwareFootprint, ScenarioInputs, SolutionInputs } from "../lib/model";
import { computeComparison } from "../lib/model";
import { TEXT_MUTED, fmtUsd } from "../lib/colors";
import { exportSnapshot } from "../lib/exportSnapshot";
import { saveComparison } from "../lib/savedComparisons";
import ScenarioStep from "./ScenarioStep";
import AssumptionsPanel from "./AssumptionsPanel";
import ChartsPanel from "./ChartsPanel";
import IncumbentPicker from "./IncumbentPicker";

// Color by meaning (which side actually costs less), not by A/B slot or
// hardcoded to any vendor — computed fresh from the totals every render, so
// it's correct regardless of which side wins. Deliberately not colorA/colorB:
// those stay exactly as the user set them (still fully editable via the
// ColorInput pickers in the wizard, still what the charts/accordion below
// use), this is a separate, computed-only accent scoped to this summary.
const CHEAPER_COLOR = "var(--mantine-color-teal-5)";
const PRICIER_COLOR = "var(--mantine-color-gray-5)";

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0} align="center">
      <Text ff="monospace" fw={600} size="sm">{value}</Text>
      <Text size="xs" c={TEXT_MUTED}>{label}</Text>
    </Stack>
  );
}

function fleetReplacedPct(horizonYears: number, halfLifeYears: number) {
  return Math.min(100, Math.round(100 * (1 - Math.pow(0.5, horizonYears / halfLifeYears))));
}

// What you actually end up owning/racking, not just what it costs — a cloud
// ripReplace solution with no local box at all renders nothing rather than a
// misleading "0 connector appliances".
function hardwareSummaryText(hw: HardwareFootprint): string | null {
  const parts: string[] = [];
  if (hw.unitsLabel && hw.units > 0) parts.push(`${hw.units.toLocaleString()} ${hw.unitsLabel.toLowerCase()}`);
  if (hw.storageTB !== null && hw.storageTB > 0) {
    const tb = hw.storageTB >= 100 ? Math.round(hw.storageTB).toLocaleString() : hw.storageTB.toFixed(1);
    parts.push(`${tb} TB storage`);
  }
  return parts.length ? parts.join(" · ") : null;
}

export default function ResultsView({
  shapeId, scenario, solA, solB, colorA, colorB, shareUrl, onScenarioChange, onSolAChange, onSolBChange, onEditSetup,
}: {
  shapeId: string;
  scenario: ScenarioInputs;
  solA: SolutionInputs;
  solB: SolutionInputs;
  colorA: string;
  colorB: string;
  shareUrl: string;
  onScenarioChange: (v: ScenarioInputs) => void;
  onSolAChange: (v: SolutionInputs) => void;
  onSolBChange: (v: SolutionInputs) => void;
  onEditSetup: () => void;
}) {
  const comparison = useMemo(() => computeComparison(scenario, solA, solB), [scenario, solA, solB]);
  const { a, b, crossoverYear, laterCrossoverYears } = comparison;
  const snapshotRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [saveModalOpen, { open: openSaveModal, close: closeSaveModal }] = useDisclosure(false);
  const [saveName, setSaveName] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  // Below this width the assumptions accordion is too cramped to sit beside the
  // chart, so it drops back to today's single stacked column instead; sticky
  // positioning is skipped entirely there rather than fighting a column that's
  // no longer meaningfully "beside" anything, which would just make the summary
  // float oddly over the fields as you scroll past it on a narrow screen.
  const isDesktop = useMediaQuery("(min-width: 75em)");

  const cheaper = a.total <= b.total ? solA : solB;
  const diff = Math.abs(a.total - b.total);
  const maxTotal = Math.max(a.total, b.total);
  const pctSaved = maxTotal > 0 ? Math.round((diff / maxTotal) * 100) : 0;

  const fleetPctA = fleetReplacedPct(scenario.horizonYears, solA.fleetHalfLifeYears);
  const fleetPctB = fleetReplacedPct(scenario.horizonYears, solB.fleetHalfLifeYears);

  async function handleDownload() {
    if (!snapshotRef.current) return;
    setExporting(true);
    try {
      await exportSnapshot(snapshotRef.current, `${solA.name}-vs-${solB.name}-tco.png`.replace(/\s+/g, "-"));
    } finally {
      setExporting(false);
    }
  }

  function handleOpenSaveModal() {
    setSaveName(`${solA.name} vs. ${solB.name}`);
    openSaveModal();
  }

  function handleConfirmSave() {
    saveComparison(saveName, { shapeId, scenario, solA, solB, colorA, colorB });
    closeSaveModal();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={3}>{solA.name} vs. {solB.name}</Title>
          <Text size="sm" c={TEXT_MUTED}>
            {scenario.cameras.toLocaleString()} cameras &middot; {scenario.sites.toLocaleString()} sites &middot; {scenario.horizonYears}-year horizon
            {scenario.incumbent !== "none" && ` · ${scenario.incumbent === "a" ? solA.name : solB.name} is incumbent`}
          </Text>
        </div>
        <Group gap="xs">
          <Button variant="default" leftSection={justSaved ? <Check size={14} /> : <Save size={14} />} onClick={handleOpenSaveModal}>
            {justSaved ? "Saved" : "Save"}
          </Button>
          <CopyButton value={shareUrl}>
            {({ copied, copy }) => (
              <Button variant="default" leftSection={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copy}>
                {copied ? "Link copied" : "Share link"}
              </Button>
            )}
          </CopyButton>
          <Button variant="default" leftSection={<Download size={14} />} onClick={handleDownload} loading={exporting}>
            Download snapshot
          </Button>
          <Button variant="default" leftSection={<RotateCcw size={14} />} onClick={onEditSetup}>
            Edit setup
          </Button>
        </Group>
      </Group>

      <Modal opened={saveModalOpen} onClose={closeSaveModal} title="Save this comparison" centered>
        <Stack gap="md">
          <Text size="sm" c={TEXT_MUTED}>
            Saved locally in this browser only, no account needed. It won&apos;t survive clearing site data, and won&apos;t
            show up on another device.
          </Text>
          <TextInput
            label="Name"
            value={saveName}
            onChange={(e) => setSaveName(e.currentTarget.value)}
            data-autofocus
            onKeyDown={(e) => e.key === "Enter" && handleConfirmSave()}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeSaveModal}>Cancel</Button>
            <Button onClick={handleConfirmSave} leftSection={<Save size={14} />}>Save</Button>
          </Group>
        </Stack>
      </Modal>

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
              <Paper withBorder p="xl" radius="md">
                <Stack gap="xl">
                  <Stack gap={4} align="center" ta="center">
                    <Text ff="monospace" fw={700} size="2.75rem" c="teal" lh={1.1}>
                      {fmtUsd(diff)}
                    </Text>
                    <Text size="sm" c={TEXT_MUTED}>
                      {pctSaved}% lower with {cheaper.name} over {scenario.horizonYears} {scenario.horizonYears === 1 ? "year" : "years"}
                      {crossoverYear !== null && `, overtaken in Yr ${crossoverYear}`}
                      {laterCrossoverYears.length > 0 && ` (crosses again at Yr ${laterCrossoverYears.join(", ")})`}
                    </Text>
                  </Stack>

                  <Stack gap="md">
                    {[{ sol: solA, result: a, slot: "a" as const }, { sol: solB, result: b, slot: "b" as const }].map(({ sol, result, slot }) => {
                      const isCheaper = sol.id === cheaper.id;
                      const isIncumbent = scenario.incumbent === slot;
                      const perCamMo = fmtUsd(result.total / (scenario.cameras * scenario.horizonYears * 12));
                      const hwText = hardwareSummaryText(result.hardware);
                      return (
                        <div key={sol.id}>
                          <Group justify="space-between" mb={6} wrap="nowrap" gap="xs">
                            <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                              <Text size="sm" fw={600} c={isCheaper ? undefined : TEXT_MUTED} truncate>{sol.name}</Text>
                              {isCheaper && (
                                <Badge size="xs" variant="light" color="teal" leftSection={<Check size={10} />} style={{ flexShrink: 0 }}>
                                  Lower cost
                                </Badge>
                              )}
                              {isIncumbent && (
                                <Badge size="xs" variant="outline" color="gray" leftSection={<History size={10} />} style={{ flexShrink: 0 }}>
                                  Incumbent
                                </Badge>
                              )}
                            </Group>
                            <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
                              <Text ff="monospace" fw={700} size="sm" c={isCheaper ? "teal" : TEXT_MUTED}>{fmtUsd(result.total)}</Text>
                              <Text size="xs" c={TEXT_MUTED}>{perCamMo} / cam / mo</Text>
                            </Group>
                          </Group>
                          <Box style={{ height: isCheaper ? 8 : 5, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                            <Box
                              style={{
                                height: "100%",
                                width: `${maxTotal > 0 ? (result.total / maxTotal) * 100 : 0}%`,
                                borderRadius: 4,
                                background: isCheaper ? CHEAPER_COLOR : PRICIER_COLOR,
                              }}
                            />
                          </Box>
                          {hwText && <Text size="xs" c={TEXT_MUTED} mt={4}>{hwText}</Text>}
                        </div>
                      );
                    })}
                  </Stack>

                  <Group justify="center" gap="xl" pt="md" style={{ borderTop: "1px solid var(--mantine-color-dark-4)" }}>
                    <FooterStat label="Crossover" value={crossoverYear === null ? "None" : "Yr " + crossoverYear} />
                    <FooterStat label={`${solA.name} fleet replaced`} value={fleetPctA + "%"} />
                    <FooterStat label={`${solB.name} fleet replaced`} value={fleetPctB + "%"} />
                    <FooterStat label="Horizon" value={`${scenario.horizonYears} yrs`} />
                  </Group>
                </Stack>
              </Paper>

              <ChartsPanel comparison={comparison} nameA={solA.name} nameB={solB.name} colorA={colorA} colorB={colorB} />
            </Stack>
          </Box>
        </Box>

        <Box style={{ flex: "1 1 0%", minWidth: 0, width: "100%" }}>
          {/* Scenario (camera count, sites, horizon, ...) is system-agnostic and stays
              open, since it's what the reviewer is most likely to want to check or tweak
              first; the two per-solution assumption panels are dense vendor-specific data
              that's more useful collapsed by default on this results/review screen, unlike
              the wizard's own editing steps where those same fields need to stay discoverable. */}
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
                <AssumptionsPanel sol={solA} onChange={onSolAChange} />
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
                <AssumptionsPanel sol={solB} onChange={onSolBChange} />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Box>
      </Box>

      <Text size="xs" c={TEXT_MUTED} maw={860}>
        <Text span fw={700} size="xs">Methodology notes.</Text> Unless one solution is marked incumbent above,
        both pay their own year-0 buildout cost (initial hardware plus bulk install labor) so neither side gets
        a sunk-cost pass; the incumbent&apos;s ongoing hardware refreshes still apply on schedule. Camera failures
        follow exponential decay (surviving fraction = 0.5^(years / half-life)), each solution has its own
        half-life and warranty period; a failure still under warranty costs only replacement labor, not the
        camera itself. Replacement cameras are assumed not to fail again within the horizon. Cloud/hybrid
        license prices are annualized (price &divide; term) with a continuous retention curve
        ((days/30)<sup>0.4</sup>), reflecting that storage is only part of what a license covers and gets
        cheaper per unit at higher volumes; on-prem storage scales the same way, before RAID overhead. On-prem
        storage cost accounts for RAID redundancy: RAID 1 and RAID 10 roughly double the raw capacity bought
        versus RAID 0 or no RAID, to survive a drive failure. On-prem perpetual licenses are charged once at
        year 0 like the hardware, unless that side is marked incumbent (already owned); support renewals are
        counted every year regardless. Appliance/server counts assume at least one unit per site.
        Annual cost escalation compounds every recurring cost year over year.
        Investigation labor is a soft cost, kept as its own category so it can be zeroed out independently.
        Defaults are directional placeholders, not quotes. This tool is not affiliated with or endorsed by any
        vendor named here.
      </Text>
    </Stack>
  );
}
