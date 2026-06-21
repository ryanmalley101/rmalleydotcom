"use client";

import { useState } from "react";
import {
    Box, Paper, Typography, Chip, Tooltip, Collapse, Divider,
    TextField, Button, Select, MenuItem, FormControl,
} from "@mui/material";
import { Sparkles, Dices, Clock } from "lucide-react";
import { DAMAGE_TRACK_INFO, DEFAULT_CYPHER_LIMIT, type DamageTrack } from "@/lib/cypherRules";
import type { Schema } from "@/amplify/data/resource";

type PlayerCharacter = Schema["PlayerCharacter"]["type"];
type Pool = "might" | "speed" | "intellect";

interface PoolState { current: number; max: number }
export interface PartySnapshot {
    tier: number;
    xp: number;
    pools: { might: PoolState; speed: PoolState; intellect: PoolState };
    damageTrack: DamageTrack;
    cypherCount: number;
    activeArcs: string[];
}

export function snapshot(pc: PlayerCharacter): PartySnapshot {
    let snap: Record<string, unknown> = {};
    try { snap = pc.systemDataJson ? JSON.parse(pc.systemDataJson) : {}; } catch { /* ignore */ }
    const cyphers = Array.isArray(snap.cyphers) ? snap.cyphers as { used?: boolean }[] : [];
    const arcs = Array.isArray(snap.arcs) ? snap.arcs as { name?: string; status?: string }[] : [];
    return {
        tier: pc.level ?? 1,
        xp: pc.xp ?? 0,
        pools: {
            might: { current: Number(snap.currentMight ?? 10), max: Number(snap.mightPool ?? 10) },
            speed: { current: Number(snap.currentSpeed ?? 10), max: Number(snap.speedPool ?? 10) },
            intellect: { current: Number(snap.currentIntellect ?? 10), max: Number(snap.intellectPool ?? 10) },
        },
        damageTrack: (snap.damageTrack as DamageTrack) ?? "hale",
        // Used cyphers are consumed — they no longer count toward the carry limit.
        cypherCount: cyphers.filter(c => !c.used).length,
        activeArcs: arcs.filter(a => a.status === "active").map(a => a.name ?? "").filter(Boolean),
    };
}

// Simplified, paraphrased mishap table (1d6) — not a verbatim reproduction of
// any published table, just illustrative outcomes for an over-the-limit roll.
const MISHAP_OUTCOMES = [
    "No ill effect — the cypher is simply used up.",
    "Minor discomfort: hindered on your next task.",
    "The effect happens, but partially backfires on you.",
    "A loud, attention-drawing reaction — light, sound, or smell gives you away.",
    "You take damage equal to the cypher's level.",
    "Something nearby is damaged or destroyed by the backlash.",
];

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
    onAwardXp: (pcId: string, amount: number) => void;
    onAdjustPool: (pcId: string, pool: Pool, delta: number) => void;
}

export function PartyCard({ pc, isSpotlight, onAwardXp, onAdjustPool }: PartyCardProps) {
    const [showFriend, setShowFriend] = useState(false);
    const [amount, setAmount] = useState("");
    const [pool, setPool] = useState<Pool>("might");
    const [mishapResult, setMishapResult] = useState<string | null>(null);
    const snap = snapshot(pc);
    const dmg = DAMAGE_TRACK_INFO[snap.damageTrack];
    const overLimit = snap.cypherCount > DEFAULT_CYPHER_LIMIT;

    function applyDelta(sign: 1 | -1) {
        const n = parseInt(amount, 10);
        if (isNaN(n) || n <= 0) return;
        onAdjustPool(pc.id, pool, sign * n);
        setAmount("");
    }

    function rollMishap() {
        const roll = Math.floor(Math.random() * 6) + 1;
        setMishapResult(`Rolled ${roll}: ${MISHAP_OUTCOMES[roll - 1]}`);
    }

    return (
        <Paper elevation={isSpotlight ? 6 : 1}
            sx={{ p: 1.5, mb: 1.5, borderLeft: "4px solid", borderLeftColor: dmg.color,
                outline: isSpotlight ? "2px solid #f59e0b" : "none", outlineOffset: 1,
                transition: "outline 0.3s, box-shadow 0.3s" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Typography variant="body1" sx={{ fontWeight: 700, color: "primary.dark", flex: 1, minWidth: 100 }}>
                    {pc.characterName}
                </Typography>
                <Chip label={`Tier ${snap.tier}`} size="small" sx={{ backgroundColor: "primary.dark", color: "#fff", fontSize: "0.65rem", height: 20 }} />
                <Chip label={`${snap.xp} XP`} size="small" variant="outlined" sx={{ fontSize: "0.65rem", height: 20 }} />
                <Chip label={dmg.label} size="small" sx={{ backgroundColor: dmg.color, color: "#fff", fontSize: "0.65rem", height: 20 }} />
                {overLimit && (
                    <Tooltip title={`Carrying ${snap.cypherCount} cyphers — over the default limit of ${DEFAULT_CYPHER_LIMIT}`}>
                        <Chip label={`${snap.cypherCount} cyphers ⚠`} size="small" color="warning" sx={{ fontSize: "0.65rem", height: 20 }} />
                    </Tooltip>
                )}
                {overLimit && (
                    <Tooltip title="Roll a simplified cypher mishap (1d6)">
                        <Button size="small" startIcon={<Dices size={12} />} onClick={rollMishap}
                            sx={{ fontSize: "0.65rem", color: "warning.main", minWidth: 0, px: 1 }}>
                            Mishap
                        </Button>
                    </Tooltip>
                )}
                <Tooltip title="GM Intrusion — award 1 XP">
                    <Button size="small" startIcon={<Sparkles size={12} />}
                        onClick={() => { onAwardXp(pc.id, 1); setShowFriend(true); }}
                        sx={{ fontSize: "0.65rem", color: "#7c3aed", minWidth: 0, px: 1 }}>
                        Intrusion
                    </Button>
                </Tooltip>
                <Tooltip title="Last updated">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, color: "text.disabled" }}>
                        <Clock size={11} />
                        <Typography variant="caption" sx={{ fontSize: "0.65rem" }}>{timeAgo(pc.updatedAt)}</Typography>
                    </Box>
                </Tooltip>
            </Box>

            <Box sx={{ display: "flex", gap: 2.5, mt: 1, flexWrap: "wrap" }}>
                {(["might", "speed", "intellect"] as const).map(p => {
                    const ps = snap.pools[p];
                    const pct = ps.max > 0 ? (ps.current / ps.max) * 100 : 0;
                    const barColor = pct > 50 ? "success.main" : pct > 25 ? "warning.main" : "error.main";
                    return (
                        <Box key={p} sx={{ minWidth: 80 }}>
                            <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "capitalize" }}>{p}</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: barColor }}>{ps.current}/{ps.max}</Typography>
                            <Box sx={{ width: 72, height: 4, borderRadius: 2, backgroundColor: "#e0e0e0", overflow: "hidden" }}>
                                <Box sx={{ height: "100%", width: `${pct}%`, backgroundColor: barColor }} />
                            </Box>
                        </Box>
                    );
                })}
                {snap.activeArcs.length > 0 && (
                    <Box sx={{ flex: 1, minWidth: 140 }}>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>Active Arcs</Typography>
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.25 }}>
                            {snap.activeArcs.map(name => (
                                <Chip key={name} label={name} size="small" sx={{ backgroundColor: "#00695c", color: "#fff", fontSize: "0.6rem", height: 18 }} />
                            ))}
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Direct pool damage/heal */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1 }}>
                <TextField size="small" placeholder="Amt" value={amount}
                    onChange={e => setAmount(e.target.value.replace(/\D/g, ""))}
                    sx={{ width: 56, "& input": { py: 0.4, fontSize: "0.8rem" } }} />
                <FormControl size="small" sx={{ minWidth: 88 }}>
                    <Select value={pool} onChange={e => setPool(e.target.value as Pool)}
                        sx={{ fontSize: "0.75rem", "& .MuiSelect-select": { py: 0.5 } }}>
                        <MenuItem value="might">Might</MenuItem>
                        <MenuItem value="speed">Speed</MenuItem>
                        <MenuItem value="intellect">Intellect</MenuItem>
                    </Select>
                </FormControl>
                <Button size="small" variant="outlined" onClick={() => applyDelta(-1)}
                    sx={{ minWidth: 0, px: 1.25, py: 0.4, color: "error.main", borderColor: "error.main", fontSize: "0.7rem" }}>
                    Dmg
                </Button>
                <Button size="small" variant="outlined" onClick={() => applyDelta(1)}
                    sx={{ minWidth: 0, px: 1.25, py: 0.4, color: "success.main", borderColor: "success.main", fontSize: "0.7rem" }}>
                    Heal
                </Button>
            </Box>

            <Collapse in={!!mishapResult}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" sx={{ color: "warning.main", display: "block" }}>{mishapResult}</Typography>
                <Button size="small" onClick={() => setMishapResult(null)} sx={{ fontSize: "0.65rem", mt: 0.5 }}>Dismiss</Button>
            </Collapse>

            <Collapse in={showFriend}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
                    +1 XP awarded to {pc.characterName}. Give the second point to a friend, or skip:
                </Typography>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    <Chip label="Skip (keep just 1)" size="small" variant="outlined"
                        onClick={() => setShowFriend(false)} sx={{ fontSize: "0.68rem" }} />
                </Box>
            </Collapse>
        </Paper>
    );
}
