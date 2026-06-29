"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type SubGallery = Schema["SubGallery"]["type"];

interface SubGalleryFormDialogProps {
    open: boolean;
    editing: SubGallery | null;
    onClose: () => void;
    onSaved: (subGallery: SubGallery) => void;
}

export function SubGalleryFormDialog({ open, editing, onClose, onSaved }: SubGalleryFormDialogProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setName(editing?.name ?? "");
            setDescription(editing?.description ?? "");
        }
    }, [open, editing]);

    async function save() {
        if (!name.trim()) return;
        setSaving(true);
        try {
            const result = editing
                ? await client.models.SubGallery.update({ id: editing.id, name: name.trim(), description })
                : await client.models.SubGallery.create({ name: name.trim(), description });
            if (result.data) onSaved(result.data);
            onClose();
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{editing ? "Edit Sub-Gallery" : "New Sub-Gallery"}</DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
                <TextField label="Name" fullWidth required autoFocus
                    value={name} onChange={e => setName(e.target.value)} />
                <TextField label="Description" fullWidth multiline rows={2}
                    value={description} onChange={e => setDescription(e.target.value)} />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={save} disabled={saving || !name.trim()}>
                    {saving ? "Saving…" : editing ? "Save" : "Create"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
