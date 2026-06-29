"use client";

import { useEffect } from "react";
import { Box, Dialog, IconButton, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight, FolderCog, X } from "lucide-react";

interface PhotoLightboxProps {
    images: string[]; // resolved URLs, in display order
    index: number | null; // null = closed
    onClose: () => void;
    onIndexChange: (index: number) => void;
    onManage?: () => void; // "manage galleries" action for the current photo
}

export function PhotoLightbox({ images, index, onClose, onIndexChange, onManage }: PhotoLightboxProps) {
    const open = index !== null && images.length > 0;
    const current = open ? images[index!] : null;

    function prev() {
        if (index === null) return;
        onIndexChange((index - 1 + images.length) % images.length);
    }
    function next() {
        if (index === null) return;
        onIndexChange((index + 1) % images.length);
    }

    useEffect(() => {
        if (!open) return;
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "ArrowLeft") prev();
            else if (e.key === "ArrowRight") next();
            else if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, index, images.length]);

    return (
        <Dialog open={open} onClose={onClose} fullScreen
            PaperProps={{ sx: { backgroundColor: "#0f0f1a", boxShadow: "none" } }}>
            <Box sx={{
                position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                width: "100%", height: "100%", minHeight: "100vh",
            }}>
                <IconButton onClick={onClose}
                    sx={{ position: "absolute", top: 12, right: 12, color: "#fff", zIndex: 1,
                        backgroundColor: "rgba(0,0,0,0.4)", "&:hover": { backgroundColor: "rgba(0,0,0,0.6)" } }}>
                    <X size={20} />
                </IconButton>
                {onManage && (
                    <IconButton onClick={onManage}
                        sx={{ position: "absolute", top: 12, right: 64, color: "#fff", zIndex: 1,
                            backgroundColor: "rgba(0,0,0,0.4)", "&:hover": { backgroundColor: "rgba(0,0,0,0.6)" } }}>
                        <FolderCog size={18} />
                    </IconButton>
                )}
                {images.length > 1 && (
                    <IconButton onClick={prev}
                        sx={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                            color: "#fff", zIndex: 1, backgroundColor: "rgba(0,0,0,0.4)",
                            "&:hover": { backgroundColor: "rgba(0,0,0,0.6)" } }}>
                        <ChevronLeft size={28} />
                    </IconButton>
                )}
                {current && (
                    <Box component="img" src={current} alt=""
                        sx={{ maxWidth: "92vw", maxHeight: "88vh", display: "block", objectFit: "contain" }} />
                )}
                {images.length > 1 && (
                    <IconButton onClick={next}
                        sx={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                            color: "#fff", zIndex: 1, backgroundColor: "rgba(0,0,0,0.4)",
                            "&:hover": { backgroundColor: "rgba(0,0,0,0.6)" } }}>
                        <ChevronRight size={28} />
                    </IconButton>
                )}
                {open && (
                    <Typography sx={{
                        position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
                        color: "#fff", backgroundColor: "rgba(0,0,0,0.5)", px: 1.5, py: 0.5,
                        borderRadius: 1, fontSize: "0.8rem", fontWeight: 600,
                    }}>
                        {index! + 1} / {images.length}
                    </Typography>
                )}
            </Box>
        </Dialog>
    );
}
