"use client";

import { useMemo, useRef, useState } from "react";
import { Accordion, Alert, Badge, Box, Button, ColorInput, CopyButton, Group, Menu, Modal, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { Check, ChevronDown, Copy, Download, FileSpreadsheet, FileText, History, Image as ImageIcon, RotateCcw, Save } from "lucide-react";
import type { HardwareFootprint, ScenarioInputs, SolutionInputs } from "../lib/model";
import { computeComparison } from "../lib/model";
import { COLOR_SWATCHES, TEXT_MUTED, fmtUsd } from "../lib/colors";
import { STAFF_TIME_NOTE } from "../lib/fieldHelp";
import InfoLabel from "./InfoLabel";
import { exportSnapshot } from "../lib/exportSnapshot";
import { saveComparison } from "../lib/savedComparisons";
import ScenarioStep from "./ScenarioStep";
import AssumptionsPanel from "./AssumptionsPanel";
import ChartsPanel from "./ChartsPanel";
import MethodologyNotes from "./MethodologyNotes";
import GapDrivers from "./GapDrivers";
import YearTable from "./YearTable";
import ShareChecklist from "./ShareChecklist";
import { buildCsv, buildReportHtml } from "../lib/report";
import { METHODOLOGY_NOTES } from "../lib/methodology";
import IncumbentPicker from "./IncumbentPicker";

// Color by meaning (which side actually costs less), not by A/B slot or
// hardcoded to any vendor — computed fresh from the totals every render, so
// it's correct regardless of which side wins. Deliberately not colorA/colorB:
// those stay exactly as the user set them (still fully editable via the
// ColorInput pickers in the wizard, still what the charts/accordion below
// use), this is a separate, computed-only accent scoped to this summary.
const CHEAPER_COLOR = "var(--mantine-color-teal-5)";
const PRICIER_COLOR = "var(--mantine-color-gray-5)";

// Chart line color for one solution, on the results page next to that
// solution's assumptions (it used to sit in the wizard's setup cards).
function ChartColor({ color, onChange }: { color: string; onChange: (v: string) => void }) {
  return (
    <ColorInput
      label="Chart color" value={color} onChange={onChange} format="hex" size="xs" w={160} mb="sm"
      swatches={COLOR_SWATCHES}
    />
  );
}

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0} align="center">
      <Text ff="monospace" fw={600} size="sm">{value}</Text>
      <Text size="xs" c={TEXT_MUTED} ta="center" maw={180} lineClamp={2}>{label}</Text>
    </Stack>
  );
}

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
  const pricier = cheaper.id === solA.id ? solB : solA;
  const yearsLabel = `${scenario.horizonYears} ${scenario.horizonYears === 1 ? "year" : "years"}`;
  const isTie = diff < 0.5;
  // The last sign flip is when the eventual winner took the lead for good.
  const allCrossovers = crossoverYear === null ? [] : [crossoverYear, ...laterCrossoverYears];
  const leadYear = allCrossovers.length ? allCrossovers[allCrossovers.length - 1] : null;
  const timingSentence = isTie
    ? null
    : allCrossovers.length > 1
      ? `The lead changes hands in years ${allCrossovers.join(", ")}, and ${cheaper.name} stays cheaper from year ${leadYear}.`
      : leadYear !== null
        ? `${cheaper.name} becomes the cheaper option in year ${leadYear}.`
        : `${cheaper.name} is cheaper in every year.`;

  // From the cost model's own camera cohorts, so the stat can't disagree
  // with what was charged.
  const fleetPctA = Math.round(a.hardware.originalFleetReplacedPct);
  const fleetPctB = Math.round(b.hardware.originalFleetReplacedPct);

  async function handleDownload() {
    if (!snapshotRef.current) return;
    setExporting(true);
    try {
      await exportSnapshot(snapshotRef.current, `${solA.name}-vs-${solB.name}-tco.png`.replace(/\s+/g, "-"));
    } finally {
      setExporting(false);
    }
  }

  const fileBase = `${solA.name}-vs-${solB.name}-tco`.replace(/[^\w.-]+/g, "-");
  const exportState = { shapeId, scenario, solA, solB, colorA, colorB };

  function handleCsv() {
    const blob = new Blob([buildCsv(exportState, comparison)], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${fileBase}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // Opens a plain, light-themed report in a new tab and starts printing, so
  // it can be saved as a PDF from the browser's print dialog.
  function handlePrintable() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildReportHtml(exportState, comparison, METHODOLOGY_NOTES));
    win.document.close();
    win.focus();
    win.print();
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
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <Button variant="default" leftSection={<Download size={14} />} rightSection={<ChevronDown size={14} />} loading={exporting}>
                Export
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<ImageIcon size={14} />} onClick={handleDownload}>Snapshot image (PNG)</Menu.Item>
              <Menu.Item leftSection={<FileSpreadsheet size={14} />} onClick={handleCsv}>Data and inputs (CSV)</Menu.Item>
              <Menu.Item leftSection={<FileText size={14} />} onClick={handlePrintable}>Printable report (PDF)</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button variant="default" leftSection={<RotateCcw size={14} />} onClick={onEditSetup}>
            Edit setup
          </Button>
        </Group>
      </Group>

      {staleModel && (
        <Alert color="blue" variant="light" withCloseButton onClose={onDismissStaleModel} p="sm">
          <Text size="sm">
            This comparison was created with an earlier version of the cost model. Its totals have been recalculated
            with the current one, so they may differ from what was originally shared.
          </Text>
        </Alert>
      )}

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
                    <Text size="sm" fw={600}>
                      {isTie ? `Both cost the same over ${yearsLabel}` : `${cheaper.name} costs less over ${yearsLabel}, by`}
                    </Text>
                    {!isTie && (
                      <Text ff="monospace" fw={700} size="2.75rem" c="teal" lh={1.1}>
                        {fmtUsd(diff)}
                      </Text>
                    )}
                    {!isTie && (
                      <Text size="sm" c={TEXT_MUTED}>
                        That&apos;s {pctSaved}% less than {pricier.name}. {timingSentence}
                      </Text>
                    )}
                  </Stack>

                  <Stack gap="md">
                    {[{ sol: solA, result: a, slot: "a" as const }, { sol: solB, result: b, slot: "b" as const }].map(({ sol, result, slot }) => {
                      const isCheaper = sol.id === cheaper.id;
                      const isIncumbent = scenario.incumbent === slot;
                      const perCamMo = fmtUsd(result.total / (Math.max(1, scenario.cameras) * Math.max(1, scenario.horizonYears) * 12));
                      const hwText = hardwareSummaryText(result.hardware);
                      return (
                        <div key={sol.id}>
                          {/* Wraps instead of truncating: on a phone the totals drop below the
                              name rather than squeezing it down to a single letter. */}
                          <Group justify="space-between" mb={6} wrap="wrap" gap="xs" style={{ rowGap: 2 }}>
                            <Group gap={6} wrap="wrap" style={{ minWidth: 0, flex: "1 1 200px", rowGap: 2 }}>
                              <Text size="sm" fw={600} c={isCheaper ? undefined : TEXT_MUTED} lineClamp={2} style={{ wordBreak: "break-word" }}>{sol.name}</Text>
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
                          <Box mt={4}>
                            <InfoLabel
                              label={`${fmtUsd(result.cashTotal)} cash · ${fmtUsd(result.staffTimeTotal)} est. staff time`}
                              help={STAFF_TIME_NOTE} size="var(--mantine-font-size-xs)" color={TEXT_MUTED}
                            />
                          </Box>
                          {hwText && <Text size="xs" c={TEXT_MUTED}>{hwText}</Text>}
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
              <GapDrivers comparison={comparison} scenario={scenario} solA={solA} solB={solB} colorA={colorA} colorB={colorB} />
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
          <ShareChecklist scenario={scenario} solA={solA} solB={solB} comparison={comparison} />
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
          </Accordion>
        </Box>
      </Box>

      <MethodologyNotes />
    </Stack>
  );
}
