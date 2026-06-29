"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
    Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent,
    DialogTitle, FormControlLabel, TextField, Typography,
} from "@mui/material";
import { Check, ImagePlus, Plus, X } from "lucide-react";
import { uploadData } from "aws-amplify/storage";
import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import { v4 as uuidv4 } from "uuid";
import type { Schema } from "@/amplify/data/resource";
import { useFileDrop } from "@/lib/useFileDrop";

const client = generateClient<Schema>();
type SubGallery = Schema["SubGallery"]["type"];

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface UploadDialogProps {
    open: boolean;
    onClose: () => void;
    subGalleries: SubGallery[];
    defaultSubGalleryId?: string;
    onDone: () => void; // reload parent data
}

interface QueuedFile {
    file: File;
    status: "uploading" | "done" | "error";
}

export function UploadDialog({ open, onClose, subGalleries, defaultSubGalleryId, onDone }: UploadDialogProps) {
    const [queue, setQueue] = useState<QueuedFile[]>([]);
    const [uploadedIds, setUploadedIds] = useState<string[]>([]);
    const [selectedGalleryIds, setSelectedGalleryIds] = useState<string[]>(
        defaultSubGalleryId ? [defaultSubGalleryId] : []
    );
    const [localSubGalleries, setLocalSubGalleries] = useState<SubGallery[]>(subGalleries);
    const [creatingGallery, setCreatingGallery] = useState(false);
    const [newGalleryName, setNewGalleryName] = useState("");
    const [applying, setApplying] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    async function handleFiles(files: File[]) {
        const accepted = files.filter(f => ACCEPTED_TYPES.includes(f.type));
        if (!accepted.length) return;

        setQueue(prev => [...prev, ...accepted.map(file => ({ file, status: "uploading" as const }))]);

        const { userId, signInDetails } = await getCurrentUser();
        const newIds: string[] = [];

        for (const file of accepted) {
            try {
                const key = `gallery-photos/${uuidv4()}-${file.name}`;
                await uploadData({ path: key, data: file, options: { contentType: file.type } }).result;
                const { data: created } = await client.models.GalleryPhoto.create({
                    storageKey: key,
                    filename: file.name,
                    uploadedAt: new Date().toISOString(),
                    uploaderId: userId,
                    uploaderName: signInDetails?.loginId,
                    subGalleryIds: defaultSubGalleryId ? [defaultSubGalleryId] : [],
                });
                if (created) newIds.push(created.id);
                setQueue(prev => prev.map(q => q.file === file ? { ...q, status: "done" } : q));
            } catch {
                setQueue(prev => prev.map(q => q.file === file ? { ...q, status: "error" } : q));
            }
        }
        setUploadedIds(prev => [...prev, ...newIds]);
    }

    const fileDrop = useFileDrop(handleFiles);

    function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        if (files.length) handleFiles(files);
        e.target.value = "";
    }

    function toggleGallery(id: string) {
        setSelectedGalleryIds(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
    }

    async function createGalleryInline() {
        if (!newGalleryName.trim()) return;
        const { data } = await client.models.SubGallery.create({ name: newGalleryName.trim() });
        if (data) {
            setLocalSubGalleries(prev => [...prev, data]);
            setSelectedGalleryIds(prev => [...prev, data.id]);
        }
        setNewGalleryName("");
        setCreatingGallery(false);
    }

    async function applyAssignments() {
        setApplying(true);
        try {
            await Promise.all(uploadedIds.map(id =>
                client.models.GalleryPhoto.update({ id, subGalleryIds: selectedGalleryIds })
            ));
        } finally {
            setApplying(false);
            handleClose();
        }
    }

    function handleClose() {
        setQueue([]);
        setUploadedIds([]);
        setSelectedGalleryIds(defaultSubGalleryId ? [defaultSubGalleryId] : []);
        onDone();
        onClose();
    }

    const allDone = queue.length > 0 && queue.every(q => q.status === "done" || q.status === "error");

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
            <DialogTitle>Upload Photos</DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
                <Box {...fileDrop.dropHandlers} onClick={() => inputRef.current?.click()}
                    sx={{
                        border: "2px dashed",
                        borderColor: fileDrop.isDragging ? "primary.main" : "divider",
                        borderRadius: 2, p: 4, textAlign: "center", cursor: "pointer",
                        backgroundColor: fileDrop.isDragging ? "rgba(129,140,248,0.06)" : "transparent",
                        transition: "border-color 0.15s, background-color 0.15s",
                    }}>
                    <ImagePlus size={28} color="#818cf8" style={{ marginBottom: 8 }} />
                    <Typography sx={{ color: "text.secondary", fontSize: "0.85rem" }}>
                        Drag and drop photos here, or click to browse
                    </Typography>
                    <Typography sx={{ color: "text.disabled", fontSize: "0.7rem", mt: 0.5 }}>
                        JPG, PNG, or WEBP — multiple files supported
                    </Typography>
                    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
                        onChange={handleFileSelect} />
                </Box>

                {queue.length > 0 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, maxHeight: 160, overflowY: "auto" }}>
                        {queue.map((q, i) => (
                            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                {q.status === "uploading" && <CircularProgress size={14} />}
                                {q.status === "done" && <Check size={14} color="#4ade80" />}
                                {q.status === "error" && <X size={14} color="#f87171" />}
                                <Typography sx={{ fontSize: "0.78rem", color: "text.secondary" }} noWrap>
                                    {q.file.name}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                )}

                {allDone && uploadedIds.length > 0 && (
                    <Box>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                            Assign to sub-galleries (optional)
                        </Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
                            {localSubGalleries.map(g => (
                                <FormControlLabel key={g.id} sx={{ mr: 0 }}
                                    control={<Checkbox size="small"
                                        checked={selectedGalleryIds.includes(g.id)}
                                        onChange={() => toggleGallery(g.id)} />}
                                    label={<Typography sx={{ fontSize: "0.82rem" }}>{g.name}</Typography>} />
                            ))}
                        </Box>
                        {creatingGallery ? (
                            <Box sx={{ display: "flex", gap: 1 }}>
                                <TextField size="small" autoFocus placeholder="New sub-gallery name"
                                    value={newGalleryName} onChange={e => setNewGalleryName(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") createGalleryInline(); }} />
                                <Button size="small" onClick={createGalleryInline}>Add</Button>
                                <Button size="small" onClick={() => setCreatingGallery(false)}>Cancel</Button>
                            </Box>
                        ) : (
                            <Button size="small" startIcon={<Plus size={14} />} onClick={() => setCreatingGallery(true)}>
                                New sub-gallery
                            </Button>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{allDone ? "Skip" : "Close"}</Button>
                {allDone && uploadedIds.length > 0 && (
                    <Button variant="contained" onClick={applyAssignments} disabled={applying}>
                        {applying ? "Saving…" : "Done"}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
