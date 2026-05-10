"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Box, Container, Button, Typography, TextField, Select, MenuItem,
    FormControl, InputLabel, LinearProgress, Paper, Chip,
    Divider, Collapse, Autocomplete,
} from "@mui/material";
import { ArrowLeft, ListOrdered, Plus, X, Trash2, ChevronRight, ChevronLeft } from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type CombatantType = "pc" | "enemy" | "ally" | "neutral";

interface DeathSaves { successes: number; failures: number; }

interface Combatant {
    id: string;
    name: string;
    initiative: number;
    maxHp: number;
    currentHp: number;
    ac: number;
    type: CombatantType;
    conditions: string[];
    deathSaves: DeathSaves;
}

interface MonsterOption { name: string; hp: number; ac: number; }

// ── Constants ─────────────────────────────────────────────────────────────────

const CONDITIONS = [
    "Blinded", "Charmed", "Deafened", "Exhausted", "Frightened",
    "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified",
    "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
    "Concentrating",
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

function uid() { return Math.random().toString(36).slice(2, 9); }

function hpColor(current: number, max: number): string {
    if (current <= 0) return "#9e9e9e";
    const pct = current / max;
    if (pct > 0.5) return "#2e7d32";
    if (pct > 0.25) return "#f57c00";
    return "#c62828";
}

const STORAGE_KEY = "initiative-tracker-v1";

// ── Death save circles ────────────────────────────────────────────────────────

function SaveCircles({ count, color, onSet }: { count: number; color: string; onSet: (n: number) => void }) {
    return (
        <Box sx={{ display: "flex", gap: 0.5 }}>
            {[0, 1, 2].map((i) => (
                <Box
                    key={i}
                    onClick={() => onSet(i < count ? i : i + 1)}
                    sx={{
                        width: 13, height: 13, borderRadius: "50%",
                        border: `2px solid ${color}`,
                        backgroundColor: i < count ? color : "transparent",
                        cursor: "pointer",
                        flexShrink: 0,
                        transition: "background-color 0.1s",
                    }}
                />
            ))}
        </Box>
    );
}

// ── Combatant row ─────────────────────────────────────────────────────────────

interface RowProps {
    combatant: Combatant;
    isActive: boolean;
    onAdjustHp: (id: string, delta: number) => void;
    onSetHp: (id: string, hp: number) => void;
    onSetDeathSaves: (id: string, type: "successes" | "failures", count: number) => void;
    onToggleCondition: (id: string, cond: string) => void;
    onRemove: (id: string) => void;
}

function CombatantRow({ combatant, isActive, onAdjustHp, onSetHp, onSetDeathSaves, onToggleCondition, onRemove }: RowProps) {
    const [delta, setDelta] = useState("");
    const [showConds, setShowConds] = useState(false);
    const [editingHp, setEditingHp] = useState(false);
    const [hpDraft, setHpDraft] = useState("");

    const color = TYPE_COLOR[combatant.type];
    const hpPct = Math.max(0, Math.min(100, (combatant.currentHp / combatant.maxHp) * 100));
    const isDowned = combatant.currentHp <= 0;
    const showDeathSaves = combatant.type === "pc" && isDowned;
    const isStable = combatant.deathSaves.successes >= 3;
    const isDead = combatant.deathSaves.failures >= 3;

    function applyDelta(sign: 1 | -1) {
        const n = parseInt(delta, 10);
        if (!isNaN(n) && n > 0) {
            onAdjustHp(combatant.id, sign * n);
            setDelta("");
        }
    }

    function commitHp() {
        const n = parseInt(hpDraft, 10);
        if (!isNaN(n)) onSetHp(combatant.id, n);
        setEditingHp(false);
    }

    return (
        <Paper
            elevation={isActive ? 4 : 1}
            sx={{
                borderLeft: `5px solid ${color}`,
                borderRadius: "4px 8px 8px 4px",
                mb: 1.5,
                opacity: isDead ? 0.45 : isDowned && !showDeathSaves ? 0.55 : 1,
                outline: isActive ? `2px solid ${color}` : "none",
                outlineOffset: 1,
            }}
        >
            <Box sx={{ p: 1.5 }}>
                {/* Top row */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 40 }}>
                        {isActive && <ChevronRight size={16} color={color} style={{ flexShrink: 0 }} />}
                        <Typography sx={{ fontWeight: 800, fontSize: "1.3rem", color, lineHeight: 1, minWidth: 28 }}>
                            {combatant.initiative}
                        </Typography>
                    </Box>

                    <Typography sx={{ fontWeight: 600, flex: 1, color: isDowned ? "text.disabled" : "text.primary", minWidth: 100 }}>
                        {combatant.name}
                        {isDead && " ✝"}
                        {isStable && !isDead && " (Stable)"}
                    </Typography>

                    <Chip
                        label={TYPE_LABEL[combatant.type]}
                        size="small"
                        sx={{ backgroundColor: color, color: "#fff", fontWeight: 700, fontSize: "0.65rem", height: 18, "& .MuiChip-label": { px: 0.75 } }}
                    />

                    <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                        AC {combatant.ac}
                    </Typography>

                    {/* HP — click to edit */}
                    {editingHp ? (
                        <TextField
                            size="small"
                            autoFocus
                            value={hpDraft}
                            onChange={(e) => setHpDraft(e.target.value.replace(/\D/g, ""))}
                            onBlur={commitHp}
                            onKeyDown={(e) => { if (e.key === "Enter") commitHp(); if (e.key === "Escape") setEditingHp(false); }}
                            sx={{ width: 64, "& input": { py: 0.4, fontSize: "0.85rem", textAlign: "center" } }}
                        />
                    ) : (
                        <Typography
                            variant="body2"
                            onClick={() => { setHpDraft(String(combatant.currentHp)); setEditingHp(true); }}
                            title="Click to set HP directly"
                            sx={{ color: hpColor(combatant.currentHp, combatant.maxHp), fontWeight: 700, whiteSpace: "nowrap", cursor: "text", userSelect: "none" }}
                        >
                            {combatant.currentHp}/{combatant.maxHp} HP
                        </Typography>
                    )}

                    <Button
                        size="small"
                        onClick={() => onRemove(combatant.id)}
                        sx={{ minWidth: 0, p: 0.25, color: "text.disabled", "&:hover": { color: "error.main" } }}
                    >
                        <X size={14} />
                    </Button>
                </Box>

                {/* HP bar */}
                <LinearProgress
                    variant="determinate"
                    value={hpPct}
                    sx={{
                        mt: 0.75, mb: 1, height: 5, borderRadius: 3,
                        backgroundColor: "#e0e0e0",
                        "& .MuiLinearProgress-bar": { backgroundColor: hpColor(combatant.currentHp, combatant.maxHp) },
                    }}
                />

                {/* Death saves (PC at 0 HP) */}
                {showDeathSaves && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1, px: 0.5 }}>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem", minWidth: 70 }}>
                            Death Saves
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            <Typography variant="caption" sx={{ color: "#2e7d32", fontSize: "0.68rem" }}>Suc</Typography>
                            <SaveCircles
                                count={combatant.deathSaves.successes}
                                color="#2e7d32"
                                onSet={(n) => onSetDeathSaves(combatant.id, "successes", n)}
                            />
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            <Typography variant="caption" sx={{ color: "#c62828", fontSize: "0.68rem" }}>Fail</Typography>
                            <SaveCircles
                                count={combatant.deathSaves.failures}
                                color="#c62828"
                                onSet={(n) => onSetDeathSaves(combatant.id, "failures", n)}
                            />
                        </Box>
                    </Box>
                )}

                {/* Damage / Heal controls */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: combatant.conditions.length || showConds ? 1 : 0 }}>
                    <TextField
                        size="small"
                        placeholder="Amt"
                        value={delta}
                        onChange={(e) => setDelta(e.target.value.replace(/\D/g, ""))}
                        onKeyDown={(e) => { if (e.key === "Enter") applyDelta(-1); }}
                        sx={{ width: 68, "& input": { py: 0.5, fontSize: "0.85rem" } }}
                    />
                    <Button
                        size="small" variant="outlined"
                        onClick={() => applyDelta(-1)}
                        sx={{ minWidth: 0, px: 1.5, py: 0.5, color: "error.main", borderColor: "error.main", fontSize: "0.75rem" }}
                    >
                        Dmg
                    </Button>
                    <Button
                        size="small" variant="outlined"
                        onClick={() => applyDelta(1)}
                        sx={{ minWidth: 0, px: 1.5, py: 0.5, color: "success.main", borderColor: "success.main", fontSize: "0.75rem" }}
                    >
                        Heal
                    </Button>
                    <Button
                        size="small"
                        onClick={() => setShowConds((v) => !v)}
                        sx={{ ml: "auto", fontSize: "0.7rem", color: "text.secondary", minWidth: 0, px: 1 }}
                    >
                        {showConds ? "▲ Conditions" : "▼ Conditions"}
                    </Button>
                </Box>

                {/* Active conditions */}
                {combatant.conditions.length > 0 && !showConds && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 0.5 }}>
                        {combatant.conditions.map((c) => (
                            <Chip
                                key={c}
                                label={c}
                                size="small"
                                onDelete={() => onToggleCondition(combatant.id, c)}
                                sx={{ backgroundColor: "#8C5A3A33", fontSize: "0.68rem", height: 20 }}
                            />
                        ))}
                    </Box>
                )}

                {/* Condition picker */}
                <Collapse in={showConds}>
                    <Divider sx={{ my: 0.75 }} />
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {CONDITIONS.map((c) => {
                            const active = combatant.conditions.includes(c);
                            return (
                                <Chip
                                    key={c}
                                    label={c}
                                    size="small"
                                    onClick={() => onToggleCondition(combatant.id, c)}
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
            </Box>
        </Paper>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = { name: "", initiative: "", hp: "", ac: "", type: "enemy" as CombatantType };

export default function InitiativePage() {
    const [combatants, setCombatants] = useState<Combatant[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [round, setRound] = useState(1);
    const [form, setForm] = useState(EMPTY_FORM);
    const [monsters, setMonsters] = useState<MonsterOption[]>([]);

    // Fetch monster list for quick-add
    useEffect(() => {
        fetch("/5_5_SRD/monsters.json")
            .then((r) => r.json())
            .then((d) => {
                const opts: MonsterOption[] = (d.monsters ?? []).map((m: any) => ({
                    name: m.name as string,
                    hp: m.hit_points as number,
                    ac: m.armor_class as number,
                }));
                setMonsters(opts);
            })
            .catch(() => {});
    }, []);

    // Persist to localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const s = JSON.parse(saved);
                const migrated = (s.combatants ?? []).map((c: any) => ({
                    ...c,
                    deathSaves: c.deathSaves ?? { successes: 0, failures: 0 },
                }));
                setCombatants(migrated);
                setActiveId(s.activeId ?? null);
                setRound(s.round ?? 1);
            }
        } catch {}
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ combatants, activeId, round }));
        } catch {}
    }, [combatants, activeId, round]);

    const sorted = [...combatants].sort((a, b) =>
        b.initiative - a.initiative || a.name.localeCompare(b.name)
    );

    function addCombatant() {
        const init = parseInt(form.initiative, 10);
        const hp = parseInt(form.hp, 10);
        const ac = parseInt(form.ac, 10);
        if (!form.name.trim() || isNaN(init) || isNaN(hp) || isNaN(ac)) return;
        const id = uid();
        setCombatants((prev) => [
            ...prev,
            {
                id,
                name: form.name.trim(),
                initiative: init,
                maxHp: hp,
                currentHp: hp,
                ac,
                type: form.type,
                conditions: [],
                deathSaves: { successes: 0, failures: 0 },
            },
        ]);
        if (activeId === null) setActiveId(id);
        setForm(EMPTY_FORM);
    }

    const adjustHp = useCallback((id: string, delta: number) => {
        setCombatants((prev) =>
            prev.map((c) =>
                c.id === id
                    ? {
                        ...c,
                        currentHp: Math.min(c.maxHp, Math.max(0, c.currentHp + delta)),
                        deathSaves: (c.currentHp + delta) > 0 ? { successes: 0, failures: 0 } : c.deathSaves,
                      }
                    : c
            )
        );
    }, []);

    const setHp = useCallback((id: string, hp: number) => {
        setCombatants((prev) =>
            prev.map((c) =>
                c.id === id
                    ? {
                        ...c,
                        currentHp: Math.min(c.maxHp, Math.max(0, hp)),
                        deathSaves: hp > 0 ? { successes: 0, failures: 0 } : c.deathSaves,
                      }
                    : c
            )
        );
    }, []);

    const setDeathSaves = useCallback((id: string, type: "successes" | "failures", count: number) => {
        setCombatants((prev) =>
            prev.map((c) =>
                c.id === id ? { ...c, deathSaves: { ...c.deathSaves, [type]: Math.min(3, Math.max(0, count)) } } : c
            )
        );
    }, []);

    const toggleCondition = useCallback((id: string, cond: string) => {
        setCombatants((prev) =>
            prev.map((c) =>
                c.id === id
                    ? { ...c, conditions: c.conditions.includes(cond) ? c.conditions.filter((x) => x !== cond) : [...c.conditions, cond] }
                    : c
            )
        );
    }, []);

    const removeCombatant = useCallback((id: string) => {
        setCombatants((prev) => {
            const next = prev.filter((c) => c.id !== id);
            setActiveId((aid) => {
                if (aid !== id) return aid;
                const s = [...prev].sort((a, b) => b.initiative - a.initiative || a.name.localeCompare(b.name));
                const si = s.findIndex((c) => c.id === id);
                const ns = s.filter((c) => c.id !== id);
                return ns[Math.min(si, ns.length - 1)]?.id ?? null;
            });
            return next;
        });
    }, []);

    function navigate(dir: 1 | -1) {
        if (!sorted.length) return;
        const idx = sorted.findIndex((c) => c.id === activeId);
        const next = (idx + dir + sorted.length) % sorted.length;
        if (dir === 1 && next === 0) setRound((r) => r + 1);
        if (dir === -1 && idx === 0 && round > 1) setRound((r) => r - 1);
        setActiveId(sorted[next].id);
    }

    function clearAll() {
        setCombatants([]);
        setActiveId(null);
        setRound(1);
    }

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href="/tabletop" startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                    <ListOrdered size={32} color="#8C5A3A" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        Initiative Tracker
                    </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    Track turn order, HP, and conditions. State is saved in your browser.
                </Typography>

                {/* Add combatant form */}
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                        Add Combatant
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1.5, mt: 1, flexWrap: "wrap", alignItems: "flex-end" }}>
                        {/* Monster quick-add autocomplete */}
                        <Autocomplete
                            freeSolo
                            options={monsters}
                            getOptionLabel={(o) => (typeof o === "string" ? o : o.name)}
                            filterOptions={(options, { inputValue }) => {
                                const lc = inputValue.toLowerCase();
                                return options.filter((o) => o.name.toLowerCase().includes(lc)).slice(0, 10);
                            }}
                            inputValue={form.name}
                            onInputChange={(_, v) => setForm((f) => ({ ...f, name: v }))}
                            onChange={(_, v) => {
                                if (v && typeof v === "object") {
                                    setForm((f) => ({
                                        ...f,
                                        name: v.name,
                                        hp: String(v.hp),
                                        ac: String(v.ac),
                                        type: "enemy",
                                    }));
                                }
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    size="small"
                                    label="Name / Monster"
                                    onKeyDown={(e) => { if (e.key === "Enter" && !params.inputProps["aria-expanded"]) addCombatant(); }}
                                />
                            )}
                            sx={{ flex: "1 1 180px" }}
                        />
                        <TextField
                            size="small" label="Init" type="number" value={form.initiative}
                            onChange={(e) => setForm((f) => ({ ...f, initiative: e.target.value }))}
                            sx={{ width: 72 }}
                        />
                        <TextField
                            size="small" label="Max HP" type="number" value={form.hp}
                            onChange={(e) => setForm((f) => ({ ...f, hp: e.target.value }))}
                            sx={{ width: 80 }}
                        />
                        <TextField
                            size="small" label="AC" type="number" value={form.ac}
                            onChange={(e) => setForm((f) => ({ ...f, ac: e.target.value }))}
                            sx={{ width: 68 }}
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
                        <Button
                            variant="contained" startIcon={<Plus size={16} />} onClick={addCombatant}
                            sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" }, whiteSpace: "nowrap" }}
                        >
                            Add
                        </Button>
                    </Box>
                </Paper>

                {/* Round counter + clear */}
                {combatants.length > 0 && (
                    <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "primary.dark" }}>
                            Round {round}
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        <Button size="small" startIcon={<Trash2 size={14} />} onClick={clearAll} sx={{ color: "text.secondary" }}>
                            Clear All
                        </Button>
                    </Box>
                )}

                {/* Combatant list */}
                {sorted.length === 0 ? (
                    <Typography sx={{ color: "text.secondary", textAlign: "center", py: 8 }}>
                        Add combatants to start tracking.
                    </Typography>
                ) : (
                    sorted.map((c) => (
                        <CombatantRow
                            key={c.id}
                            combatant={c}
                            isActive={c.id === activeId}
                            onAdjustHp={adjustHp}
                            onSetHp={setHp}
                            onSetDeathSaves={setDeathSaves}
                            onToggleCondition={toggleCondition}
                            onRemove={removeCombatant}
                        />
                    ))
                )}

                {/* Navigation */}
                {sorted.length > 0 && (
                    <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 3 }}>
                        <Button
                            variant="outlined" startIcon={<ChevronLeft size={18} />}
                            onClick={() => navigate(-1)}
                            sx={{ color: "primary.dark", borderColor: "primary.dark" }}
                        >
                            Prev
                        </Button>
                        <Button
                            variant="contained" endIcon={<ChevronRight size={18} />}
                            onClick={() => navigate(1)}
                            sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" } }}
                        >
                            Next Turn
                        </Button>
                    </Box>
                )}
            </Container>
        </Box>
    );
}
