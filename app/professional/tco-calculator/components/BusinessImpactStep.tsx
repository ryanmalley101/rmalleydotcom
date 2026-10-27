"use client";

import { Alert, Badge, Box, Checkbox, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  ArrowRightLeft, BellRing, Cctv, Clock, DollarSign, Footprints, Gavel, Hammer, HardHat, IdCard, Info, PackageX,
  ScanFace, Shield, ShieldUser, ShoppingCart, Siren, Store, UserX, Users,
} from "lucide-react";
import type { ScenarioInputs, SolutionInputs } from "../lib/model";
import { TEXT_MUTED, fmtUsd } from "../lib/colors";
import {
  NEW_COST_UNIT_LABEL, VERTICALS, annualBaselinePerSite, annualOutcomes, baselineValue, changeValue, inputsInUse,
  isCategoryEnabled, verticalFor,
  type OutcomeCategory, type OutcomeGroup, type OutcomeIcon, type OutcomeInput, type Vertical, type VerticalDef,
} from "../lib/verticals";
import InfoLabel from "./InfoLabel";

const ICONS: Record<OutcomeIcon, React.ElementType> = {
  store: Store, sales: ShoppingCart, shrink: PackageX, outsideTheft: UserX, employeeTheft: IdCard,
  slip: Footprints, gavel: Gavel, hardHat: HardHat, hammer: Hammer, siren: Siren, people: Users, guard: ShieldUser,
  clock: Clock, dollar: DollarSign, face: ScanFace, bell: BellRing, cctv: Cctv, shield: Shield, swap: ArrowRightLeft,
};

const INDUSTRY_HELP =
  "Picks the industry-specific costs a video system can raise or lower, such as theft and injury claims in retail. Leave it empty to keep business impact out of the comparison.";

const VERTICAL_OPTIONS = VERTICALS.map((v) => ({
  value: v.id,
  label: v.modeled ? v.label : `${v.label} (coming soon)`,
  disabled: !v.modeled,
}));

const BORDER = "1px solid var(--mantine-color-dark-4)";

const perYear = (n: number) => `${fmtUsd(n)}/yr`;

// A field label with its context icon in front.
function IconLabel({ icon, label, help, size, fw }: { icon: OutcomeIcon; label: string; help: string; size?: string; fw?: number }) {
  const Icon = ICONS[icon];
  return (
    <Group gap={6} wrap="nowrap">
      <Icon size={14} style={{ flexShrink: 0, opacity: 0.85 }} />
      <InfoLabel label={label} help={help} size={size} fw={fw} />
    </Group>
  );
}

const SubLabel = ({ children }: { children: React.ReactNode }) => (
  <Text size="xs" fw={700} tt="uppercase" c={TEXT_MUTED} style={{ letterSpacing: 0.5 }}>
    {children}
  </Text>
);

function BaselineField({ input, scenario, onScenarioChange }: {
  input: OutcomeInput; scenario: ScenarioInputs; onScenarioChange: (v: ScenarioInputs) => void;
}) {
  return (
    <NumberInput
      label={<IconLabel icon={input.icon} label={input.label} help={input.help} />}
      value={baselineValue(scenario, input)}
      min={0}
      max={input.unit === "pct" ? 100 : undefined}
      step={input.unit === "pct" ? 0.1 : 1}
      decimalScale={2}
      prefix={input.unit === "usd" ? "$" : undefined}
      suffix={input.unit === "pct" ? "%" : undefined}
      thousandSeparator=","
      onChange={(v) =>
        onScenarioChange({
          ...scenario,
          outcomeBaseline: { ...scenario.outcomeBaseline, [input.key]: typeof v === "number" ? v : 0 },
        })
      }
    />
  );
}

interface Side {
  sol: SolutionInputs;
  color: string;
  onChange: (v: SolutionInputs) => void;
  isIncumbent: boolean;
  outcomes: { category: OutcomeCategory; amount: number }[];
  total: number;
}

const SideBadge = ({ side, size = "sm" }: { side: Side; size?: "sm" | "md" }) => (
  <Badge variant="dot" color={side.color} size={size} style={{ maxWidth: "100%" }}>{side.sol.name}</Badge>
);

function ChangeField({ category, side }: { category: OutcomeCategory; side: Side }) {
  // Explained once at the top of the step; a dash keeps the column aligned.
  if (side.isIncumbent) return <Text size="sm" c={TEXT_MUTED} visibleFrom="sm">—</Text>;
  const { sol, onChange } = side;
  const existing = category.kind === "existing";
  const amount = side.outcomes.find((o) => o.category.id === category.id)?.amount ?? 0;
  return (
    <div>
      {/* Small screens stack both inputs under the category, so each needs
          its own solution label; wider screens have a header row instead. */}
      <Box hiddenFrom="sm" mb={4}><SideBadge side={side} /></Box>
      <NumberInput
        aria-label={`${category.label}, ${sol.name}`}
        value={changeValue(sol, category)}
        min={existing ? -100 : 0}
        max={existing ? 100 : undefined}
        decimalScale={2}
        prefix={existing || category.unit === "hoursPerSiteWeek" ? undefined : "$"}
        suffix={existing ? "%" : ` ${NEW_COST_UNIT_LABEL[category.unit].replace(/^\$/, "")}`}
        thousandSeparator=","
        onChange={(v) => onChange({ ...sol, outcomeChanges: { ...sol.outcomeChanges, [category.id]: typeof v === "number" ? v : 0 } })}
      />
      <Text size="xs" c={amount < 0 ? "teal" : amount > 0 ? "orange" : TEXT_MUTED} mt={2}>
        {amount === 0 ? "No change" : amount < 0 ? `Saves ${perYear(-amount)}` : `Adds ${perYear(amount)}`}
      </Text>
    </div>
  );
}

// One themed group: a checkbox per category, then, for the ones switched
// on, the shared facts they need and each solution's change.
function GroupCard({ group, vertical, scenario, sides, onScenarioChange }: {
  group: OutcomeGroup; vertical: VerticalDef; scenario: ScenarioInputs; sides: Side[];
  onScenarioChange: (v: ScenarioInputs) => void;
}) {
  const GroupIcon = ICONS[group.icon];
  const categories = group.categoryIds
    .map((id) => vertical.categories.find((c) => c.id === id))
    .filter((c): c is OutcomeCategory => Boolean(c));
  const enabled = categories.filter((c) => isCategoryEnabled(scenario, c.id));
  const inputs = inputsInUse(scenario, vertical, group.categoryIds);
  const sites = Math.max(1, scenario.sites);

  const toggle = (id: string, on: boolean) => {
    const current = scenario.outcomeEnabled ?? [];
    onScenarioChange({ ...scenario, outcomeEnabled: on ? [...current, id] : current.filter((c) => c !== id) });
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <GroupIcon size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <Text fw={600} size="sm">{group.label}</Text>
            <Text size="xs" c={TEXT_MUTED}>{group.description}</Text>
          </div>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: categories.length > 2 ? 3 : 2 }} spacing="xs" verticalSpacing="xs">
          {categories.map((c) => {
            const Icon = ICONS[c.icon];
            return (
              <Group key={c.id} gap={6} wrap="nowrap">
                <Checkbox
                  checked={isCategoryEnabled(scenario, c.id)}
                  onChange={(e) => toggle(c.id, e.currentTarget.checked)}
                  label={
                    <Group gap={6} wrap="nowrap" component="span">
                      <Icon size={14} style={{ flexShrink: 0, opacity: 0.85 }} />
                      <span>{c.label}</span>
                    </Group>
                  }
                />
                {/* Outside the checkbox's label, so opening the help doesn't toggle it. */}
                <InfoLabel label={c.label} help={c.help} hideLabel />
              </Group>
            );
          })}
        </SimpleGrid>

        {inputs.length > 0 && (
          <Stack gap="xs" pt="sm" style={{ borderTop: BORDER }}>
            <SubLabel>Your business today, per site</SubLabel>
            <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing="md">
              {inputs.map((input) => (
                <BaselineField key={input.key} input={input} scenario={scenario} onScenarioChange={onScenarioChange} />
              ))}
            </SimpleGrid>
          </Stack>
        )}

        {enabled.length > 0 && (
          <Stack gap={0} pt="sm" style={{ borderTop: BORDER }}>
            <SimpleGrid cols={3} spacing="sm" visibleFrom="sm" mb="xs">
              <SubLabel>Change with each solution</SubLabel>
              {sides.map((side) => <SideBadge key={side.sol.id} side={side} size="md" />)}
            </SimpleGrid>
            <Box hiddenFrom="sm" mb="xs"><SubLabel>Change with each solution</SubLabel></Box>
            {enabled.map((category, i) => {
              const baseline = category.kind === "existing" ? annualBaselinePerSite(scenario, vertical, category) * sites : null;
              return (
                <SimpleGrid key={category.id} cols={{ base: 1, sm: 3 }} spacing="sm" verticalSpacing="xs" py="xs"
                  style={{ borderTop: i === 0 ? undefined : BORDER }}>
                  <div>
                    <IconLabel icon={category.icon} label={category.label} help={category.help} size="var(--mantine-font-size-sm)" fw={500} />
                    <Text size="xs" c={TEXT_MUTED}>
                      {baseline !== null ? `Today: ${perYear(baseline)} across ${sites.toLocaleString()} site${sites === 1 ? "" : "s"}` : "New cost"}
                    </Text>
                  </div>
                  {sides.map((side) => <ChangeField key={side.sol.id} category={category} side={side} />)}
                </SimpleGrid>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

// The wizard's business impact step, and the matching panel on the results
// page: pick an industry, switch on the costs that apply, enter facts about
// the business once, then each solution's change. See lib/verticals.ts.
export default function BusinessImpactStep({
  scenario, solA, solB, colorA, colorB, onScenarioChange, onSolAChange, onSolBChange, showIntro = true,
}: {
  scenario: ScenarioInputs;
  solA: SolutionInputs;
  solB: SolutionInputs;
  colorA: string;
  colorB: string;
  onScenarioChange: (v: ScenarioInputs) => void;
  onSolAChange: (v: SolutionInputs) => void;
  onSolBChange: (v: SolutionInputs) => void;
  showIntro?: boolean;
}) {
  const vertical = verticalFor(scenario);
  const sides: Side[] = [
    { sol: solA, color: colorA, onChange: onSolAChange, isIncumbent: scenario.incumbent === "a" },
    { sol: solB, color: colorB, onChange: onSolBChange, isIncumbent: scenario.incumbent === "b" },
  ].map((s) => {
    const outcomes = s.isIncumbent ? [] : annualOutcomes(scenario, s.sol);
    return { ...s, outcomes, total: outcomes.reduce((sum, o) => sum + o.amount, 0) };
  });
  const incumbent = sides.find((s) => s.isIncumbent);
  const challenger = sides.find((s) => !s.isIncumbent);
  const anyEnabled = vertical?.categories.some((c) => isCategoryEnabled(scenario, c.id)) ?? false;

  return (
    <Stack gap="lg">
      {showIntro && (
        <div>
          <Title order={4} mb={4}>Business impact (optional)</Title>
          <Text size="sm" c={TEXT_MUTED}>
            Costs your business already carries that a video system can raise or lower, and new costs it can bring.
            Every change starts at 0: enter only what you can support with your own data, not a vendor&apos;s claim.
            Results show these estimates separately from cash costs.
          </Text>
        </div>
      )}

      <Select
        label={<IconLabel icon="store" label="Industry" help={INDUSTRY_HELP} />}
        placeholder="None, leave business impact out"
        data={VERTICAL_OPTIONS}
        value={vertical?.id ?? null}
        onChange={(v) => onScenarioChange({ ...scenario, vertical: (v as Vertical | null) ?? null })}
        clearable
        allowDeselect
        maw={360}
      />

      {vertical && (
        <>
          <Text size="xs" c={TEXT_MUTED}>
            Check the costs that apply to this business; only those show fields and count toward the totals. Facts about
            the business are shared by both solutions, and their defaults are placeholders. Each change is a year-one
            figure (a % of today&apos;s cost, negative for a saving, or a new cost&apos;s amount) and grows with labor
            escalation after that.
            {incumbent && challenger && (
              <> {incumbent.sol.name} is already installed, so today&apos;s figures include its effect, and only {challenger.sol.name} gets a change.</>
            )}
          </Text>

          {vertical.groups.map((group) => (
            <GroupCard key={group.id} group={group} vertical={vertical} scenario={scenario} sides={sides} onScenarioChange={onScenarioChange} />
          ))}

          {anyEnabled && (
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" px="md">
              <Text size="sm" fw={600}>Net change per year</Text>
              {sides.map((side) => (
                <Group key={side.sol.id} gap={6} visibleFrom={side.isIncumbent ? "sm" : undefined}>
                  <Box hiddenFrom="sm"><SideBadge side={side} /></Box>
                  <Text size="sm" ff="monospace" fw={600} c={side.total < 0 ? "teal" : side.total > 0 ? "orange" : TEXT_MUTED}>
                    {side.isIncumbent ? "Today" : perYear(side.total)}
                  </Text>
                </Group>
              ))}
            </SimpleGrid>
          )}

          {scenario.incumbent === "none" && anyEnabled && (
            <Alert color="blue" variant="light" icon={<Info size={16} />} p="sm">
              <Text size="xs">
                Neither solution is installed yet, so each change is measured against having no system at all. Both
                solutions would likely deter theft and help with claims; give them different numbers only where their
                features actually differ.
              </Text>
            </Alert>
          )}
        </>
      )}
    </Stack>
  );
}
