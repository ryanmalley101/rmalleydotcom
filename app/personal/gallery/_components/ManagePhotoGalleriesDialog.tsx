"use client";

import { useEffect, useState } from "react";
import {
    Autocomplete, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent,
    DialogTitle, FormControlLabel, TextField, Typography,
} from "@mui/material";
import { Trash2 } from "lucide-react";
import { remove } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type GalleryPhoto = Schema["GalleryPhoto"]["type"];
type SubGallery = Schema["SubGallery"]["type"];

interface ManagePhotoGalleriesDialogProps {
    open: boolean;
    photo: GalleryPhoto | null;
    subGalleries: SubGallery[];
    allTags: string[]; // every tag already used across all photos, for autocomplete suggestions
    onClose: () => void;
    onSaved: () => void;
    onDeleted: () => void;
}

export function ManagePhotoGalleriesDialog({
    open, photo, subGalleries, allTags, onClose, onSaved, onDeleted,
}: ManagePhotoGalleriesDialogProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [tags, setTags] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (open && photo) {
            setSelectedIds((photo.subGalleryIds ?? []).filter((id): id is string => !!id));
            setTags((photo.tags ?? []).filter((t): t is string => !!t));
            setConfirmingDelete(false);
        }
    }, [open, photo]);

    function toggle(id: string) {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
    }

    async function save() {
        if (!photo) return;
        setSaving(true);
        try {
            await client.models.GalleryPhoto.update({ id: photo.id, subGalleryIds: selectedIds, tags });
            onSaved();
            onClose();
        } finally {
            setSaving(false);
        }
    }

    async function confirmDelete() {
        if (!photo) return;
        setDeleting(true);
        try {
            await remove({ path: photo.storageKey });
            await client.models.GalleryPhoto.delete({ id: photo.id });
            onDeleted();
        } finally {
            setDeleting(false);
        }
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
            <DialogTitle>Manage Photo</DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 0.5, pt: "16px !important" }}>
                <Typography variant="caption" sx={{ color: "text.secondary", mb: 0.5 }}>
                    Aesthetic tags
                </Typography>
                <Autocomplete
                    multiple freeSolo size="small"
                    options={allTags}
                    value={tags}
                    onChange={(_, newValue) => setTags(newValue)}
                    renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                            <Chip label={option} size="small" {...getTagProps({ index })} />
                        ))
                    }
                    renderInput={params => (
                        <TextField {...params} placeholder="warm, bohemian, minimalist…" />
                    )}
                    sx={{ mb: 1.5 }}
                />

                <Typography variant="caption" sx={{ color: "text.secondary", mb: 0.5 }}>
                    Sub-galleries
                </Typography>
                {subGalleries.length === 0 ? (
                    <Typography sx={{ color: "text.disabled", fontSize: "0.82rem" }}>
                        No sub-galleries yet.
                    </Typography>
                ) : subGalleries.map(g => (
                    <FormControlLabel key={g.id}
                        control={<Checkbox size="small"
                            checked={selectedIds.includes(g.id)}
                            onChange={() => toggle(g.id)} />}
                        label={<Typography sx={{ fontSize: "0.85rem" }}>{g.name}</Typography>} />
                ))}

                <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1.5, mt: 1.5 }}>
                    {confirmingDelete ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography sx={{ fontSize: "0.8rem", color: "error.main", flex: 1 }}>
                                Delete this photo permanently?
                            </Typography>
                            <Button size="small" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
                            <Button size="small" color="error" variant="contained" onClick={confirmDelete} disabled={deleting}>
                                {deleting ? "Deleting…" : "Delete"}
                            </Button>
                        </Box>
                    ) : (
                        <Button size="small" color="error" startIcon={<Trash2 size={14} />}
                            onClick={() => setConfirmingDelete(true)}>
                            Delete photo
                        </Button>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={save} disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
