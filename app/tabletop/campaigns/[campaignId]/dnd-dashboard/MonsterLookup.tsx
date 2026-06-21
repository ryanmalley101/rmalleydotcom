"use client";

import { useState, useEffect, useMemo } from "react";
import { Box, Paper, Typography, TextField, IconButton, InputAdornment, Divider } from "@mui/material";
import { Search, Pin, X } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type Monster = Schema["MonsterStatblock"]["type"];

interface MonsterLookupProps {
    pinnedIds: string[];
    onTogglePin: (monsterId: string) => void;
    onClose: () => void;
}

function monsterMeta(m: Monster): string {
    const parts = [`${m.size} ${m.type}`, `CR ${m.challenge_rating ?? m.cr}`, `AC ${m.armor_class}`, `HP ${m.hit_points}`];
    if (m.speed?.walk) parts.push(`Speed ${m.speed.walk} ft.`);
    return parts.join(" · ");
}

function MonsterRow({ m, isPinned, onTogglePin }: { m: Monster; isPinned: boolean; onTogglePin: () => void }) {
    return (
        <Box sx={{ mb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>{m.name}</Typography>
                <IconButton size="small" onClick={onTogglePin} sx={{ p: 0.25, color: isPinned ? "warning.main" : "text.disabled" }}>
                    <Pin size={13} />
                </IconButton>
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{monsterMeta(m)}</Typography>
        </Box>
    );
}

export function MonsterLookup({ pinnedIds, onTogglePin, onClose }: MonsterLookupProps) {
    const [allMonsters, setAllMonsters] = useState<Monster[]>([]);
    const [search, setSearch] = useState("");

    useEffect(() => {
        client.models.MonsterStatblock.list({ limit: 1000 }).then(({ data }) => setAllMonsters(data ?? []));
    }, []);

    const pinned = useMemo(() => allMonsters.filter(m => pinnedIds.includes(m.id)), [allMonsters, pinnedIds]);
    const results = useMemo(() => {
        const q = search.trim().toLowerCase();
        const matches = q ? allMonsters.filter(m => m.name.toLowerCase().includes(q)) : [];
        return matches.filter(m => !pinnedIds.includes(m.id)).slice(0, 20);
    }, [allMonsters, search, pinnedIds]);

    return (
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>Monster Lookup</Typography>
                <IconButton size="small" onClick={onClose}><X size={14} /></IconButton>
            </Box>
            {pinned.length > 0 && (
                <>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>Pinned</Typography>
                    {pinned.map(m => <MonsterRow key={m.id} m={m} isPinned onTogglePin={() => onTogglePin(m.id)} />)}
                    <Divider sx={{ my: 1 }} />
                </>
            )}
            <TextField size="small" fullWidth placeholder="Search your monsters…" value={search}
                onChange={e => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment> }} />
            <Box sx={{ mt: 1, maxHeight: 280, overflowY: "auto" }}>
                {results.map(m => <MonsterRow key={m.id} m={m} isPinned={false} onTogglePin={() => onTogglePin(m.id)} />)}
                {search && results.length === 0 && (
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>No matches.</Typography>
                )}
            </Box>
        </Paper>
    );
}
