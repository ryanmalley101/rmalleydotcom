"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
    Box, Container, Typography, Button, TextField, Chip,
    CircularProgress, Card, CardContent, CardActionArea,
    IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
    DialogActions, Collapse, Switch, FormControlLabel,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Plus, Users, Pencil, Trash2, ChevronDown, ChevronUp, Skull } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type NPC = Schema["NPC"]["type"];

const EMPTY: Omit<NPC, "id" | "campaignId" | "createdAt" | "updatedAt" | "owner"> = {
    name: "",
    role: "",
    location: "",
    description: "",
    motivation: "",
    relationship: "",
    notes: "",
    isAlive: true,
    tags: [],
};

function NpcForm({ value, onChange }: { value: typeof EMPTY; onChange: (v: typeof EMPTY) => void }) {
    const [tagInput, setTagInput] = useState("");
    const f = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        onChange({ ...value, [field]: e.target.value });

    function addTag() {
        const t = tagInput.trim();
        if (t && !(value.tags ?? []).includes(t)) onChange({ ...value, tags: [...(value.tags ?? []), t] });
        setTagInput("");
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <TextField label="Name *" required value={value.name} onChange={f("name")} sx={{ flex: "2 1 180px" }} />
                <TextField label="Role / Title" value={value.role ?? ""} onChange={f("role")} sx={{ flex: "1 1 140px" }} />
                <TextField label="Location" value={value.location ?? ""} onChange={f("location")} sx={{ flex: "1 1 140px" }} />
            </Box>
            <TextField label="Description" multiline minRows={2} value={value.description ?? ""} onChange={f("description")} fullWidth />
            <TextField label="Motivation" multiline minRows={1} value={value.motivation ?? ""} onChange={f("motivation")} fullWidth />
            <TextField label="Relationship to party" multiline minRows={1} value={value.relationship ?? ""} onChange={f("relationship")} fullWidth />
            <TextField label="Notes" multiline minRows={2} value={value.notes ?? ""} onChange={f("notes")} fullWidth />
            <FormControlLabel
                control={<Switch checked={value.isAlive ?? true} onChange={e => onChange({ ...value, isAlive: e.target.checked })} />}
                label="Alive"
            />
            <Box>
                <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                    <TextField size="small" placeholder="Add tag…" value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                    <Button size="small" onClick={addTag}>Add</Button>
                </Box>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {(value.tags ?? []).map(t => (
                        <Chip key={t} label={t} size="small" onDelete={() => onChange({ ...value, tags: (value.tags ?? []).filter(x => x !== t) })} />
                    ))}
                </Box>
            </Box>
        </Box>
    );
}

export default function NpcsPage() {
    const { campaignId } = useParams<{ campaignId: string }>();

    const [npcs, setNpcs]           = useState<NPC[]>([]);
    const [loading, setLoading]     = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [editNpc, setEditNpc]     = useState<NPC | null>(null);
    const [deleteNpc, setDeleteNpc] = useState<NPC | null>(null);
    const [form, setForm]           = useState<typeof EMPTY>({ ...EMPTY });
    const [saving, setSaving]       = useState(false);
    const [expanded, setExpanded]   = useState<Record<string, boolean>>({});
    const [filter, setFilter]       = useState<"all" | "alive" | "dead">("all");

    async function load() {
        const { data } = await client.models.NPC.list();
        setNpcs((data ?? []).filter(n => n.campaignId === campaignId));
        setLoading(false);
    }

    useEffect(() => { load(); }, [campaignId]);

    async function handleCreate() {
        if (!form.name.trim()) return;
        setSaving(true);
        await client.models.NPC.create({ ...form, campaignId });
        setSaving(false);
        setCreateOpen(false);
        setForm({ ...EMPTY });
        load();
    }

    async function handleEdit() {
        if (!editNpc || !form.name.trim()) return;
        setSaving(true);
        await client.models.NPC.update({ id: editNpc.id, ...form });
        setSaving(false);
        setEditNpc(null);
        load();
    }

    async function handleDelete() {
        if (!deleteNpc) return;
        await client.models.NPC.delete({ id: deleteNpc.id });
        setDeleteNpc(null);
        load();
    }

    function openEdit(npc: NPC) {
        setEditNpc(npc);
        setForm({
            name: npc.name, role: npc.role ?? "", location: npc.location ?? "",
            description: npc.description ?? "", motivation: npc.motivation ?? "",
            relationship: npc.relationship ?? "", notes: npc.notes ?? "",
            isAlive: npc.isAlive ?? true, tags: npc.tags ?? [],
        });
    }

    const filtered = npcs.filter(n =>
        filter === "all" ? true : filter === "alive" ? (n.isAlive ?? true) : !(n.isAlive ?? true)
    );

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
                        <Users size={26} color="#8C5A3A" />
                        <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>NPCs</Typography>
                        <Chip label={`${npcs.length} total`} size="small" />
                    </Box>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                        {(["all", "alive", "dead"] as const).map(f => (
                            <Chip key={f} label={f === "all" ? "All" : f === "alive" ? "Alive" : "Dead"}
                                onClick={() => setFilter(f)}
                                variant={filter === f ? "filled" : "outlined"}
                                color={filter === f ? "primary" : "default"}
                                size="small" />
                        ))}
                        <Button variant="contained" startIcon={<Plus size={16} />}
                            onClick={() => { setForm({ ...EMPTY }); setCreateOpen(true); }}
                            sx={{ backgroundColor: "primary.main" }}>
                            New NPC
                        </Button>
                    </Box>
                </Box>

                {filtered.length === 0 ? (
                    <Box sx={{ textAlign: "center", py: 10 }}>
                        <Users size={40} color="#c9a87c" style={{ marginBottom: 12 }} />
                        <Typography sx={{ color: "text.secondary" }}>
                            {npcs.length === 0 ? "No NPCs yet. Create your first to track characters your party meets." : "No NPCs match this filter."}
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                        {filtered.map(npc => (
                            <Card key={npc.id} sx={{ borderLeft: "4px solid", borderColor: (npc.isAlive ?? true) ? "primary.light" : "#9e9e9e" }}>
                                <Box sx={{ display: "flex", alignItems: "stretch" }}>
                                    <CardActionArea sx={{ flex: 1 }} onClick={() => setExpanded(p => ({ ...p, [npc.id]: !p[npc.id] }))}>
                                        <CardContent sx={{ py: 1.5 }}>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                                {!(npc.isAlive ?? true) && <Skull size={14} color="#9e9e9e" />}
                                                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: (npc.isAlive ?? true) ? "primary.dark" : "text.disabled" }}>
                                                    {npc.name}
                                                </Typography>
                                                {npc.role && <Typography variant="caption" sx={{ color: "text.secondary" }}>{npc.role}</Typography>}
                                                {npc.location && <Chip label={npc.location} size="small" variant="outlined" sx={{ height: 18, fontSize: "0.65rem" }} />}
                                                {(npc.tags ?? []).map(t => <Chip key={t} label={t} size="small" sx={{ height: 18, fontSize: "0.65rem", backgroundColor: "#8C5A3A22" }} />)}
                                            </Box>
                                            {npc.description && !expanded[npc.id] && (
                                                <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5,
                                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {npc.description}
                                                </Typography>
                                            )}
                                        </CardContent>
                                    </CardActionArea>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, pr: 1 }}>
                                        <IconButton size="small" onClick={() => setExpanded(p => ({ ...p, [npc.id]: !p[npc.id] }))}>
                                            {expanded[npc.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </IconButton>
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => openEdit(npc)}><Pencil size={14} /></IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton size="small" color="error" onClick={() => setDeleteNpc(npc)}><Trash2 size={14} /></IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>
                                <Collapse in={!!expanded[npc.id]}>
                                    <CardContent sx={{ pt: 0, pb: "12px !important" }}>
                                        {npc.description && <Typography variant="body2" sx={{ mb: 1 }}><strong>Description:</strong> {npc.description}</Typography>}
                                        {npc.motivation && <Typography variant="body2" sx={{ mb: 1 }}><strong>Motivation:</strong> {npc.motivation}</Typography>}
                                        {npc.relationship && <Typography variant="body2" sx={{ mb: 1 }}><strong>Relationship:</strong> {npc.relationship}</Typography>}
                                        {npc.notes && <Typography variant="body2" sx={{ color: "text.secondary" }}>{npc.notes}</Typography>}
                                    </CardContent>
                                </Collapse>
                            </Card>
                        ))}
                    </Box>
                )}

                {/* Create Dialog */}
                <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>New NPC</DialogTitle>
                    <DialogContent sx={{ pt: 2 }}>
                        <NpcForm value={form} onChange={setForm} />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button variant="contained" onClick={handleCreate} disabled={saving || !form.name.trim()}
                            sx={{ backgroundColor: "primary.main" }}>
                            {saving ? <CircularProgress size={16} /> : "Create"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={!!editNpc} onClose={() => setEditNpc(null)} maxWidth="sm" fullWidth>
                    <DialogTitle>Edit NPC</DialogTitle>
                    <DialogContent sx={{ pt: 2 }}>
                        <NpcForm value={form} onChange={setForm} />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setEditNpc(null)}>Cancel</Button>
                        <Button variant="contained" onClick={handleEdit} disabled={saving || !form.name.trim()}
                            sx={{ backgroundColor: "primary.main" }}>
                            {saving ? <CircularProgress size={16} /> : "Save"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete confirmation */}
                <Dialog open={!!deleteNpc} onClose={() => setDeleteNpc(null)}>
                    <DialogTitle>Delete {deleteNpc?.name}?</DialogTitle>
                    <DialogContent><Typography>This cannot be undone.</Typography></DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteNpc(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={handleDelete}>Delete</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
