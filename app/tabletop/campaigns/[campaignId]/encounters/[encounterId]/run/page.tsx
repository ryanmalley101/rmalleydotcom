"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
    Box, Typography, Button, TextField, Paper, Chip, Divider,
    IconButton, Tooltip, CircularProgress, LinearProgress, Collapse,
    Dialog, DialogTitle, DialogContent, DialogActions,
    useMediaQuery, useTheme, Tabs, Tab, Switch, FormControlLabel,
} from "@mui/material";
import Link from "next/link";
import {
    ArrowLeft, ChevronRight, ChevronLeft, X, Swords, Dices, RotateCcw, Shield,
    Focus, Zap, Trophy, Settings,
} from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { scoreToMod } from "@/5eReference/converters";
import { DiceRoll } from "@dice-roller/rpg-dice-roller";
import type { EncounterEntry } from "../page";
import { DEFAULT_COMBAT_SETTINGS, SETTING_META, parseSettings, type CombatSettings } from "../../../combatSettings";
import CypherEncounterRun from "./CypherEncounterRun";

const client = generateClient<Schema>();
type MonsterStatblock = Schema["MonsterStatblock"]["type"];
type PlayerCharacter  = Schema["PlayerCharacter"]["type"];

// ── Types ─────────────────────────────────────────────────────────────────────

type CombatantType = "enemy" | "pc" | "placeholder";
interface DeathSaves { successes: number; failures: number; }

interface TurnEffect {
    id: string;
    name: string;
    timing: "start" | "end";
    desc: string;
    damage?: string;     // e.g. "1d6 poison"
    saveType?: string;   // e.g. "CON"
    saveDC?: number;
}

interface RunCombatant {
    id: string;
    name: string;
    initiative: number | null;
    maxHp: number;
    currentHp: number;
    tempHp: number;
    ac: number;
    dexMod: number;
    type: CombatantType;
    monsterId?: string;
    characterId?: string;
    conditions: string[];
    deathSaves: DeathSaves;
    concentrating: boolean;
    concentrationSpell: string;
    legendaryActionsMax: number;
    legendaryActionsRemaining: number;
    reactionUsed: boolean;
    surprised: boolean;
    turnEffects: TurnEffect[];
    conSaveMod: number;
}

interface LogEntry {
    id: string;
    round: number;
    text: string;
    type: "damage" | "heal" | "kill" | "status" | "roll" | "info";
    timestamp?: number;
}

interface DiceResult { expr: string; result: string; total: number; }

// ── Constants ─────────────────────────────────────────────────────────────────

const CONDITIONS = [
    "Blinded","Charmed","Deafened","Exhausted","Frightened","Grappled",
    "Incapacitated","Invisible","Paralyzed","Petrified","Poisoned",
    "Prone","Restrained","Stunned","Unconscious","Concentrating",
];
const TYPE_COLOR: Record<CombatantType, string> = {
    enemy: "#b71c1c", pc: "#1565c0", placeholder: "#546e7a",
};
const TYPE_LABEL: Record<CombatantType, string> = {
    enemy: "Enemy", pc: "PC", placeholder: "NPC",
};
const LOG_COLOR: Record<LogEntry["type"], string> = {
    damage: "#b71c1c", heal: "#2e7d32", kill: "#4a0000",
    status: "#e65100", roll: "#1565c0", info: "#546e7a",
};
const CR_XP: Record<string, number> = {
    "0":10,"0.125":25,"0.25":50,"0.5":100,"1":200,"2":450,"3":700,"4":1100,
    "5":1800,"6":2300,"7":2900,"8":3900,"9":5000,"10":5900,"11":7200,"12":8400,
    "13":10000,"14":11500,"15":13000,"16":15000,"17":18000,"18":20000,"19":22000,
    "20":25000,"21":33000,"22":41000,"23":50000,"24":62000,
};

function uid() { return Math.random().toString(36).slice(2, 9); }
function hpColor(cur: number, max: number) {
    if (cur <= 0) return "#9e9e9e";
    const p = cur / max;
    if (p > 0.5) return "#2e7d32";
    if (p > 0.25) return "#f57c00";
    return "#c62828";
}
function rollD20(mod = 0) { return Math.floor(Math.random() * 20) + 1 + mod; }
function fmtMod(n: number) { return n >= 0 ? `+${n}` : `${n}`; }

// ── Dice Roller Panel ─────────────────────────────────────────────────────────

function DiceRollerPanel({ onRoll }: { onRoll: (text: string) => void }) {
    const [expr, setExpr]     = useState("");
    const [history, setHistory] = useState<DiceResult[]>([]);
    const [error, setError]   = useState(false);

    function roll(expression: string) {
        const e = expression.trim();
        if (!e) return;
        try {
            const r = new DiceRoll(e);
            const entry: DiceResult = { expr: e, result: r.output, total: r.total };
            setHistory(prev => [entry, ...prev].slice(0, 20));
            onRoll(`[Roll] ${r.output}`);
            setError(false);
        } catch { setError(true); }
    }

    const QUICK = ["d4","d6","d8","d10","d12","d20","d100"];

    return (
        <Box sx={{ p: 1.5 }}>
            <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.6rem", letterSpacing: 2, display: "block", mb: 1 }}>
                Dice Roller
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
                {QUICK.map(d => (
                    <Button key={d} size="small" variant="outlined"
                        onClick={() => roll(d)}
                        sx={{ minWidth: 0, px: 0.75, py: 0.25, fontSize: "0.65rem", borderColor: "primary.light", color: "primary.dark" }}>
                        {d}
                    </Button>
                ))}
            </Box>
            <Box sx={{ display: "flex", gap: 0.5, mb: 1 }}>
                <TextField
                    size="small" placeholder="2d6+4" value={expr} error={error}
                    onChange={e => { setExpr(e.target.value); setError(false); }}
                    onKeyDown={e => { if (e.key === "Enter") { roll(expr); setExpr(""); } }}
                    sx={{ flex: 1, "& input": { fontSize: "0.85rem", py: 0.75 } }}
                />
                <Button variant="contained" size="small" onClick={() => { roll(expr); setExpr(""); }}
                    sx={{ backgroundColor: "primary.main", minWidth: 0, px: 1.5 }}>
                    <Dices size={14} />
                </Button>
            </Box>
            <Box sx={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0.5 }}>
                {history.map((h, i) => (
                    <Box key={i} sx={{ borderLeft: "3px solid", borderLeftColor: "primary.light",
                        pl: 1, py: 0.25, borderRadius: "0 4px 4px 0" }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.dark", display: "block" }}>
                            {h.expr} = {h.total}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem" }}>
                            {h.result.length < 60 ? h.result : h.result.slice(0, 57) + "…"}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

// ── Combat Log Panel ──────────────────────────────────────────────────────────

function CombatLogPanel({ log, onClear }: { log: LogEntry[]; onClear: () => void }) {
    return (
        <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.6rem", letterSpacing: 2 }}>
                    Combat Log
                </Typography>
                <Button size="small" onClick={onClear} sx={{ fontSize: "0.65rem", minWidth: 0, py: 0, color: "text.disabled" }}>
                    Clear
                </Button>
            </Box>
            <Box sx={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                {log.length === 0 ? (
                    <Typography variant="caption" sx={{ color: "text.disabled", fontStyle: "italic" }}>
                        No events yet.
                    </Typography>
                ) : log.map(entry => (
                    <Box key={entry.id} sx={{ borderLeft: "3px solid", borderLeftColor: LOG_COLOR[entry.type],
                        pl: 1, py: 0.25, borderRadius: "0 4px 4px 0" }}>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem", display: "block" }}>
                            R{entry.round}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: "0.72rem", lineHeight: 1.3 }}>
                            {entry.text}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

// ── SaveCircles ───────────────────────────────────────────────────────────────

function SaveCircles({ count, color, onSet }: { count: number; color: string; onSet: (n: number) => void }) {
    return (
        <Box sx={{ display: "flex", gap: 0.5 }}>
            {[0,1,2].map(i => (
                <Box key={i} onClick={() => onSet(i < count ? i : i + 1)}
                    sx={{ width: 13, height: 13, borderRadius: "50%", border: `2px solid ${color}`,
                        backgroundColor: i < count ? color : "transparent", cursor: "pointer", flexShrink: 0 }} />
            ))}
        </Box>
    );
}

// ── Combatant Row ─────────────────────────────────────────────────────────────

interface RowProps {
    combatant: RunCombatant;
    isActive: boolean;
    round: number;
    onAdjustHp: (id: string, delta: number, log?: boolean) => void;
    onSetHp: (id: string, hp: number) => void;
    onSetTempHp: (id: string, hp: number) => void;
    onSetDeathSaves: (id: string, type: "successes"|"failures", count: number) => void;
    onToggleCondition: (id: string, cond: string) => void;
    onToggleConcentration: (id: string) => void;
    onSetConcentrationSpell: (id: string, spell: string) => void;
    onAdjustLegendary: (id: string, delta: number) => void;
    onToggleReaction: (id: string) => void;
    onToggleSurprised: (id: string) => void;
    onRemove: (id: string) => void;
    onRollInit: (id: string) => void;
    onSetInit: (id: string, val: number | null) => void;
    onClickName: (id: string) => void;
    onAddTurnEffect: (id: string, effect: TurnEffect) => void;
    onRemoveTurnEffect: (id: string, effectId: string) => void;
}

function CombatantRow(props: RowProps) {
    const { combatant: c, isActive, round } = props;
    const [delta, setDelta]       = useState("");
    const [tempInput, setTempInput] = useState("");
    const [showConds, setShowConds] = useState(false);
    const [showExtra, setShowExtra] = useState(false);
    const [showEffects, setShowEffects] = useState(false);
    const [editingHp, setEditingHp] = useState(false);
    const [hpDraft, setHpDraft]   = useState("");
    const [initDraft, setInitDraft] = useState(c.initiative != null ? String(c.initiative) : "");
    const [spellDraft, setSpellDraft] = useState(c.concentrationSpell ?? "");
    const [effectDraft, setEffectDraft] = useState({ name: "", timing: "start" as "start"|"end", desc: "", damage: "", saveType: "", saveDC: "" });

    useEffect(() => {
        setInitDraft(c.initiative != null ? String(c.initiative) : "");
    }, [c.initiative]);

    const color   = TYPE_COLOR[c.type];
    const hpPct   = Math.max(0, Math.min(100, (c.currentHp / c.maxHp) * 100));
    const isDowned = c.currentHp <= 0;
    const showDeath = c.type === "pc" && isDowned;
    const isStable = c.deathSaves.successes >= 3;
    const isDead   = c.deathSaves.failures >= 3;

    function applyDelta(sign: 1 | -1) {
        const n = parseInt(delta, 10);
        if (!isNaN(n) && n > 0) { props.onAdjustHp(c.id, sign * n, true); setDelta(""); }
    }
    function commitHp() {
        const n = parseInt(hpDraft, 10);
        if (!isNaN(n)) props.onSetHp(c.id, n);
        setEditingHp(false);
    }
    function commitInit() {
        const n = parseInt(initDraft, 10);
        props.onSetInit(c.id, isNaN(n) ? null : n);
    }

    return (
        <Paper elevation={isActive ? 4 : 1}
            sx={{ borderLeft: `5px solid ${color}`, borderRadius: "4px 8px 8px 4px", mb: 1.5,
                opacity: isDead ? 0.45 : 1, outline: isActive ? `2px solid ${color}` : "none", outlineOffset: 1 }}>
            <Box sx={{ p: 1.5 }}>
                {/* Top row */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    {/* Initiative */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 80 }}>
                        {isActive && <ChevronRight size={14} color={color} />}
                        <TextField size="small" value={initDraft}
                            onChange={e => setInitDraft(e.target.value.replace(/[^-\d]/g, ""))}
                            onBlur={commitInit}
                            onKeyDown={e => { if (e.key === "Enter") commitInit(); }}
                            placeholder="Init"
                            sx={{ width: 52, "& input": { py: 0.4, fontSize: "0.95rem", fontWeight: 800, color, textAlign: "center" } }}
                        />
                        <Tooltip title={`Roll d20${fmtMod(c.dexMod)}`}>
                            <IconButton size="small" onClick={() => props.onRollInit(c.id)}
                                sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: "primary.main" } }}>
                                <Dices size={14} />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    {/* Name */}
                    <Typography onClick={() => props.onClickName(c.id)}
                        sx={{ fontWeight: 600, flex: 1, color: isDowned ? "text.disabled" : "text.primary",
                            cursor: "pointer", "&:hover": { color: "primary.main", textDecoration: "underline" }, minWidth: 80 }}>
                        {c.name}{isDead && " ✝"}{isStable && !isDead && " (Stable)"}
                    </Typography>

                    {/* Badges */}
                    {round === 1 && c.surprised && (
                        <Chip label="SURPRISED" size="small" onClick={() => props.onToggleSurprised(c.id)}
                            sx={{ backgroundColor: "#f59e0b", color: "#fff", fontWeight: 700, fontSize: "0.58rem", height: 18, cursor: "pointer" }} />
                    )}
                    {c.concentrating && (
                        <Tooltip title={c.concentrationSpell || "Concentrating"}>
                            <Chip icon={<Focus size={10} />} label={c.concentrationSpell || "Conc."}
                                size="small" onClick={() => setShowExtra(v => !v)}
                                sx={{ backgroundColor: "#7c3aed22", color: "#7c3aed", fontSize: "0.6rem", height: 18, cursor: "pointer" }} />
                        </Tooltip>
                    )}
                    {c.legendaryActionsMax > 0 && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                            <Typography variant="caption" sx={{ color: "#b45309", fontWeight: 700, fontSize: "0.65rem" }}>
                                L:{c.legendaryActionsRemaining}/{c.legendaryActionsMax}
                            </Typography>
                            <IconButton size="small" sx={{ p: 0.15 }}
                                onClick={() => props.onAdjustLegendary(c.id, -1)}
                                disabled={c.legendaryActionsRemaining <= 0}>
                                <span style={{ fontSize: 10, color: "#b45309" }}>−</span>
                            </IconButton>
                        </Box>
                    )}
                    {c.reactionUsed && (
                        <Chip label="⚡ used" size="small" onClick={() => props.onToggleReaction(c.id)}
                            sx={{ backgroundColor: "#e0e0e0", color: "#757575", fontSize: "0.6rem", height: 18, cursor: "pointer" }} />
                    )}

                    <Chip label={TYPE_LABEL[c.type]} size="small"
                        sx={{ backgroundColor: color, color: "#fff", fontWeight: 700, fontSize: "0.6rem",
                            height: 18, "& .MuiChip-label": { px: 0.75 } }} />
                    <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                        AC {c.ac}
                    </Typography>

                    {/* HP display */}
                    {editingHp ? (
                        <TextField size="small" autoFocus value={hpDraft}
                            onChange={e => setHpDraft(e.target.value.replace(/\D/g, ""))}
                            onBlur={commitHp}
                            onKeyDown={e => { if (e.key === "Enter") commitHp(); if (e.key === "Escape") setEditingHp(false); }}
                            sx={{ width: 64, "& input": { py: 0.4, fontSize: "0.85rem", textAlign: "center" } }} />
                    ) : (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                            <Typography variant="body2" title="Click to set HP"
                                onClick={() => { setHpDraft(String(c.currentHp)); setEditingHp(true); }}
                                sx={{ color: hpColor(c.currentHp, c.maxHp), fontWeight: 700, whiteSpace: "nowrap", cursor: "text" }}>
                                {c.currentHp}/{c.maxHp}
                            </Typography>
                            {c.tempHp > 0 && (
                                <Typography variant="caption" sx={{ color: "#1565c0", fontWeight: 700 }}>
                                    +{c.tempHp}
                                </Typography>
                            )}
                        </Box>
                    )}

                    <IconButton size="small" onClick={() => props.onRemove(c.id)}
                        sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: "error.main" } }}>
                        <X size={14} />
                    </IconButton>
                </Box>

                {/* HP bar */}
                <LinearProgress variant="determinate" value={hpPct}
                    sx={{ mt: 0.75, mb: 1, height: 4, borderRadius: 2, backgroundColor: "#e0e0e0",
                        "& .MuiLinearProgress-bar": { backgroundColor: hpColor(c.currentHp, c.maxHp) } }} />

                {/* Death saves */}
                {showDeath && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                        <Typography variant="caption" sx={{ color: "text.secondary", minWidth: 70, fontSize: "0.7rem" }}>Death Saves</Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            <Typography variant="caption" sx={{ color: "#2e7d32", fontSize: "0.68rem" }}>Suc</Typography>
                            <SaveCircles count={c.deathSaves.successes} color="#2e7d32"
                                onSet={n => props.onSetDeathSaves(c.id, "successes", n)} />
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            <Typography variant="caption" sx={{ color: "#c62828", fontSize: "0.68rem" }}>Fail</Typography>
                            <SaveCircles count={c.deathSaves.failures} color="#c62828"
                                onSet={n => props.onSetDeathSaves(c.id, "failures", n)} />
                        </Box>
                    </Box>
                )}

                {/* Damage/Heal row */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <TextField size="small" placeholder="Amt" value={delta}
                        onChange={e => setDelta(e.target.value.replace(/\D/g, ""))}
                        onKeyDown={e => { if (e.key === "Enter") applyDelta(-1); }}
                        sx={{ width: 60, "& input": { py: 0.5, fontSize: "0.85rem" } }} />
                    <Button size="small" variant="outlined" onClick={() => applyDelta(-1)}
                        sx={{ minWidth: 0, px: 1.5, py: 0.5, color: "error.main", borderColor: "error.main", fontSize: "0.75rem" }}>
                        Dmg
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => applyDelta(1)}
                        sx={{ minWidth: 0, px: 1.5, py: 0.5, color: "success.main", borderColor: "success.main", fontSize: "0.75rem" }}>
                        Heal
                    </Button>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <TextField size="small" placeholder="+Temp" value={tempInput}
                            onChange={e => setTempInput(e.target.value.replace(/\D/g, ""))}
                            onKeyDown={e => {
                                if (e.key === "Enter") {
                                    const n = parseInt(tempInput, 10);
                                    if (!isNaN(n) && n > 0) { props.onSetTempHp(c.id, n); setTempInput(""); }
                                }
                            }}
                            sx={{ width: 56, "& input": { py: 0.5, fontSize: "0.75rem" } }} />
                        <Button size="small" variant="text" onClick={() => {
                            const n = parseInt(tempInput, 10);
                            if (!isNaN(n) && n > 0) { props.onSetTempHp(c.id, n); setTempInput(""); }
                        }} sx={{ minWidth: 0, px: 0.75, py: 0.5, fontSize: "0.65rem", color: "#1565c0" }}>
                            Tmp
                        </Button>
                    </Box>
                    <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
                        <Tooltip title="Toggle concentration">
                            <IconButton size="small" onClick={() => { props.onToggleConcentration(c.id); setShowExtra(v => !v); }}
                                sx={{ p: 0.5, color: c.concentrating ? "#7c3aed" : "text.disabled" }}>
                                <Focus size={13} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={c.reactionUsed ? "Mark reaction available" : "Mark reaction used"}>
                            <IconButton size="small" onClick={() => props.onToggleReaction(c.id)}
                                sx={{ p: 0.5, color: c.reactionUsed ? "#f57c00" : "text.disabled" }}>
                                <Zap size={13} />
                            </IconButton>
                        </Tooltip>
                        <Button size="small" onClick={() => setShowConds(v => !v)}
                            sx={{ fontSize: "0.68rem", color: "text.secondary", minWidth: 0, px: 0.75 }}>
                            {showConds ? "▲" : "▼"} Cond
                        </Button>
                        <Tooltip title="Turn effects (start/end of turn reminders)">
                            <Button size="small" onClick={() => setShowEffects(v => !v)}
                                sx={{ fontSize: "0.68rem", color: (c.turnEffects ?? []).length > 0 ? "#b45309" : "text.disabled", minWidth: 0, px: 0.75 }}>
                                ⏱ {(c.turnEffects ?? []).length > 0 ? `${(c.turnEffects ?? []).length}` : ""}
                            </Button>
                        </Tooltip>
                    </Box>
                </Box>

                {/* Concentration spell input */}
                <Collapse in={showExtra && c.concentrating}>
                    <Box sx={{ mt: 1, display: "flex", gap: 1, alignItems: "center" }}>
                        <Focus size={12} color="#7c3aed" />
                        <TextField size="small" placeholder="Spell name…" value={spellDraft}
                            onChange={e => setSpellDraft(e.target.value)}
                            onBlur={() => props.onSetConcentrationSpell(c.id, spellDraft)}
                            onKeyDown={e => { if (e.key === "Enter") props.onSetConcentrationSpell(c.id, spellDraft); }}
                            sx={{ flex: 1, "& input": { py: 0.5, fontSize: "0.8rem", color: "#7c3aed" } }} />
                    </Box>
                </Collapse>

                {/* Active conditions */}
                {c.conditions.length > 0 && !showConds && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.75 }}>
                        {c.conditions.map(cond => (
                            <Chip key={cond} label={cond} size="small" onDelete={() => props.onToggleCondition(c.id, cond)}
                                sx={{ backgroundColor: "#8C5A3A33", fontSize: "0.68rem", height: 20 }} />
                        ))}
                    </Box>
                )}

                {/* Condition picker */}
                <Collapse in={showConds}>
                    <Divider sx={{ my: 0.75 }} />
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {CONDITIONS.map(cond => {
                            const active = c.conditions.includes(cond);
                            return (
                                <Chip key={cond} label={cond} size="small"
                                    onClick={() => props.onToggleCondition(c.id, cond)}
                                    variant={active ? "filled" : "outlined"}
                                    sx={{ fontSize: "0.68rem", height: 20, cursor: "pointer",
                                        ...(active && { backgroundColor: "#8C5A3A", color: "#fff" }) }} />
                            );
                        })}
                    </Box>
                </Collapse>

                {/* Turn effects panel */}
                <Collapse in={showEffects}>
                    <Divider sx={{ my: 0.75 }} />
                    <Typography variant="overline" sx={{ fontSize: "0.6rem", letterSpacing: 1.5, color: "#b45309", display: "block", mb: 0.75 }}>
                        Turn Effects
                    </Typography>
                    {(c.turnEffects ?? []).map(eff => (
                        <Box key={eff.id} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5,
                            p: 0.75, borderRadius: 1, backgroundColor: eff.timing === "start" ? "#15803d11" : "#b4530911" }}>
                            <Chip label={eff.timing === "start" ? "START" : "END"} size="small"
                                sx={{ height: 16, fontSize: "0.55rem", fontWeight: 700,
                                    backgroundColor: eff.timing === "start" ? "#15803d" : "#b45309", color: "#fff", flexShrink: 0 }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="caption" sx={{ fontWeight: 600, display: "block", fontSize: "0.72rem" }}>
                                    {eff.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.68rem" }}>
                                    {eff.desc}
                                    {eff.damage ? ` · ${eff.damage} dmg` : ""}
                                    {eff.saveType && eff.saveDC ? ` · DC ${eff.saveDC} ${eff.saveType} save` : ""}
                                </Typography>
                            </Box>
                            <IconButton size="small" sx={{ p: 0.25 }} onClick={() => props.onRemoveTurnEffect(c.id, eff.id)}>
                                <X size={12} />
                            </IconButton>
                        </Box>
                    ))}
                    <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 0.75 }}>
                        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                            <TextField size="small" placeholder="Effect name *" value={effectDraft.name}
                                onChange={e => setEffectDraft(p => ({ ...p, name: e.target.value }))}
                                sx={{ flex: "2 1 120px", "& input": { py: 0.4, fontSize: "0.8rem" } }} />
                            <Box sx={{ display: "flex", gap: 0.5 }}>
                                {(["start", "end"] as const).map(t => (
                                    <Chip key={t} label={t === "start" ? "Start" : "End"} size="small"
                                        onClick={() => setEffectDraft(p => ({ ...p, timing: t }))}
                                        variant={effectDraft.timing === t ? "filled" : "outlined"}
                                        sx={{ cursor: "pointer", height: 26,
                                            ...(effectDraft.timing === t ? { backgroundColor: t === "start" ? "#15803d" : "#b45309", color: "#fff" } : {}) }} />
                                ))}
                            </Box>
                        </Box>
                        <TextField size="small" placeholder="Description (e.g. take poison damage)" value={effectDraft.desc}
                            onChange={e => setEffectDraft(p => ({ ...p, desc: e.target.value }))}
                            sx={{ "& input": { py: 0.4, fontSize: "0.8rem" } }} fullWidth />
                        <Box sx={{ display: "flex", gap: 0.75 }}>
                            <TextField size="small" placeholder="Damage (e.g. 1d6)" value={effectDraft.damage}
                                onChange={e => setEffectDraft(p => ({ ...p, damage: e.target.value }))}
                                sx={{ flex: 1, "& input": { py: 0.4, fontSize: "0.75rem" } }} />
                            <TextField size="small" placeholder="Save (CON)" value={effectDraft.saveType}
                                onChange={e => setEffectDraft(p => ({ ...p, saveType: e.target.value }))}
                                sx={{ flex: 1, "& input": { py: 0.4, fontSize: "0.75rem" } }} />
                            <TextField size="small" placeholder="DC" value={effectDraft.saveDC} type="number"
                                onChange={e => setEffectDraft(p => ({ ...p, saveDC: e.target.value }))}
                                sx={{ width: 52, "& input": { py: 0.4, fontSize: "0.75rem" } }} />
                        </Box>
                        <Button size="small" variant="outlined" disabled={!effectDraft.name.trim() || !effectDraft.desc.trim()}
                            onClick={() => {
                                props.onAddTurnEffect(c.id, {
                                    id: Math.random().toString(36).slice(2, 9),
                                    name: effectDraft.name.trim(),
                                    timing: effectDraft.timing,
                                    desc: effectDraft.desc.trim(),
                                    damage: effectDraft.damage.trim() || undefined,
                                    saveType: effectDraft.saveType.trim() || undefined,
                                    saveDC: effectDraft.saveDC ? parseInt(effectDraft.saveDC, 10) : undefined,
                                });
                                setEffectDraft({ name: "", timing: "start", desc: "", damage: "", saveType: "", saveDC: "" });
                            }}
                            sx={{ fontSize: "0.72rem", alignSelf: "flex-start" }}>
                            Add Effect
                        </Button>
                    </Box>
                </Collapse>
            </Box>
        </Paper>
    );
}

// ── Monster Statblock Panel ───────────────────────────────────────────────────

function modStr(score: number | null | undefined) {
    const m = scoreToMod(score ?? 10);
    return m >= 0 ? `+${m}` : `${m}`;
}
function AbilityCol({ label, score }: { label: string; score: number | null | undefined }) {
    return (
        <Box sx={{ textAlign: "center", flex: 1 }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700, fontSize: "0.6rem", display: "block" }}>{label}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{score ?? "—"}</Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem" }}>{modStr(score)}</Typography>
        </Box>
    );
}
function MonsterStatblockPanel({ sb }: { sb: MonsterStatblock }) {
    const abilities = [
        { label: "STR", score: sb.strength }, { label: "DEX", score: sb.dexterity },
        { label: "CON", score: sb.constitution }, { label: "INT", score: sb.intelligence },
        { label: "WIS", score: sb.wisdom }, { label: "CHA", score: sb.charisma },
    ];

    const savingThrows = [
        { label: "Str", val: sb.strength_save },
        { label: "Dex", val: sb.dexterity_save },
        { label: "Con", val: sb.constitution_save },
        { label: "Int", val: sb.intelligence_save },
        { label: "Wis", val: sb.wisdom_save },
        { label: "Cha", val: sb.charisma_save },
    ].filter(s => s.val != null) as { label: string; val: number }[];

    const skills = sb.skills ? Object.entries(sb.skills)
        .filter(([, v]) => v != null && (v as number) !== 0)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} ${(v as number) >= 0 ? "+" : ""}${v}`)
        : [];

    return (
        <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#8C1A1A", mb: 0.25 }}>{sb.name}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1, fontStyle: "italic" }}>
                {sb.size} {sb.type}{sb.subtype ? ` (${sb.subtype})` : ""}, {sb.alignment}
            </Typography>
            <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
                <Typography variant="body2"><strong>AC</strong> {sb.armor_class}{sb.armor_desc ? ` (${sb.armor_desc})` : ""}</Typography>
                <Typography variant="body2"><strong>HP</strong> {sb.hit_points}</Typography>
                <Typography variant="body2"><strong>CR</strong> {sb.challenge_rating}</Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "flex", gap: 0.5, mb: 1 }}>{abilities.map(a => <AbilityCol key={a.label} {...a} />)}</Box>
            <Divider sx={{ my: 1 }} />
            {savingThrows.length > 0 && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>Saving Throws</strong>{" "}
                    {savingThrows.map(s => `${s.label} ${s.val >= 0 ? "+" : ""}${s.val}`).join(", ")}
                </Typography>
            )}
            {skills.length > 0 && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>Skills</strong> {skills.join(", ")}
                </Typography>
            )}
            {sb.damage_resistances && <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Resist</strong> {sb.damage_resistances}</Typography>}
            {sb.damage_immunities && <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Immune</strong> {sb.damage_immunities}</Typography>}
            {sb.condition_immunities && <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Cond. Immune</strong> {sb.condition_immunities}</Typography>}
            {sb.senses && <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Senses</strong> {sb.senses}</Typography>}
            {(sb.special_abilities?.length ?? 0) > 0 && <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="overline" sx={{ fontSize: "0.6rem", letterSpacing: 2 }}>Traits</Typography>
                {sb.special_abilities!.map((a, i) => <Box key={i} sx={{ mb: 0.5 }}>
                    <Typography variant="body2" component="span" sx={{ fontWeight: 700 }}>{a?.name}. </Typography>
                    <Typography variant="body2" component="span" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>{a?.desc}</Typography>
                </Box>)}
            </>}
            {(sb.actions?.length ?? 0) > 0 && <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="overline" sx={{ fontSize: "0.6rem", letterSpacing: 2 }}>Actions</Typography>
                {sb.actions!.map((a, i) => <Box key={i} sx={{ mb: 0.5 }}>
                    <Typography variant="body2" component="span" sx={{ fontWeight: 700 }}>{a?.name}. </Typography>
                    <Typography variant="body2" component="span" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>{a?.desc}</Typography>
                </Box>)}
            </>}
            {(sb.legendary_actions?.length ?? 0) > 0 && <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="overline" sx={{ fontSize: "0.6rem", letterSpacing: 2 }}>Legendary Actions</Typography>
                {sb.legendary_desc && <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.5, fontSize: "0.8rem" }}>{sb.legendary_desc}</Typography>}
                {sb.legendary_actions!.map((a, i) => <Box key={i} sx={{ mb: 0.5 }}>
                    <Typography variant="body2" component="span" sx={{ fontWeight: 700 }}>{a?.name}. </Typography>
                    <Typography variant="body2" component="span" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>{a?.desc}</Typography>
                </Box>)}
            </>}
        </Box>
    );
}

function PCStatblockPanel({ pc }: { pc: PlayerCharacter }) {
    const abilities = [
        { label: "STR", score: pc.strength }, { label: "DEX", score: pc.dexterity },
        { label: "CON", score: pc.constitution }, { label: "INT", score: pc.intelligence },
        { label: "WIS", score: pc.wisdom }, { label: "CHA", score: pc.charisma },
    ];
    return (
        <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#1565c0", mb: 0.25 }}>{pc.characterName}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic", mb: 0.5 }}>
                {[pc.race, pc.characterClass].filter(Boolean).join(" · ")}{pc.level ? ` — Level ${pc.level}` : ""}
            </Typography>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 1 }}>
                <Typography variant="body2"><strong>AC</strong> {pc.armorClass ?? "—"}</Typography>
                <Typography variant="body2"><strong>HP</strong> {pc.maxHp ?? "—"}</Typography>
                <Typography variant="body2"><strong>Speed</strong> {pc.speed ?? 30} ft.</Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "flex", gap: 0.5 }}>{abilities.map(a => <AbilityCol key={a.label} {...a} />)}</Box>
        </Box>
    );
}

// ── Main Run Page ─────────────────────────────────────────────────────────────

// Branches by campaign system — Cypher campaigns get the pools/level-based runner.
export default function RunEncounterPage() {
    const { campaignId } = useParams<{ campaignId: string }>();
    const [system, setSystem] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        client.models.Campaign.get({ id: campaignId }).then(({ data }) => setSystem(data?.system ?? null));
    }, [campaignId]);

    if (system === undefined) return (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "background.default" }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );
    if (system === "Cypher System") return <CypherEncounterRun />;
    return <DnDRunEncounterPage />;
}

function DnDRunEncounterPage() {
    const { campaignId, encounterId } = useParams<{ campaignId: string; encounterId: string }>();
    const theme = useTheme();
    const isWide = useMediaQuery(theme.breakpoints.up("md"));

    const [combatants, setCombatants] = useState<RunCombatant[]>([]);
    const [activeId, setActiveId]     = useState<string | null>(null);
    const [round, setRound]           = useState(1);
    const [loading, setLoading]       = useState(true);
    const [encounterName, setEncounterName] = useState("Encounter");
    const [sbMap, setSbMap]           = useState<Record<string, MonsterStatblock>>({});
    const [pcMap, setPcMap]           = useState<Record<string, PlayerCharacter>>({});
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [statblockOpen, setStatblockOpen] = useState(false);
    const [log, setLog]               = useState<LogEntry[]>([]);
    const [sidebarTab, setSidebarTab] = useState(0);
    const [endOpen, setEndOpen]       = useState(false);
    const [mobilePanel, setMobilePanel] = useState(false);
    const [effectsAlert, setEffectsAlert] = useState<{ combatant: string; effects: TurnEffect[] } | null>(null);

    const STORAGE_KEY   = `run-enc-${encounterId}`;
    const lastUpdatedRef = useRef(0);
    const saveTimerRef   = useRef<ReturnType<typeof setTimeout>>();
    const combatantsRef  = useRef<RunCombatant[]>([]);
    const settingsRef    = useRef<CombatSettings>({ ...DEFAULT_COMBAT_SETTINGS });

    const [settings, setSettings]         = useState<CombatSettings>({ ...DEFAULT_COMBAT_SETTINGS });
    const [settingsOpen, setSettingsOpen] = useState(false);

    const [concCheck, setConcCheck] = useState<{
        combatantId: string; name: string; roll: number; mod: number;
        total: number; dc: number; passed: boolean;
    } | null>(null);

    const addLog = useCallback((text: string, type: LogEntry["type"]) => {
        setLog(prev => [{
            id: uid(), round, text, type, timestamp: Date.now(),
        }, ...prev].slice(0, 100));
    }, [round]);

    // ── DB persistence ────────────────────────────────────────────────────────

    const persistState = useCallback((
        c: RunCombatant[], aid: string | null, r: number, l: LogEntry[]
    ) => {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            const now = Date.now();
            lastUpdatedRef.current = now;
            client.models.Encounter.update({
                id: encounterId,
                combatStateJson: JSON.stringify({ combatants: c, activeId: aid, round: r, log: l, lastUpdated: now }),
            });
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ combatants: c, activeId: aid, round: r, log: l, lastUpdated: now })); } catch {}
        }, 2000);
    }, [encounterId, STORAGE_KEY]);

    // ── Real-time sync ────────────────────────────────────────────────────────

    useEffect(() => {
        const sub = client.models.Encounter.observeQuery({
            filter: { id: { eq: encounterId } },
        }).subscribe({
            next: ({ items }) => {
                const enc = items[0];
                if (!enc?.combatStateJson) return;
                try {
                    const remote = JSON.parse(enc.combatStateJson);
                    if ((remote.lastUpdated ?? 0) > lastUpdatedRef.current) {
                        lastUpdatedRef.current = remote.lastUpdated;
                        setCombatants(remote.combatants ?? []);
                        setActiveId(remote.activeId ?? null);
                        setRound(remote.round ?? 1);
                        setLog(remote.log ?? []);
                    }
                } catch {}
            },
        });
        return () => sub.unsubscribe();
    }, [encounterId]);

    // ── Load ──────────────────────────────────────────────────────────────────

    async function initFromDB() {
        const [encRes, campRes] = await Promise.all([
            client.models.Encounter.get({ id: encounterId }),
            client.models.Campaign.get({ id: campaignId }),
        ]);
        const enc = encRes.data;
        if (!enc) return;
        setEncounterName(enc.name);
        const campSettings = parseSettings(campRes.data?.settingsJson);
        const encOverrides = enc.settingsJson ? (() => { try { return JSON.parse(enc.settingsJson) as Partial<CombatSettings>; } catch { return {}; } })() : {};
        const merged = { ...campSettings, ...encOverrides };
        setSettings(merged);
        settingsRef.current = merged;

        const entries: EncounterEntry[] = JSON.parse(enc.monstersJson ?? "[]");
        const monsterIds = Array.from(new Set(entries.filter(e => e.monsterId).map(e => e.monsterId!)));
        const sbMapLocal: Record<string, MonsterStatblock> = {};
        await Promise.all(monsterIds.map(async id => {
            const res = await client.models.MonsterStatblock.get({ id });
            if (res.data) sbMapLocal[id] = res.data;
        }));
        setSbMap(sbMapLocal);

        const pcRes = await client.models.PlayerCharacter.list();
        const campaignPCs = (pcRes.data ?? []).filter(pc => pc.campaignId === enc.campaignId);
        const pcMapLocal: Record<string, PlayerCharacter> = {};
        campaignPCs.forEach(pc => { pcMapLocal[pc.id] = pc; });
        setPcMap(pcMapLocal);

        // Try DB state first, then localStorage
        const dbState = enc.combatStateJson ? (() => { try { return JSON.parse(enc.combatStateJson); } catch { return null; } })() : null;
        const lsState = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"); } catch { return null; } })();
        const saved = (dbState?.lastUpdated ?? 0) >= (lsState?.lastUpdated ?? 0) ? dbState : lsState;

        if (saved?.combatants?.length) {
            lastUpdatedRef.current = saved.lastUpdated ?? 0;
            setCombatants(saved.combatants);
            setActiveId(saved.activeId ?? null);
            setRound(saved.round ?? 1);
            setLog(saved.log ?? []);
            setLoading(false);
            return;
        }

        // Build fresh
        const list: RunCombatant[] = [];
        for (const entry of entries) {
            const sb = entry.monsterId ? sbMapLocal[entry.monsterId] : null;
            const hasLegendary = (sb?.legendary_actions?.length ?? 0) > 0;
            for (let i = 0; i < entry.count; i++) {
                const name = entry.count > 1 ? `${entry.name} ${i + 1}` : entry.name;
                list.push({
                    id: uid(), name,
                    initiative: null,
                    maxHp: sb?.hit_points ?? entry.placeholderHp ?? 10,
                    currentHp: sb?.hit_points ?? entry.placeholderHp ?? 10,
                    tempHp: 0,
                    ac: sb?.armor_class ?? entry.placeholderAc ?? 10,
                    dexMod: sb ? scoreToMod(sb.dexterity) : 0,
                    type: entry.type === "placeholder" ? "placeholder" : "enemy",
                    monsterId: entry.monsterId,
                    conditions: [], deathSaves: { successes: 0, failures: 0 },
                    concentrating: false, concentrationSpell: "",
                    legendaryActionsMax: hasLegendary ? 3 : 0,
                    legendaryActionsRemaining: hasLegendary ? 3 : 0,
                    reactionUsed: false, surprised: false, turnEffects: [],
                    conSaveMod: sb ? (sb.constitution_save ?? scoreToMod(sb.constitution ?? 10)) : 0,
                });
            }
        }
        for (const pc of campaignPCs) {
            list.push({
                id: uid(), name: pc.characterName,
                initiative: null,
                maxHp: pc.maxHp ?? 10, currentHp: pc.currentHp ?? pc.maxHp ?? 10,
                tempHp: pc.tempHp ?? 0,
                ac: pc.armorClass ?? 10,
                dexMod: pc.initiative ?? scoreToMod(pc.dexterity ?? 10),
                type: "pc", characterId: pc.id,
                conditions: [], deathSaves: { successes: 0, failures: 0 },
                concentrating: false, concentrationSpell: "",
                legendaryActionsMax: 0, legendaryActionsRemaining: 0,
                reactionUsed: false, surprised: false, turnEffects: [],
                conSaveMod: scoreToMod(pc.constitution ?? 10),
            });
        }
        setCombatants(list);
        if (list.length > 0) setActiveId(list[0].id);
        setLoading(false);
    }

    useEffect(() => { initFromDB(); }, [encounterId]);

    // Keep refs in sync
    useEffect(() => { combatantsRef.current = combatants; }, [combatants]);
    useEffect(() => { settingsRef.current = settings; }, [settings]);

    // Persist on every state change
    useEffect(() => {
        if (loading) return;
        persistState(combatants, activeId, round, log);
    }, [combatants, activeId, round, log, loading]);

    // ── Sorted combatants ─────────────────────────────────────────────────────

    const sorted = [...combatants].sort((a, b) => {
        if (a.initiative === null && b.initiative === null) return a.name.localeCompare(b.name);
        if (a.initiative === null) return 1;
        if (b.initiative === null) return -1;
        return b.initiative - a.initiative || b.dexMod - a.dexMod || a.name.localeCompare(b.name);
    });

    // ── XP calculation ────────────────────────────────────────────────────────

    const xpData = (() => {
        const enemies = combatants.filter(c => c.type === "enemy" && c.monsterId);
        const totalXp = enemies.reduce((sum, c) => {
            const sb = sbMap[c.monsterId!];
            const crStr = String(sb?.cr ?? 0);
            return sum + (CR_XP[crStr] ?? 0);
        }, 0);
        const pcs = combatants.filter(c => c.type === "pc").length;
        return { totalXp, perPlayer: pcs > 0 ? Math.floor(totalXp / pcs) : totalXp, pcs };
    })();

    // ── Handlers ──────────────────────────────────────────────────────────────

    const rollInit = useCallback((id: string) => {
        setCombatants(prev => prev.map(c => {
            if (c.id !== id) return c;
            const roll = rollD20(c.dexMod);
            addLog(`${c.name} rolled initiative: ${roll}`, "info");
            return { ...c, initiative: roll };
        }));
    }, [addLog]);

    const setInit = useCallback((id: string, val: number | null) => {
        setCombatants(prev => prev.map(c => c.id === id ? { ...c, initiative: val } : c));
    }, []);

    function rollAll() {
        setCombatants(prev => prev.map(c => {
            const roll = rollD20(c.dexMod);
            return { ...c, initiative: roll };
        }));
        addLog("All initiatives rolled", "info");
    }

    function resetCombat() {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        client.models.Encounter.update({ id: encounterId, combatStateJson: "" });
        setLoading(true);
        setLog([]);
        initFromDB();
    }

    const adjustHp = useCallback((id: string, delta: number, doLog = false) => {
        // Auto concentration check (read from ref to avoid stale closure)
        if (delta < 0 && doLog && settingsRef.current.autoRollConcentrationCheck) {
            const target = combatantsRef.current.find(c => c.id === id);
            if (target?.concentrating && target.currentHp > 0) {
                const actualDamage = target.tempHp > 0
                    ? Math.max(0, Math.abs(delta) - target.tempHp)
                    : Math.abs(delta);
                if (actualDamage > 0) {
                    const dc = Math.max(10, Math.floor(actualDamage / 2));
                    const dieRoll = Math.floor(Math.random() * 20) + 1;
                    const conMod = target.conSaveMod ?? 0;
                    const total = dieRoll + conMod;
                    const passed = total >= dc;
                    const modStr = conMod >= 0 ? `+${conMod}` : `${conMod}`;
                    addLog(
                        `Concentration check: ${target.name} rolled ${dieRoll}${modStr} = ${total} vs DC ${dc} — ${passed ? "✓ PASS" : "✗ FAIL"}`,
                        passed ? "info" : "status"
                    );
                    setConcCheck({ combatantId: id, name: target.name, roll: dieRoll, mod: conMod, total, dc, passed });
                }
            }
        }
        setCombatants(prev => prev.map(c => {
            if (c.id !== id) return c;
            const effective = delta < 0 && c.tempHp > 0
                ? (() => {
                    const absorbed = Math.min(c.tempHp, Math.abs(delta));
                    return { newHp: c.currentHp, newTemp: c.tempHp - absorbed, leftover: Math.abs(delta) - absorbed };
                })()
                : { newHp: c.currentHp + delta, newTemp: c.tempHp, leftover: 0 };
            const newHp = Math.min(c.maxHp, Math.max(0, effective.newHp - effective.leftover));
            if (doLog) {
                if (delta < 0) {
                    if (newHp <= 0 && c.currentHp > 0) {
                        addLog(`${c.name} dropped to 0 HP!`, "kill");
                    } else {
                        addLog(`${c.name} took ${Math.abs(delta)} damage (${newHp}/${c.maxHp} HP)`, "damage");
                    }
                } else {
                    addLog(`${c.name} healed ${delta} HP (${newHp}/${c.maxHp} HP)`, "heal");
                }
            }
            return { ...c, currentHp: newHp, tempHp: effective.newTemp,
                deathSaves: newHp > 0 ? { successes: 0, failures: 0 } : c.deathSaves };
        }));
    }, [addLog]);

    const setHp = useCallback((id: string, hp: number) => {
        setCombatants(prev => prev.map(c => c.id === id
            ? { ...c, currentHp: Math.min(c.maxHp, Math.max(0, hp)),
                deathSaves: hp > 0 ? { successes: 0, failures: 0 } : c.deathSaves }
            : c));
    }, []);

    const setTempHp = useCallback((id: string, hp: number) => {
        setCombatants(prev => prev.map(c => c.id === id ? { ...c, tempHp: Math.max(c.tempHp, hp) } : c));
    }, []);

    const setDeathSaves = useCallback((id: string, type: "successes"|"failures", count: number) => {
        setCombatants(prev => prev.map(c => c.id === id
            ? { ...c, deathSaves: { ...c.deathSaves, [type]: Math.min(3, Math.max(0, count)) } } : c));
    }, []);

    const toggleCondition = useCallback((id: string, cond: string) => {
        setCombatants(prev => prev.map(c => {
            if (c.id !== id) return c;
            const next = c.conditions.includes(cond) ? c.conditions.filter(x => x !== cond) : [...c.conditions, cond];
            addLog(`${c.name}: ${cond} ${c.conditions.includes(cond) ? "removed" : "applied"}`, "status");
            return { ...c, conditions: next };
        }));
    }, [addLog]);

    const toggleConcentration = useCallback((id: string) => {
        setCombatants(prev => prev.map(c => {
            if (c.id !== id) return c;
            addLog(`${c.name}: concentration ${c.concentrating ? "ended" : "started"}`, "status");
            return { ...c, concentrating: !c.concentrating };
        }));
    }, [addLog]);

    const setConcentrationSpell = useCallback((id: string, spell: string) => {
        setCombatants(prev => prev.map(c => c.id === id ? { ...c, concentrationSpell: spell } : c));
    }, []);

    const adjustLegendary = useCallback((id: string, delta: number) => {
        setCombatants(prev => prev.map(c => c.id === id
            ? { ...c, legendaryActionsRemaining: Math.max(0, Math.min(c.legendaryActionsMax, c.legendaryActionsRemaining + delta)) }
            : c));
    }, []);

    const toggleReaction = useCallback((id: string) => {
        setCombatants(prev => prev.map(c => {
            if (c.id !== id) return c;
            if (!c.reactionUsed) addLog(`${c.name} used their reaction`, "status");
            return { ...c, reactionUsed: !c.reactionUsed };
        }));
    }, [addLog]);

    const toggleSurprised = useCallback((id: string) => {
        setCombatants(prev => prev.map(c => c.id === id ? { ...c, surprised: !c.surprised } : c));
    }, []);

    const addTurnEffect = useCallback((id: string, effect: TurnEffect) => {
        setCombatants(prev => prev.map(c => c.id === id
            ? { ...c, turnEffects: [...(c.turnEffects ?? []), effect] }
            : c));
    }, []);

    const removeTurnEffect = useCallback((id: string, effectId: string) => {
        setCombatants(prev => prev.map(c => c.id === id
            ? { ...c, turnEffects: (c.turnEffects ?? []).filter(e => e.id !== effectId) }
            : c));
    }, []);

    const removeCombatant = useCallback((id: string) => {
        setCombatants(prev => {
            const next = prev.filter(c => c.id !== id);
            setActiveId(aid => {
                if (aid !== id) return aid;
                const s = [...prev].sort((a, b) => (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity));
                const si = s.findIndex(c => c.id === id);
                const ns = s.filter(c => c.id !== id);
                return ns[Math.min(si, ns.length - 1)]?.id ?? null;
            });
            return next;
        });
    }, []);

    function navigate(dir: 1 | -1) {
        if (!sorted.length) return;
        const idx = sorted.findIndex(c => c.id === activeId);
        const next = (idx + dir + sorted.length) % sorted.length;
        const currentCombatant = sorted[idx];
        const nextCombatant = sorted[next];

        function fireEffectDamage(combatantId: string, combatantName: string, effect: TurnEffect) {
            if (!effect.damage || !settingsRef.current.autoRollTurnEffectDamage) return;
            const parts = effect.damage.trim().split(/\s+/);
            const diceExpr = parts[0];
            const dmgType = parts.slice(1).join(" ");
            try {
                const rolled = new DiceRoll(diceExpr);
                const total = rolled.total;
                addLog(`${combatantName} takes ${total}${dmgType ? ` ${dmgType}` : ""} damage from ${effect.name} [${rolled.output}]`, "damage");
                adjustHp(combatantId, -total, true);
            } catch {
                addLog(`Could not roll damage for ${effect.name}: ${effect.damage}`, "status");
            }
        }

        // Fire end-of-turn effects for current combatant
        if (currentCombatant) {
            const endEffects = (currentCombatant.turnEffects ?? []).filter(e => e.timing === "end");
            if (endEffects.length > 0) {
                setEffectsAlert({ combatant: currentCombatant.name, effects: endEffects });
                endEffects.forEach(e => {
                    addLog(`End of ${currentCombatant.name}'s turn: ${e.name} — ${e.desc}`, "status");
                    fireEffectDamage(currentCombatant.id, currentCombatant.name, e);
                });
            }
        }

        if (dir === 1 && next === 0) {
            setRound(r => r + 1);
            addLog(`--- Round ${round + 1} begins ---`, "info");
            if (round === 1 && settingsRef.current.autoRemoveSurprised) {
                setCombatants(prev => {
                    const surprised = prev.filter(c => c.surprised);
                    surprised.forEach(c => addLog(`${c.name}: Surprised removed (round 1 ended)`, "status"));
                    return prev.map(c => c.surprised ? { ...c, surprised: false } : c);
                });
            }
        }
        if (dir === -1 && idx === 0 && round > 1) setRound(r => r - 1);
        setActiveId(nextCombatant.id);
        addLog(`${nextCombatant.name}'s turn`, "info");

        // Fire start-of-turn effects for next combatant
        const startEffects = (nextCombatant.turnEffects ?? []).filter(e => e.timing === "start");
        if (startEffects.length > 0) {
            setEffectsAlert({ combatant: nextCombatant.name, effects: startEffects });
            startEffects.forEach(e => {
                addLog(`Start of ${nextCombatant.name}'s turn: ${e.name} — ${e.desc}`, "status");
                fireEffectDamage(nextCombatant.id, nextCombatant.name, e);
            });
        }

        // Auto-reset reaction and legendary actions on their turn
        setCombatants(prev => prev.map(c => c.id === nextCombatant.id
            ? { ...c, reactionUsed: false, legendaryActionsRemaining: c.legendaryActionsMax }
            : c));
    }

    async function endEncounter() {
        await client.models.Encounter.update({ id: encounterId, status: "completed" });
        // Sync current HP of PCs back to their character sheets
        const pcCombatants = combatants.filter(c => c.type === "pc" && c.characterId);
        await Promise.all(pcCombatants.map(c =>
            client.models.PlayerCharacter.update({
                id: c.characterId!,
                currentHp: c.currentHp,
                tempHp: c.tempHp > 0 ? c.tempHp : undefined,
            })
        ));
        if (pcCombatants.length > 0) {
            addLog(`HP synced to character sheets for ${pcCombatants.map(c => c.name).join(", ")}`, "info");
        }
        addLog(`Encounter ended! ${xpData.perPlayer} XP per player (${xpData.totalXp} total)`, "info");
        setEndOpen(false);
    }

    const selectedCombatant = combatants.find(c => c.id === selectedId);
    const selectedSb = selectedCombatant?.monsterId ? sbMap[selectedCombatant.monsterId] : null;
    const selectedPc = selectedCombatant?.characterId ? pcMap[selectedCombatant.characterId] : null;

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "background.default" }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );

    // ── Sidebar content ───────────────────────────────────────────────────────

    const SidebarContent = (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            <Tabs value={sidebarTab} onChange={(_, v) => setSidebarTab(v)} sx={{ borderBottom: 1, borderColor: "divider", minHeight: 36 }}>
                <Tab label="Dice" sx={{ minHeight: 36, fontSize: "0.72rem", py: 0.75 }} />
                <Tab label={`Log (${log.length})`} sx={{ minHeight: 36, fontSize: "0.72rem", py: 0.75 }} />
            </Tabs>
            {sidebarTab === 0 && <DiceRollerPanel onRoll={text => addLog(text, "roll")} />}
            {sidebarTab === 1 && (
                <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <CombatLogPanel log={log} onClear={() => setLog([])} />
                </Box>
            )}
        </Box>
    );

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", display: "flex", flexDirection: "column" }}>
            {/* Sticky header */}
            <Box sx={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: "background.paper",
                borderBottom: 1, borderColor: "divider", px: 2, py: 1,
                display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}/encounters/${encounterId}`}
                    startIcon={<ArrowLeft size={14} />} sx={{ color: "text.secondary", minWidth: 0, fontSize: "0.75rem" }}>
                    Builder
                </Button>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Swords size={18} color="#8C5A3A" />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "primary.dark", fontSize: "1rem" }}>
                        {encounterName}
                    </Typography>
                </Box>
                <Chip label={`Round ${round}`} sx={{ backgroundColor: "primary.main", color: "#fff", fontWeight: 700, height: 24 }} />
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Combat automation settings (session override)">
                    <IconButton size="small" onClick={() => setSettingsOpen(true)}
                        sx={{ color: "text.secondary", "&:hover": { color: "warning.main" } }}>
                        <Settings size={16} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Roll d20+DEX for all">
                    <Button variant="outlined" size="small" startIcon={<Dices size={14} />} onClick={rollAll}
                        sx={{ borderColor: "primary.main", color: "primary.main", fontSize: "0.72rem" }}>
                        Roll All
                    </Button>
                </Tooltip>
                <Tooltip title="Reset combat to starting values">
                    <Button variant="outlined" size="small" startIcon={<RotateCcw size={12} />} onClick={resetCombat}
                        sx={{ borderColor: "text.disabled", color: "text.secondary", fontSize: "0.72rem" }}>
                        Reset
                    </Button>
                </Tooltip>
                <Tooltip title="End encounter and award XP">
                    <Button variant="outlined" size="small" startIcon={<Trophy size={12} />} onClick={() => setEndOpen(true)}
                        sx={{ borderColor: "success.main", color: "success.main", fontSize: "0.72rem" }}>
                        End
                    </Button>
                </Tooltip>
                {!isWide && (
                    <Button size="small" variant="outlined" startIcon={<Dices size={12} />}
                        onClick={() => setMobilePanel(true)}
                        sx={{ fontSize: "0.72rem", borderColor: "primary.light" }}>
                        Dice / Log
                    </Button>
                )}
                <Button variant="outlined" size="small" startIcon={<ChevronLeft size={14} />} onClick={() => navigate(-1)}
                    sx={{ color: "primary.dark", borderColor: "primary.dark", fontSize: "0.72rem" }}>
                    Prev
                </Button>
                <Button variant="contained" size="small" endIcon={<ChevronRight size={14} />} onClick={() => navigate(1)}
                    sx={{ backgroundColor: "primary.dark", fontSize: "0.72rem" }}>
                    Next
                </Button>
            </Box>

            {/* Main content */}
            <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
                {/* Combatant list */}
                <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 2, maxWidth: isWide ? "calc(100% - 280px)" : "100%" }}>
                    {sorted.length === 0 ? (
                        <Box sx={{ textAlign: "center", py: 12 }}>
                            <Shield size={40} color="#c9a87c" style={{ marginBottom: 12 }} />
                            <Typography sx={{ color: "text.secondary" }}>
                                No combatants. Go back to the builder to add monsters.
                            </Typography>
                        </Box>
                    ) : (
                        sorted.map(c => (
                            <CombatantRow key={c.id} combatant={c} isActive={c.id === activeId} round={round}
                                onAdjustHp={adjustHp} onSetHp={setHp} onSetTempHp={setTempHp}
                                onSetDeathSaves={setDeathSaves} onToggleCondition={toggleCondition}
                                onToggleConcentration={toggleConcentration}
                                onSetConcentrationSpell={setConcentrationSpell}
                                onAdjustLegendary={adjustLegendary} onToggleReaction={toggleReaction}
                                onToggleSurprised={toggleSurprised} onRemove={removeCombatant}
                                onRollInit={rollInit} onSetInit={setInit}
                                onAddTurnEffect={addTurnEffect} onRemoveTurnEffect={removeTurnEffect}
                                onClickName={id => { setSelectedId(id); setStatblockOpen(true); }}
                            />
                        ))
                    )}
                    {sorted.length > 0 && (
                        <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 2 }}>
                            <Button variant="outlined" startIcon={<ChevronLeft size={16} />} onClick={() => navigate(-1)}
                                sx={{ color: "primary.dark", borderColor: "primary.dark" }}>Prev</Button>
                            <Button variant="contained" endIcon={<ChevronRight size={16} />} onClick={() => navigate(1)}
                                sx={{ backgroundColor: "primary.dark" }}>
                                Next Turn
                            </Button>
                        </Box>
                    )}
                </Box>

                {/* Desktop sidebar */}
                {isWide && (
                    <Box sx={{ width: 280, borderLeft: 1, borderColor: "divider", display: "flex",
                        flexDirection: "column", position: "sticky", top: 57, height: "calc(100vh - 57px)",
                        backgroundColor: "background.paper", overflow: "hidden" }}>
                        {SidebarContent}
                    </Box>
                )}
            </Box>

            {/* Statblock dialog */}
            <Dialog open={statblockOpen} onClose={() => setStatblockOpen(false)} maxWidth="sm" fullWidth scroll="paper">
                <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 0 }}>
                    <Typography variant="subtitle2" sx={{ color: "text.secondary", textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: 2 }}>
                        {selectedCombatant?.type === "pc" ? "Player Character" : "Monster Statblock"}
                    </Typography>
                    <IconButton size="small" onClick={() => setStatblockOpen(false)}><X size={16} /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedSb && <MonsterStatblockPanel sb={selectedSb} />}
                    {selectedPc && !selectedSb && <PCStatblockPanel pc={selectedPc} />}
                    {!selectedSb && !selectedPc && selectedCombatant && (
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{selectedCombatant.name}</Typography>
                            <Typography variant="body2">AC {selectedCombatant.ac} · HP {selectedCombatant.maxHp}</Typography>
                        </Box>
                    )}
                </DialogContent>
            </Dialog>

            {/* End Encounter dialog */}
            <Dialog open={endOpen} onClose={() => setEndOpen(false)}>
                <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Trophy size={20} color="#15803d" />
                    Encounter Complete
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ textAlign: "center", py: 1 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: "success.main" }}>
                            {xpData.perPlayer.toLocaleString()} XP
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            per player ({xpData.pcs} players)
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mt: 1 }}>
                            Total: {xpData.totalXp.toLocaleString()} XP from {combatants.filter(c => c.type === "enemy").length} enemies
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEndOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={endEncounter} sx={{ backgroundColor: "success.main" }}>
                        Mark Complete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Concentration check result */}
            <Dialog open={!!concCheck} onClose={() => setConcCheck(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ pb: 0.5, display: "flex", alignItems: "center", gap: 1 }}>
                    <Focus size={18} color="#7c3aed" />
                    Concentration Check
                </DialogTitle>
                <DialogContent>
                    {concCheck && (
                        <Box sx={{ textAlign: "center", py: 1 }}>
                            <Typography variant="h3" sx={{ fontWeight: 800,
                                color: concCheck.passed ? "success.main" : "error.main", mb: 0.5 }}>
                                {concCheck.total}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
                                {concCheck.roll}{concCheck.mod >= 0 ? `+${concCheck.mod}` : concCheck.mod} (CON save) vs DC {concCheck.dc}
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700,
                                color: concCheck.passed ? "success.main" : "error.main" }}>
                                {concCheck.passed ? "✓ PASSED" : "✗ FAILED"}
                            </Typography>
                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                                {concCheck.name} {concCheck.passed ? "maintains" : "fails"} concentration
                            </Typography>
                            {!concCheck.passed && (
                                <Button variant="contained" color="error" size="small"
                                    sx={{ mt: 2 }}
                                    onClick={() => {
                                        toggleConcentration(concCheck.combatantId);
                                        setConcCheck(null);
                                    }}>
                                    End Concentration
                                </Button>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConcCheck(null)}>Dismiss</Button>
                </DialogActions>
            </Dialog>

            {/* Turn effects alert */}
            <Dialog open={!!effectsAlert} onClose={() => setEffectsAlert(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ pb: 0.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {effectsAlert?.effects[0]?.timing === "start" ? "▶ Start of Turn" : "◀ End of Turn"}: {effectsAlert?.combatant}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    {effectsAlert?.effects.map(eff => (
                        <Box key={eff.id} sx={{ mb: 1.5, p: 1.25, borderRadius: 1.5,
                            backgroundColor: eff.timing === "start" ? "#15803d11" : "#b4530911",
                            borderLeft: "3px solid", borderColor: eff.timing === "start" ? "#15803d" : "#b45309" }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25 }}>{eff.name}</Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>{eff.desc}</Typography>
                            {eff.damage && (
                                <Typography variant="body2" sx={{ color: "error.main", mt: 0.5 }}>
                                    Damage: <strong>{eff.damage}</strong>
                                </Typography>
                            )}
                            {eff.saveType && eff.saveDC && (
                                <Typography variant="body2" sx={{ color: "#b45309", mt: 0.25 }}>
                                    Save: DC {eff.saveDC} <strong>{eff.saveType}</strong> to end effect
                                </Typography>
                            )}
                        </Box>
                    ))}
                </DialogContent>
                <DialogActions>
                    <Button variant="contained" onClick={() => setEffectsAlert(null)} sx={{ backgroundColor: "primary.main" }}>
                        Dismiss
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Session settings dialog (not persisted to DB) */}
            <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Settings size={18} />
                    Automation Settings
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                        Session-only toggles — changes here aren't saved. Edit the encounter or campaign to persist.
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                        {(Object.keys(SETTING_META) as (keyof CombatSettings)[]).map(k => (
                            <Box key={k}>
                                <FormControlLabel
                                    control={
                                        <Switch checked={settings[k]} size="small" color="warning"
                                            onChange={() => setSettings(prev => ({ ...prev, [k]: !prev[k] }))} />
                                    }
                                    label={<Typography variant="body2" sx={{ fontWeight: 600 }}>{SETTING_META[k].label}</Typography>}
                                />
                                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", pl: 5.5 }}>
                                    {SETTING_META[k].desc}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSettingsOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Mobile dice/log panel */}
            <Dialog open={mobilePanel} onClose={() => setMobilePanel(false)} fullWidth maxWidth="sm">
                <DialogTitle sx={{ pb: 0 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="subtitle2">Dice &amp; Log</Typography>
                        <IconButton size="small" onClick={() => setMobilePanel(false)}><X size={16} /></IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ height: 480, display: "flex", flexDirection: "column", p: 0 }}>
                    {SidebarContent}
                </DialogContent>
            </Dialog>
        </Box>
    );
}
