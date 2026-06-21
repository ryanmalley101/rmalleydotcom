"use client";

import { useState, useEffect, useMemo } from "react";
import { Box, Paper, Typography, TextField, Chip, IconButton, InputAdornment } from "@mui/material";
import { Search, X } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type NPC = Schema["NPC"]["type"];

interface SpotlightNpcsProps {
    campaignId: string;
    pinnedIds: string[];
    onTogglePin: (npcId: string) => void;
}

export function SpotlightNpcs({ campaignId, pinnedIds, onTogglePin }: SpotlightNpcsProps) {
    const [npcs, setNpcs] = useState<NPC[]>([]);
    const [search, setSearch] = useState("");

    useEffect(() => {
        client.models.NPC.list().then(({ data }) => {
            setNpcs((data ?? []).filter(n => n.campaignId === campaignId));
        });
    }, [campaignId]);

    const pinned = useMemo(() => npcs.filter(n => pinnedIds.includes(n.id)), [npcs, pinnedIds]);
    const results = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return npcs.filter(n => !pinnedIds.includes(n.id) && n.name.toLowerCase().includes(q)).slice(0, 8);
    }, [npcs, search, pinnedIds]);

    return (
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            {pinned.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.disabled", mb: 1.5 }}>
                    No NPCs pinned. Search below to pin a few likely to show up this session.
                </Typography>
            ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 1.5 }}>
                    {pinned.map(npc => (
                        <Box key={npc.id} sx={{ borderLeft: "3px solid", borderColor: "secondary.main", pl: 1.5, py: 0.5,
                            display: "flex", alignItems: "flex-start", gap: 1 }}>
                            <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{npc.name}</Typography>
                                    {npc.role && <Chip label={npc.role} size="small" sx={{ height: 18, fontSize: "0.6rem" }} />}
                                    {npc.isAlive === false && <Chip label="Deceased" size="small" color="error" sx={{ height: 18, fontSize: "0.6rem" }} />}
                                </Box>
                                {npc.motivation && (
                                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                                        Motive: {npc.motivation}
                                    </Typography>
                                )}
                                {npc.notes && (
                                    <Typography variant="caption" sx={{ color: "text.disabled", display: "block" }}>
                                        {npc.notes}
                                    </Typography>
                                )}
                            </Box>
                            <IconButton size="small" onClick={() => onTogglePin(npc.id)} sx={{ p: 0.25 }}>
                                <X size={12} />
                            </IconButton>
                        </Box>
                    ))}
                </Box>
            )}
            <TextField size="small" fullWidth placeholder="Search NPCs to pin…" value={search}
                onChange={e => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment> }} />
            {results.length > 0 && (
                <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {results.map(npc => (
                        <Chip key={npc.id} label={npc.name} size="small" clickable
                            onClick={() => { onTogglePin(npc.id); setSearch(""); }}
                            sx={{ fontSize: "0.68rem" }} />
                    ))}
                </Box>
            )}
        </Paper>
    );
}
