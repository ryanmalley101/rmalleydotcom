"use client";

import { useState, useEffect, useMemo } from "react";
import { Box, Paper, Typography, TextField, IconButton, InputAdornment, Divider } from "@mui/material";
import { Search, Pin, X } from "lucide-react";
import { loadCreatures, searchSrd, creatureMeta, type CreatureSrd } from "@/lib/cypherSrd";

interface CreatureLookupProps {
    pinnedIds: string[];
    onTogglePin: (creatureId: string) => void;
    onClose: () => void;
}

function CreatureRow({ c, isPinned, onTogglePin }: { c: CreatureSrd; isPinned: boolean; onTogglePin: () => void }) {
    return (
        <Box sx={{ mb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>{c.name}</Typography>
                <IconButton size="small" onClick={onTogglePin} sx={{ p: 0.25, color: isPinned ? "warning.main" : "text.disabled" }}>
                    <Pin size={13} />
                </IconButton>
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{creatureMeta(c)}</Typography>
            {c.combat && <Typography variant="caption" sx={{ color: "text.disabled" }}>{c.combat}</Typography>}
        </Box>
    );
}

export function CreatureLookup({ pinnedIds, onTogglePin, onClose }: CreatureLookupProps) {
    const [allCreatures, setAllCreatures] = useState<CreatureSrd[]>([]);
    const [search, setSearch] = useState("");

    useEffect(() => { loadCreatures().then(setAllCreatures); }, []);

    const pinned = useMemo(() => allCreatures.filter(c => pinnedIds.includes(c.id)), [allCreatures, pinnedIds]);
    const results = useMemo(() => searchSrd(allCreatures, search, 20).filter(c => !pinnedIds.includes(c.id)),
        [allCreatures, search, pinnedIds]);

    return (
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>SRD Creature Lookup</Typography>
                <IconButton size="small" onClick={onClose}><X size={14} /></IconButton>
            </Box>
            {pinned.length > 0 && (
                <>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>Pinned</Typography>
                    {pinned.map(c => <CreatureRow key={c.id} c={c} isPinned onTogglePin={() => onTogglePin(c.id)} />)}
                    <Divider sx={{ my: 1 }} />
                </>
            )}
            <TextField size="small" fullWidth placeholder="Search creatures…" value={search}
                onChange={e => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment> }} />
            <Box sx={{ mt: 1, maxHeight: 280, overflowY: "auto" }}>
                {results.map(c => <CreatureRow key={c.id} c={c} isPinned={false} onTogglePin={() => onTogglePin(c.id)} />)}
                {search && results.length === 0 && (
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>No matches.</Typography>
                )}
            </Box>
        </Paper>
    );
}
