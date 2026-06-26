"use client";

import { useRef } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import { X } from "lucide-react";

interface FloatingWindowProps {
    title: string;
    x: number;
    y: number;
    z: number;
    width?: number;
    onMove: (x: number, y: number) => void;
    onFocus: () => void;
    onClose: () => void;
    children: React.ReactNode;
}

// A draggable, closable panel that floats above whatever's behind it —
// "a window within a window." Position is plain viewport coordinates
// (position: fixed), so it isn't affected by any ancestor's overflow/scroll
// clipping — important since this sits on top of the VTT's Konva canvas,
// which clips aggressively for its own pan/zoom.
export function FloatingWindow({ title, x, y, z, width = 360, onMove, onFocus, onClose, children }: FloatingWindowProps) {
    const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

    function handleTitleMouseDown(e: React.MouseEvent) {
        onFocus();
        dragRef.current = { startX: e.clientX, startY: e.clientY, origX: x, origY: y };

        function onMouseMove(ev: MouseEvent) {
            if (!dragRef.current) return;
            onMove(dragRef.current.origX + (ev.clientX - dragRef.current.startX),
                   dragRef.current.origY + (ev.clientY - dragRef.current.startY));
        }
        function onMouseUp() {
            dragRef.current = null;
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        }
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }

    return (
        <Box onMouseDown={onFocus} sx={{
            position: "fixed", left: x, top: y, zIndex: z, width,
            maxHeight: "80vh", display: "flex", flexDirection: "column",
            backgroundColor: "background.paper", borderRadius: 1, boxShadow: 8, overflow: "hidden",
        }}>
            <Box onMouseDown={handleTitleMouseDown} sx={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                px: 1.5, py: 0.75, backgroundColor: "#1a1a2e", flexShrink: 0, cursor: "move", userSelect: "none",
            }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "#c9a87c" }}>{title}</Typography>
                <IconButton size="small" onClick={onClose} sx={{ color: "#c9a87c", p: 0.25 }}>
                    <X size={14} />
                </IconButton>
            </Box>
            <Box sx={{ overflowY: "auto", p: 1 }}>{children}</Box>
        </Box>
    );
}
