"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
    Box, Container, Typography, Button, TextField, Chip, Slider,
    CircularProgress, Card, CardContent, CardActionArea,
    IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
    DialogActions, Collapse,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Plus, Shield, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type Faction = Schema["Faction"]["type"];

const REP_LABELS: Record<number, { label: string; color: string }> = {
    [-5]: { label: "Hostile",    color: "#b91c1c" },
    [-4]: { label: "Hostile",    color: "#b91c1c" },
    [-3]: { label: "Unfriendly", color: "#c2410c" },
    [-2]: { label: "Unfriendly", color: "#c2410c" },
    [-1]: { label: "Indifferent",color: "#78716c" },
    [0]:  { label: "Neutral",    color: "#78716c" },
    [1]:  { label: "Friendly",   color: "#15803d" },
    [2]:  { label: "Friendly",   color: "#15803d" },
    [3]:  { label: "Allied",     color: "#1d4ed8" },
    [4]:  { label: "Allied",     color: "#1d4ed8" },
    [5]:  { label: "Revered",    color: "#7c3aed" },
};

function repInfo(n: number) { return REP_LABELS[Math.max(-5, Math.min(5, n))] ?? REP_LABELS[0]; }

function ReputationBar({ value }: { value: number }) {
    const { label, color } = repInfo(value);
    const pct = ((value + 5) / 10) * 100;
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: "#e5e7eb", position: "relative" }}>
                <Box sx={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: 3,
                    width: `${pct}%`, backgroundColor: color, transition: "width 0.3s" }} />
                <Box sx={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
                    width: 2, height: "100%", backgroundColor: "#9ca3af" }} />
            </Box>
            <Chip label={`${value >= 0 ? "+" : ""}${value} ${label}`} size="small"
                sx={{ backgroundColor: color + "22", color, fontWeight: 700, fontSize: "0.7rem", height: 22 }} />
        </Box>
    );
}

interface FactionForm { name: string; description: string; reputation: number; notes: string; }
const EMPTY_FORM: FactionForm = { name: "", description: "", reputation: 0, notes: "" };

function FactionFormPanel({ value, onChange }: { value: FactionForm; onChange: (v: FactionForm) => void }) {
    const f = (field: keyof FactionForm) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            onChange({ ...value, [field]: e.target.value });
    const { label, color } = repInfo(value.reputation);
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField label="Name *" required value={value.name} onChange={f("name")} fullWidth />
            <TextField label="Description" multiline minRows={2} value={value.description} onChange={f("description")} fullWidth />
            <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Reputation: <span style={{ color }}>+{value.reputation >= 0 ? "" : ""}{value.reputation} — {label}</span>
                </Typography>
                <Slider
                    value={value.reputation}
                    min={-5} max={5} step={1}
                    marks={[-5,-4,-3,-2,-1,0,1,2,3,4,5].map(v => ({ value: v, label: v === -5 ? "−5" : v === 5 ? "+5" : v === 0 ? "0" : undefined }))}
                    onChange={(_, v) => onChange({ ...value, reputation: v as number })}
                    sx={{ "& .MuiSlider-thumb": { backgroundColor: color }, "& .MuiSlider-track": { backgroundColor: color } }}
                />
            </Box>
            <TextField label="Notes" multiline minRows={2} value={value.notes} onChange={f("notes")} fullWidth />
        </Box>
    );
}

export default function FactionsPage() {
    const { campaignId } = useParams<{ campaignId: string }>();

    const [factions, setFactions]     = useState<Faction[]>([]);
    const [loading, setLoading]       = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [editFaction, setEditFaction] = useState<Faction | null>(null);
    const [deleteFaction, setDeleteFaction] = useState<Faction | null>(null);
    const [form, setForm]             = useState<FactionForm>({ ...EMPTY_FORM });
    const [saving, setSaving]         = useState(false);
    const [expanded, setExpanded]     = useState<Record<string, boolean>>({});

    async function load() {
        const { data } = await client.models.Faction.list();
        setFactions((data ?? []).filter(f => f.campaignId === campaignId));
        setLoading(false);
    }

    useEffect(() => { load(); }, [campaignId]);

    async function handleCreate() {
        if (!form.name.trim()) return;
        setSaving(true);
        await client.models.Faction.create({
            campaignId,
            name: form.name.trim(),
            description: form.description || undefined,
            reputation: form.reputation,
            notes: form.notes || undefined,
        });
        setSaving(false);
        setCreateOpen(false);
        setForm({ ...EMPTY_FORM });
        load();
    }

    async function handleEdit() {
        if (!editFaction || !form.name.trim()) return;
        setSaving(true);
        await client.models.Faction.update({
            id: editFaction.id,
            name: form.name.trim(),
            description: form.description || undefined,
            reputation: form.reputation,
            notes: form.notes || undefined,
        });
        setSaving(false);
        setEditFaction(null);
        load();
    }

    async function handleDelete() {
        if (!deleteFaction) return;
        await client.models.Faction.delete({ id: deleteFaction.id });
        setDeleteFaction(null);
        load();
    }

    async function adjustRep(faction: Faction, delta: number) {
        const next = Math.max(-5, Math.min(5, (faction.reputation ?? 0) + delta));
        await client.models.Faction.update({ id: faction.id, reputation: next });
        load();
    }

    function openEdit(f: Faction) {
        setEditFaction(f);
        setForm({ name: f.name, description: f.description ?? "", reputation: f.reputation ?? 0, notes: f.notes ?? "" });
    }

    const sorted = [...factions].sort((a, b) => (b.reputation ?? 0) - (a.reputation ?? 0));

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 3, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Shield size={26} color="#8C5A3A" />
                        <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>Factions</Typography>
                        <Chip label={`${factions.length} total`} size="small" />
                    </Box>
                    <Button variant="contained" startIcon={<Plus size={16} />}
                        onClick={() => { setForm({ ...EMPTY_FORM }); setCreateOpen(true); }}
                        sx={{ backgroundColor: "primary.main" }}>
                        New Faction
                    </Button>
                </Box>

                {sorted.length === 0 ? (
                    <Box sx={{ textAlign: "center", py: 10 }}>
                        <Shield size={40} color="#c9a87c" style={{ marginBottom: 12 }} />
                        <Typography sx={{ color: "text.secondary" }}>
                            No factions yet. Track organizations and the party's standing with them.
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                        {sorted.map(faction => {
                            const { color } = repInfo(faction.reputation ?? 0);
                            return (
                                <Card key={faction.id} sx={{ borderLeft: "4px solid", borderColor: color }}>
                                    <Box sx={{ display: "flex", alignItems: "stretch" }}>
                                        <CardActionArea sx={{ flex: 1 }} onClick={() => setExpanded(p => ({ ...p, [faction.id]: !p[faction.id] }))}>
                                            <CardContent sx={{ py: 1.5 }}>
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", mb: 0.75 }}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "primary.dark" }}>
                                                        {faction.name}
                                                    </Typography>
                                                    <Box sx={{ flex: 1, minWidth: 160 }}>
                                                        <ReputationBar value={faction.reputation ?? 0} />
                                                    </Box>
                                                </Box>
                                                {faction.description && !expanded[faction.id] && (
                                                    <Typography variant="body2" sx={{ color: "text.secondary",
                                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {faction.description}
                                                    </Typography>
                                                )}
                                            </CardContent>
                                        </CardActionArea>
                                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", px: 0.5, gap: 0.25 }}>
                                            <Tooltip title="Increase reputation">
                                                <IconButton size="small" onClick={() => adjustRep(faction, 1)} disabled={(faction.reputation ?? 0) >= 5}>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color }}>+</span>
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Decrease reputation">
                                                <IconButton size="small" onClick={() => adjustRep(faction, -1)} disabled={(faction.reputation ?? 0) <= -5}>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color }}>−</span>
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, pr: 1 }}>
                                            <IconButton size="small" onClick={() => setExpanded(p => ({ ...p, [faction.id]: !p[faction.id] }))}>
                                                {expanded[faction.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </IconButton>
                                            <Tooltip title="Edit">
                                                <IconButton size="small" onClick={() => openEdit(faction)}><Pencil size={14} /></IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton size="small" color="error" onClick={() => setDeleteFaction(faction)}><Trash2 size={14} /></IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                    <Collapse in={!!expanded[faction.id]}>
                                        <CardContent sx={{ pt: 0, pb: "12px !important" }}>
                                            {faction.description && (
                                                <Typography variant="body2" sx={{ mb: 1 }}>{faction.description}</Typography>
                                            )}
                                            {faction.notes && (
                                                <Typography variant="body2" sx={{ color: "text.secondary" }}>{faction.notes}</Typography>
                                            )}
                                        </CardContent>
                                    </Collapse>
                                </Card>
                            );
                        })}
                    </Box>
                )}

                {/* Create Dialog */}
                <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>New Faction</DialogTitle>
                    <DialogContent sx={{ pt: 2 }}><FactionFormPanel value={form} onChange={setForm} /></DialogContent>
                    <DialogActions>
                        <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button variant="contained" onClick={handleCreate} disabled={saving || !form.name.trim()}
                            sx={{ backgroundColor: "primary.main" }}>
                            {saving ? <CircularProgress size={16} /> : "Create"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={!!editFaction} onClose={() => setEditFaction(null)} maxWidth="sm" fullWidth>
                    <DialogTitle>Edit Faction</DialogTitle>
                    <DialogContent sx={{ pt: 2 }}><FactionFormPanel value={form} onChange={setForm} /></DialogContent>
                    <DialogActions>
                        <Button onClick={() => setEditFaction(null)}>Cancel</Button>
                        <Button variant="contained" onClick={handleEdit} disabled={saving || !form.name.trim()}
                            sx={{ backgroundColor: "primary.main" }}>
                            {saving ? <CircularProgress size={16} /> : "Save"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete confirmation */}
                <Dialog open={!!deleteFaction} onClose={() => setDeleteFaction(null)}>
                    <DialogTitle>Delete "{deleteFaction?.name}"?</DialogTitle>
                    <DialogContent><Typography>This cannot be undone.</Typography></DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteFaction(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={handleDelete}>Delete</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
