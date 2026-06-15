"use client";

import { useState, useEffect } from "react";
import {
    Box, Container, Typography, Button, TextField, Dialog,
    DialogTitle, DialogContent, DialogActions, MenuItem, Select,
    FormControl, InputLabel, Card, CardActionArea, CardContent,
    IconButton, Tooltip, Divider, CircularProgress,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Globe, Plus, Pencil, Trash2 } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type World = Schema["DnDWorld"]["type"];

const GENRES = ["Fantasy", "Sci-Fi", "Horror", "Modern", "Historical", "Steampunk", "Post-Apocalyptic", "Other"];

const emptyForm = { name: "", description: "", genre: "Fantasy" };

export default function WorldsPage() {
    const [worlds, setWorlds]       = useState<World[]>([]);
    const [loading, setLoading]     = useState(true);
    const [dialogOpen, setDialog]   = useState(false);
    const [editing, setEditing]     = useState<World | null>(null);
    const [form, setForm]           = useState(emptyForm);
    const [saving, setSaving]       = useState(false);
    const [deleteId, setDeleteId]   = useState<string | null>(null);

    async function load() {
        const { data } = await client.models.DnDWorld.list();
        setWorlds((data ?? []).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")));
        setLoading(false);
    }

    useEffect(() => { load(); }, []);

    function openCreate() {
        setEditing(null);
        setForm(emptyForm);
        setDialog(true);
    }

    function openEdit(w: World) {
        setEditing(w);
        setForm({ name: w.name, description: w.description ?? "", genre: w.genre ?? "Fantasy" });
        setDialog(true);
    }

    async function save() {
        if (!form.name.trim()) return;
        setSaving(true);
        if (editing) {
            await client.models.DnDWorld.update({ id: editing.id, ...form });
        } else {
            await client.models.DnDWorld.create(form);
        }
        setSaving(false);
        setDialog(false);
        load();
    }

    async function confirmDelete() {
        if (!deleteId) return;
        await client.models.DnDWorld.delete({ id: deleteId });
        setDeleteId(null);
        load();
    }

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href="/tabletop" startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}>
                    Back
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Globe size={32} color="#8C5A3A" />
                        <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                            My Worlds
                        </Typography>
                    </Box>
                    <Button variant="contained" startIcon={<Plus size={16} />} onClick={openCreate}
                        sx={{ backgroundColor: "primary.main", "&:hover": { backgroundColor: "primary.dark" } }}>
                        New World
                    </Button>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    Each world has its own wiki — create articles for locations, NPCs, factions, lore, and link them together.
                </Typography>

                <Divider sx={{ mb: 4 }} />

                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                        <CircularProgress sx={{ color: "primary.main" }} />
                    </Box>
                ) : worlds.length === 0 ? (
                    <Box sx={{ textAlign: "center", py: 10 }}>
                        <Globe size={48} color="#c9a87c" style={{ marginBottom: 12 }} />
                        <Typography sx={{ color: "text.secondary", mb: 2 }}>No worlds yet.</Typography>
                        <Button variant="outlined" onClick={openCreate}
                            sx={{ borderColor: "primary.main", color: "primary.main" }}>
                            Create your first world
                        </Button>
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {worlds.map(w => (
                            <Card key={w.id} sx={{ borderLeft: "4px solid", borderColor: "primary.main" }}>
                                <Box sx={{ display: "flex", alignItems: "stretch" }}>
                                    <CardActionArea component={Link} href={`/tabletop/worlds/${w.id}`} sx={{ flex: 1 }}>
                                        <CardContent>
                                            <Typography variant="h6" sx={{ fontWeight: 700, color: "primary.dark" }}>
                                                {w.name}
                                            </Typography>
                                            {w.genre && (
                                                <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 1 }}>
                                                    {w.genre}
                                                </Typography>
                                            )}
                                            {w.description && (
                                                <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                                                    {w.description}
                                                </Typography>
                                            )}
                                        </CardContent>
                                    </CardActionArea>
                                    <Box sx={{ display: "flex", alignItems: "center", pr: 1, gap: 0.5 }}>
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => openEdit(w)}>
                                                <Pencil size={16} />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton size="small" color="error" onClick={() => setDeleteId(w.id)}>
                                                <Trash2 size={16} />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>
                            </Card>
                        ))}
                    </Box>
                )}

                {/* Create / Edit dialog */}
                <Dialog open={dialogOpen} onClose={() => setDialog(false)} fullWidth maxWidth="sm">
                    <DialogTitle>{editing ? "Edit World" : "New World"}</DialogTitle>
                    <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
                        <TextField
                            label="World Name" fullWidth required
                            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        />
                        <FormControl fullWidth>
                            <InputLabel>Genre</InputLabel>
                            <Select label="Genre" value={form.genre}
                                onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}>
                                {GENRES.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <TextField
                            label="Description" fullWidth multiline rows={3}
                            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        />
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
                    <DialogTitle>Delete World?</DialogTitle>
                    <DialogContent>
                        <Typography>This will delete the world record. Wiki articles must be deleted separately.</Typography>
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
