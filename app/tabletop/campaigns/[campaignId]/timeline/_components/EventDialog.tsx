"use client";

import { useEffect, useState } from "react";
import {
    Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, FormControl, FormControlLabel, InputLabel, MenuItem, Select,
    Switch, TextField, Typography,
} from "@mui/material";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { WikiSearchPin } from "../../_dashboard-shared/WikiSearchPin";
import { EVENT_TYPE_META } from "./EventCard";

const client = generateClient<Schema>();
type TimelineEvent = Schema["TimelineEvent"]["type"];

interface EventDialogProps {
    open: boolean;
    editing: TimelineEvent | null;
    campaignId: string;
    worldIds: string[];
    onClose: () => void;
    onSaved: () => void;
}

const emptyForm = {
    title: "",
    eventType: "other",
    realDate: "",
    inWorldDate: "",
    description: "",
    visibleToPlayers: true,
    articleIds: [] as string[],
};

export function EventDialog({ open, editing, campaignId, worldIds, onClose, onSaved }: EventDialogProps) {
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            if (editing) {
                setForm({
                    title: editing.title,
                    eventType: editing.eventType ?? "other",
                    realDate: editing.realDate ?? "",
                    inWorldDate: editing.inWorldDate ?? "",
                    description: editing.description ?? "",
                    visibleToPlayers: editing.visibleToPlayers !== false,
                    articleIds: (editing.articleIds ?? []).filter((id): id is string => !!id),
                });
            } else {
                setForm(emptyForm);
            }
        }
    }, [open, editing]);

    function toggleArticle(id: string) {
        setForm(f => ({
            ...f,
            articleIds: f.articleIds.includes(id)
                ? f.articleIds.filter(a => a !== id)
                : [...f.articleIds, id],
        }));
    }

    async function save() {
        if (!form.title.trim()) return;
        setSaving(true);
        try {
            const payload = {
                campaignId,
                title: form.title.trim(),
                eventType: form.eventType,
                realDate: form.realDate || undefined,
                inWorldDate: form.inWorldDate || undefined,
                description: form.description || undefined,
                visibleToPlayers: form.visibleToPlayers,
                articleIds: form.articleIds,
            };
            if (editing) {
                await client.models.TimelineEvent.update({ id: editing.id, ...payload });
            } else {
                await client.models.TimelineEvent.create(payload);
            }
            onSaved();
            onClose();
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ fontFamily: "'Cinzel', serif" }}>
                {editing ? "Edit Event" : "New Timeline Event"}
            </DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
                <TextField label="Title" fullWidth required autoFocus
                    value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />

                <FormControl fullWidth>
                    <InputLabel>Event Type</InputLabel>
                    <Select label="Event Type" value={form.eventType}
                        onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}>
                        {Object.entries(EVENT_TYPE_META).map(([key, { label, icon }]) => (
                            <MenuItem key={key} value={key}>{icon} {label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Box sx={{ display: "flex", gap: 2 }}>
                    <TextField label="Real Date" type="date" fullWidth
                        value={form.realDate} onChange={e => setForm(f => ({ ...f, realDate: e.target.value }))}
                        InputLabelProps={{ shrink: true }} />
                    <TextField label="In-World Date" fullWidth
                        placeholder="e.g. Kythorn 15, 1492 DR"
                        value={form.inWorldDate} onChange={e => setForm(f => ({ ...f, inWorldDate: e.target.value }))} />
                </Box>

                <TextField label="Description" fullWidth multiline rows={3}
                    value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

                <FormControlLabel
                    control={<Switch checked={form.visibleToPlayers}
                        onChange={e => setForm(f => ({ ...f, visibleToPlayers: e.target.checked }))} />}
                    label="Visible to players" />

                <Divider />
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Linked Wiki Articles</Typography>
                <WikiSearchPin
                    worldIds={worldIds}
                    pinnedIds={form.articleIds}
                    onTogglePin={toggleArticle}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={save} disabled={saving || !form.title.trim()}
                    sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" } }}>
                    {saving ? <CircularProgress size={18} /> : editing ? "Save" : "Create"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
