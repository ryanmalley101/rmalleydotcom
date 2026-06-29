"use client";

import { Box, Chip, IconButton, Typography } from "@mui/material";
import { Check, X } from "lucide-react";
import type { GalleryPhoto } from "../_lib/useGalleryData";

interface SwipeCardProps {
    photo: GalleryPhoto;
    url: string;
    position: number; // 1-based
    total: number;
    onYes: () => void;
    onNo: () => void;
}

export function SwipeCard({ photo, url, position, total, onYes, onNo }: SwipeCardProps) {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2.5 }}>
            <Typography sx={{ color: "text.disabled", fontSize: "0.8rem" }}>
                {position} / {total}
            </Typography>

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
                {(photo.tags ?? []).length > 0 && (
                    <Box sx={{
                        position: "absolute", bottom: 8, left: 8, right: 8,
                        display: "flex", flexWrap: "wrap", gap: 0.5,
                    }}>
                        {(photo.tags ?? []).map(tag => tag && (
                            <Chip key={tag} label={tag} size="small"
                                sx={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }} />
                        ))}
                    </Box>
                )}
            </Box>

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
            <Typography sx={{ color: "text.disabled", fontSize: "0.72rem" }}>
                Use the ← / → arrow keys, or click
            </Typography>
        </Box>
    );
}
