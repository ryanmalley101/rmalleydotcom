"use client";

import { useState } from "react";
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, Chip, Typography, Divider } from "@mui/material";
import { Dices } from "lucide-react";
import { COMMON_INTRUSIONS, randomIntrusion, type IntrusionIdea } from "@/lib/cypherIntrusions";

const CATEGORY_COLORS: Record<IntrusionIdea["category"], string> = {
    Combat: "#b71c1c", Social: "#1565c0", Environmental: "#2e7d32",
    Equipment: "#6a1b9a", NPC: "#e65100", Pacing: "#546e7a",
};

interface CommonIntrusionsDialogProps {
    open: boolean;
    onClose: () => void;
    // Optional — lets the caller do something with a chosen idea (e.g. push
    // it into the GM's own idea log). Omit for read-only browsing.
    onPick?: (text: string) => void;
}

export function CommonIntrusionsDialog({ open, onClose, onPick }: CommonIntrusionsDialogProps) {
    const [rolled, setRolled] = useState<IntrusionIdea | null>(null);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Common GM Intrusions</DialogTitle>
            <DialogContent>
                <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
                    <Button variant="contained" startIcon={<Dices size={16} />} onClick={() => setRolled(randomIntrusion())}
                        sx={{ backgroundColor: "primary.main" }}>
                        Random Idea
                    </Button>
                </Box>
                {rolled && (
                    <Box sx={{ mb: 2, p: 1.5, borderRadius: 1, border: "1px solid", borderColor: CATEGORY_COLORS[rolled.category],
                        backgroundColor: `${CATEGORY_COLORS[rolled.category]}11` }}>
                        <Chip label={rolled.category} size="small"
                            sx={{ backgroundColor: CATEGORY_COLORS[rolled.category], color: "#fff", mb: 0.75, fontSize: "0.65rem", height: 20 }} />
                        <Typography variant="body2">{rolled.text}</Typography>
                        {onPick && (
                            <Button size="small" sx={{ mt: 1 }} onClick={() => onPick(rolled.text)}>Use this</Button>
                        )}
                    </Box>
                )}
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2, display: "block", mb: 1 }}>
                    Full List ({COMMON_INTRUSIONS.length})
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, maxHeight: 360, overflowY: "auto" }}>
                    {COMMON_INTRUSIONS.map((idea, i) => (
                        <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                            <Chip label={idea.category} size="small"
                                sx={{ backgroundColor: CATEGORY_COLORS[idea.category], color: "#fff", fontSize: "0.6rem", height: 18, flexShrink: 0, mt: 0.25 }} />
                            <Typography variant="body2" sx={{ flex: 1 }}>{idea.text}</Typography>
                            {onPick && (
                                <Button size="small" sx={{ flexShrink: 0, minWidth: 0, fontSize: "0.65rem" }} onClick={() => onPick(idea.text)}>
                                    Use
                                </Button>
                            )}
                        </Box>
                    ))}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
