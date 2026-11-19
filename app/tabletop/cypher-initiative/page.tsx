"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Box, Container, Button, Typography, TextField, Select, MenuItem,
    FormControl, InputLabel, LinearProgress, Paper, Chip,
    Divider, Collapse, Autocomplete,
} from "@mui/material";
import {
    ArrowLeft, ListOrdered, Plus, X, Trash2,
    Users, Crown, ArrowRightLeft, CheckCircle2, Circle,
} from "lucide-react";
import Link from "next/link";
import { loadCreatures, type CreatureSrd } from "@/lib/cypherSrd";
import { DAMAGE_TRACK_INFO, type DamageTrack } from "@/lib/cypherRules";

// ── Types ─────────────────────────────────────────────────────────────────────
//
// Cypher System combat doesn't use a rolled, interleaved initiative order like
// D&D — the rules are: all PCs act in a round, in whatever order the players
// choose, then the GM's NPCs act. So instead of a single sorted list keyed on
// an initiative number, this tracks two phases (Players / GM) with an "acted"
// checkbox per combatant to help a GM running a big fight keep track of who's
// gone within a phase.

type CombatantType = "pc" | "enemy" | "ally" | "neutral";
type Phase = "players" | "gm";
type PcStatus = DamageTrack | "dead";
type Pool = "might" | "speed" | "intellect";

interface PoolState { current: number; max: number; }

interface Combatant {
    id: string;
    name: string;
    type: CombatantType;
    armor: number;
    acted: boolean;
    conditions: string[];
    dead: boolean;
    // PCs track three pools; NPCs/creatures track one Health pool + Level.
    pools?: { might: PoolState; speed: PoolState; intellect: PoolState };
    level?: number;
    health?: PoolState;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CYPHER_CONDITIONS = [
    "Hindered", "Stunned", "Dazed", "Confused", "Prone", "Held",
    "Grabbed", "Entangled", "Invisible", "Poisoned", "Diseased",
    "Blinded", "Deafened", "Frightened", "Distracted", "Slowed",
];

const TYPE_COLOR: Record<CombatantType, string> = {
    pc:      "#1565c0",
    enemy:   "#b71c1c",
    ally:    "#2e7d32",
    neutral: "#546e7a",
};

const TYPE_LABEL: Record<CombatantType, string> = {
    pc: "PC", enemy: "Enemy", ally: "Ally", neutral: "NPC",
};

const STATUS_INFO: Record<PcStatus, { label: string; color: string }> = {
    hale:        { label: DAMAGE_TRACK_INFO.hale.label,        color: DAMAGE_TRACK_INFO.hale.color },
    impaired:    { label: DAMAGE_TRACK_INFO.impaired.label,    color: DAMAGE_TRACK_INFO.impaired.color },
    debilitated: { label: DAMAGE_TRACK_INFO.debilitated.label, color: DAMAGE_TRACK_INFO.debilitated.color },
    dead:        { label: "Dead",                              color: "#424242" },
};

function uid() { return Math.random().toString(36).slice(2, 9); }

function poolColor(current: number, max: number): string {
    if (current <= 0) return "#9e9e9e";
    const pct = current / max;
    if (pct > 0.5) return "#2e7d32";
    if (pct > 0.25) return "#f57c00";
    return "#c62828";
}

function pcStatus(c: Combatant): PcStatus {
    if (c.dead) return "dead";
    const pools = c.pools!;
    const zeroed = [pools.might, pools.speed, pools.intellect].filter(p => p.current <= 0).length;
    if (zeroed >= 3) return "dead";
    if (zeroed === 2) return "debilitated";
    if (zeroed === 1) return "impaired";
    return "hale";
}

const STORAGE_KEY = "cypher-initiative-tracker-v1";

// ── Shared bits ───────────────────────────────────────────────────────────────

function ActedToggle({ acted, onToggle, color }: { acted: boolean; onToggle: () => void; color: string }) {
    return (
        <Button
            size="small" onClick={onToggle}
            title={acted ? "Mark as not yet acted" : "Mark as acted this phase"}
            sx={{ minWidth: 0, p: 0.25, color: acted ? color : "text.disabled" }}
        >
            {acted ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </Button>
    );
}

function ConditionBlock({ conditions, showPicker, onTogglePicker, onToggleCondition }: {
    conditions: string[]; showPicker: boolean;
    onTogglePicker: () => void; onToggleCondition: (cond: string) => void;
}) {
    return (
        <>
            {conditions.length > 0 && !showPicker && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                    {conditions.map((c) => (
                        <Chip
                            key={c} label={c} size="small"
                            onDelete={() => onToggleCondition(c)}
                            sx={{ backgroundColor: "#8C5A3A33", fontSize: "0.68rem", height: 20 }}
                        />
                    ))}
                </Box>
            )}
            <Collapse in={showPicker}>
                <Divider sx={{ my: 0.75 }} />
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {CYPHER_CONDITIONS.map((c) => {
                        const active = conditions.includes(c);
                        return (
                            <Chip
                                key={c} label={c} size="small"
                                onClick={() => onToggleCondition(c)}
                                variant={active ? "filled" : "outlined"}
                                sx={{
                                    fontSize: "0.68rem", height: 20, cursor: "pointer",
                                    ...(active && { backgroundColor: "#8C5A3A", color: "#fff" }),
                                }}
                            />
                        );
                    })}
                </Box>
            </Collapse>
            <Button
                size="small" onClick={onTogglePicker}
                sx={{ mt: 0.5, fontSize: "0.7rem", color: "text.secondary", minWidth: 0, px: 1 }}
            >
                {showPicker ? "▲ Conditions" : "▼ Conditions"}
            </Button>
        </>
    );
}

// ── PC row ────────────────────────────────────────────────────────────────────

interface RowCallbacks {
    onToggleActed: (id: string) => void;
    onAdjustPool: (id: string, pool: Pool, delta: number) => void;
    onSetHealth: (id: string, hp: number) => void;
    onAdjustHealth: (id: string, delta: number) => void;
    onToggleDead: (id: string) => void;
    onToggleCondition: (id: string, cond: string) => void;
    onRemove: (id: string) => void;
}

function PcRow({ c, cb }: { c: Combatant; cb: RowCallbacks }) {
    const [amt, setAmt] = useState("");
    const [pool, setPool] = useState<Pool>("might");
    const [showConds, setShowConds] = useState(false);
    const status = pcStatus(c);
    const info = STATUS_INFO[status];
    const color = TYPE_COLOR.pc;

    function applyDelta(sign: 1 | -1) {
        const n = parseInt(amt, 10);
        if (!isNaN(n) && n > 0) { cb.onAdjustPool(c.id, pool, sign * n); setAmt(""); }
    }

    return (
        <Paper elevation={c.acted ? 1 : 3} sx={{
            borderLeft: `5px solid ${color}`, borderRadius: "4px 8px 8px 4px", mb: 1.5,
            opacity: status === "dead" ? 0.45 : c.acted ? 0.75 : 1,
        }}>
            <Box sx={{ p: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
                    <ActedToggle acted={c.acted} onToggle={() => cb.onToggleActed(c.id)} color={color} />
                    <Typography sx={{ fontWeight: 600, flex: 1, color: "text.primary", minWidth: 100 }}>
                        {c.name}{status === "dead" && " ✝"}
                    </Typography>
                    <Chip label="PC" size="small"
                        sx={{ backgroundColor: color, color: "#fff", fontWeight: 700, fontSize: "0.65rem", height: 18 }} />
                    <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                        Armor {c.armor}
                    </Typography>
                    <Chip label={info.label} size="small"
                        sx={{ backgroundColor: info.color, color: "#fff", fontSize: "0.65rem", height: 18 }} />
                    <Button size="small" onClick={() => cb.onToggleDead(c.id)}
                        sx={{ fontSize: "0.65rem", color: "text.disabled", minWidth: 0, px: 0.75 }}>
                        {c.dead ? "Revive" : "Mark Dead"}
                    </Button>
                    <Button size="small" onClick={() => cb.onRemove(c.id)}
                        sx={{ minWidth: 0, p: 0.25, color: "text.disabled", "&:hover": { color: "error.main" } }}>
                        <X size={14} />
                    </Button>
                </Box>

                {/* Pool bars */}
                <Box sx={{ display: "flex", gap: 2.5, mt: 1, mb: 1, flexWrap: "wrap" }}>
                    {(["might", "speed", "intellect"] as const).map((p) => {
                        const ps = c.pools![p];
                        const pct = ps.max > 0 ? (ps.current / ps.max) * 100 : 0;
                        const barColor = poolColor(ps.current, ps.max);
                        return (
                            <Box key={p} sx={{ minWidth: 76 }}>
                                <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "capitalize" }}>
                                    {p}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: barColor, lineHeight: 1.3 }}>
                                    {ps.current}/{ps.max}
                                </Typography>
                                <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, pct))}
                                    sx={{
                                        width: 72, height: 4, borderRadius: 2, backgroundColor: "#e0e0e0",
                                        "& .MuiLinearProgress-bar": { backgroundColor: barColor },
                                    }} />
                            </Box>
                        );
                    })}
                </Box>

                {/* Damage / Heal controls */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TextField size="small" placeholder="Amt" value={amt}
                        onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))}
                        onKeyDown={(e) => { if (e.key === "Enter") applyDelta(-1); }}
                        sx={{ width: 64, "& input": { py: 0.5, fontSize: "0.85rem" } }} />
                    <FormControl size="small" sx={{ minWidth: 96 }}>
                        <Select value={pool} onChange={(e) => setPool(e.target.value as Pool)}
                            sx={{ fontSize: "0.78rem", "& .MuiSelect-select": { py: 0.6 } }}>
                            <MenuItem value="might">Might</MenuItem>
                            <MenuItem value="speed">Speed</MenuItem>
                            <MenuItem value="intellect">Intellect</MenuItem>
                        </Select>
                    </FormControl>
                    <Button size="small" variant="outlined" onClick={() => applyDelta(-1)}
                        sx={{ minWidth: 0, px: 1.5, py: 0.5, color: "error.main", borderColor: "error.main", fontSize: "0.75rem" }}>
                        Dmg
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => applyDelta(1)}
                        sx={{ minWidth: 0, px: 1.5, py: 0.5, color: "success.main", borderColor: "success.main", fontSize: "0.75rem" }}>
                        Heal
                    </Button>
                </Box>

                <ConditionBlock
                    conditions={c.conditions} showPicker={showConds}
                    onTogglePicker={() => setShowConds((v) => !v)}
                    onToggleCondition={(cond) => cb.onToggleCondition(c.id, cond)}
                />
            </Box>
        </Paper>
    );
}

// ── NPC / creature row ───────────────────────────────────────────────────────

function CreatureRow({ c, cb }: { c: Combatant; cb: RowCallbacks }) {
    const [amt, setAmt] = useState("");
    const [showConds, setShowConds] = useState(false);
    const [editingHp, setEditingHp] = useState(false);
    const [hpDraft, setHpDraft] = useState("");
    const color = TYPE_COLOR[c.type];
    const hp = c.health!;
    const hpPct = hp.max > 0 ? Math.max(0, Math.min(100, (hp.current / hp.max) * 100)) : 0;
    const isDown = c.dead || hp.current <= 0;
    const tn = (c.level ?? 1) * 3;

    function applyDelta(sign: 1 | -1) {
        const n = parseInt(amt, 10);
        if (!isNaN(n) && n > 0) { cb.onAdjustHealth(c.id, sign * n); setAmt(""); }
    }
    function commitHp() {
        const n = parseInt(hpDraft, 10);
        if (!isNaN(n)) cb.onSetHealth(c.id, n);
        setEditingHp(false);
    }

    return (
        <Paper elevation={c.acted ? 1 : 3} sx={{
            borderLeft: `5px solid ${color}`, borderRadius: "4px 8px 8px 4px", mb: 1.5,
            opacity: isDown ? 0.5 : c.acted ? 0.75 : 1,
        }}>
            <Box sx={{ p: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
                    <ActedToggle acted={c.acted} onToggle={() => cb.onToggleActed(c.id)} color={color} />
                    <Typography sx={{ fontWeight: 600, flex: 1, color: isDown ? "text.disabled" : "text.primary", minWidth: 100 }}>
                        {c.name}{c.dead && " ✝"}
                    </Typography>
                    <Chip label={TYPE_LABEL[c.type]} size="small"
                        sx={{ backgroundColor: color, color: "#fff", fontWeight: 700, fontSize: "0.65rem", height: 18 }} />
                    <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                        Lvl {c.level} (TN {tn})
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                        Armor {c.armor}
                    </Typography>
                    {editingHp ? (
                        <TextField size="small" autoFocus value={hpDraft}
                            onChange={(e) => setHpDraft(e.target.value.replace(/\D/g, ""))}
                            onBlur={commitHp}
                            onKeyDown={(e) => { if (e.key === "Enter") commitHp(); if (e.key === "Escape") setEditingHp(false); }}
                            sx={{ width: 64, "& input": { py: 0.4, fontSize: "0.85rem", textAlign: "center" } }} />
                    ) : (
                        <Typography variant="body2"
                            onClick={() => { setHpDraft(String(hp.current)); setEditingHp(true); }}
                            title="Click to set Health directly"
                            sx={{ color: poolColor(hp.current, hp.max), fontWeight: 700, cursor: "text", userSelect: "none", whiteSpace: "nowrap" }}>
                            {hp.current}/{hp.max} HP
                        </Typography>
                    )}
                    <Button size="small" onClick={() => cb.onToggleDead(c.id)}
                        sx={{ fontSize: "0.65rem", color: "text.disabled", minWidth: 0, px: 0.75 }}>
                        {c.dead ? "Revive" : "Mark Dead"}
                    </Button>
                    <Button size="small" onClick={() => cb.onRemove(c.id)}
                        sx={{ minWidth: 0, p: 0.25, color: "text.disabled", "&:hover": { color: "error.main" } }}>
                        <X size={14} />
                    </Button>
                </Box>

                <LinearProgress variant="determinate" value={hpPct} sx={{
                    mt: 0.75, mb: 1, height: 5, borderRadius: 3, backgroundColor: "#e0e0e0",
                    "& .MuiLinearProgress-bar": { backgroundColor: poolColor(hp.current, hp.max) },
                }} />

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TextField size="small" placeholder="Amt" value={amt}
                        onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))}
                        onKeyDown={(e) => { if (e.key === "Enter") applyDelta(-1); }}
                        sx={{ width: 68, "& input": { py: 0.5, fontSize: "0.85rem" } }} />
                    <Button size="small" variant="outlined" onClick={() => applyDelta(-1)}
                        sx={{ minWidth: 0, px: 1.5, py: 0.5, color: "error.main", borderColor: "error.main", fontSize: "0.75rem" }}>
                        Dmg
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => applyDelta(1)}
                        sx={{ minWidth: 0, px: 1.5, py: 0.5, color: "success.main", borderColor: "success.main", fontSize: "0.75rem" }}>
                        Heal
                    </Button>
                </Box>

                <ConditionBlock
                    conditions={c.conditions} showPicker={showConds}
                    onTogglePicker={() => setShowConds((v) => !v)}
                    onToggleCondition={(cond) => cb.onToggleCondition(c.id, cond)}
                />
            </Box>
        </Paper>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
    name: "", type: "enemy" as CombatantType, armor: "0",
    level: "3", health: "10",
    might: "10", speed: "10", intellect: "10",
};

export default function CypherInitiativePage() {
    const [combatants, setCombatants] = useState<Combatant[]>([]);
    const [phase, setPhase] = useState<Phase>("players");
    const [round, setRound] = useState(1);
    const [form, setForm] = useState(EMPTY_FORM);
    const [creatures, setCreatures] = useState<CreatureSrd[]>([]);

    // Fetch creature SRD list for quick-add
    useEffect(() => {
        loadCreatures().then(setCreatures).catch(() => {});
    }, []);

    // Persist to localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const s = JSON.parse(saved);
                setCombatants(s.combatants ?? []);
                setPhase(s.phase ?? "players");
                setRound(s.round ?? 1);
            }
        } catch {}
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ combatants, phase, round }));
        } catch {}
    }, [combatants, phase, round]);

    const pcs = combatants.filter((c) => c.type === "pc");
    const npcs = combatants.filter((c) => c.type !== "pc");

    function addCombatant() {
        if (!form.name.trim()) return;
        const armor = parseInt(form.armor, 10) || 0;
        const id = uid();
        let next: Combatant;
        if (form.type === "pc") {
            const might = parseInt(form.might, 10);
            const speed = parseInt(form.speed, 10);
            const intellect = parseInt(form.intellect, 10);
            if (isNaN(might) || isNaN(speed) || isNaN(intellect)) return;
            next = {
                id, name: form.name.trim(), type: "pc", armor, acted: false, conditions: [], dead: false,
                pools: {
                    might: { current: might, max: might },
                    speed: { current: speed, max: speed },
                    intellect: { current: intellect, max: intellect },
                },
            };
        } else {
            const level = parseInt(form.level, 10);
            const health = parseInt(form.health, 10);
            if (isNaN(level) || isNaN(health)) return;
            next = {
                id, name: form.name.trim(), type: form.type, armor, acted: false, conditions: [], dead: false,
                level, health: { current: health, max: health },
            };
        }
        setCombatants((prev) => [...prev, next]);
        setForm(EMPTY_FORM);
    }

    const toggleActed = useCallback((id: string) => {
        setCombatants((prev) => prev.map((c) => c.id === id ? { ...c, acted: !c.acted } : c));
    }, []);

    const adjustPool = useCallback((id: string, pool: Pool, delta: number) => {
        setCombatants((prev) => prev.map((c) => {
            if (c.id !== id || !c.pools) return c;
            const ps = c.pools[pool];
            const nextCurrent = Math.min(ps.max, Math.max(0, ps.current + delta));
            return { ...c, pools: { ...c.pools, [pool]: { ...ps, current: nextCurrent } } };
        }));
    }, []);

    const setHealth = useCallback((id: string, hp: number) => {
        setCombatants((prev) => prev.map((c) => {
            if (c.id !== id || !c.health) return c;
            return { ...c, health: { ...c.health, current: Math.min(c.health.max, Math.max(0, hp)) } };
        }));
    }, []);

    const adjustHealth = useCallback((id: string, delta: number) => {
        setCombatants((prev) => prev.map((c) => {
            if (c.id !== id || !c.health) return c;
            const nextCurrent = Math.min(c.health.max, Math.max(0, c.health.current + delta));
            return { ...c, health: { ...c.health, current: nextCurrent } };
        }));
    }, []);

    const toggleDead = useCallback((id: string) => {
        setCombatants((prev) => prev.map((c) => c.id === id ? { ...c, dead: !c.dead } : c));
    }, []);

    const toggleCondition = useCallback((id: string, cond: string) => {
        setCombatants((prev) => prev.map((c) =>
            c.id === id
                ? { ...c, conditions: c.conditions.includes(cond) ? c.conditions.filter((x) => x !== cond) : [...c.conditions, cond] }
                : c
        ));
    }, []);

    const removeCombatant = useCallback((id: string) => {
        setCombatants((prev) => prev.filter((c) => c.id !== id));
    }, []);

    function advancePhase() {
        const nextPhase: Phase = phase === "players" ? "gm" : "players";
        const nextRound = nextPhase === "players" ? round + 1 : round;
        setCombatants((prev) => prev.map((c) => {
            const inNextGroup = nextPhase === "players" ? c.type === "pc" : c.type !== "pc";
            return inNextGroup ? { ...c, acted: false } : c;
        }));
        setPhase(nextPhase);
        setRound(nextRound);
    }

    function clearAll() {
        setCombatants([]);
        setPhase("players");
        setRound(1);
    }

    const cb: RowCallbacks = {
        onToggleActed: toggleActed, onAdjustPool: adjustPool, onSetHealth: setHealth,
        onAdjustHealth: adjustHealth, onToggleDead: toggleDead,
        onToggleCondition: toggleCondition, onRemove: removeCombatant,
    };

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href="/tabletop" startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                    <ListOrdered size={32} color="#8C5A3A" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        Cypher Combat Tracker
                    </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    The Cypher System doesn&apos;t roll individual initiative — all PCs act first, in whatever order the
                    players choose, then the GM&apos;s NPCs act. Track pools, Health, and who&apos;s gone each phase here.
                    State is saved in your browser.
                </Typography>

                {/* Add combatant form */}
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                        Add Combatant
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1.5, mt: 1, flexWrap: "wrap", alignItems: "flex-end" }}>
                        <Autocomplete
                            freeSolo
                            options={creatures}
                            getOptionLabel={(o) => (typeof o === "string" ? o : o.name)}
                            filterOptions={(options, { inputValue }) => {
                                const lc = inputValue.toLowerCase();
                                return options.filter((o) => o.name.toLowerCase().includes(lc)).slice(0, 10);
                            }}
                            inputValue={form.name}
                            onInputChange={(_, v) => setForm((f) => ({ ...f, name: v }))}
                            onChange={(_, v) => {
                                if (v && typeof v === "object") {
                                    const level = v.level ?? 1;
                                    const health = parseInt(v.health ?? "", 10);
                                    const armor = parseInt(v.armor ?? "", 10);
                                    setForm((f) => ({
                                        ...f,
                                        name: v.name,
                                        type: "enemy",
                                        level: String(level),
                                        health: String(isNaN(health) ? Math.max(3, level * 3) : health),
                                        armor: String(isNaN(armor) ? 0 : armor),
                                    }));
                                }
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params} size="small" label="Name / Creature"
                                    onKeyDown={(e) => { if (e.key === "Enter" && !params.inputProps["aria-expanded"]) addCombatant(); }}
                                />
                            )}
                            sx={{ flex: "1 1 180px" }}
                        />
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                            <InputLabel>Type</InputLabel>
                            <Select value={form.type} label="Type" onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CombatantType }))}>
                                <MenuItem value="pc">PC</MenuItem>
                                <MenuItem value="enemy">Enemy</MenuItem>
                                <MenuItem value="ally">Ally</MenuItem>
                                <MenuItem value="neutral">NPC</MenuItem>
                            </Select>
                        </FormControl>

                        {form.type === "pc" ? (
                            <>
                                <TextField size="small" label="Might" type="number" value={form.might}
                                    onChange={(e) => setForm((f) => ({ ...f, might: e.target.value }))} sx={{ width: 76 }} />
                                <TextField size="small" label="Speed" type="number" value={form.speed}
                                    onChange={(e) => setForm((f) => ({ ...f, speed: e.target.value }))} sx={{ width: 76 }} />
                                <TextField size="small" label="Intellect" type="number" value={form.intellect}
                                    onChange={(e) => setForm((f) => ({ ...f, intellect: e.target.value }))} sx={{ width: 84 }} />
                            </>
                        ) : (
                            <>
                                <TextField size="small" label="Level" type="number" value={form.level}
                                    onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} sx={{ width: 72 }} />
                                <TextField size="small" label="Health" type="number" value={form.health}
                                    onChange={(e) => setForm((f) => ({ ...f, health: e.target.value }))} sx={{ width: 80 }} />
                            </>
                        )}
                        <TextField size="small" label="Armor" type="number" value={form.armor}
                            onChange={(e) => setForm((f) => ({ ...f, armor: e.target.value }))} sx={{ width: 72 }} />

                        <Button
                            variant="contained" startIcon={<Plus size={16} />} onClick={addCombatant}
                            sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" }, whiteSpace: "nowrap" }}
                        >
                            Add
                        </Button>
                    </Box>
                </Paper>

                {/* Phase / round bar */}
                {combatants.length > 0 && (
                    <Paper elevation={1} sx={{ p: 1.5, mb: 3, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "primary.dark" }}>
                            Round {round}
                        </Typography>
                        <Chip
                            icon={phase === "players" ? <Users size={14} /> : <Crown size={14} />}
                            label={phase === "players" ? "Players' Turn" : "GM's Turn"}
                            sx={{
                                backgroundColor: phase === "players" ? TYPE_COLOR.pc : "#7c3aed",
                                color: "#fff", fontWeight: 700,
                            }}
                        />
                        <Box sx={{ flex: 1 }} />
                        <Button size="small" startIcon={<Trash2 size={14} />} onClick={clearAll} sx={{ color: "text.secondary" }}>
                            Clear All
                        </Button>
                        <Button
                            variant="contained" startIcon={<ArrowRightLeft size={16} />} onClick={advancePhase}
                            sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" } }}
                        >
                            {phase === "players" ? "Hand to GM" : "Next Round"}
                        </Button>
                    </Paper>
                )}

                {combatants.length === 0 && (
                    <Typography sx={{ color: "text.secondary", textAlign: "center", py: 8 }}>
                        Add combatants to start tracking.
                    </Typography>
                )}

                {/* Players */}
                {pcs.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="overline" sx={{ color: TYPE_COLOR.pc, fontWeight: 700, letterSpacing: 2, fontSize: "0.7rem" }}>
                            Player Characters
                        </Typography>
                        {pcs.map((c) => <PcRow key={c.id} c={c} cb={cb} />)}
                    </Box>
                )}

                {/* GM's NPCs */}
                {npcs.length > 0 && (
                    <Box>
                        <Typography variant="overline" sx={{ color: "#7c3aed", fontWeight: 700, letterSpacing: 2, fontSize: "0.7rem" }}>
                            GM&apos;s NPCs &amp; Creatures
                        </Typography>
                        {npcs.map((c) => <CreatureRow key={c.id} c={c} cb={cb} />)}
                    </Box>
                )}
            </Container>
        </Box>
    );
}
