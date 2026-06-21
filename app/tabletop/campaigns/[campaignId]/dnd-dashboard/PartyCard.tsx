"use client";

import { useState } from "react";
import {
    Box, Paper, Typography, Chip, Tooltip, Collapse, Divider,
    TextField, Button, IconButton, Autocomplete,
} from "@mui/material";
import { Star, Clock, Plus, X } from "lucide-react";
import { CONDITION_COLOR, CONDITION_NAMES } from "@/lib/dndConditions";
import type { Schema } from "@/amplify/data/resource";

type PlayerCharacter = Schema["PlayerCharacter"]["type"];

export interface PartySnapshot {
    classLabel: string;
    hp: { current: number; max: number; temp: number };
    ac: number;
    conditions: string[];
    exhaustion: number;
    downed: boolean;
}

export function snapshot(pc: PlayerCharacter): PartySnapshot {
    let conditions: string[] = [];
    try { conditions = pc.conditionsJson ? JSON.parse(pc.conditionsJson) : []; } catch { /* ignore */ }
    const current = pc.currentHp ?? 0;
    const max = pc.maxHp ?? 1;
    return {
        classLabel: [pc.characterClass, pc.level ? `${pc.level}` : null].filter(Boolean).join(" "),
        hp: { current, max, temp: pc.tempHp ?? 0 },
        ac: pc.armorClass ?? 10,
        conditions,
        exhaustion: pc.exhaustion ?? 0,
        downed: current <= 0,
    };
}

function timeAgo(iso: string | null | undefined): string {
    if (!iso) return "never";
    const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

interface PartyCardProps {
    pc: PlayerCharacter;
    isSpotlight: boolean;
    onUpdate: (pcId: string, patch: Partial<PlayerCharacter>) => void;
}

export function PartyCard({ pc, isSpotlight, onUpdate }: PartyCardProps) {
    const [amount, setAmount] = useState("");
    const [concInput, setConcInput] = useState(pc.concentratingOn ?? "");
    const [concDC, setConcDC] = useState<number | null>(null);
    const snap = snapshot(pc);
    const hpPct = snap.hp.max > 0 ? (snap.hp.current / snap.hp.max) * 100 : 0;
    const hpColor = hpPct > 50 ? "#2e7d32" : hpPct > 25 ? "#f57c00" : "#c62828";

    function applyDamage(n: number) {
        const tempHp = pc.tempHp ?? 0;
        const currentHp = pc.currentHp ?? 0;
        const maxHp = pc.maxHp ?? 1;
        const absorbed = Math.min(tempHp, n);
        const remaining = n - absorbed;
        const newCurrent = Math.max(0, currentHp - remaining);
        const patch: Partial<PlayerCharacter> = { tempHp: tempHp - absorbed, currentHp: newCurrent };

        let conditions = snap.conditions;
        if (currentHp > 0 && newCurrent === 0) {
            conditions = conditions.includes("Unconscious") ? conditions : [...conditions, "Unconscious"];
            patch.conditionsJson = JSON.stringify(conditions);
            const overkill = remaining - currentHp;
            if (overkill >= maxHp) patch.deathSaveFailures = 3; // instant death — massive damage
        }
        onUpdate(pc.id, patch);
        if (pc.concentratingOn) setConcDC(Math.max(10, Math.floor(n / 2)));
    }

    function applyHeal(n: number) {
        const currentHp = pc.currentHp ?? 0;
        const maxHp = pc.maxHp ?? 1;
        const newCurrent = Math.min(maxHp, currentHp + n);
        const patch: Partial<PlayerCharacter> = { currentHp: newCurrent };
        if (currentHp <= 0 && newCurrent > 0) {
            patch.deathSaveSuccesses = 0;
            patch.deathSaveFailures = 0;
            patch.conditionsJson = JSON.stringify(snap.conditions.filter(c => c !== "Unconscious"));
        }
        onUpdate(pc.id, patch);
    }

    function applyDelta(sign: 1 | -1) {
        const n = parseInt(amount, 10);
        if (isNaN(n) || n <= 0) return;
        if (sign === -1) applyDamage(n); else applyHeal(n);
        setAmount("");
    }

    function toggleCondition(name: string | null) {
        if (!name || snap.conditions.includes(name)) return;
        onUpdate(pc.id, { conditionsJson: JSON.stringify([...snap.conditions, name]) });
    }
    function removeCondition(name: string) {
        onUpdate(pc.id, { conditionsJson: JSON.stringify(snap.conditions.filter(c => c !== name)) });
    }

    function saveConcentration() {
        onUpdate(pc.id, { concentratingOn: concInput.trim() || null });
    }

    function adjustDeathSave(kind: "success" | "failure", delta: number) {
        if (kind === "success") {
            onUpdate(pc.id, { deathSaveSuccesses: Math.max(0, Math.min(3, (pc.deathSaveSuccesses ?? 0) + delta)) });
        } else {
            onUpdate(pc.id, { deathSaveFailures: Math.max(0, Math.min(3, (pc.deathSaveFailures ?? 0) + delta)) });
        }
    }

    function adjustExhaustion(delta: number) {
        onUpdate(pc.id, { exhaustion: Math.max(0, Math.min(6, snap.exhaustion + delta)) });
    }

    const successes = pc.deathSaveSuccesses ?? 0;
    const failures = pc.deathSaveFailures ?? 0;
    const deceased = failures >= 3;
    const stable = successes >= 3;

    return (
        <Paper elevation={isSpotlight ? 6 : 1}
            sx={{ p: 1.5, mb: 1.5, borderLeft: "4px solid", borderLeftColor: hpColor,
                outline: isSpotlight ? "2px solid #f59e0b" : "none", outlineOffset: 1,
                transition: "outline 0.3s, box-shadow 0.3s" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Typography variant="body1" sx={{ fontWeight: 700, color: "primary.dark", flex: 1, minWidth: 100 }}>
                    {pc.characterName}
                </Typography>
                {snap.classLabel && (
                    <Chip label={snap.classLabel} size="small" sx={{ backgroundColor: "primary.dark", color: "#fff", fontSize: "0.65rem", height: 20 }} />
                )}
                <Chip label={`AC ${snap.ac}`} size="small" variant="outlined" sx={{ fontSize: "0.65rem", height: 20 }} />
                <Tooltip title="Toggle Inspiration">
                    <IconButton size="small" onClick={() => onUpdate(pc.id, { inspiration: !pc.inspiration })}
                        sx={{ p: 0.25, color: pc.inspiration ? "#f9a825" : "text.disabled" }}>
                        <Star size={16} fill={pc.inspiration ? "#f9a825" : "none"} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Last updated">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, color: "text.disabled" }}>
                        <Clock size={11} />
                        <Typography variant="caption" sx={{ fontSize: "0.65rem" }}>{timeAgo(pc.updatedAt)}</Typography>
                    </Box>
                </Tooltip>
            </Box>

            {deceased && <Chip label="DECEASED" size="small" color="error" sx={{ mt: 1, fontWeight: 700 }} />}
            {!deceased && stable && <Chip label="STABLE (unconscious)" size="small" color="warning" sx={{ mt: 1, fontWeight: 700 }} />}

            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 1 }}>
                <Box sx={{ minWidth: 120 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: hpColor }}>
                        {snap.hp.current}/{snap.hp.max} HP{snap.hp.temp > 0 && ` (+${snap.hp.temp} temp)`}
                    </Typography>
                    <Box sx={{ width: 140, height: 6, borderRadius: 3, backgroundColor: "#e0e0e0", overflow: "hidden", position: "relative" }}>
                        <Box sx={{ height: "100%", width: `${hpPct}%`, backgroundColor: hpColor }} />
                    </Box>
                </Box>
                {snap.exhaustion > 0 && (
                    <Tooltip title="Exhaustion level">
                        <Chip label={`Exhaustion ${snap.exhaustion}`} size="small" color="warning" sx={{ fontSize: "0.65rem", height: 20 }} />
                    </Tooltip>
                )}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                    <IconButton size="small" sx={{ p: 0.15 }} onClick={() => adjustExhaustion(-1)}>
                        <Typography variant="caption">−</Typography>
                    </IconButton>
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>exhaustion</Typography>
                    <IconButton size="small" sx={{ p: 0.15 }} onClick={() => adjustExhaustion(1)}>
                        <Typography variant="caption">+</Typography>
                    </IconButton>
                </Box>
            </Box>

            {/* Conditions */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1, flexWrap: "wrap" }}>
                {snap.conditions.map(c => (
                    <Chip key={c} label={c} size="small" onDelete={() => removeCondition(c)}
                        sx={{ backgroundColor: CONDITION_COLOR[c] ?? "#607d8b", color: "#fff", fontSize: "0.62rem", height: 20 }} />
                ))}
                <Autocomplete size="small" options={CONDITION_NAMES.filter(n => !snap.conditions.includes(n))}
                    onChange={(_, v) => toggleCondition(v)} value={null} blurOnSelect clearOnBlur
                    renderInput={(params) => <TextField {...params} placeholder="Add condition…" variant="standard" sx={{ width: 140, "& input": { fontSize: "0.75rem" } }} />} />
            </Box>

            {/* Death saves — only relevant at 0 HP */}
            {snap.downed && !deceased && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Typography variant="caption" sx={{ color: "success.main" }}>Saves</Typography>
                        {[0, 1, 2].map(i => (
                            <Box key={i} onClick={() => adjustDeathSave("success", i < successes ? -1 : 1)}
                                sx={{ width: 14, height: 14, borderRadius: "50%", cursor: "pointer",
                                    border: "1px solid", borderColor: "success.main",
                                    backgroundColor: i < successes ? "success.main" : "transparent" }} />
                        ))}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Typography variant="caption" sx={{ color: "error.main" }}>Fails</Typography>
                        {[0, 1, 2].map(i => (
                            <Box key={i} onClick={() => adjustDeathSave("failure", i < failures ? -1 : 1)}
                                sx={{ width: 14, height: 14, borderRadius: "50%", cursor: "pointer",
                                    border: "1px solid", borderColor: "error.main",
                                    backgroundColor: i < failures ? "error.main" : "transparent" }} />
                        ))}
                    </Box>
                </Box>
            )}

            {/* Concentration */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1 }}>
                <TextField size="small" placeholder="Concentrating on…" value={concInput}
                    onChange={e => setConcInput(e.target.value)} onBlur={saveConcentration}
                    onKeyDown={e => { if (e.key === "Enter") saveConcentration(); }}
                    sx={{ flex: 1, maxWidth: 220, "& input": { py: 0.4, fontSize: "0.75rem" } }} />
                {pc.concentratingOn && (
                    <IconButton size="small" onClick={() => { setConcInput(""); onUpdate(pc.id, { concentratingOn: null }); }} sx={{ p: 0.25 }}>
                        <X size={13} />
                    </IconButton>
                )}
            </Box>

            {/* Direct HP damage/heal */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1 }}>
                <TextField size="small" placeholder="Amt" value={amount}
                    onChange={e => setAmount(e.target.value.replace(/\D/g, ""))}
                    sx={{ width: 56, "& input": { py: 0.4, fontSize: "0.8rem" } }} />
                <Button size="small" variant="outlined" onClick={() => applyDelta(-1)}
                    sx={{ minWidth: 0, px: 1.25, py: 0.4, color: "error.main", borderColor: "error.main", fontSize: "0.7rem" }}>
                    Dmg
                </Button>
                <Button size="small" variant="outlined" onClick={() => applyDelta(1)}
                    sx={{ minWidth: 0, px: 1.25, py: 0.4, color: "success.main", borderColor: "success.main", fontSize: "0.7rem" }}>
                    Heal
                </Button>
            </Box>

            <Collapse in={concDC !== null}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" sx={{ color: "warning.main", display: "block" }}>
                    Concentration check: DC {concDC} (Constitution save) to keep "{pc.concentratingOn}".
                </Typography>
                <Button size="small" onClick={() => setConcDC(null)} sx={{ fontSize: "0.65rem", mt: 0.5 }}>Dismiss</Button>
            </Collapse>
        </Paper>
    );
}
