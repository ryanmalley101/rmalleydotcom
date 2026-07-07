"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
    Box, Container, Button, Typography, TextField, Select, MenuItem,
    FormControl, InputLabel, LinearProgress, Paper, Chip,
    CircularProgress, Divider, Collapse, Autocomplete,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, ListOrdered, Plus, X, Trash2, ChevronRight, ChevronLeft } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { useCampaignRole } from "@/lib/useCampaignRole";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

const client = generateClient<Schema>();
type PC = Schema["PlayerCharacter"]["type"];

// ── Types ─────────────────────────────────────────────────────────────────────

type CombatantType = "pc" | "enemy" | "ally" | "neutral";
interface DeathSaves { successes: number; failures: number; }
interface Combatant {
    id: string; name: string; initiative: number;
    maxHp: number; currentHp: number; ac: number;
    type: CombatantType; conditions: string[];
    deathSaves: DeathSaves;
}
interface MonsterOption { name: string; hp: number; ac: number; }
interface CombatState { combatants: Combatant[]; activeId: string | null; round: number; }

const CONDITIONS = [
    "Blinded","Charmed","Deafened","Exhausted","Frightened",
    "Grappled","Incapacitated","Invisible","Paralyzed","Petrified",
    "Poisoned","Prone","Restrained","Stunned","Unconscious","Concentrating",
];
const TYPE_COLOR: Record<CombatantType, string> = {
    pc:"#1565c0", enemy:"#b71c1c", ally:"#2e7d32", neutral:"#546e7a",
};
const TYPE_LABEL: Record<CombatantType, string> = {
    pc:"PC", enemy:"Enemy", ally:"Ally", neutral:"NPC",
};

function uid() { return Math.random().toString(36).slice(2, 9); }
function hpColor(c: number, m: number) {
    if (c <= 0) return "#9e9e9e";
    const p = c / m;
    if (p > 0.5) return "#2e7d32";
    if (p > 0.25) return "#f57c00";
    return "#c62828";
}

function SaveCircles({ count, color, onSet }: { count: number; color: string; onSet: (n: number) => void }) {
    return (
        <Box sx={{ display: "flex", gap: 0.5 }}>
            {[0,1,2].map(i => (
                <Box key={i} onClick={() => onSet(i < count ? i : i + 1)} sx={{
                    width: 13, height: 13, borderRadius: "50%",
                    border: `2px solid ${color}`,
                    backgroundColor: i < count ? color : "transparent",
                    cursor: "pointer", flexShrink: 0,
                }} />
            ))}
        </Box>
    );
}

function CombatantRow({ combatant: c, isActive, onAdjustHp, onSetHp, onSetDeathSaves, onToggleCondition, onRemove }: {
    combatant: Combatant; isActive: boolean;
    onAdjustHp: (id: string, d: number) => void; onSetHp: (id: string, hp: number) => void;
    onSetDeathSaves: (id: string, t: "successes"|"failures", n: number) => void;
    onToggleCondition: (id: string, cond: string) => void; onRemove: (id: string) => void;
}) {
    const [delta, setDelta] = useState("");
    const [showConds, setShowConds] = useState(false);
    const [editingHp, setEditingHp] = useState(false);
    const [hpDraft, setHpDraft] = useState("");
    const color = TYPE_COLOR[c.type];
    const hpPct = Math.max(0, Math.min(100, (c.currentHp / c.maxHp) * 100));
    const isDowned = c.currentHp <= 0;
    const showDeathSaves = c.type === "pc" && isDowned;
    const isStable = c.deathSaves.successes >= 3;
    const isDead = c.deathSaves.failures >= 3;

    function applyDelta(sign: 1 | -1) {
        const n = parseInt(delta, 10);
        if (!isNaN(n) && n > 0) { onAdjustHp(c.id, sign * n); setDelta(""); }
    }
    function commitHp() {
        const n = parseInt(hpDraft, 10);
        if (!isNaN(n)) onSetHp(c.id, n);
        setEditingHp(false);
    }

    return (
        <Paper elevation={isActive ? 4 : 1} sx={{
            borderLeft: `5px solid ${color}`, borderRadius: "4px 8px 8px 4px", mb: 1.5,
            opacity: isDead ? 0.45 : 1,
            outline: isActive ? `2px solid ${color}` : "none", outlineOffset: 1,
        }}>
            <Box sx={{ p: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 40 }}>
                        {isActive && <ChevronRight size={16} color={color} />}
                        <Typography sx={{ fontWeight: 800, fontSize: "1.3rem", color, lineHeight: 1, minWidth: 28 }}>
                            {c.initiative}
                        </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 600, flex: 1, color: isDowned ? "text.disabled" : "text.primary", minWidth: 100 }}>
                        {c.name}{isDead ? " ✝" : isStable && !isDead ? " (Stable)" : ""}
                    </Typography>
                    <Chip label={TYPE_LABEL[c.type]} size="small"
                        sx={{ backgroundColor: color, color: "#fff", fontWeight: 700, fontSize: "0.65rem", height: 18 }} />
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>AC {c.ac}</Typography>
                    {editingHp ? (
                        <TextField size="small" autoFocus value={hpDraft}
                            onChange={e => setHpDraft(e.target.value.replace(/\D/g, ""))}
                            onBlur={commitHp}
                            onKeyDown={e => { if (e.key === "Enter") commitHp(); if (e.key === "Escape") setEditingHp(false); }}
                            sx={{ width: 64, "& input": { py: 0.4, fontSize: "0.85rem", textAlign: "center" } }} />
                    ) : (
                        <Typography variant="body2" onClick={() => { setHpDraft(String(c.currentHp)); setEditingHp(true); }}
                            sx={{ color: hpColor(c.currentHp, c.maxHp), fontWeight: 700, cursor: "text", userSelect: "none" }}>
                            {c.currentHp}/{c.maxHp} HP
                        </Typography>
                    )}
                    <Button size="small" onClick={() => onRemove(c.id)}
                        sx={{ minWidth: 0, p: 0.25, color: "text.disabled", "&:hover": { color: "error.main" } }}>
                        <X size={14} />
                    </Button>
                </Box>

                <LinearProgress variant="determinate" value={hpPct} sx={{
                    mt: 0.75, mb: 1, height: 5, borderRadius: 3, backgroundColor: "#e0e0e0",
                    "& .MuiLinearProgress-bar": { backgroundColor: hpColor(c.currentHp, c.maxHp) },
                }} />

                {showDeathSaves && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                        <Typography variant="caption" sx={{ color: "text.secondary", minWidth: 70 }}>Death Saves</Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            <Typography variant="caption" sx={{ color: "#2e7d32", fontSize: "0.68rem" }}>Suc</Typography>
                            <SaveCircles count={c.deathSaves.successes} color="#2e7d32" onSet={n => onSetDeathSaves(c.id,"successes",n)} />
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            <Typography variant="caption" sx={{ color: "#c62828", fontSize: "0.68rem" }}>Fail</Typography>
                            <SaveCircles count={c.deathSaves.failures} color="#c62828" onSet={n => onSetDeathSaves(c.id,"failures",n)} />
                        </Box>
                    </Box>
                )}

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TextField size="small" placeholder="Amt" value={delta}
                        onChange={e => setDelta(e.target.value.replace(/\D/g,""))}
                        onKeyDown={e => { if (e.key === "Enter") applyDelta(-1); }}
                        sx={{ width: 68, "& input": { py: 0.5, fontSize: "0.85rem" } }} />
                    <Button size="small" variant="outlined" onClick={() => applyDelta(-1)}
                        sx={{ minWidth: 0, px: 1.5, py: 0.5, color: "error.main", borderColor: "error.main" }}>Dmg</Button>
                    <Button size="small" variant="outlined" onClick={() => applyDelta(1)}
                        sx={{ minWidth: 0, px: 1.5, py: 0.5, color: "success.main", borderColor: "success.main" }}>Heal</Button>
                    <Button size="small" onClick={() => setShowConds(v => !v)}
                        sx={{ ml: "auto", fontSize: "0.7rem", color: "text.secondary", minWidth: 0, px: 1 }}>
                        {showConds ? "▲ Conditions" : "▼ Conditions"}
                    </Button>
                </Box>

                {c.conditions.length > 0 && !showConds && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                        {c.conditions.map(cond => (
                            <Chip key={cond} label={cond} size="small" onDelete={() => onToggleCondition(c.id, cond)}
                                sx={{ backgroundColor: "#8C5A3A33", fontSize: "0.68rem", height: 20 }} />
                        ))}
                    </Box>
                )}

                <Collapse in={showConds}>
                    <Divider sx={{ my: 0.75 }} />
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {CONDITIONS.map(cond => {
                            const active = c.conditions.includes(cond);
                            return (
                                <Chip key={cond} label={cond} size="small" onClick={() => onToggleCondition(c.id, cond)}
                                    variant={active ? "filled" : "outlined"}
                                    sx={{ fontSize: "0.68rem", height: 20, cursor: "pointer",
                                        ...(active && { backgroundColor: "#8C5A3A", color: "#fff" }) }} />
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

export default function CampaignInitiativePage() {
    const { campaignId } = useParams<{ campaignId: string }>();
    const { isGm: isGM } = useCampaignRole(campaignId);
    useDocumentTitle("Initiative Tracker");

    const [combatants, setCombatants] = useState<Combatant[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [round, setRound] = useState(1);
    const [form, setForm] = useState(EMPTY_FORM);
    const [monsters, setMonsters] = useState<MonsterOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load campaign initiativeJson + pre-populate PCs
    useEffect(() => {
        Promise.all([
            client.models.Campaign.get({ id: campaignId }),
            client.models.PlayerCharacter.list(),
        ]).then(([campRes, pcRes]) => {
            const camp = campRes.data;
            const pcs = (pcRes.data ?? []).filter(p => p.campaignId === campaignId);

            if (camp?.initiativeJson) {
                try {
                    const s: CombatState = JSON.parse(camp.initiativeJson);
                    const migrated = (s.combatants ?? []).map(c => ({
                        ...c, deathSaves: c.deathSaves ?? { successes: 0, failures: 0 },
                    }));
                    setCombatants(migrated);
                    setActiveId(s.activeId ?? null);
                    setRound(s.round ?? 1);
                } catch {}
            } else if (pcs.length > 0) {
                // No saved state — pre-populate with PCs
                const initial: Combatant[] = pcs.map(pc => ({
                    id: uid(),
                    name: pc.characterName,
                    initiative: 0,
                    maxHp: pc.maxHp ?? 10,
                    currentHp: pc.currentHp ?? pc.maxHp ?? 10,
                    ac: pc.armorClass ?? 10,
                    type: "pc",
                    conditions: [],
                    deathSaves: { successes: 0, failures: 0 },
                }));
                setCombatants(initial);
            }
        }).finally(() => setLoading(false));

        fetch("/5_5_SRD/monsters.json").then(r => r.json()).then(d => {
            setMonsters((d.monsters ?? []).map((m: Record<string, unknown>) => ({
                name: m.name as string, hp: m.hit_points as number, ac: m.armor_class as number,
            })));
        }).catch(() => {});
    }, [campaignId]);

    // Debounced autosave to Campaign
    function scheduleAutosave(state: CombatState) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            setSaving(true);
            await client.models.Campaign.update({ id: campaignId, initiativeJson: JSON.stringify(state) });
            setSaving(false);
        }, 800);
    }

    function updateState(next: Partial<CombatState> & { combatants?: Combatant[] }) {
        const state: CombatState = {
            combatants: next.combatants ?? combatants,
            activeId: next.activeId !== undefined ? next.activeId : activeId,
            round: next.round ?? round,
        };
        scheduleAutosave(state);
    }

    const sorted = [...combatants].sort((a, b) =>
        b.initiative - a.initiative || a.name.localeCompare(b.name)
    );

    function addCombatant() {
        const init = parseInt(form.initiative, 10);
        const hp = parseInt(form.hp, 10);
        const ac = parseInt(form.ac, 10);
        if (!form.name.trim() || isNaN(init) || isNaN(hp) || isNaN(ac)) return;
        const id = uid();
        const next = [...combatants, {
            id, name: form.name.trim(), initiative: init,
            maxHp: hp, currentHp: hp, ac, type: form.type,
            conditions: [], deathSaves: { successes: 0, failures: 0 },
        }];
        setCombatants(next);
        if (activeId === null) setActiveId(id);
        setForm(EMPTY_FORM);
        updateState({ combatants: next, activeId: activeId ?? id });
    }

    const adjustHp = useCallback((id: string, delta: number) => {
        setCombatants(prev => {
            const next = prev.map(c => c.id === id ? {
                ...c, currentHp: Math.min(c.maxHp, Math.max(0, c.currentHp + delta)),
                deathSaves: (c.currentHp + delta) > 0 ? { successes:0, failures:0 } : c.deathSaves,
            } : c);
            scheduleAutosave({ combatants: next, activeId, round });
            return next;
        });
    }, [activeId, round]); // eslint-disable-line react-hooks/exhaustive-deps

    const setHp = useCallback((id: string, hp: number) => {
        setCombatants(prev => {
            const next = prev.map(c => c.id === id ? {
                ...c, currentHp: Math.min(c.maxHp, Math.max(0, hp)),
                deathSaves: hp > 0 ? { successes:0, failures:0 } : c.deathSaves,
            } : c);
            scheduleAutosave({ combatants: next, activeId, round });
            return next;
        });
    }, [activeId, round]); // eslint-disable-line react-hooks/exhaustive-deps

    const setDeathSaves = useCallback((id: string, type: "successes"|"failures", count: number) => {
        setCombatants(prev => {
            const next = prev.map(c => c.id === id
                ? { ...c, deathSaves: { ...c.deathSaves, [type]: Math.min(3, Math.max(0, count)) } } : c);
            scheduleAutosave({ combatants: next, activeId, round });
            return next;
        });
    }, [activeId, round]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleCondition = useCallback((id: string, cond: string) => {
        setCombatants(prev => {
            const next = prev.map(c => c.id === id ? {
                ...c, conditions: c.conditions.includes(cond) ? c.conditions.filter(x => x !== cond) : [...c.conditions, cond],
            } : c);
            scheduleAutosave({ combatants: next, activeId, round });
            return next;
        });
    }, [activeId, round]); // eslint-disable-line react-hooks/exhaustive-deps

    const removeCombatant = useCallback((id: string) => {
        setCombatants(prev => {
            const next = prev.filter(c => c.id !== id);
            const s = [...prev].sort((a,b) => b.initiative - a.initiative || a.name.localeCompare(b.name));
            const si = s.findIndex(c => c.id === id);
            const ns = s.filter(c => c.id !== id);
            const newActive = ns[Math.min(si, ns.length - 1)]?.id ?? null;
            setActiveId(newActive);
            scheduleAutosave({ combatants: next, activeId: newActive, round });
            return next;
        });
    }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

    function navigate(dir: 1 | -1) {
        if (!sorted.length) return;
        const idx = sorted.findIndex(c => c.id === activeId);
        const next = (idx + dir + sorted.length) % sorted.length;
        const newRound = dir === 1 && next === 0 ? round + 1 : dir === -1 && idx === 0 && round > 1 ? round - 1 : round;
        setRound(newRound);
        setActiveId(sorted[next].id);
        updateState({ activeId: sorted[next].id, round: newRound });
    }

    async function clearCombat() {
        setCombatants([]);
        setActiveId(null);
        setRound(1);
        await client.models.Campaign.update({ id: campaignId, initiativeJson: undefined });
    }

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                    <ListOrdered size={32} color="#8C5A3A" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        Initiative Tracker
                    </Typography>
                    {saving && <CircularProgress size={16} sx={{ color: "primary.main" }} />}
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    State persists across refreshes. PCs are pre-loaded from the campaign roster.
                </Typography>

                {/* Add combatant form */}
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                        Add Combatant
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1.5, mt: 1, flexWrap: "wrap", alignItems: "flex-end" }}>
                        <Autocomplete freeSolo options={monsters} getOptionLabel={o => typeof o === "string" ? o : o.name}
                            filterOptions={(options, { inputValue }) => {
                                const lc = inputValue.toLowerCase();
                                return options.filter(o => o.name.toLowerCase().includes(lc)).slice(0, 10);
                            }}
                            inputValue={form.name}
                            onInputChange={(_, v) => setForm(f => ({ ...f, name: v }))}
                            onChange={(_, v) => {
                                if (v && typeof v === "object") {
                                    setForm(f => ({ ...f, name: v.name, hp: String(v.hp), ac: String(v.ac), type: "enemy" }));
                                }
                            }}
                            renderInput={params => (
                                <TextField {...params} size="small" label="Name / Monster"
                                    onKeyDown={e => { if (e.key === "Enter" && !params.inputProps["aria-expanded"]) addCombatant(); }} />
                            )}
                            sx={{ flex: "1 1 180px" }} />
                        <TextField size="small" label="Init" type="number" value={form.initiative}
                            onChange={e => setForm(f => ({ ...f, initiative: e.target.value }))} sx={{ width: 72 }} />
                        <TextField size="small" label="Max HP" type="number" value={form.hp}
                            onChange={e => setForm(f => ({ ...f, hp: e.target.value }))} sx={{ width: 80 }} />
                        <TextField size="small" label="AC" type="number" value={form.ac}
                            onChange={e => setForm(f => ({ ...f, ac: e.target.value }))} sx={{ width: 68 }} />
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                            <InputLabel>Type</InputLabel>
                            <Select value={form.type} label="Type" onChange={e => setForm(f => ({ ...f, type: e.target.value as CombatantType }))}>
                                <MenuItem value="pc">PC</MenuItem>
                                <MenuItem value="enemy">Enemy</MenuItem>
                                <MenuItem value="ally">Ally</MenuItem>
                                <MenuItem value="neutral">NPC</MenuItem>
                            </Select>
                        </FormControl>
                        <Button variant="contained" startIcon={<Plus size={16} />} onClick={addCombatant}
                            sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" }, whiteSpace: "nowrap" }}>
                            Add
                        </Button>
                    </Box>
                </Paper>

                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        {combatants.length > 0 && (
                            <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 2 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: "primary.dark" }}>
                                    Round {round}
                                </Typography>
                                <Box sx={{ flex: 1 }} />
                                <Button size="small" startIcon={<Trash2 size={14} />} onClick={clearCombat}
                                    sx={{ color: "text.secondary" }}>
                                    Clear Combat
                                </Button>
                            </Box>
                        )}

                        {sorted.length === 0 ? (
                            <Typography sx={{ color: "text.secondary", textAlign: "center", py: 8 }}>
                                Add combatants above to begin. PCs from your campaign roster will pre-populate on the first load.
                            </Typography>
                        ) : (
                            sorted.map(c => (
                                <CombatantRow key={c.id} combatant={c} isActive={c.id === activeId}
                                    onAdjustHp={adjustHp} onSetHp={setHp}
                                    onSetDeathSaves={setDeathSaves} onToggleCondition={toggleCondition}
                                    onRemove={removeCombatant} />
                            ))
                        )}

                        {sorted.length > 0 && (
                            <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 3 }}>
                                <Button variant="outlined" startIcon={<ChevronLeft size={18} />}
                                    onClick={() => navigate(-1)}
                                    sx={{ color: "primary.dark", borderColor: "primary.dark" }}>
                                    Prev
                                </Button>
                                <Button variant="contained" endIcon={<ChevronRight size={18} />}
                                    onClick={() => navigate(1)}
                                    sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" } }}>
                                    Next Turn
                                </Button>
                            </Box>
                        )}
                    </>
                )}
            </Container>
        </Box>
    );
}
