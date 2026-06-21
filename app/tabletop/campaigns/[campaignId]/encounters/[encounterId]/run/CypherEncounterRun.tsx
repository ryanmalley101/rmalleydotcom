"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import {
    Box, Typography, Button, TextField, Paper, Chip, Divider,
    IconButton, Tooltip, CircularProgress, LinearProgress,
    Dialog, DialogTitle, DialogContent, DialogActions,
    useMediaQuery, useTheme, Tabs, Tab, FormControl, InputLabel, Select, MenuItem, Collapse,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, X, Swords, Dices, RotateCcw, Trophy, Sparkles, CheckCircle2, Circle } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { DiceRoll } from "@dice-roller/rpg-dice-roller";
import type { CypherEncounterEntry } from "../CypherEncounterBuilder";
import { loadCreatures, type CreatureSrd, creatureMeta } from "@/lib/cypherSrd";

const client = generateClient<Schema>();
type PlayerCharacter = Schema["PlayerCharacter"]["type"];

// ── Types ─────────────────────────────────────────────────────────────────────

type CombatantType = "creature" | "pc" | "placeholder";
type Phase = "pc" | "gm";
type Pool = "might" | "speed" | "intellect";
type DamageTrack = "hale" | "impaired" | "debilitated";

interface PoolState { current: number; max: number }

interface CypherRunCombatant {
    id: string;
    name: string;
    type: CombatantType;
    creatureId?: string;
    characterId?: string;
    level: number;
    targetNumber: number;
    maxHealth: number;
    currentHealth: number;
    armor: number;
    acted: boolean;
    statuses: string[];
    // PC-only:
    pools?: { might: PoolState; speed: PoolState; intellect: PoolState };
    damageTrack?: DamageTrack;
}

interface LogEntry {
    id: string;
    round: number;
    text: string;
    type: "damage" | "heal" | "kill" | "status" | "roll" | "info" | "xp";
}

interface DiceResult { expr: string; result: string; total: number; }

function uid() { return Math.random().toString(36).slice(2, 9); }
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

const DAMAGE_TRACK_ORDER: DamageTrack[] = ["hale", "impaired", "debilitated"];
const DAMAGE_TRACK_COLOR: Record<string, string> = { hale: "#2e7d32", impaired: "#f57c00", debilitated: "#c62828" };
const TYPE_COLOR: Record<CombatantType, string> = { creature: "#b71c1c", pc: "#1565c0", placeholder: "#6a1b9a" };
const TYPE_LABEL: Record<CombatantType, string> = { creature: "Creature", pc: "PC", placeholder: "NPC" };
const LOG_COLOR: Record<LogEntry["type"], string> = {
    damage: "#b71c1c", heal: "#2e7d32", kill: "#4a0000", status: "#e65100", roll: "#1565c0", info: "#546e7a", xp: "#7c3aed",
};

function parseSnapshot(json: string | null | undefined): Record<string, unknown> {
    if (!json) return {};
    try { return JSON.parse(json); } catch { return {}; }
}

// ── Dice Roller Panel (shared look with the D&D runner) ──────────────────────

function DiceRollerPanel({ onRoll }: { onRoll: (text: string) => void }) {
    const [expr, setExpr] = useState("");
    const [history, setHistory] = useState<DiceResult[]>([]);
    const [error, setError] = useState(false);

    function roll(expression: string) {
        const e = expression.trim();
        if (!e) return;
        try {
            const r = new DiceRoll(e);
            setHistory(prev => [{ expr: e, result: r.output, total: r.total }, ...prev].slice(0, 20));
            onRoll(`[Roll] ${r.output}`);
            setError(false);
        } catch { setError(true); }
    }

    return (
        <Box sx={{ p: 1.5 }}>
            <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.6rem", letterSpacing: 2, display: "block", mb: 1 }}>
                Dice Roller
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
                {["d20","d10","d6","1d6+2","1d100"].map(d => (
                    <Button key={d} size="small" variant="outlined" onClick={() => roll(d)}
                        sx={{ minWidth: 0, px: 0.75, py: 0.25, fontSize: "0.65rem", borderColor: "primary.light", color: "primary.dark" }}>
                        {d}
                    </Button>
                ))}
            </Box>
            <Box sx={{ display: "flex", gap: 0.5, mb: 1 }}>
                <TextField size="small" placeholder="3d6" value={expr} error={error}
                    onChange={e => { setExpr(e.target.value); setError(false); }}
                    onKeyDown={e => { if (e.key === "Enter") { roll(expr); setExpr(""); } }}
                    sx={{ flex: 1, "& input": { fontSize: "0.85rem", py: 0.75 } }} />
                <Button variant="contained" size="small" onClick={() => { roll(expr); setExpr(""); }}
                    sx={{ backgroundColor: "primary.main", minWidth: 0, px: 1.5 }}>
                    <Dices size={14} />
                </Button>
            </Box>
            <Box sx={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0.5 }}>
                {history.map((h, i) => (
                    <Box key={i} sx={{ borderLeft: "3px solid", borderLeftColor: "primary.light", pl: 1, py: 0.25 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.dark", display: "block" }}>
                            {h.expr} = {h.total}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

function CombatLogPanel({ log, onClear }: { log: LogEntry[]; onClear: () => void }) {
    return (
        <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.6rem", letterSpacing: 2 }}>
                    Combat Log
                </Typography>
                <Button size="small" onClick={onClear} sx={{ fontSize: "0.65rem", minWidth: 0, py: 0, color: "text.disabled" }}>Clear</Button>
            </Box>
            <Box sx={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                {log.length === 0 ? (
                    <Typography variant="caption" sx={{ color: "text.disabled", fontStyle: "italic" }}>No events yet.</Typography>
                ) : log.map(entry => (
                    <Box key={entry.id} sx={{ borderLeft: "3px solid", borderLeftColor: LOG_COLOR[entry.type], pl: 1, py: 0.25 }}>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6rem", display: "block" }}>R{entry.round}</Typography>
                        <Typography variant="caption" sx={{ fontSize: "0.72rem", lineHeight: 1.3 }}>{entry.text}</Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

// ── Combatant Row ─────────────────────────────────────────────────────────────

interface RowProps {
    c: CypherRunCombatant;
    pcs: CypherRunCombatant[];
    onAdjustHealth: (id: string, delta: number) => void;
    onSetHealth: (id: string, hp: number) => void;
    onAdjustPool: (id: string, pool: Pool, delta: number) => void;
    onSetDamageTrack: (id: string, track: CypherRunCombatant["damageTrack"]) => void;
    onToggleActed: (id: string) => void;
    onRemove: (id: string) => void;
    onClickName: (id: string) => void;
    onAddStatus: (id: string, status: string) => void;
    onRemoveStatus: (id: string, status: string) => void;
    onIntrusion: (id: string) => void;
}

function CombatantRow(props: RowProps) {
    const { c } = props;
    const [dmgAmt, setDmgAmt] = useState("");
    const [pool, setPool] = useState<Pool>("might");
    const [showIntrusion, setShowIntrusion] = useState(false);
    const [statusInput, setStatusInput] = useState("");
    const color = TYPE_COLOR[c.type];

    function applyDelta(sign: 1 | -1) {
        const n = parseInt(dmgAmt, 10);
        if (isNaN(n) || n <= 0) return;
        if (c.type === "pc" && c.pools) props.onAdjustPool(c.id, pool, sign * n);
        else props.onAdjustHealth(c.id, sign * n);
        setDmgAmt("");
    }

    return (
        <Paper elevation={1} sx={{ borderLeft: `5px solid ${color}`, borderRadius: "4px 8px 8px 4px", mb: 1.5, p: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Tooltip title={c.acted ? "Acted this phase — click to undo" : "Mark as acted this phase"}>
                    <IconButton size="small" onClick={() => props.onToggleActed(c.id)} sx={{ p: 0.25 }}>
                        {c.acted ? <CheckCircle2 size={16} color={color} /> : <Circle size={16} color="#bbb" />}
                    </IconButton>
                </Tooltip>

                <Typography onClick={() => props.onClickName(c.id)}
                    sx={{ fontWeight: 600, flex: 1, minWidth: 80, color: c.acted ? "text.disabled" : "text.primary",
                        cursor: c.creatureId ? "pointer" : "default",
                        "&:hover": c.creatureId ? { color: "primary.main", textDecoration: "underline" } : {} }}>
                    {c.name}
                </Typography>

                <Chip label={TYPE_LABEL[c.type]} size="small"
                    sx={{ backgroundColor: color, color: "#fff", fontWeight: 700, fontSize: "0.6rem", height: 18 }} />

                {c.type !== "pc" && (
                    <>
                        <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                            Lvl {c.level} (TN {c.targetNumber})
                        </Typography>
                        {c.armor > 0 && (
                            <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                                Armor {c.armor}
                            </Typography>
                        )}
                        <Typography variant="body2" sx={{ color: c.currentHealth <= 0 ? "#9e9e9e" : "#c62828", fontWeight: 700 }}>
                            {c.currentHealth}/{c.maxHealth} HP
                        </Typography>
                    </>
                )}

                {c.type === "pc" && (
                    <Tooltip title="GM Intrusion — award XP">
                        <Button size="small" startIcon={<Sparkles size={12} />}
                            onClick={() => { props.onIntrusion(c.id); setShowIntrusion(true); }}
                            sx={{ fontSize: "0.65rem", color: "#7c3aed", minWidth: 0, px: 1 }}>
                            Intrusion
                        </Button>
                    </Tooltip>
                )}

                <IconButton size="small" onClick={() => props.onRemove(c.id)}
                    sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: "error.main" } }}>
                    <X size={14} />
                </IconButton>
            </Box>

            {/* PC pools */}
            {c.type === "pc" && c.pools && (
                <Box sx={{ display: "flex", gap: 2, mt: 1, flexWrap: "wrap" }}>
                    {(["might","speed","intellect"] as const).map(p => {
                        const ps = c.pools![p];
                        const pct = ps.max > 0 ? (ps.current / ps.max) * 100 : 0;
                        const barColor = pct > 50 ? "#2e7d32" : pct > 25 ? "#f57c00" : "#c62828";
                        return (
                            <Box key={p} sx={{ minWidth: 90 }}>
                                <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "capitalize" }}>
                                    {p}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: barColor }}>
                                    {ps.current}/{ps.max}
                                </Typography>
                                <LinearProgress variant="determinate" value={pct}
                                    sx={{ width: 80, height: 4, borderRadius: 2, backgroundColor: "#e0e0e0",
                                        "& .MuiLinearProgress-bar": { backgroundColor: barColor } }} />
                            </Box>
                        );
                    })}
                    <Box>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>Damage Track</Typography>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                            {DAMAGE_TRACK_ORDER.map(track => (
                                <Chip key={track} label={track} size="small"
                                    onClick={() => props.onSetDamageTrack(c.id, track)}
                                    sx={{
                                        backgroundColor: c.damageTrack === track ? DAMAGE_TRACK_COLOR[track!] : "transparent",
                                        color: c.damageTrack === track ? "#fff" : DAMAGE_TRACK_COLOR[track!],
                                        border: `1px solid ${DAMAGE_TRACK_COLOR[track!]}`, cursor: "pointer",
                                        fontSize: "0.6rem", height: 20, textTransform: "capitalize",
                                    }} />
                            ))}
                        </Box>
                    </Box>
                </Box>
            )}

            {/* Statuses */}
            {c.statuses.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                    {c.statuses.map(s => (
                        <Chip key={s} label={s} size="small" onDelete={() => props.onRemoveStatus(c.id, s)}
                            sx={{ backgroundColor: "#8C5A3A33", fontSize: "0.65rem", height: 20 }} />
                    ))}
                </Box>
            )}

            {/* Damage/heal + status row */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mt: 1 }}>
                <TextField size="small" placeholder="Amt" value={dmgAmt}
                    onChange={e => setDmgAmt(e.target.value.replace(/\D/g, ""))}
                    sx={{ width: 60, "& input": { py: 0.5, fontSize: "0.85rem" } }} />
                {c.type === "pc" && (
                    <FormControl size="small" sx={{ minWidth: 90 }}>
                        <Select value={pool} onChange={e => setPool(e.target.value as Pool)}
                            sx={{ fontSize: "0.78rem", "& .MuiSelect-select": { py: 0.6 } }}>
                            <MenuItem value="might">Might</MenuItem>
                            <MenuItem value="speed">Speed</MenuItem>
                            <MenuItem value="intellect">Intellect</MenuItem>
                        </Select>
                    </FormControl>
                )}
                <Button size="small" variant="outlined" onClick={() => applyDelta(-1)}
                    sx={{ minWidth: 0, px: 1.5, py: 0.5, color: "error.main", borderColor: "error.main", fontSize: "0.75rem" }}>
                    Dmg
                </Button>
                <Button size="small" variant="outlined" onClick={() => applyDelta(1)}
                    sx={{ minWidth: 0, px: 1.5, py: 0.5, color: "success.main", borderColor: "success.main", fontSize: "0.75rem" }}>
                    Heal
                </Button>
                <Box sx={{ ml: "auto", display: "flex", gap: 0.5, alignItems: "center" }}>
                    <TextField size="small" placeholder="+Status" value={statusInput}
                        onChange={e => setStatusInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === "Enter" && statusInput.trim()) {
                                props.onAddStatus(c.id, statusInput.trim());
                                setStatusInput("");
                            }
                        }}
                        sx={{ width: 90, "& input": { py: 0.5, fontSize: "0.72rem" } }} />
                </Box>
            </Box>

            {/* Intrusion: give a second XP to a friend */}
            {c.type === "pc" && (
                <Collapse in={showIntrusion}>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
                        +1 XP awarded to {c.name}. Give the second point to a friend:
                    </Typography>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {props.pcs.filter(p => p.id !== c.id).map(p => (
                            <Chip key={p.id} label={p.name} size="small" clickable
                                onClick={() => { props.onIntrusion(p.id); setShowIntrusion(false); }}
                                sx={{ fontSize: "0.68rem" }} />
                        ))}
                        <Chip label="Skip (keep just 1)" size="small" variant="outlined"
                            onClick={() => setShowIntrusion(false)} sx={{ fontSize: "0.68rem" }} />
                    </Box>
                </Collapse>
            )}
        </Paper>
    );
}

// ── Creature detail panel ─────────────────────────────────────────────────────

function CreaturePanel({ sb }: { sb: CreatureSrd }) {
    return (
        <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#8C1A1A", mb: 0.25 }}>{sb.name}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>{creatureMeta(sb)}</Typography>
            {sb.description && <Typography variant="body2" sx={{ mb: 1 }}>{sb.description}</Typography>}
            {sb.motive && <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Motive</strong> {sb.motive}</Typography>}
            {sb.environment && <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Environment</strong> {sb.environment}</Typography>}
            {sb.combat && <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Combat</strong> {sb.combat}</Typography>}
            {sb.interaction && <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Interaction</strong> {sb.interaction}</Typography>}
            {sb.modifications && <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Modifications</strong> {sb.modifications}</Typography>}
            {sb.loot && <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Use/Loot</strong> {sb.loot}</Typography>}
            {sb.gm_intrusion && <Typography variant="body2" sx={{ color: "#7c3aed" }}><strong>GM Intrusion</strong> {sb.gm_intrusion}</Typography>}
        </Box>
    );
}

// ── Main Run Page ─────────────────────────────────────────────────────────────

export default function CypherEncounterRun() {
    const { campaignId, encounterId } = useParams<{ campaignId: string; encounterId: string }>();
    const theme = useTheme();
    const isWide = useMediaQuery(theme.breakpoints.up("md"));

    const [combatants, setCombatants] = useState<CypherRunCombatant[]>([]);
    const [phase, setPhase] = useState<Phase>("pc");
    const [round, setRound] = useState(1);
    const [loading, setLoading] = useState(true);
    const [encounterName, setEncounterName] = useState("Encounter");
    const [creatureMap, setCreatureMap] = useState<Record<string, CreatureSrd>>({});
    const [pcMap, setPcMap] = useState<Record<string, PlayerCharacter>>({});
    const [log, setLog] = useState<LogEntry[]>([]);
    const [sidebarTab, setSidebarTab] = useState(0);
    const [endOpen, setEndOpen] = useState(false);
    const [mobilePanel, setMobilePanel] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [statblockOpen, setStatblockOpen] = useState(false);

    const STORAGE_KEY = `run-cypher-enc-${encounterId}`;
    const lastUpdatedRef = useRef(0);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

    const addLog = useCallback((text: string, type: LogEntry["type"]) => {
        setLog(prev => [{ id: uid(), round, text, type }, ...prev].slice(0, 100));
    }, [round]);

    // ── Persistence ───────────────────────────────────────────────────────────

    const persistState = useCallback((c: CypherRunCombatant[], p: Phase, r: number, l: LogEntry[]) => {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            const now = Date.now();
            lastUpdatedRef.current = now;
            client.models.Encounter.update({
                id: encounterId,
                combatStateJson: JSON.stringify({ combatants: c, phase: p, round: r, log: l, lastUpdated: now }),
            });
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ combatants: c, phase: p, round: r, log: l, lastUpdated: now })); } catch {}
        }, 2000);
    }, [encounterId, STORAGE_KEY]);

    useEffect(() => {
        const sub = client.models.Encounter.observeQuery({ filter: { id: { eq: encounterId } } }).subscribe({
            next: ({ items }) => {
                const enc = items[0];
                if (!enc?.combatStateJson) return;
                try {
                    const remote = JSON.parse(enc.combatStateJson);
                    if ((remote.lastUpdated ?? 0) > lastUpdatedRef.current) {
                        lastUpdatedRef.current = remote.lastUpdated;
                        setCombatants(remote.combatants ?? []);
                        setPhase(remote.phase ?? "pc");
                        setRound(remote.round ?? 1);
                        setLog(remote.log ?? []);
                    }
                } catch {}
            },
        });
        return () => sub.unsubscribe();
    }, [encounterId]);

    async function initFromDB() {
        const [encRes, creatures] = await Promise.all([
            client.models.Encounter.get({ id: encounterId }),
            loadCreatures(),
        ]);
        const enc = encRes.data;
        if (!enc) return;
        setEncounterName(enc.name);
        const cMap: Record<string, CreatureSrd> = {};
        creatures.forEach(c => { cMap[c.id] = c; });
        setCreatureMap(cMap);

        const entries: CypherEncounterEntry[] = JSON.parse(enc.monstersJson ?? "[]");

        const pcRes = await client.models.PlayerCharacter.list();
        const campaignPCs = (pcRes.data ?? []).filter(pc => pc.campaignId === enc.campaignId);
        const pcMapLocal: Record<string, PlayerCharacter> = {};
        campaignPCs.forEach(pc => { pcMapLocal[pc.id] = pc; });
        setPcMap(pcMapLocal);

        const dbState = enc.combatStateJson ? (() => { try { return JSON.parse(enc.combatStateJson); } catch { return null; } })() : null;
        const lsState = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"); } catch { return null; } })();
        const saved = (dbState?.lastUpdated ?? 0) >= (lsState?.lastUpdated ?? 0) ? dbState : lsState;

        if (saved?.combatants?.length) {
            lastUpdatedRef.current = saved.lastUpdated ?? 0;
            setCombatants(saved.combatants);
            setPhase(saved.phase ?? "pc");
            setRound(saved.round ?? 1);
            setLog(saved.log ?? []);
            setLoading(false);
            return;
        }

        // Build fresh
        const list: CypherRunCombatant[] = [];
        for (const entry of entries) {
            const sb = entry.creatureId ? cMap[entry.creatureId] : null;
            const level = sb?.level ?? entry.placeholderLevel ?? entry.level ?? 3;
            const health = parseInt(sb?.health ?? "", 10) || entry.placeholderHealth || level * 3;
            const armor = parseInt(sb?.armor ?? "", 10) || 0;
            for (let i = 0; i < entry.count; i++) {
                const name = entry.count > 1 ? `${entry.name} ${i + 1}` : entry.name;
                list.push({
                    id: uid(), name, type: entry.type === "placeholder" ? "placeholder" : "creature",
                    creatureId: entry.creatureId, level,
                    targetNumber: sb?.target_number ?? level * 3,
                    maxHealth: health, currentHealth: health,
                    armor, acted: false, statuses: [],
                });
            }
        }
        for (const pc of campaignPCs) {
            const snap = parseSnapshot(pc.systemDataJson);
            list.push({
                id: uid(), name: pc.characterName, type: "pc", characterId: pc.id,
                level: pc.level ?? 1, targetNumber: 0, maxHealth: 0, currentHealth: 0, armor: 0,
                acted: false, statuses: [],
                pools: {
                    might: { current: Number(snap.currentMight ?? 10), max: Number(snap.mightPool ?? 10) },
                    speed: { current: Number(snap.currentSpeed ?? 10), max: Number(snap.speedPool ?? 10) },
                    intellect: { current: Number(snap.currentIntellect ?? 10), max: Number(snap.intellectPool ?? 10) },
                },
                damageTrack: (snap.damageTrack as CypherRunCombatant["damageTrack"]) ?? "hale",
            });
        }
        setCombatants(list);
        setLoading(false);
    }

    useEffect(() => { initFromDB(); }, [encounterId]);

    useEffect(() => {
        if (loading) return;
        persistState(combatants, phase, round, log);
    }, [combatants, phase, round, log, loading]);

    const pcs = useMemo(() => combatants.filter(c => c.type === "pc"), [combatants]);
    const creatures = useMemo(() => combatants.filter(c => c.type !== "pc"), [combatants]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const adjustHealth = useCallback((id: string, delta: number) => {
        setCombatants(prev => prev.map(c => {
            if (c.id !== id) return c;
            const newHp = clamp(c.currentHealth + delta, 0, c.maxHealth);
            if (delta < 0) {
                if (newHp <= 0 && c.currentHealth > 0) addLog(`${c.name} dropped to 0 health!`, "kill");
                else addLog(`${c.name} took ${Math.abs(delta)} damage (${newHp}/${c.maxHealth})`, "damage");
            } else {
                addLog(`${c.name} healed ${delta} (${newHp}/${c.maxHealth})`, "heal");
            }
            return { ...c, currentHealth: newHp };
        }));
    }, [addLog]);

    const setHealth = useCallback((id: string, hp: number) => {
        setCombatants(prev => prev.map(c => c.id === id ? { ...c, currentHealth: clamp(hp, 0, c.maxHealth) } : c));
    }, []);

    const adjustPool = useCallback((id: string, pool: Pool, delta: number) => {
        setCombatants(prev => prev.map(c => {
            if (c.id !== id || !c.pools) return c;
            const ps = c.pools[pool];
            const newCurrent = clamp(ps.current + delta, 0, ps.max);
            const overflowed = delta < 0 && ps.current + delta < 0;
            if (delta < 0) addLog(`${c.name} took ${Math.abs(delta)} ${pool} damage (${newCurrent}/${ps.max})`, "damage");
            else addLog(`${c.name} recovered ${delta} ${pool} (${newCurrent}/${ps.max})`, "heal");

            let track = c.damageTrack ?? "hale";
            if (overflowed) {
                const idx = DAMAGE_TRACK_ORDER.indexOf(track);
                if (idx < DAMAGE_TRACK_ORDER.length - 1) {
                    track = DAMAGE_TRACK_ORDER[idx + 1];
                    addLog(`${c.name} moves a step down the damage track: ${track}`, "status");
                } else {
                    addLog(`${c.name} is debilitated and took a Pool to 0 again — consider this character dying.`, "kill");
                }
            }
            return { ...c, pools: { ...c.pools, [pool]: { ...ps, current: newCurrent } }, damageTrack: track };
        }));
    }, [addLog]);

    const setDamageTrack = useCallback((id: string, track: CypherRunCombatant["damageTrack"]) => {
        setCombatants(prev => prev.map(c => c.id === id ? { ...c, damageTrack: track } : c));
    }, []);

    const toggleActed = useCallback((id: string) => {
        setCombatants(prev => prev.map(c => c.id === id ? { ...c, acted: !c.acted } : c));
    }, []);

    const addStatus = useCallback((id: string, status: string) => {
        setCombatants(prev => prev.map(c => c.id === id && !c.statuses.includes(status)
            ? { ...c, statuses: [...c.statuses, status] } : c));
    }, []);

    const removeStatus = useCallback((id: string, status: string) => {
        setCombatants(prev => prev.map(c => c.id === id ? { ...c, statuses: c.statuses.filter(s => s !== status) } : c));
    }, []);

    const removeCombatant = useCallback((id: string) => {
        setCombatants(prev => prev.filter(c => c.id !== id));
    }, []);

    const awardXp = useCallback((id: string) => {
        setCombatants(prev => {
            const target = prev.find(c => c.id === id);
            if (target) addLog(`${target.name} awarded 1 XP (GM intrusion)`, "xp");
            return prev;
        });
        const pc = pcMap[combatants.find(c => c.id === id)?.characterId ?? ""];
        if (pc) {
            const newXp = (pc.xp ?? 0) + 1;
            client.models.PlayerCharacter.update({ id: pc.id, xp: newXp });
            setPcMap(prev => ({ ...prev, [pc.id]: { ...pc, xp: newXp } }));
        }
    }, [pcMap, combatants, addLog]);

    function nextPhase() {
        if (phase === "pc") {
            setPhase("gm");
            setCombatants(prev => prev.map(c => c.type !== "pc" ? { ...c, acted: false } : c));
            addLog("GM Phase begins — NPCs and creatures act", "info");
        } else {
            setPhase("pc");
            setRound(r => r + 1);
            setCombatants(prev => prev.map(c => c.type === "pc" ? { ...c, acted: false } : c));
            addLog(`--- Round ${round + 1} begins — PC Phase ---`, "info");
        }
    }

    function resetCombat() {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        client.models.Encounter.update({ id: encounterId, combatStateJson: "" });
        setLoading(true);
        setLog([]);
        initFromDB();
    }

    async function endEncounter() {
        await client.models.Encounter.update({ id: encounterId, status: "completed" });
        await Promise.all(pcs.filter(c => c.characterId && c.pools).map(async c => {
            const fresh = await client.models.PlayerCharacter.get({ id: c.characterId! });
            const snap = parseSnapshot(fresh.data?.systemDataJson);
            const merged = {
                ...snap,
                currentMight: c.pools!.might.current, mightPool: c.pools!.might.max,
                currentSpeed: c.pools!.speed.current, speedPool: c.pools!.speed.max,
                currentIntellect: c.pools!.intellect.current, intellectPool: c.pools!.intellect.max,
                damageTrack: c.damageTrack ?? "hale",
            };
            await client.models.PlayerCharacter.update({ id: c.characterId!, systemDataJson: JSON.stringify(merged) });
        }));
        addLog(`Encounter ended. Pools synced to character sheets for ${pcs.map(c => c.name).join(", ") || "no PCs"}.`, "info");
        setEndOpen(false);
    }

    const selected = combatants.find(c => c.id === selectedId);
    const selectedSrd = selected?.creatureId ? creatureMap[selected.creatureId] : null;

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "background.default" }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );

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
                <Chip label={phase === "pc" ? "PC Phase" : "GM Phase"}
                    sx={{ backgroundColor: phase === "pc" ? "#1565c0" : "#b71c1c", color: "#fff", fontWeight: 700, height: 24 }} />
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Reset combat to starting values">
                    <Button variant="outlined" size="small" startIcon={<RotateCcw size={12} />} onClick={resetCombat}
                        sx={{ borderColor: "text.disabled", color: "text.secondary", fontSize: "0.72rem" }}>
                        Reset
                    </Button>
                </Tooltip>
                <Tooltip title="End encounter and sync PC pools back to character sheets">
                    <Button variant="outlined" size="small" startIcon={<Trophy size={12} />} onClick={() => setEndOpen(true)}
                        sx={{ borderColor: "success.main", color: "success.main", fontSize: "0.72rem" }}>
                        End
                    </Button>
                </Tooltip>
                {!isWide && (
                    <Button size="small" variant="outlined" startIcon={<Dices size={12} />} onClick={() => setMobilePanel(true)}
                        sx={{ fontSize: "0.72rem", borderColor: "primary.light" }}>
                        Dice / Log
                    </Button>
                )}
                <Button variant="contained" size="small" onClick={nextPhase} sx={{ backgroundColor: "primary.dark", fontSize: "0.72rem" }}>
                    {phase === "pc" ? "End PC Phase →" : "End GM Phase → Next Round"}
                </Button>
            </Box>

            <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
                <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 2, maxWidth: isWide ? "calc(100% - 280px)" : "100%" }}>
                    {combatants.length === 0 ? (
                        <Box sx={{ textAlign: "center", py: 12 }}>
                            <Swords size={40} color="#c9a87c" style={{ marginBottom: 12 }} />
                            <Typography sx={{ color: "text.secondary" }}>
                                No combatants. Go back to the builder to add creatures.
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                                Player Characters
                            </Typography>
                            {pcs.map(c => (
                                <CombatantRow key={c.id} c={c} pcs={pcs}
                                    onAdjustHealth={adjustHealth} onSetHealth={setHealth} onAdjustPool={adjustPool}
                                    onSetDamageTrack={setDamageTrack} onToggleActed={toggleActed} onRemove={removeCombatant}
                                    onClickName={id => { setSelectedId(id); setStatblockOpen(true); }}
                                    onAddStatus={addStatus} onRemoveStatus={removeStatus} onIntrusion={awardXp} />
                            ))}
                            <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2, display: "block", mt: 2 }}>
                                Creatures &amp; NPCs
                            </Typography>
                            {creatures.map(c => (
                                <CombatantRow key={c.id} c={c} pcs={pcs}
                                    onAdjustHealth={adjustHealth} onSetHealth={setHealth} onAdjustPool={adjustPool}
                                    onSetDamageTrack={setDamageTrack} onToggleActed={toggleActed} onRemove={removeCombatant}
                                    onClickName={id => { setSelectedId(id); setStatblockOpen(true); }}
                                    onAddStatus={addStatus} onRemoveStatus={removeStatus} onIntrusion={awardXp} />
                            ))}
                        </>
                    )}
                </Box>

                {isWide && (
                    <Box sx={{ width: 280, borderLeft: 1, borderColor: "divider", display: "flex",
                        flexDirection: "column", position: "sticky", top: 57, height: "calc(100vh - 57px)",
                        backgroundColor: "background.paper", overflow: "hidden" }}>
                        {SidebarContent}
                    </Box>
                )}
            </Box>

            {/* Creature statblock dialog */}
            <Dialog open={statblockOpen} onClose={() => setStatblockOpen(false)} maxWidth="sm" fullWidth scroll="paper">
                <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 0 }}>
                    <Typography variant="subtitle2" sx={{ color: "text.secondary", textTransform: "uppercase", fontSize: "0.65rem", letterSpacing: 2 }}>
                        {selected?.type === "pc" ? "Player Character" : "Creature"}
                    </Typography>
                    <IconButton size="small" onClick={() => setStatblockOpen(false)}><X size={16} /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedSrd && <CreaturePanel sb={selectedSrd} />}
                    {!selectedSrd && selected && (
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{selected.name}</Typography>
                            {selected.type !== "pc" && <Typography variant="body2">Level {selected.level} · {selected.currentHealth}/{selected.maxHealth} HP</Typography>}
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
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        This will mark the encounter complete and write each PC's current pools and damage track
                        back to their character sheet.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEndOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={endEncounter} sx={{ backgroundColor: "success.main" }}>
                        Mark Complete
                    </Button>
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
