"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
    Box, Button, Card, CardContent, Chip, CircularProgress, Container,
    Dialog, DialogActions, DialogContent, DialogTitle,
    IconButton, TextField, Tooltip, Typography,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { useCampaignRole } from "@/lib/useCampaignRole";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

const client = generateClient<Schema>();
type CampaignResource = Schema["CampaignResource"]["type"];

const PRESET_COLORS = [
    { label: "Amber",  value: "#d97706" },
    { label: "Green",  value: "#15803d" },
    { label: "Blue",   value: "#1d4ed8" },
    { label: "Purple", value: "#7c3aed" },
    { label: "Red",    value: "#b91c1c" },
    { label: "Teal",   value: "#0e7490" },
    { label: "Brown",  value: "#92400e" },
    { label: "Grey",   value: "#6b7280" },
];

interface ResourceForm {
    name: string;
    description: string;
    value: string;
    maxValue: string;
    unit: string;
    color: string;
}
const EMPTY_FORM: ResourceForm = {
    name: "", description: "", value: "0", maxValue: "", unit: "", color: "#d97706",
};

function ResourceCard({
    resource, isGM, onEdit, onDelete, onAdjust,
}: {
    resource: CampaignResource;
    isGM: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onAdjust: (delta: number) => void;
}) {
    const [editingValue, setEditingValue] = useState(false);
    const [localValue, setLocalValue] = useState(String(resource.value));
    const color = resource.color ?? "#92400e";
    const hasMax = resource.maxValue != null && resource.maxValue > 0;
    const pct = hasMax ? Math.min(100, Math.max(0, (resource.value / resource.maxValue!) * 100)) : 0;

    function commitValue() {
        const n = parseFloat(localValue);
        if (!isNaN(n) && n !== resource.value) onAdjust(n - resource.value);
        setEditingValue(false);
    }

    return (
        <Card sx={{ borderLeft: "4px solid", borderColor: color }}>
            <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                    <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                            <Typography sx={{ fontWeight: 700, color: "primary.dark", fontSize: "1rem" }}>
                                {resource.name}
                            </Typography>
                            {resource.unit && (
                                <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.72rem" }}>
                                    {resource.unit}
                                </Typography>
                            )}
                        </Box>
                        {resource.description && (
                            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25, fontSize: "0.82rem" }}>
                                {resource.description}
                            </Typography>
                        )}
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                        {isGM && (
                            <>
                                <Tooltip title="Decrease">
                                    <IconButton size="small" onClick={() => onAdjust(-1)} sx={{ color: "text.secondary" }}>
                                        <Minus size={14} />
                                    </IconButton>
                                </Tooltip>
                            </>
                        )}

                        {/* Value display / inline editor */}
                        {editingValue && isGM ? (
                            <TextField
                                size="small" type="number" autoFocus
                                value={localValue}
                                onChange={e => setLocalValue(e.target.value)}
                                onBlur={commitValue}
                                onKeyDown={e => { if (e.key === "Enter") commitValue(); if (e.key === "Escape") { setEditingValue(false); setLocalValue(String(resource.value)); } }}
                                sx={{ width: 80 }}
                                inputProps={{ style: { textAlign: "center" } }}
                            />
                        ) : (
                            <Chip
                                label={hasMax ? `${resource.value} / ${resource.maxValue}` : String(resource.value)}
                                onClick={isGM ? () => { setLocalValue(String(resource.value)); setEditingValue(true); } : undefined}
                                sx={{
                                    fontWeight: 700, fontSize: "0.88rem",
                                    backgroundColor: color + "22", color,
                                    cursor: isGM ? "pointer" : "default",
                                    "&:hover": isGM ? { backgroundColor: color + "33" } : undefined,
                                }}
                            />
                        )}

                        {isGM && (
                            <Tooltip title="Increase">
                                <IconButton size="small" onClick={() => onAdjust(1)} sx={{ color: "text.secondary" }}>
                                    <Plus size={14} />
                                </IconButton>
                            </Tooltip>
                        )}

                        {isGM && (
                            <>
                                <Tooltip title="Edit">
                                    <IconButton size="small" onClick={onEdit} sx={{ color: "text.secondary" }}>
                                        <Pencil size={13} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                    <IconButton size="small" color="error" onClick={onDelete}>
                                        <Trash2 size={13} />
                                    </IconButton>
                                </Tooltip>
                            </>
                        )}
                    </Box>
                </Box>

                {hasMax && (
                    <Box sx={{ mt: 1.25, height: 6, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.08)", position: "relative", overflow: "hidden" }}>
                        <Box sx={{
                            position: "absolute", left: 0, top: 0, height: "100%",
                            width: `${pct}%`,
                            backgroundColor: color,
                            borderRadius: 3,
                            transition: "width 0.3s",
                        }} />
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}

function ResourceDialog({
    open, editing, campaignId, nextOrder, onClose, onSaved,
}: {
    open: boolean;
    editing: CampaignResource | null;
    campaignId: string;
    nextOrder: number;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [form, setForm] = useState<ResourceForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const f = (field: keyof ResourceForm) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setForm(v => ({ ...v, [field]: e.target.value }));

    useEffect(() => {
        if (open) {
            setForm(editing ? {
                name: editing.name,
                description: editing.description ?? "",
                value: String(editing.value),
                maxValue: editing.maxValue != null ? String(editing.maxValue) : "",
                unit: editing.unit ?? "",
                color: editing.color ?? "#d97706",
            } : EMPTY_FORM);
        }
    }, [open, editing]);

    async function save() {
        if (!form.name.trim()) return;
        setSaving(true);
        const payload = {
            campaignId,
            name: form.name.trim(),
            description: form.description || undefined,
            value: parseFloat(form.value) || 0,
            maxValue: form.maxValue ? parseFloat(form.maxValue) : undefined,
            unit: form.unit || undefined,
            color: form.color,
            sortOrder: editing?.sortOrder ?? nextOrder,
        };
        try {
            if (editing) {
                await client.models.CampaignResource.update({ id: editing.id, ...payload });
            } else {
                await client.models.CampaignResource.create(payload);
            }
            onSaved();
            onClose();
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{editing ? "Edit Resource" : "New Resource"}</DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
                <TextField label="Name" required autoFocus fullWidth value={form.name} onChange={f("name")}
                    placeholder="e.g. Party Food Supply, Reputation with Ironhold" />
                <TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={f("description")}
                    placeholder="Optional note about what this tracks" />
                <Box sx={{ display: "flex", gap: 2 }}>
                    <TextField label="Current Value" type="number" fullWidth value={form.value} onChange={f("value")} />
                    <TextField label="Max Value" type="number" fullWidth value={form.maxValue} onChange={f("maxValue")}
                        placeholder="Optional (shows progress bar)" />
                    <TextField label="Unit" fullWidth value={form.unit} onChange={f("unit")}
                        placeholder="days, gold, pts…" sx={{ maxWidth: 120 }} />
                </Box>
                <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", mb: 1, display: "block" }}>
                        Accent colour
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {PRESET_COLORS.map(({ label, value }) => (
                            <Box key={value} onClick={() => setForm(v => ({ ...v, color: value }))}
                                title={label}
                                sx={{
                                    width: 28, height: 28, borderRadius: "50%",
                                    backgroundColor: value, cursor: "pointer",
                                    border: "3px solid",
                                    borderColor: form.color === value ? "text.primary" : "transparent",
                                    transition: "border-color 0.15s",
                                    "&:hover": { opacity: 0.85 },
                                }} />
                        ))}
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={save} disabled={saving || !form.name.trim()}
                    sx={{ backgroundColor: "primary.main" }}>
                    {saving ? <CircularProgress size={18} /> : editing ? "Save" : "Create"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default function ResourcesPage() {
    const { campaignId } = useParams<{ campaignId: string }>();
    const { isGm: isGM, loading: roleLoading } = useCampaignRole(campaignId);
    useDocumentTitle("Campaign Resources");

    const [resources, setResources] = useState<CampaignResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<CampaignResource | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CampaignResource | null>(null);

    const load = useCallback(async () => {
        if (!client.models.CampaignResource) { setLoading(false); return; }
        setLoading(true);
        const { data } = await client.models.CampaignResource.list();
        setResources(
            (data ?? [])
                .filter(r => r.campaignId === campaignId)
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        );
        setLoading(false);
    }, [campaignId]);

    useEffect(() => { load(); }, [load]);

    async function adjust(resource: CampaignResource, delta: number) {
        const next = resource.value + delta;
        const clamped = resource.maxValue != null ? Math.min(next, resource.maxValue) : next;
        await client.models.CampaignResource.update({ id: resource.id, value: clamped });
        setResources(prev => prev.map(r => r.id === resource.id ? { ...r, value: clamped } : r));
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        await client.models.CampaignResource.delete({ id: deleteTarget.id });
        setDeleteTarget(null);
        load();
    }

    const pageLoading = loading || roleLoading;
    const nextOrder = resources.length > 0 ? Math.max(...resources.map(r => r.sortOrder ?? 0)) + 1 : 0;

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="sm">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        Resources
                    </Typography>
                    {isGM && (
                        <Button variant="contained" startIcon={<Plus size={16} />}
                            onClick={() => { setEditing(null); setDialogOpen(true); }}
                            sx={{ backgroundColor: "primary.main" }}>
                            New Resource
                        </Button>
                    )}
                </Box>
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 4 }}>
                    Track anything your campaign needs — supplies, reputation, morale, magic reserves.
                </Typography>

                {pageLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : !client.models.CampaignResource ? (
                    <Typography sx={{ color: "text.secondary", textAlign: "center", py: 8 }}>
                        Resources feature needs a backend deploy — run <code>npx ampx sandbox</code>.
                    </Typography>
                ) : resources.length === 0 ? (
                    <Box sx={{ textAlign: "center", py: 8 }}>
                        <Typography sx={{ color: "text.secondary", mb: 2 }}>
                            No resources yet.{isGM ? " Add one to start tracking." : ""}
                        </Typography>
                        {isGM && (
                            <Button variant="outlined" startIcon={<Plus size={16} />}
                                onClick={() => { setEditing(null); setDialogOpen(true); }}
                                sx={{ borderColor: "primary.main", color: "primary.main" }}>
                                Add First Resource
                            </Button>
                        )}
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                        {resources.map(r => (
                            <ResourceCard key={r.id} resource={r} isGM={isGM}
                                onEdit={() => { setEditing(r); setDialogOpen(true); }}
                                onDelete={() => setDeleteTarget(r)}
                                onAdjust={delta => adjust(r, delta)}
                            />
                        ))}
                    </Box>
                )}

                <ResourceDialog
                    open={dialogOpen}
                    editing={editing}
                    campaignId={campaignId}
                    nextOrder={nextOrder}
                    onClose={() => setDialogOpen(false)}
                    onSaved={load}
                />

                <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
                    <DialogTitle>Delete "{deleteTarget?.name}"?</DialogTitle>
                    <DialogContent>
                        <Typography>This cannot be undone.</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={confirmDelete}>Delete</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
