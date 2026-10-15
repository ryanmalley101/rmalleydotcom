"use client";

import { Accordion, ScrollArea, Table, Text } from "@mantine/core";
import type { ComparisonResult } from "../lib/model";
import { upfrontAndOngoing } from "../lib/report";
import { TEXT_MUTED, fmtUsd } from "../lib/colors";

const yearTotal = (byYear: Record<string, number>) => Object.values(byYear).reduce((a, b) => a + b, 0);

// Year-by-year costs for both solutions, plus the buildout-vs-ongoing split,
// as a plain table: the numbers behind the cumulative chart, readable
// without hovering and by screen readers.
export default function YearTable({ comparison, nameA, nameB }: { comparison: ComparisonResult; nameA: string; nameB: string }) {
  const { a, b, labels } = comparison;
  const sa = upfrontAndOngoing(a), sb = upfrontAndOngoing(b);
  return (
    <Accordion variant="separated">
      <Accordion.Item value="years">
        <Accordion.Control><Text size="sm" fw={500}>Year-by-year costs</Text></Accordion.Control>
        <Accordion.Panel>
          <ScrollArea>
            <Table striped withTableBorder fz="xs" miw={420}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Year</Table.Th>
                  <Table.Th ta="right">{nameA}</Table.Th>
                  <Table.Th ta="right">Cumulative</Table.Th>
                  <Table.Th ta="right">{nameB}</Table.Th>
                  <Table.Th ta="right">Cumulative</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {labels.map((label, y) => (
                  <Table.Tr key={label}>
                    <Table.Td>{label}</Table.Td>
                    <Table.Td ta="right" ff="monospace">{fmtUsd(yearTotal(a.byYear[y]))}</Table.Td>
                    <Table.Td ta="right" ff="monospace" c={TEXT_MUTED}>{fmtUsd(a.cumulative[y])}</Table.Td>
                    <Table.Td ta="right" ff="monospace">{fmtUsd(yearTotal(b.byYear[y]))}</Table.Td>
                    <Table.Td ta="right" ff="monospace" c={TEXT_MUTED}>{fmtUsd(b.cumulative[y])}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Th>Year 0 (buildout)</Table.Th>
                  <Table.Td ta="right" ff="monospace" colSpan={2}>{fmtUsd(sa.upfront)}</Table.Td>
                  <Table.Td ta="right" ff="monospace" colSpan={2}>{fmtUsd(sb.upfront)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Th>Years 1+ (ongoing)</Table.Th>
                  <Table.Td ta="right" ff="monospace" colSpan={2}>{fmtUsd(sa.ongoing)}</Table.Td>
                  <Table.Td ta="right" ff="monospace" colSpan={2}>{fmtUsd(sb.ongoing)}</Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          </ScrollArea>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
