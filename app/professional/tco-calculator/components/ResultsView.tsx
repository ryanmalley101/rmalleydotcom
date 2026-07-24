"use client";

import { useMemo, useRef, useState } from "react";
import { Accordion, Badge, Box, Button, CopyButton, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { Check, Copy, Download, RotateCcw } from "lucide-react";
import type { ScenarioInputs, SolutionInputs } from "../lib/model";
import { computeComparison } from "../lib/model";
import { TEXT_MUTED, fmtUsd } from "../lib/colors";
import { exportSnapshot } from "../lib/exportSnapshot";
import ScenarioStep from "./ScenarioStep";
import AssumptionsPanel from "./AssumptionsPanel";
import ChartsPanel from "./ChartsPanel";
import IncumbentPicker from "./IncumbentPicker";

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Paper withBorder p="md" radius="md" style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>
      <Text size="xs" c={TEXT_MUTED} mb={4}>{label}</Text>
      <Text ff="monospace" fw={600} size="xl">{value}</Text>
      {sub && <Text size="xs" c={TEXT_MUTED} mt={2}>{sub}</Text>}
    </Paper>
  );
}

function fleetReplacedPct(horizonYears: number, halfLifeYears: number) {
  return Math.min(100, Math.round(100 * (1 - Math.pow(0.5, horizonYears / halfLifeYears))));
}

export default function ResultsView({
  scenario, solA, solB, colorA, colorB, shareUrl, onScenarioChange, onSolAChange, onSolBChange, onEditSetup,
}: {
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

  const cheaper = a.total <= b.total ? solA : solB;
  const pricier = a.total <= b.total ? solB : solA;
  const diff = Math.abs(a.total - b.total);

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

      <Box ref={snapshotRef} style={{ background: "#0f1117" }}>
        <Stack gap="xl">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            <StatTile label={`${solA.name} (NPV)`} value={fmtUsd(a.total)} accent={colorA}
              sub={fmtUsd(a.total / (scenario.cameras * scenario.horizonYears * 12)) + " / cam / mo"} />
            <StatTile label={`${solB.name} (NPV)`} value={fmtUsd(b.total)} accent={colorB}
              sub={fmtUsd(b.total / (scenario.cameras * scenario.horizonYears * 12)) + " / cam / mo"} />
            <StatTile label="Difference" value={fmtUsd(diff)} sub={`${cheaper.name} lower over ${scenario.horizonYears} yrs`} />
            <StatTile label="Crossover"
              value={crossoverYear === null ? "N/A" : "Yr " + crossoverYear}
              sub={
                crossoverYear === null
                  ? "No crossover within horizon"
                  : laterCrossoverYears.length > 0
                    ? `${pricier.name} overtakes ${cheaper.name}, crosses again at Yr ${laterCrossoverYears.join(", ")}`
                    : `${pricier.name} overtakes ${cheaper.name}`
              } />
            <StatTile label={`Fleet replaced (${solA.name})`} value={fleetPctA + "%"} accent={colorA}
              sub={`at ${solA.fleetHalfLifeYears.toFixed(1)}-yr half-life`} />
            <StatTile label={`Fleet replaced (${solB.name})`} value={fleetPctB + "%"} accent={colorB}
              sub={`at ${solB.fleetHalfLifeYears.toFixed(1)}-yr half-life`} />
          </SimpleGrid>

          <ChartsPanel comparison={comparison} nameA={solA.name} nameB={solB.name} colorA={colorA} colorB={colorB} />
        </Stack>
      </Box>

      <Accordion variant="separated" multiple defaultValue={["scenario", "solA", "solB"]}>
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
        versus RAID 0 or no RAID, to survive a drive failure. On-prem perpetual licenses are sunk; only support
        renewals are counted. Appliance/server counts assume at least one unit per site.
        Annual cost escalation compounds every recurring cost; NPV discounting is separate and applied on top.
        Investigation labor is a soft cost, kept as its own category so it can be zeroed out independently.
        Defaults are directional placeholders, not quotes. This tool is not affiliated with or endorsed by any
        vendor named here.
      </Text>
    </Stack>
  );
}
