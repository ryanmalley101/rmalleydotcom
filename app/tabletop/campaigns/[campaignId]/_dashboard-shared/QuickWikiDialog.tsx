"use client";

import { useState, useEffect } from "react";
import {
    Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
    MenuItem, Select, FormControl, InputLabel, Typography, CircularProgress,
} from "@mui/material";
import Link from "next/link";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type World = Schema["DnDWorld"]["type"];

const CATEGORIES = ["Location", "Person", "Species", "Organization", "Event", "Item", "Lore", "Deity", "Other"];

interface QuickWikiDialogProps {
    open: boolean;
    onClose: () => void;
    worldIds: string[];
    defaultCategory?: string;
    onCreated?: (articleId: string, worldId: string) => void;
}

export function QuickWikiDialog({ open, onClose, worldIds, defaultCategory, onCreated }: QuickWikiDialogProps) {
    const [worlds, setWorlds] = useState<World[]>([]);
    const [worldId, setWorldId] = useState("");
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState(defaultCategory ?? "Other");
    const [content, setContent] = useState("");
    const [saving, setSaving] = useState(false);
    const [createdId, setCreatedId] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        client.models.DnDWorld.list().then(({ data }) => {
            const linked = (data ?? []).filter(w => worldIds.includes(w.id));
            setWorlds(linked);
            setWorldId(linked[0]?.id ?? "");
        });
    }, [open, worldIds]);

    function reset() {
        setTitle(""); setCategory(defaultCategory ?? "Other"); setContent(""); setCreatedId(null);
    }

    async function save() {
        if (!title.trim() || !worldId) return;
        setSaving(true);
        const { data } = await client.models.WikiArticle.create({
            worldId, title: title.trim(), category, content: content || undefined,
        });
        setSaving(false);
        if (data) {
            setCreatedId(data.id);
            onCreated?.(data.id, worldId);
        }
    }

    function handleClose() {
        reset();
        onClose();
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>New Wiki Article</DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
                {worlds.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "text.disabled" }}>
                        This campaign has no linked worlds yet — link one from the Campaign page before creating wiki articles.
                    </Typography>
                ) : createdId ? (
                    <Box sx={{ textAlign: "center", py: 2 }}>
                        <Typography variant="body1" sx={{ mb: 1.5 }}>"{title}" created.</Typography>
                        <Button component={Link} href={`/tabletop/worlds/${worldId}/wiki/${createdId}`}
                            variant="outlined">
                            Open full editor
                        </Button>
                    </Box>
                ) : (
                    <>
                        {worlds.length > 1 && (
                            <FormControl size="small" fullWidth>
                                <InputLabel>World</InputLabel>
                                <Select label="World" value={worldId} onChange={e => setWorldId(e.target.value)}>
                                    {worlds.map(w => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
                                </Select>
                            </FormControl>
                        )}
                        <TextField label="Title" size="small" fullWidth autoFocus value={title}
                            onChange={e => setTitle(e.target.value)} />
                        <FormControl size="small" fullWidth>
                            <InputLabel>Category</InputLabel>
                            <Select label="Category" value={category} onChange={e => setCategory(e.target.value)}>
                                {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <TextField label="Content" size="small" multiline minRows={4} fullWidth value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder="Quick notes — the full editor supports Markdown, links, and more." />
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{createdId ? "Close" : "Cancel"}</Button>
                {!createdId && worlds.length > 0 && (
                    <Button variant="contained" onClick={save} disabled={saving || !title.trim()}
                        sx={{ backgroundColor: "primary.main" }}>
                        {saving ? <CircularProgress size={18} /> : "Create"}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
