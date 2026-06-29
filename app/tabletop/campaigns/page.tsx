"use client";

import { useState, useEffect } from "react";
import {
    Box, Container, Typography, Button, TextField, Dialog,
    DialogTitle, DialogContent, DialogActions, MenuItem, Select,
    FormControl, InputLabel, Card, CardActionArea, CardContent,
    IconButton, Tooltip, Divider, CircularProgress, Chip,
    OutlinedInput, ListItemText, Checkbox,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, ScrollText, Plus, Pencil, Trash2 } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type Campaign = Schema["Campaign"]["type"];
type World    = Schema["DnDWorld"]["type"];

const STATUSES = ["Active", "Paused", "Completed", "Planning"];
const SYSTEMS  = ["D&D 5e", "D&D 5.5e (2024)", "Pathfinder 2e", "Cypher System", "Call of Cthulhu", "FATE", "Other"];

const emptyForm = { name: "", description: "", status: "Active", system: "D&D 5e", worldIds: [] as string[] };

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [worlds, setWorlds]       = useState<World[]>([]);
    const [loading, setLoading]     = useState(true);
    const [dialogOpen, setDialog]   = useState(false);
    const [editing, setEditing]     = useState<Campaign | null>(null);
    const [form, setForm]           = useState(emptyForm);
    const [saving, setSaving]       = useState(false);
    const [deleteId, setDeleteId]   = useState<string | null>(null);

    async function load() {
        const [cRes, wRes] = await Promise.all([
            client.models.Campaign.list(),
            client.models.DnDWorld.list(),
        ]);
        setCampaigns((cRes.data ?? []).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")));
        setWorlds(wRes.data ?? []);
        setLoading(false);
    }

    useEffect(() => { load(); }, []);

    function openCreate() {
        setEditing(null);
        setForm(emptyForm);
        setDialog(true);
    }

    function openEdit(c: Campaign) {
        setEditing(c);
        setForm({
            name: c.name,
            description: c.description ?? "",
            status: c.status ?? "Active",
            system: c.system ?? "D&D 5e",
            worldIds: (c.worldIds ?? []).filter(Boolean) as string[],
        });
        setDialog(true);
    }

    async function save() {
        if (!form.name.trim()) return;
        setSaving(true);
        if (editing) {
            await client.models.Campaign.update({ id: editing.id, ...form });
        } else {
            const { userId } = await getCurrentUser();
            await client.models.Campaign.create({ ...form, gmUserId: userId });
        }
        setSaving(false);
        setDialog(false);
        load();
    }

    async function confirmDelete() {
        if (!deleteId) return;
        await client.models.Campaign.delete({ id: deleteId });
        setDeleteId(null);
        load();
    }

    const statusColor: Record<string, string> = {
        Active: "#15803d", Paused: "#b45309", Completed: "#1d4ed8", Planning: "#7e22ce",
    };

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href="/tabletop" startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}>
                    Back
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <ScrollText size={32} color="#8C5A3A" />
                        <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                            My Campaigns
                        </Typography>
                    </Box>
                    <Button variant="contained" startIcon={<Plus size={16} />} onClick={openCreate}
                        sx={{ backgroundColor: "primary.main", "&:hover": { backgroundColor: "primary.dark" } }}>
                        New Campaign
                    </Button>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    Track sessions, prep notes, and player characters for each campaign.
                </Typography>

                <Divider sx={{ mb: 4 }} />

                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                        <CircularProgress sx={{ color: "primary.main" }} />
                    </Box>
                ) : campaigns.length === 0 ? (
                    <Box sx={{ textAlign: "center", py: 10 }}>
                        <ScrollText size={48} color="#c9a87c" style={{ marginBottom: 12 }} />
                        <Typography sx={{ color: "text.secondary", mb: 2 }}>No campaigns yet.</Typography>
                        <Button variant="outlined" onClick={openCreate}
                            sx={{ borderColor: "primary.main", color: "primary.main" }}>
                            Create your first campaign
                        </Button>
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {campaigns.map(c => {
                            const linkedWorlds = worlds.filter(w => (c.worldIds ?? []).includes(w.id));
                            return (
                                <Card key={c.id} sx={{ borderLeft: "4px solid", borderColor: "secondary.main" }}>
                                    <Box sx={{ display: "flex", alignItems: "stretch" }}>
                                        <CardActionArea component={Link} href={`/tabletop/campaigns/${c.id}`} sx={{ flex: 1 }}>
                                            <CardContent>
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                                                    <Typography variant="h6" sx={{ fontWeight: 700, color: "primary.dark" }}>
                                                        {c.name}
                                                    </Typography>
                                                    {c.status && (
                                                        <Chip label={c.status} size="small"
                                                            sx={{ backgroundColor: statusColor[c.status] ?? "#555", color: "#fff", fontSize: "0.65rem", height: 18 }} />
                                                    )}
                                                </Box>
                                                {c.system && (
                                                    <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 1 }}>
                                                        {c.system}
                                                    </Typography>
                                                )}
                                                {c.description && (
                                                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                                                        {c.description}
                                                    </Typography>
                                                )}
                                                {linkedWorlds.length > 0 && (
                                                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 1 }}>
                                                        {linkedWorlds.map(w => (
                                                            <Chip key={w.id} label={w.name} size="small" variant="outlined"
                                                                sx={{ fontSize: "0.65rem", height: 18 }} />
                                                        ))}
                                                    </Box>
                                                )}
                                            </CardContent>
                                        </CardActionArea>
                                        <Box sx={{ display: "flex", alignItems: "center", pr: 1, gap: 0.5 }}>
                                            <Tooltip title="Edit">
                                                <IconButton size="small" onClick={() => openEdit(c)}>
                                                    <Pencil size={16} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton size="small" color="error" onClick={() => setDeleteId(c.id)}>
                                                    <Trash2 size={16} />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                </Card>
                            );
                        })}
                    </Box>
                )}

                {/* Create / Edit dialog */}
                <Dialog open={dialogOpen} onClose={() => setDialog(false)} fullWidth maxWidth="sm">
                    <DialogTitle>{editing ? "Edit Campaign" : "New Campaign"}</DialogTitle>
                    <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
                        <TextField
                            label="Campaign Name" fullWidth required
                            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        />
                        <Box sx={{ display: "flex", gap: 2 }}>
                            <FormControl fullWidth>
                                <InputLabel>Status</InputLabel>
                                <Select label="Status" value={form.status}
                                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                                    {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel>System</InputLabel>
                                <Select label="System" value={form.system}
                                    onChange={e => setForm(f => ({ ...f, system: e.target.value }))}>
                                    {SYSTEMS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Box>
                        <TextField
                            label="Description" fullWidth multiline rows={2}
                            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        />
                        {worlds.length > 0 && (
                            <FormControl fullWidth>
                                <InputLabel>Linked Worlds</InputLabel>
                                <Select
                                    multiple
                                    label="Linked Worlds"
                                    value={form.worldIds}
                                    onChange={e => setForm(f => ({ ...f, worldIds: e.target.value as string[] }))}
                                    input={<OutlinedInput label="Linked Worlds" />}
                                    renderValue={(selected) =>
                                        worlds.filter(w => selected.includes(w.id)).map(w => w.name).join(", ")
                                    }
                                >
                                    {worlds.map(w => (
                                        <MenuItem key={w.id} value={w.id}>
                                            <Checkbox checked={form.worldIds.includes(w.id)} />
                                            <ListItemText primary={w.name} secondary={w.genre} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDialog(false)}>Cancel</Button>
                        <Button variant="contained" onClick={save} disabled={saving || !form.name.trim()}
                            sx={{ backgroundColor: "primary.main" }}>
                            {saving ? <CircularProgress size={18} /> : editing ? "Save" : "Create"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete confirmation */}
                <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
                    <DialogTitle>Delete Campaign?</DialogTitle>
                    <DialogContent>
                        <Typography>This will delete the campaign record. Sessions and characters must be deleted separately.</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={confirmDelete}>Delete</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
