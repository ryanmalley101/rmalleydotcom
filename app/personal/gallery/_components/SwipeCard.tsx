"use client";

import { useState } from "react";
import { Box, Button, Chip, CircularProgress, IconButton, Typography } from "@mui/material";
import { Check, Eye, EyeOff, Trash2, X } from "lucide-react";
import type { GalleryPhoto } from "../_lib/useGalleryData";

interface SwipeCardProps {
    photo: GalleryPhoto;
    url: string;
    position: number; // 1-based
    total: number;
    onYes: () => void;
    onNo: () => void;
    onDelete?: () => Promise<void> | void;
    deleting?: boolean;
    tagsVisible: boolean;
    onToggleTags: () => void;
}

export function SwipeCard({
    photo, url, position, total, onYes, onNo, onDelete, deleting, tagsVisible, onToggleTags,
}: SwipeCardProps) {
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const tags = (photo.tags ?? []).filter((t): t is string => !!t);

    async function handleConfirmDelete() {
        await onDelete?.();
        setConfirmingDelete(false);
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2.5 }}>
            <Typography sx={{ color: "text.disabled", fontSize: "0.8rem" }}>
                {position} / {total}
            </Typography>

            <Box sx={{ display: "flex", gap: 2.5, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap" }}>
                <Box sx={{
                    position: "relative",
                    width: "100%", maxWidth: 480,
                    borderRadius: 3, overflow: "hidden",
                    backgroundColor: "background.paper",
                    border: "1px solid rgba(255,255,255,0.08)",
                }}>
                    {url ? (
                        <Box component="img" src={url} alt={photo.filename}
                            sx={{ width: "100%", maxHeight: "60vh", objectFit: "contain", display: "block" }} />
                    ) : (
                        <Box sx={{ width: "100%", height: 320 }} />
                    )}
                    {onDelete && (
                        <IconButton onClick={() => setConfirmingDelete(true)}
                            sx={{
                                position: "absolute", top: 8, right: 8, color: "#fff",
                                backgroundColor: "rgba(0,0,0,0.45)",
                                "&:hover": { backgroundColor: "rgba(220,38,38,0.7)" },
                            }}>
                            <Trash2 size={16} />
                        </IconButton>
                    )}
                </Box>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 150, maxWidth: 200 }}>
                    <Button size="small" onClick={onToggleTags}
                        startIcon={tagsVisible ? <EyeOff size={14} /> : <Eye size={14} />}>
                        {tagsVisible ? "Hide tags" : "Show tags"}
                    </Button>
                    {tagsVisible && (
                        tags.length > 0 ? (
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                {tags.map(tag => (
                                    <Chip key={tag} label={tag} size="small" />
                                ))}
                            </Box>
                        ) : (
                            <Typography sx={{ color: "text.disabled", fontSize: "0.75rem" }}>
                                No tags yet.
                            </Typography>
                        )
                    )}
                </Box>
            </Box>

            {confirmingDelete ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography sx={{ color: "error.main", fontSize: "0.82rem" }}>
                        Delete this photo permanently?
                    </Typography>
                    <Button size="small" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                        Cancel
                    </Button>
                    <Button size="small" color="error" variant="contained" onClick={handleConfirmDelete} disabled={deleting}
                        startIcon={deleting ? <CircularProgress size={12} color="inherit" /> : undefined}>
                        {deleting ? "Deleting…" : "Delete"}
                    </Button>
                </Box>
            ) : (
                <Box sx={{ display: "flex", gap: 4 }}>
                    <IconButton onClick={onNo}
                        sx={{
                            width: 64, height: 64, backgroundColor: "rgba(248,113,113,0.12)",
                            border: "2px solid #f87171", color: "#f87171",
                            "&:hover": { backgroundColor: "rgba(248,113,113,0.22)" },
                        }}>
                        <X size={28} />
                    </IconButton>
                    <IconButton onClick={onYes}
                        sx={{
                            width: 64, height: 64, backgroundColor: "rgba(74,222,128,0.12)",
                            border: "2px solid #4ade80", color: "#4ade80",
                            "&:hover": { backgroundColor: "rgba(74,222,128,0.22)" },
                        }}>
                        <Check size={28} />
                    </IconButton>
                </Box>
            )}
            <Typography sx={{ color: "text.disabled", fontSize: "0.72rem" }}>
                Use the ← / → arrow keys, or click
            </Typography>
        </Box>
    );
}
