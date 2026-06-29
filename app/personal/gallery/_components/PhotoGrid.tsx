"use client";

import { Box, Checkbox, CircularProgress } from "@mui/material";
import type { GalleryPhoto } from "../_lib/useGalleryData";

interface PhotoGridProps {
    photos: GalleryPhoto[];
    urls: Record<string, string>;
    onPhotoClick: (index: number) => void;
    selectionMode?: boolean;
    selectedIds?: Set<string>;
    onToggleSelect?: (id: string) => void;
}

export function PhotoGrid({
    photos, urls, onPhotoClick, selectionMode, selectedIds, onToggleSelect,
}: PhotoGridProps) {
    return (
        <Box sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 2,
        }}>
            {photos.map((photo, i) => {
                const selected = selectedIds?.has(photo.id) ?? false;
                return (
                    <Box key={photo.id}
                        onClick={() => selectionMode ? onToggleSelect?.(photo.id) : onPhotoClick(i)}
                        sx={{
                            position: "relative",
                            aspectRatio: "1",
                            borderRadius: 2,
                            overflow: "hidden",
                            cursor: "pointer",
                            backgroundColor: "background.paper",
                            border: "1px solid",
                            borderColor: selected ? "#ec4899" : "rgba(255,255,255,0.06)",
                            transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
                            "&:hover": {
                                transform: "scale(1.02)",
                                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                            },
                        }}>
                        {urls[photo.storageKey] ? (
                            <Box component="img" src={urls[photo.storageKey]} alt={photo.filename} loading="lazy"
                                sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        ) : (
                            <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <CircularProgress size={20} />
                            </Box>
                        )}
                        {selectionMode && (
                            <Checkbox checked={selected} size="small"
                                sx={{
                                    position: "absolute", top: 4, left: 4,
                                    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: "4px", p: 0.5,
                                    color: "#fff",
                                    "&.Mui-checked": { color: "#ec4899" },
                                }} />
                        )}
                    </Box>
                );
            })}
        </Box>
    );
}
