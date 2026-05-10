"use client";

import { useState, useMemo } from "react";
import {
    Box, Container, Button, Typography, TextField, Select, MenuItem,
    FormControl, InputLabel, Paper, Divider, Chip, IconButton,
} from "@mui/material";
import { ArrowLeft, Calculator, Plus, X } from "lucide-react";
import Link from "next/link";

// ── XP tables (PHB 2014 / DMG) ────────────────────────────────────────────────

// [easy, medium, hard, deadly] per character per level
const XP_THRESHOLDS: Record<number, [number, number, number, number]> = {
    1:  [25,   50,   75,    100],   2:  [50,   100,  150,   200],
    3:  [75,   150,  225,   400],   4:  [125,  250,  375,   500],
    5:  [250,  500,  750,   1100],  6:  [300,  600,  900,   1400],
    7:  [350,  750,  1100,  1700],  8:  [450,  900,  1400,  2100],
    9:  [550,  1100, 1600,  2400],  10: [600,  1200, 1900,  2800],
    11: [800,  1600, 2400,  3600],  12: [1000, 2000, 3000,  4500],
    13: [1100, 2200, 3400,  5100],  14: [1250, 2500, 3800,  5700],
    15: [1400, 2800, 4300,  6400],  16: [1600, 3200, 4800,  7200],
    17: [2000, 3900, 5900,  8800],  18: [2100, 4200, 6300,  9500],
    19: [2400, 4900, 7300,  10900], 20: [2800, 5700, 8500,  12700],
};

const CR_XP: Record<string, number> = {
    "0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
    "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800,
    "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900,
    "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000,
    "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000,
    "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000,
    "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000,
};

const CR_OPTIONS = ["0", "1/8", "1/4", "1/2",
    ...Array.from({ length: 30 }, (_, i) => String(i + 1))];

function getMultiplier(count: number): number {
    if (count === 1) return 1;
    if (count === 2) return 1.5;
    if (count <= 6) return 2;
    if (count <= 10) return 2.5;
    if (count <= 14) return 3;
    return 4;
}

function fmt(n: number): string { return n.toLocaleString(); }

function uid() { return Math.random().toString(36).slice(2, 9); }

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonsterEntry { id: string; cr: string; count: number; name: string }

const DIFFICULTIES = [
    { key: "trivial", label: "Trivial", color: "#90a4ae" },
    { key: "easy",    label: "Easy",    color: "#43a047" },
    { key: "medium",  label: "Medium",  color: "#fdd835" },
    { key: "hard",    label: "Hard",    color: "#ef6c00" },
    { key: "deadly",  label: "Deadly",  color: "#c62828" },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function EncounterCalcPage() {
    // Party
    const [partySize, setPartySize] = useState(4);
    const [useUniformLevel, setUseUniformLevel] = useState(true);
    const [uniformLevel, setUniformLevel] = useState(5);
    const [charLevels, setCharLevels] = useState<number[]>([5, 5, 5, 5]);

    // Monsters
    const [monsters, setMonsters] = useState<MonsterEntry[]>([]);
    const [addCr, setAddCr] = useState("1");
    const [addCount, setAddCount] = useState("1");
    const [addName, setAddName] = useState("");

    // Sync charLevels length when partySize changes
    function changePartySize(n: number) {
        setPartySize(n);
        setCharLevels((prev) => {
            const next = Array.from({ length: n }, (_, i) => prev[i] ?? uniformLevel);
            return next;
        });
    }

    function addMonster() {
        const count = Math.max(1, parseInt(addCount, 10) || 1);
        setMonsters((prev) => [...prev, { id: uid(), cr: addCr, count, name: addName.trim() }]);
        setAddName("");
        setAddCount("1");
    }

    const levels = useUniformLevel
        ? Array.from({ length: partySize }, () => uniformLevel)
        : charLevels;

    const { rawXp, adjustedXp, multiplier, monsterCount, thresholds, difficulty } = useMemo(() => {
        const rawXp = monsters.reduce((s, m) => s + (CR_XP[m.cr] ?? 0) * m.count, 0);
        const monsterCount = monsters.reduce((s, m) => s + m.count, 0);
        const multiplier = monsterCount > 0 ? getMultiplier(monsterCount) : 1;
        const adjustedXp = Math.floor(rawXp * multiplier);

        const thresholds = levels.reduce<[number, number, number, number]>(
            ([e, m, h, d], lv) => {
                const t = XP_THRESHOLDS[Math.max(1, Math.min(20, lv))] ?? [0, 0, 0, 0];
                return [e + t[0], m + t[1], h + t[2], d + t[3]];
            },
            [0, 0, 0, 0]
        );

        let difficulty: string;
        if (adjustedXp < thresholds[0]) difficulty = "trivial";
        else if (adjustedXp < thresholds[1]) difficulty = "easy";
        else if (adjustedXp < thresholds[2]) difficulty = "medium";
        else if (adjustedXp < thresholds[3]) difficulty = "hard";
        else difficulty = "deadly";

        return { rawXp, adjustedXp, multiplier, monsterCount, thresholds, difficulty };
    }, [monsters, levels]);

    const hasMonsters = monsters.length > 0;

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href="/tabletop" startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                    <Calculator size={32} color="#8C5A3A" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        Encounter Difficulty
                    </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    Calculate encounter difficulty using the D&amp;D XP budget method.
                </Typography>

                <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "flex-start" }}>
                    {/* ── Left column: Party + Monsters ── */}
                    <Box sx={{ flex: "1 1 320px" }}>
                        {/* Party setup */}
                        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                            <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                                Party
                            </Typography>
                            <Box sx={{ display: "flex", gap: 1.5, mt: 1, flexWrap: "wrap", alignItems: "center" }}>
                                <FormControl size="small" sx={{ minWidth: 100 }}>
                                    <InputLabel>Characters</InputLabel>
                                    <Select value={partySize} label="Characters" onChange={(e) => changePartySize(Number(e.target.value))}>
                                        {[1,2,3,4,5,6,7,8].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                                    </Select>
                                </FormControl>

                                {useUniformLevel ? (
                                    <FormControl size="small" sx={{ minWidth: 100 }}>
                                        <InputLabel>Level</InputLabel>
                                        <Select value={uniformLevel} label="Level" onChange={(e) => { setUniformLevel(Number(e.target.value)); setCharLevels(Array.from({ length: partySize }, () => Number(e.target.value))); }}>
                                            {Array.from({ length: 20 }, (_, i) => i + 1).map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                ) : (
                                    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                                        {charLevels.map((lv, i) => (
                                            <TextField
                                                key={i} size="small" type="number" label={`P${i+1}`}
                                                value={lv}
                                                onChange={(e) => setCharLevels((prev) => { const next = [...prev]; next[i] = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)); return next; })}
                                                sx={{ width: 60 }}
                                            />
                                        ))}
                                    </Box>
                                )}

                                <Button
                                    size="small" variant="text"
                                    onClick={() => setUseUniformLevel((v) => !v)}
                                    sx={{ fontSize: "0.72rem", color: "primary.main", whiteSpace: "nowrap" }}
                                >
                                    {useUniformLevel ? "Custom levels" : "Same level"}
                                </Button>
                            </Box>
                        </Paper>

                        {/* Add monsters */}
                        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                            <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                                Add Monster
                            </Typography>
                            <Box sx={{ display: "flex", gap: 1.5, mt: 1, flexWrap: "wrap", alignItems: "flex-end" }}>
                                <FormControl size="small" sx={{ minWidth: 90 }}>
                                    <InputLabel>CR</InputLabel>
                                    <Select value={addCr} label="CR" onChange={(e) => setAddCr(e.target.value)}>
                                        {CR_OPTIONS.map((cr) => <MenuItem key={cr} value={cr}>{cr}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <TextField
                                    size="small" label="×" type="number" value={addCount}
                                    onChange={(e) => setAddCount(e.target.value)}
                                    sx={{ width: 64 }}
                                />
                                <TextField
                                    size="small" label="Name (opt)" value={addName}
                                    onChange={(e) => setAddName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") addMonster(); }}
                                    sx={{ flex: "1 1 120px" }}
                                />
                                <Button
                                    variant="contained" size="small" startIcon={<Plus size={14} />}
                                    onClick={addMonster}
                                    sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" } }}
                                >
                                    Add
                                </Button>
                            </Box>
                        </Paper>

                        {/* Monster list */}
                        {monsters.length > 0 && (
                            <Paper elevation={1} sx={{ p: 2 }}>
                                <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2, mb: 1, display: "block" }}>
                                    Encounter ({monsterCount} {monsterCount === 1 ? "creature" : "creatures"})
                                </Typography>
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                                    {monsters.map((m) => (
                                        <Box key={m.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                            <Typography variant="body2" sx={{ flex: 1, color: "text.primary" }}>
                                                <strong>{m.count}×</strong> CR {m.cr}{m.name ? ` — ${m.name}` : ""}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                                                {fmt((CR_XP[m.cr] ?? 0) * m.count)} XP
                                            </Typography>
                                            <IconButton size="small" onClick={() => setMonsters((prev) => prev.filter((x) => x.id !== m.id))} sx={{ p: 0.25, color: "text.disabled" }}>
                                                <X size={12} />
                                            </IconButton>
                                        </Box>
                                    ))}
                                </Box>
                            </Paper>
                        )}
                    </Box>

                    {/* ── Right column: Results ── */}
                    <Box sx={{ flex: "1 1 260px" }}>
                        <Paper elevation={hasMonsters ? 4 : 1} sx={{ p: 2.5, backgroundColor: hasMonsters ? "#F5E6C8" : "background.paper", border: hasMonsters ? "2px solid #8C5A3A" : "none" }}>
                            <Typography variant="overline" sx={{ color: hasMonsters ? "#6B3A1F" : "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                                Result
                            </Typography>

                            {!hasMonsters ? (
                                <Typography variant="body2" sx={{ color: "text.disabled", mt: 1 }}>
                                    Add monsters to calculate difficulty.
                                </Typography>
                            ) : (
                                <>
                                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 0.5, mt: 1.5, mb: 2 }}>
                                        {[
                                            ["Raw XP",      fmt(rawXp)],
                                            ["Multiplier",  `×${multiplier} (${monsterCount} monster${monsterCount !== 1 ? "s" : ""})`],
                                            ["Adjusted XP", fmt(adjustedXp)],
                                        ].map(([label, value]) => (
                                            <>
                                                <Typography key={`l-${label}`} variant="body2" sx={{ color: "#6B3A1F" }}>{label}</Typography>
                                                <Typography key={`v-${label}`} variant="body2" sx={{ fontWeight: 700, color: "#3E1F00", textAlign: "right" }}>{value}</Typography>
                                            </>
                                        ))}
                                    </Box>

                                    <Divider sx={{ borderColor: "#8C5A3A55", mb: 2 }} />

                                    <Typography variant="caption" sx={{ color: "#6B3A1F", letterSpacing: 1, textTransform: "uppercase", fontSize: "0.65rem", display: "block", mb: 1 }}>
                                        Party Thresholds ({partySize} chars)
                                    </Typography>

                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                                        {DIFFICULTIES.slice(1).map(({ key, label, color }, i) => {
                                            const threshold = thresholds[i];
                                            const isActive = difficulty === key;
                                            return (
                                                <Box
                                                    key={key}
                                                    sx={{
                                                        display: "flex", alignItems: "center", gap: 1,
                                                        px: 1.5, py: 0.75, borderRadius: 1,
                                                        backgroundColor: isActive ? color : `${color}22`,
                                                        border: `1px solid ${color}`,
                                                        transition: "all 0.15s",
                                                    }}
                                                >
                                                    <Typography variant="body2" sx={{ fontWeight: 700, color: isActive ? "#fff" : color, flex: 1 }}>
                                                        {label}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: isActive ? "#ffffffcc" : color, fontSize: "0.78rem" }}>
                                                        {fmt(threshold)}+ XP
                                                    </Typography>
                                                </Box>
                                            );
                                        })}
                                    </Box>

                                    {difficulty === "trivial" && (
                                        <Box sx={{ mt: 1, px: 1.5, py: 0.75, borderRadius: 1, backgroundColor: "#90a4ae22", border: "1px solid #90a4ae" }}>
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: "#546e7a" }}>
                                                Trivial — below Easy threshold
                                            </Typography>
                                        </Box>
                                    )}

                                    <Typography variant="h5" sx={{ fontWeight: 800, color: "#3E1F00", textAlign: "center", mt: 2 }}>
                                        {DIFFICULTIES.find((d) => d.key === difficulty)?.label ?? difficulty}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: "#6B3A1F", textAlign: "center", fontSize: "0.78rem" }}>
                                        {fmt(adjustedXp)} adjusted XP
                                    </Typography>
                                </>
                            )}
                        </Paper>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}
