"use client";

import { Box, CircularProgress } from "@mui/material";
import type { GalleryPhoto } from "../_lib/useGalleryData";

interface PhotoGridProps {
    photos: GalleryPhoto[];
    urls: Record<string, string>;
    onPhotoClick: (index: number) => void;
}

export function PhotoGrid({ photos, urls, onPhotoClick }: PhotoGridProps) {
    return (
        <Box sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 2,
        }}>
            {photos.map((photo, i) => (
                <Box key={photo.id} onClick={() => onPhotoClick(i)}
                    sx={{
                        position: "relative",
                        aspectRatio: "1",
                        borderRadius: 2,
                        overflow: "hidden",
                        cursor: "pointer",
                        backgroundColor: "background.paper",
                        border: "1px solid rgba(255,255,255,0.06)",
                        transition: "transform 0.15s, box-shadow 0.15s",
                        "&:hover": {
                            transform: "scale(1.02)",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                        },
                    }}>
                    {urls[photo.storageKey] ? (
                        <Box component="img" src={urls[photo.storageKey]} alt={photo.filename}
                            sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                        <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <CircularProgress size={20} />
                        </Box>
                    )}
                </Box>
            ))}
        </Box>
    );
}
