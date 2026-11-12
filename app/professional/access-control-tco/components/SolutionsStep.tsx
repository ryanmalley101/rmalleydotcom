"use client";

import { Badge, Card, Group, Select, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { Building } from "lucide-react";
import type { ScenarioInputs, SolutionInputs } from "../lib/model";
import { CLOUD_PROVIDERS, ONPREM_PROVIDERS } from "../lib/providers";
import { confidenceSummary, switchVendor } from "../lib/vendorDefaults";
import { PLACEHOLDER_NAMES } from "../lib/seeds";
import { TEXT_MUTED } from "../../_tco-shared/lib/colors";
import { ConfidenceBadge, IconLabel, OTHER_PROVIDER, providerSelectData } from "../../_tco-shared/components/FormParts";
import SolutionForm from "./SolutionForm";

// The provider picker. Picking a researched vendor applies its defaults, and
// switching away resets them.
function ProviderPicker({ sol, onChange }: { sol: SolutionInputs; onChange: (v: SolutionInputs) => void }) {
  const providers = sol.model === "cloud" ? CLOUD_PROVIDERS : ONPREM_PROVIDERS;
  const isPlaceholder = PLACEHOLDER_NAMES.includes(sol.name);
  const known = providers.includes(sol.name);
  const selectValue = isPlaceholder ? null : known ? sol.name : OTHER_PROVIDER;
  return (
    <>
      <Select
        label={<IconLabel icon={Building} label="Provider" />}
        placeholder="Choose a provider…"
        data={providerSelectData(providers)}
        value={selectValue}
        onChange={(v) => {
          if (!v) return;
          const next = v === OTHER_PROVIDER ? "" : v;
          onChange({ ...switchVendor(sol, sol.name, next), name: next });
        }}
      />
      {selectValue && selectValue !== OTHER_PROVIDER && <ConfidenceBadge summary={confidenceSummary(sol)} />}
      {selectValue === OTHER_PROVIDER && (
        <TextInput placeholder="Type a provider name" value={sol.name} onChange={(e) => onChange({ ...sol, name: e.currentTarget.value })} />
      )}
    </>
  );
}

function SolutionCard({ sol, onChange, color, scenario }: {
  sol: SolutionInputs; onChange: (v: SolutionInputs) => void; color: string; scenario: ScenarioInputs;
}) {
  return (
    <Card withBorder padding="lg" radius="md" style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Text fw={700} fz="1.05rem">{sol.name || "Unnamed solution"}</Text>
          <Badge variant="light" color={sol.model === "cloud" ? "blue" : "grape"}>
            {sol.model === "cloud" ? "Cloud" : "Server-based"}
          </Badge>
        </Group>
        <ProviderPicker sol={sol} onChange={onChange} />
        <SolutionForm sol={sol} onChange={onChange} scenario={scenario} />
      </Stack>
    </Card>
  );
}

export default function SolutionsStep({ solA, solB, onChangeA, onChangeB, colorA, colorB, scenario }: {
  solA: SolutionInputs; solB: SolutionInputs;
  onChangeA: (v: SolutionInputs) => void; onChangeB: (v: SolutionInputs) => void;
  colorA: string; colorB: string;
  scenario: ScenarioInputs;
}) {
  return (
    <Stack gap="md">
      <div>
        <Title order={4} mb={4}>Name & configure each solution</Title>
        <Text size="sm" c={TEXT_MUTED}>
          Pick a provider for each side and adjust what matters most. Researched vendors fill in their published prices
          and hardware compatibility (the dots show which); every other default is a generic placeholder, so replace the
          ones you have quotes for. Everything stays editable on the results page.
        </Text>
      </div>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <SolutionCard sol={solA} onChange={onChangeA} color={colorA} scenario={scenario} />
        <SolutionCard sol={solB} onChange={onChangeB} color={colorB} scenario={scenario} />
      </SimpleGrid>
    </Stack>
  );
}
