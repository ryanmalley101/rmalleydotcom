"use client";

import { useState } from "react";
import { Alert, Button, CopyButton, Group, Menu, Modal, Stack, Text, TextInput, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Check, ChevronDown, Copy, Download, FileSpreadsheet, FileText, Image as ImageIcon, RotateCcw, Save, Sheet } from "lucide-react";
import { TEXT_MUTED } from "../lib/colors";

// The results page's title row and actions: save locally, copy the share
// link, export, and go back to the setup. Plus the notice for a link made
// under an older cost model.
export default function ResultsHeader({
  title, subtitle, shareUrl, staleModel, onDismissStaleModel, defaultSaveName, onSave,
  onSnapshot, onCsv, onSpreadsheet, onPrintable, onEditSetup,
}: {
  title: string;
  subtitle: string;
  shareUrl: string;
  staleModel: boolean;
  onDismissStaleModel?: () => void;
  defaultSaveName: string;
  onSave: (name: string) => void;
  onSnapshot: () => Promise<void>;
  onCsv: () => void;
  // The live-formula Excel workbook; left out by a calculator that doesn't have one.
  onSpreadsheet?: () => Promise<void>;
  onPrintable: () => void;
  onEditSetup: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [saveModalOpen, { open: openSaveModal, close: closeSaveModal }] = useDisclosure(false);
  const [saveName, setSaveName] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  async function runExport(task: () => Promise<void>) {
    setExporting(true);
    try {
      await task();
    } finally {
      setExporting(false);
    }
  }

  function handleOpenSaveModal() {
    setSaveName(defaultSaveName);
    openSaveModal();
  }

  function handleConfirmSave() {
    onSave(saveName);
    closeSaveModal();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  return (
    <>
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={3}>{title}</Title>
          <Text size="sm" c={TEXT_MUTED}>{subtitle}</Text>
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
              <Menu.Item leftSection={<ImageIcon size={14} />} onClick={() => runExport(onSnapshot)}>Snapshot image (PNG)</Menu.Item>
              {onSpreadsheet && (
                <Menu.Item leftSection={<Sheet size={14} />} onClick={() => runExport(onSpreadsheet)}>
                  Spreadsheet with formulas and charts (Excel)
                </Menu.Item>
              )}
              <Menu.Item leftSection={<FileSpreadsheet size={14} />} onClick={onCsv}>Data and inputs (CSV)</Menu.Item>
              <Menu.Item leftSection={<FileText size={14} />} onClick={onPrintable}>Printable report (PDF)</Menu.Item>
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
    </>
  );
}
