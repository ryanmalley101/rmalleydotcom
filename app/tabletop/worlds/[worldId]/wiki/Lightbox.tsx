"use client";

import { Box, Dialog, IconButton } from "@mui/material";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface LightboxProps {
    images: string[]; // resolved URLs, in display order
    index: number | null; // null = closed
    onClose: () => void;
    onIndexChange: (index: number) => void;
}

export function Lightbox({ images, index, onClose, onIndexChange }: LightboxProps) {
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

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg"
            PaperProps={{ sx: { backgroundColor: "#0f0f1a", boxShadow: "none" } }}>
            <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                minHeight: 300, minWidth: 300 }}>
                <IconButton onClick={onClose}
                    sx={{ position: "absolute", top: 8, right: 8, color: "#fff", zIndex: 1,
                        backgroundColor: "rgba(0,0,0,0.4)", "&:hover": { backgroundColor: "rgba(0,0,0,0.6)" } }}>
                    <X size={18} />
                </IconButton>
                {images.length > 1 && (
                    <IconButton onClick={prev}
                        sx={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                            color: "#fff", zIndex: 1, backgroundColor: "rgba(0,0,0,0.4)",
                            "&:hover": { backgroundColor: "rgba(0,0,0,0.6)" } }}>
                        <ChevronLeft size={22} />
                    </IconButton>
                )}
                {current && (
                    <Box component="img" src={current} alt=""
                        sx={{ maxWidth: "90vw", maxHeight: "85vh", display: "block", objectFit: "contain" }} />
                )}
                {images.length > 1 && (
                    <IconButton onClick={next}
                        sx={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                            color: "#fff", zIndex: 1, backgroundColor: "rgba(0,0,0,0.4)",
                            "&:hover": { backgroundColor: "rgba(0,0,0,0.6)" } }}>
                        <ChevronRight size={22} />
                    </IconButton>
                )}
            </Box>
        </Dialog>
    );
}
