"use client";

import { useState, useCallback, type KeyboardEvent } from "react";
import {
    Box, Container, Typography, Button, TextField, Paper,
    Chip, Divider, CircularProgress, MenuItem, Select,
    FormControl, InputLabel, IconButton, Tooltip, Dialog,
    DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Pencil, Save, X, Trash2, Plus, RotateCcw, Search, Dices } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import { useRouter } from "next/navigation";
import type { Schema } from "@/amplify/data/resource";
import { DiceRoll } from "@dice-roller/rpg-dice-roller";
import { SrdPickerDialog } from "../../SrdPickerDialog";
import {
    loadAbilities, loadCyphers, loadArcs, searchSrd, formatArcSteps,
    type AbilitySrd, type CypherSrd, type ArcSrd,
} from "@/lib/cypherSrd";

const client = generateClient<Schema>();
type PC = Schema["PlayerCharacter"]["type"];

// ── Data types ────────────────────────────────────────────────────────────────

interface SkillEntry    { name: string; level: "trained" | "specialized" | "inability" }
interface AbilityEntry  { name: string; cost?: string; description: string }
interface CypherEntry   { name: string; level: string; form?: string; effect: string }
interface ArtifactEntry { name: string; level?: number; form?: string; effect: string; depletion?: string }
interface EquipmentEntry{ name: string; quantity?: number }
interface ArcEntry      { name: string; description: string; status: "active" | "completed"; notes: string }

interface CypherData {
    mightPool: number; mightEdge: number; currentMight: number;
    speedPool: number; speedEdge: number; currentSpeed: number;
    intellectPool: number; intellectEdge: number; currentIntellect: number;
    effort: number;
    damageTrack: "hale" | "impaired" | "debilitated";
    recovery: { action: boolean; tenMin: boolean; oneHour: boolean; tenHour: boolean };
    skills:    SkillEntry[];
    abilities: AbilityEntry[];
    cyphers:   CypherEntry[];
    artifacts: ArtifactEntry[];
    equipment: EquipmentEntry[];
    arcs:      ArcEntry[];
    shins: number;
    notes: string;
    backstory: string;
    links: string;
}

const DEFAULT_DATA: CypherData = {
    mightPool: 10, mightEdge: 0, currentMight: 10,
    speedPool: 10, speedEdge: 0, currentSpeed: 10,
    intellectPool: 10, intellectEdge: 0, currentIntellect: 10,
    effort: 1,
    damageTrack: "hale",
    recovery: { action: false, tenMin: false, oneHour: false, tenHour: false },
    skills: [], abilities: [], cyphers: [], artifacts: [], equipment: [], arcs: [],
    shins: 0, notes: "", backstory: "", links: "",
};

function parseData(json: string | null | undefined): CypherData {
    if (!json) return { ...DEFAULT_DATA };
    try { return { ...DEFAULT_DATA, ...JSON.parse(json) }; }
    catch { return { ...DEFAULT_DATA }; }
}

// ── Damage track rule reminders ───────────────────────────────────────────────

const DAMAGE_TRACK_INFO: Record<CypherData["damageTrack"], { label: string; color: string; effect: string }> = {
    hale: {
        label: "Hale", color: "#2e7d32",
        effect: "No penalties. You're functioning at full capacity.",
    },
    impaired: {
        label: "Impaired", color: "#f57c00",
        effect: "You can't apply Effort to any task, and all of your tasks are one step harder than normal.",
    },
    debilitated: {
        label: "Debilitated", color: "#c62828",
        effect: "You can't move or take physical actions. You can still think and talk, but mental actions are one step harder, and you still can't apply Effort. Reaching 0 in a Pool while already debilitated means death.",
    },
};

const SKILL_COLORS: Record<string, string> = {
    trained:      "#1565c0",
    specialized:  "#6a1b9a",
    inability:    "#c62828",
};

function rollableLevel(level: string): boolean {
    return /\d*d\d+/i.test(level.trim());
}

// ── Inline-editable number (click to edit, commits on blur/Enter) ────────────

function InlineNumber({ value, onCommit, width = 56, fontSize = "1rem", fontWeight = 700, color, min, max }: {
    value: number; onCommit: (v: number) => void; width?: number; fontSize?: string;
    fontWeight?: number; color?: string; min?: number; max?: number;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(String(value));

    function startEdit() { setDraft(String(value)); setEditing(true); }
    function commit() {
        const n = parseInt(draft, 10);
        setEditing(false);
        if (!isNaN(n)) {
            const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n));
            if (clamped !== value) onCommit(clamped);
        }
    }
    function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
    }

    return editing ? (
        <TextField size="small" autoFocus value={draft}
            onChange={e => setDraft(e.target.value.replace(/[^-\d]/g, ""))}
            onBlur={commit} onKeyDown={onKeyDown}
            sx={{ width, "& input": { textAlign: "center", fontSize, fontWeight, py: 0.3 } }} />
    ) : (
        <Typography component="span" onClick={startEdit} title="Click to edit"
            sx={{ fontSize, fontWeight, color: color ?? "text.primary", cursor: "text",
                borderBottom: "1px dashed", borderColor: "divider", px: 0.3, lineHeight: 1.4,
                "&:hover": { borderColor: "primary.main" } }}>
            {value}
        </Typography>
    );
}

// ── Stat pool cell ────────────────────────────────────────────────────────────

function PoolCell({ label, current, pool, edge, onChange }: {
    label: string; current: number; pool: number; edge: number;
    onChange: (field: "current" | "pool" | "edge", v: number) => void;
}) {
    const pct = pool > 0 ? Math.round((current / pool) * 100) : 0;
    const barColor = pct > 50 ? "#2e7d32" : pct > 25 ? "#f57c00" : "#c62828";

    return (
        <Paper elevation={2} sx={{ p: 2, textAlign: "center", minWidth: 140 }}>
            <Typography variant="overline" sx={{ color: "primary.dark", fontWeight: 700, letterSpacing: 2, fontSize: "0.7rem" }}>
                {label}
            </Typography>
            <Box sx={{ mt: 1, mb: 0.5, display: "flex", alignItems: "baseline", justifyContent: "center", gap: 0.4 }}>
                <InlineNumber value={current} onCommit={v => onChange("current", Math.max(0, v))}
                    width={52} fontSize="1.6rem" fontWeight={800} color={barColor} min={0} />
                <Typography component="span" variant="body2" sx={{ color: "text.secondary" }}>/</Typography>
                <InlineNumber value={pool} onCommit={v => onChange("pool", Math.max(1, v))}
                    width={46} fontSize="1rem" min={1} />
            </Box>
            <Box sx={{ height: 4, borderRadius: 2, backgroundColor: "#e0e0e0", overflow: "hidden", mx: 1 }}>
                <Box sx={{ height: "100%", width: `${pct}%`, backgroundColor: barColor, transition: "width 0.3s" }} />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 0.5, mt: 0.75 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>Edge</Typography>
                <InlineNumber value={edge} onCommit={v => onChange("edge", Math.max(0, v))}
                    width={36} fontSize="0.85rem" min={0} max={10} />
            </Box>
        </Paper>
    );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CypherSheet({ pc, campaignId }: { pc: PC; campaignId: string }) {
    const router = useRouter();
    const [data, setData]       = useState<CypherData>(() => parseData(pc.systemDataJson));
    const [editing, setEditing] = useState(false);
    const [saving, setSaving]   = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Identity fields (stored in top-level PC fields)
    const [name,       setName]       = useState(pc.characterName ?? "");
    const [playerName, setPlayerName] = useState(pc.playerName ?? "");
    const [descriptor, setDescriptor] = useState(pc.race ?? "");
    const [type,       setType]       = useState(pc.characterClass ?? "");
    const [focus,      setFocus]      = useState(pc.subclass ?? "");
    const [tier,       setTier]       = useState(pc.level ?? 1);
    const [xp,         setXp]         = useState(pc.xp ?? 0);

    // Inline list editors
    const [newSkill,    setNewSkill]    = useState<SkillEntry>({ name: "", level: "trained" });
    const [newAbility,  setNewAbility]  = useState<AbilityEntry>({ name: "", cost: "", description: "" });
    const [newCypher,   setNewCypher]   = useState<CypherEntry>({ name: "", level: "1", form: "", effect: "" });
    const [newArtifact, setNewArtifact] = useState<ArtifactEntry>({ name: "", level: undefined, form: "", effect: "", depletion: "" });
    const [newEquip,    setNewEquip]    = useState<EquipmentEntry>({ name: "", quantity: 1 });
    const [newArc,      setNewArc]      = useState<ArcEntry>({ name: "", description: "", status: "active", notes: "" });

    // SRD pickers
    const [picker, setPicker] = useState<null | "ability" | "cypher" | "arc">(null);

    const upd = useCallback((patch: Partial<CypherData>) => setData(d => ({ ...d, ...patch })), []);

    // Persists a partial change to systemDataJson immediately (no edit-mode gate).
    const quickSave = useCallback(async (patch: Partial<CypherData>) => {
        setData(d => {
            const next = { ...d, ...patch };
            client.models.PlayerCharacter.update({ id: pc.id, systemDataJson: JSON.stringify(next) });
            return next;
        });
    }, [pc.id]);

    // Persists Tier/XP immediately — these live on the PC record, not systemDataJson.
    async function quickSaveIdentity(patch: { tier?: number; xp?: number }) {
        if (patch.tier !== undefined) setTier(patch.tier);
        if (patch.xp !== undefined) setXp(patch.xp);
        await client.models.PlayerCharacter.update({
            id: pc.id,
            ...(patch.tier !== undefined ? { level: patch.tier } : {}),
            ...(patch.xp !== undefined ? { xp: patch.xp } : {}),
        });
    }

    function poolChange(stat: "might" | "speed" | "intellect", field: "current" | "pool" | "edge", v: number) {
        const keys: Record<typeof field, keyof CypherData> = {
            current: `current${stat.charAt(0).toUpperCase() + stat.slice(1)}` as keyof CypherData,
            pool:    `${stat}Pool` as keyof CypherData,
            edge:    `${stat}Edge` as keyof CypherData,
        };
        quickSave({ [keys[field]]: v } as Partial<CypherData>);
    }

    async function save() {
        setSaving(true);
        await client.models.PlayerCharacter.update({
            id: pc.id,
            characterName: name.trim(),
            playerName:    playerName.trim() || undefined,
            race:          descriptor.trim() || undefined,
            characterClass: type || undefined,
            subclass:      focus.trim() || undefined,
            systemDataJson: JSON.stringify(data),
        });
        setSaving(false);
        setEditing(false);
    }

    function cancelEdit() {
        setName(pc.characterName ?? "");
        setPlayerName(pc.playerName ?? "");
        setDescriptor(pc.race ?? "");
        setType(pc.characterClass ?? "");
        setFocus(pc.subclass ?? "");
        setData(parseData(pc.systemDataJson));
        setEditing(false);
    }

    async function deleteChar() {
        await client.models.PlayerCharacter.delete({ id: pc.id });
        router.push(`/tabletop/campaigns/${campaignId}`);
    }

    const dmgInfo = DAMAGE_TRACK_INFO[data.damageTrack];
    const allRecoveryUsed = Object.values(data.recovery).every(Boolean);

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                {/* Header */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
                    <Box>
                        {editing ? (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 300 }}>
                                <TextField label="Character Name" value={name} onChange={e => setName(e.target.value)} size="small" />
                                <TextField label="Player Name" value={playerName} onChange={e => setPlayerName(e.target.value)} size="small" />
                            </Box>
                        ) : (
                            <>
                                <Typography variant="h4" sx={{ fontWeight: 800, color: "primary.dark" }}>{name}</Typography>
                                {playerName && (
                                    <Typography variant="body2" sx={{ color: "text.secondary" }}>Player: {playerName}</Typography>
                                )}
                            </>
                        )}
                    </Box>
                    <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
                        {editing ? (
                            <>
                                <Button variant="contained" size="small" startIcon={saving ? <CircularProgress size={14} /> : <Save size={14} />}
                                    onClick={save} disabled={saving}
                                    sx={{ backgroundColor: "primary.main" }}>
                                    Save
                                </Button>
                                <Button size="small" startIcon={<X size={14} />} onClick={cancelEdit}>
                                    Cancel
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outlined" size="small" startIcon={<Pencil size={14} />}
                                    onClick={() => setEditing(true)}
                                    sx={{ borderColor: "primary.main", color: "primary.main" }}>
                                    Edit
                                </Button>
                                <IconButton size="small" color="error" onClick={() => setConfirmDelete(true)}>
                                    <Trash2 size={16} />
                                </IconButton>
                            </>
                        )}
                    </Box>
                </Box>

                {/* Identity row */}
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    {editing ? (
                        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                            <TextField label="Descriptor" size="small" value={descriptor}
                                onChange={e => setDescriptor(e.target.value)} sx={{ flex: "1 1 140px" }} />
                            <FormControl size="small" sx={{ flex: "1 1 140px" }}>
                                <InputLabel>Type</InputLabel>
                                <Select label="Type" value={type} onChange={e => setType(e.target.value)}>
                                    {["Warrior","Adept","Explorer","Speaker","Other"].map(t =>
                                        <MenuItem key={t} value={t}>{t}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <TextField label="Focus" size="small" value={focus}
                                onChange={e => setFocus(e.target.value)} sx={{ flex: "1 1 180px" }} />
                        </Box>
                    ) : (
                        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
                            <Typography variant="body1" sx={{ color: "text.primary" }}>
                                <strong>{descriptor || "—"}</strong>
                                {" "}
                                {type || "—"}
                                {focus ? ` who ${focus}` : ""}
                            </Typography>
                            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5,
                                    backgroundColor: "primary.dark", borderRadius: 1, px: 1, py: 0.25 }}>
                                    <Typography variant="caption" sx={{ color: "#fff", fontWeight: 700 }}>Tier</Typography>
                                    <InlineNumber value={tier} onCommit={v => quickSaveIdentity({ tier: Math.max(1, v) })}
                                        width={28} fontSize="0.8rem" fontWeight={700} color="#fff" min={1} max={6} />
                                </Box>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5,
                                    border: "1px solid", borderColor: "primary.main", borderRadius: 1, px: 1, py: 0.25 }}>
                                    <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 700 }}>XP</Typography>
                                    <InlineNumber value={xp} onCommit={v => quickSaveIdentity({ xp: Math.max(0, v) })}
                                        width={36} fontSize="0.8rem" fontWeight={700} color="#9a3412" min={0} />
                                </Box>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5,
                                    border: "1px solid", borderColor: "divider", borderRadius: 1, px: 1, py: 0.25 }}>
                                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>Effort</Typography>
                                    <InlineNumber value={data.effort} onCommit={v => quickSave({ effort: Math.max(1, v) })}
                                        width={28} fontSize="0.8rem" fontWeight={700} min={1} max={6} />
                                </Box>
                            </Box>
                        </Box>
                    )}
                </Paper>

                {/* Stat Pools */}
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 3 }}>
                    {(["might","speed","intellect"] as const).map(stat => (
                        <Box key={stat} sx={{ flex: "1 1 140px" }}>
                            <PoolCell
                                label={stat.charAt(0).toUpperCase() + stat.slice(1)}
                                current={(data as unknown as Record<string, number>)[`current${stat.charAt(0).toUpperCase() + stat.slice(1)}`]}
                                pool={(data as unknown as Record<string, number>)[`${stat}Pool`]}
                                edge={(data as unknown as Record<string, number>)[`${stat}Edge`]}
                                onChange={(f, v) => poolChange(stat, f, v)}
                            />
                        </Box>
                    ))}
                </Box>

                {/* Damage Track + Recovery */}
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "flex-start" }}>
                        <Box>
                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>Damage Track</Typography>
                            <Box sx={{ display: "flex", gap: 1 }}>
                                {(["hale","impaired","debilitated"] as const).map(track => (
                                    <Chip key={track} label={DAMAGE_TRACK_INFO[track].label} size="small"
                                        onClick={() => quickSave({ damageTrack: track })}
                                        sx={{
                                            backgroundColor: data.damageTrack === track ? DAMAGE_TRACK_INFO[track].color : "transparent",
                                            color: data.damageTrack === track ? "#fff" : DAMAGE_TRACK_INFO[track].color,
                                            border: `1px solid ${DAMAGE_TRACK_INFO[track].color}`,
                                            cursor: "pointer",
                                            fontWeight: data.damageTrack === track ? 700 : 400,
                                        }} />
                                ))}
                            </Box>
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 200 }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>Recovery Rolls</Typography>
                                {allRecoveryUsed && (
                                    <Button size="small" variant="outlined" color="warning"
                                        startIcon={<RotateCcw size={12} />}
                                        onClick={() => quickSave({ recovery: { action: false, tenMin: false, oneHour: false, tenHour: false } })}
                                        sx={{ fontSize: "0.65rem", minWidth: 0, py: 0, px: 1 }}>
                                        Reset all
                                    </Button>
                                )}
                            </Box>
                            <Box sx={{ display: "flex", gap: 1 }}>
                                {(["action","tenMin","oneHour","tenHour"] as const).map((key, i) => {
                                    const labels = ["1 Action","10 Min","1 Hour","10 Hours"];
                                    const used = data.recovery[key];
                                    return (
                                        <Chip key={key} label={labels[i]} size="small"
                                            onClick={() => quickSave({ recovery: { ...data.recovery, [key]: !used } })}
                                            sx={{
                                                backgroundColor: used ? "#546e7a" : "transparent",
                                                color: used ? "#fff" : "text.secondary",
                                                border: "1px solid #90a4ae",
                                                cursor: "pointer",
                                                textDecoration: used ? "line-through" : "none",
                                                fontSize: "0.65rem",
                                            }} />
                                    );
                                })}
                            </Box>
                        </Box>
                    </Box>

                    {/* Damage track rule reminder */}
                    <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 1, borderLeft: "3px solid", borderColor: dmgInfo.color,
                        backgroundColor: `${dmgInfo.color}11` }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: dmgInfo.color }}>
                            {dmgInfo.label}:{" "}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {dmgInfo.effect}
                        </Typography>
                    </Box>
                </Paper>

                {/* Skills */}
                <SectionHeader label="Skills" />
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    {data.skills.length === 0 && (
                        <Typography variant="body2" sx={{ color: "text.disabled", mb: 1 }}>No skills added.</Typography>
                    )}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
                        {data.skills.map((sk, i) => (
                            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5,
                                border: "1px solid", borderColor: "divider", borderRadius: 1, px: 1, py: 0.25 }}>
                                <Typography variant="body2" sx={{ color: "text.primary", fontSize: "0.82rem" }}>{sk.name}</Typography>
                                <Chip label={sk.level} size="small"
                                    sx={{ backgroundColor: SKILL_COLORS[sk.level], color: "#fff",
                                        fontSize: "0.6rem", height: 16, "& .MuiChip-label": { px: 0.5 } }} />
                                <IconButton size="small" sx={{ p: 0.25 }}
                                    onClick={() => quickSave({ skills: data.skills.filter((_, j) => j !== i) })}>
                                    <X size={10} />
                                </IconButton>
                            </Box>
                        ))}
                    </Box>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "flex-end" }}>
                        <TextField label="Skill name" size="small" value={newSkill.name}
                            onChange={e => setNewSkill(s => ({ ...s, name: e.target.value }))}
                            sx={{ flex: "1 1 160px" }} />
                        <FormControl size="small" sx={{ minWidth: 130 }}>
                            <InputLabel>Level</InputLabel>
                            <Select label="Level" value={newSkill.level}
                                onChange={e => setNewSkill(s => ({ ...s, level: e.target.value as SkillEntry["level"] }))}>
                                <MenuItem value="trained">Trained</MenuItem>
                                <MenuItem value="specialized">Specialized</MenuItem>
                                <MenuItem value="inability">Inability</MenuItem>
                            </Select>
                        </FormControl>
                        <Button size="small" variant="outlined" startIcon={<Plus size={12} />}
                            disabled={!newSkill.name.trim()}
                            onClick={() => { quickSave({ skills: [...data.skills, { ...newSkill }] }); setNewSkill({ name: "", level: "trained" }); }}>
                            Add
                        </Button>
                    </Box>
                </Paper>

                {/* Abilities */}
                <SectionHeader label="Abilities" />
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    {data.abilities.length === 0 && (
                        <Typography variant="body2" sx={{ color: "text.disabled", mb: 1 }}>No abilities added.</Typography>
                    )}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
                        {data.abilities.map((ab, i) => (
                            <Box key={i} sx={{ borderLeft: "3px solid", borderColor: "primary.light", pl: 1.5, py: 0.5 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>{ab.name}</Typography>
                                    {ab.cost && <Chip label={ab.cost} size="small" sx={{ fontSize: "0.65rem", height: 18 }} />}
                                    <IconButton size="small" sx={{ ml: "auto", p: 0.25 }}
                                        onClick={() => quickSave({ abilities: data.abilities.filter((_, j) => j !== i) })}>
                                        <X size={10} />
                                    </IconButton>
                                </Box>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>{ab.description}</Typography>
                            </Box>
                        ))}
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <Box sx={{ display: "flex", gap: 1 }}>
                            <Button size="small" variant="outlined" startIcon={<Search size={12} />}
                                onClick={() => setPicker("ability")} sx={{ flexShrink: 0 }}>
                                SRD
                            </Button>
                            <TextField label="Ability name" size="small" value={newAbility.name}
                                onChange={e => setNewAbility(a => ({ ...a, name: e.target.value }))} sx={{ flex: 2 }} />
                            <TextField label="Cost (opt)" size="small" value={newAbility.cost}
                                onChange={e => setNewAbility(a => ({ ...a, cost: e.target.value }))} sx={{ flex: 1 }} />
                        </Box>
                        <Box sx={{ display: "flex", gap: 1 }}>
                            <TextField label="Description" size="small" multiline rows={2} fullWidth
                                value={newAbility.description}
                                onChange={e => setNewAbility(a => ({ ...a, description: e.target.value }))} />
                            <Button size="small" variant="outlined" startIcon={<Plus size={12} />}
                                disabled={!newAbility.name.trim()}
                                onClick={() => {
                                    quickSave({ abilities: [...data.abilities, { ...newAbility }] });
                                    setNewAbility({ name: "", cost: "", description: "" });
                                }}>
                                Add
                            </Button>
                        </Box>
                    </Box>
                </Paper>

                {/* Cyphers */}
                <SectionHeader label={`Cyphers (${data.cyphers.length})`} />
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    {data.cyphers.length === 0 && (
                        <Typography variant="body2" sx={{ color: "text.disabled", mb: 1 }}>No cyphers.</Typography>
                    )}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
                        {data.cyphers.map((cy, i) => (
                            <Box key={i} sx={{ borderLeft: "3px solid #6a1b9a", pl: 1.5, py: 0.5 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>{cy.name}</Typography>
                                    <Chip label={`Level ${cy.level}`} size="small"
                                        sx={{ backgroundColor: "#6a1b9a", color: "#fff", fontSize: "0.65rem", height: 18 }} />
                                    {cy.form && <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>{cy.form}</Typography>}
                                    <IconButton size="small" sx={{ ml: "auto", p: 0.25 }}
                                        onClick={() => quickSave({ cyphers: data.cyphers.filter((_, j) => j !== i) })}>
                                        <X size={10} />
                                    </IconButton>
                                </Box>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>{cy.effect}</Typography>
                            </Box>
                        ))}
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                            <Button size="small" variant="outlined" startIcon={<Search size={12} />}
                                onClick={() => setPicker("cypher")} sx={{ flexShrink: 0 }}>
                                SRD
                            </Button>
                            <TextField label="Name" size="small" value={newCypher.name}
                                onChange={e => setNewCypher(c => ({ ...c, name: e.target.value }))} sx={{ flex: 2 }} />
                            <TextField label="Level" size="small" value={newCypher.level}
                                onChange={e => setNewCypher(c => ({ ...c, level: e.target.value }))}
                                sx={{ width: 90 }} />
                            {rollableLevel(newCypher.level) && (
                                <Tooltip title={`Roll ${newCypher.level}`}>
                                    <IconButton size="small" onClick={() => {
                                        try {
                                            const r = new DiceRoll(newCypher.level);
                                            setNewCypher(c => ({ ...c, level: String(r.total) }));
                                        } catch { /* not a valid dice expression */ }
                                    }}>
                                        <Dices size={14} />
                                    </IconButton>
                                </Tooltip>
                            )}
                            <TextField label="Form (opt)" size="small" value={newCypher.form}
                                onChange={e => setNewCypher(c => ({ ...c, form: e.target.value }))} sx={{ flex: 2 }} />
                        </Box>
                        <Box sx={{ display: "flex", gap: 1 }}>
                            <TextField label="Effect" size="small" multiline rows={2} fullWidth
                                value={newCypher.effect}
                                onChange={e => setNewCypher(c => ({ ...c, effect: e.target.value }))} />
                            <Button size="small" variant="outlined" startIcon={<Plus size={12} />}
                                disabled={!newCypher.name.trim()}
                                onClick={() => {
                                    quickSave({ cyphers: [...data.cyphers, { ...newCypher }] });
                                    setNewCypher({ name: "", level: "1", form: "", effect: "" });
                                }}>
                                Add
                            </Button>
                        </Box>
                    </Box>
                </Paper>

                {/* Artifacts */}
                <SectionHeader label={`Artifacts (${data.artifacts.length})`} />
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    {data.artifacts.length === 0 && (
                        <Typography variant="body2" sx={{ color: "text.disabled", mb: 1 }}>No artifacts.</Typography>
                    )}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
                        {data.artifacts.map((ar, i) => (
                            <Box key={i} sx={{ borderLeft: "3px solid #e65100", pl: 1.5, py: 0.5 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>{ar.name}</Typography>
                                    {ar.level != null && (
                                        <Chip label={`Level ${ar.level}`} size="small"
                                            sx={{ backgroundColor: "#e65100", color: "#fff", fontSize: "0.65rem", height: 18 }} />
                                    )}
                                    {ar.depletion && (
                                        <Typography variant="caption" sx={{ color: "text.secondary" }}>Depletion: {ar.depletion}</Typography>
                                    )}
                                    <IconButton size="small" sx={{ ml: "auto", p: 0.25 }}
                                        onClick={() => quickSave({ artifacts: data.artifacts.filter((_, j) => j !== i) })}>
                                        <X size={10} />
                                    </IconButton>
                                </Box>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>{ar.effect}</Typography>
                            </Box>
                        ))}
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                            <TextField label="Name" size="small" value={newArtifact.name}
                                onChange={e => setNewArtifact(a => ({ ...a, name: e.target.value }))} sx={{ flex: 2 }} />
                            <TextField label="Level (opt)" type="number" size="small" value={newArtifact.level ?? ""}
                                onChange={e => setNewArtifact(a => ({ ...a, level: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
                                sx={{ width: 90 }} />
                            <TextField label="Depletion" size="small" value={newArtifact.depletion}
                                onChange={e => setNewArtifact(a => ({ ...a, depletion: e.target.value }))} sx={{ flex: 1 }} />
                        </Box>
                        <Box sx={{ display: "flex", gap: 1 }}>
                            <TextField label="Effect" size="small" multiline rows={2} fullWidth
                                value={newArtifact.effect}
                                onChange={e => setNewArtifact(a => ({ ...a, effect: e.target.value }))} />
                            <Button size="small" variant="outlined" startIcon={<Plus size={12} />}
                                disabled={!newArtifact.name.trim()}
                                onClick={() => {
                                    quickSave({ artifacts: [...data.artifacts, { ...newArtifact }] });
                                    setNewArtifact({ name: "", level: undefined, form: "", effect: "", depletion: "" });
                                }}>
                                Add
                            </Button>
                        </Box>
                        <Typography variant="caption" sx={{ color: "text.disabled" }}>
                            No SRD list for artifacts — they're unique, GM-created items, so this is manual entry only.
                        </Typography>
                    </Box>
                </Paper>

                {/* Character Arcs */}
                <SectionHeader label={`Character Arcs (${data.arcs.length})`} />
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    {data.arcs.length === 0 && (
                        <Typography variant="body2" sx={{ color: "text.disabled", mb: 1 }}>No character arcs.</Typography>
                    )}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
                        {data.arcs.map((arc, i) => (
                            <Box key={i} sx={{ borderLeft: "3px solid #00695c", pl: 1.5, py: 0.5 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>{arc.name}</Typography>
                                    <Chip label={arc.status === "active" ? "Active" : "Completed"} size="small"
                                        onClick={() => quickSave({
                                            arcs: data.arcs.map((a, j) => j === i
                                                ? { ...a, status: a.status === "active" ? "completed" : "active" }
                                                : a),
                                        })}
                                        sx={{
                                            backgroundColor: arc.status === "active" ? "#00695c" : "#546e7a",
                                            color: "#fff", fontSize: "0.65rem", height: 18, cursor: "pointer",
                                        }} />
                                    <IconButton size="small" sx={{ ml: "auto", p: 0.25 }}
                                        onClick={() => quickSave({ arcs: data.arcs.filter((_, j) => j !== i) })}>
                                        <X size={10} />
                                    </IconButton>
                                </Box>
                                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{arc.description}</Typography>
                                {arc.notes && (
                                    <Typography variant="caption" sx={{ color: "text.disabled", whiteSpace: "pre-wrap", display: "block", mt: 0.5 }}>
                                        {arc.notes}
                                    </Typography>
                                )}
                            </Box>
                        ))}
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        <Box sx={{ display: "flex", gap: 1 }}>
                            <Button size="small" variant="outlined" startIcon={<Search size={12} />}
                                onClick={() => setPicker("arc")} sx={{ flexShrink: 0 }}>
                                SRD
                            </Button>
                            <TextField label="Arc name" size="small" value={newArc.name}
                                onChange={e => setNewArc(a => ({ ...a, name: e.target.value }))} sx={{ flex: 2 }} />
                        </Box>
                        <TextField label="Description" size="small" multiline rows={2} fullWidth
                            value={newArc.description}
                            onChange={e => setNewArc(a => ({ ...a, description: e.target.value }))} />
                        <Box sx={{ display: "flex", gap: 1 }}>
                            <TextField label="Notes / steps (opt)" size="small" multiline rows={3} fullWidth
                                value={newArc.notes}
                                onChange={e => setNewArc(a => ({ ...a, notes: e.target.value }))} />
                            <Button size="small" variant="outlined" startIcon={<Plus size={12} />}
                                disabled={!newArc.name.trim()}
                                onClick={() => {
                                    quickSave({ arcs: [...data.arcs, { ...newArc }] });
                                    setNewArc({ name: "", description: "", status: "active", notes: "" });
                                }}>
                                Add
                            </Button>
                        </Box>
                    </Box>
                </Paper>

                {/* Equipment */}
                <SectionHeader label="Equipment" />
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    {data.equipment.length === 0 && (
                        <Typography variant="body2" sx={{ color: "text.disabled", mb: 1 }}>No equipment.</Typography>
                    )}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1.5 }}>
                        {data.equipment.map((eq, i) => (
                            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5,
                                border: "1px solid", borderColor: "divider", borderRadius: 1, px: 1, py: 0.25 }}>
                                <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>
                                    {eq.quantity && eq.quantity > 1 ? `${eq.quantity}× ` : ""}{eq.name}
                                </Typography>
                                <IconButton size="small" sx={{ p: 0.2 }}
                                    onClick={() => quickSave({ equipment: data.equipment.filter((_, j) => j !== i) })}>
                                    <X size={10} />
                                </IconButton>
                            </Box>
                        ))}
                    </Box>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
                        <TextField label="Item" size="small" value={newEquip.name}
                            onChange={e => setNewEquip(q => ({ ...q, name: e.target.value }))} sx={{ flex: 1 }} />
                        <TextField label="Qty" type="number" size="small" value={newEquip.quantity ?? 1}
                            onChange={e => setNewEquip(q => ({ ...q, quantity: parseInt(e.target.value, 10) || 1 }))}
                            sx={{ width: 72 }} />
                        <Button size="small" variant="outlined" startIcon={<Plus size={12} />}
                            disabled={!newEquip.name.trim()}
                            onClick={() => {
                                quickSave({ equipment: [...data.equipment, { ...newEquip }] });
                                setNewEquip({ name: "", quantity: 1 });
                            }}>
                            Add
                        </Button>
                    </Box>
                    <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>Shins:</Typography>
                        <InlineNumber value={data.shins} onCommit={v => quickSave({ shins: Math.max(0, v) })}
                            width={70} fontSize="0.9rem" fontWeight={700} min={0} />
                    </Box>
                </Paper>

                {/* Notes */}
                <SectionHeader label="Notes & Background" />
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    {editing ? (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <TextField label="Backstory" multiline rows={4} fullWidth
                                value={data.backstory} onChange={e => upd({ backstory: e.target.value })} />
                            <TextField label="Links to other PCs" multiline rows={2} fullWidth
                                value={data.links} onChange={e => upd({ links: e.target.value })} />
                            <TextField label="Notes" multiline rows={3} fullWidth
                                value={data.notes} onChange={e => upd({ notes: e.target.value })} />
                        </Box>
                    ) : (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {data.backstory && (
                                <>
                                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>BACKSTORY</Typography>
                                    <Typography variant="body2" sx={{ color: "text.primary", whiteSpace: "pre-wrap" }}>{data.backstory}</Typography>
                                    <Divider />
                                </>
                            )}
                            {data.links && (
                                <>
                                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>LINKS</Typography>
                                    <Typography variant="body2" sx={{ color: "text.primary", whiteSpace: "pre-wrap" }}>{data.links}</Typography>
                                    <Divider />
                                </>
                            )}
                            {data.notes ? (
                                <Typography variant="body2" sx={{ color: "text.primary", whiteSpace: "pre-wrap" }}>{data.notes}</Typography>
                            ) : !data.backstory && !data.links ? (
                                <Typography variant="body2" sx={{ color: "text.disabled" }}>No notes yet.</Typography>
                            ) : null}
                        </Box>
                    )}
                </Paper>

                {/* Delete dialog */}
                <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
                    <DialogTitle>Delete Character?</DialogTitle>
                    <DialogContent>
                        <Typography>This will permanently delete {name}.</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={deleteChar}>Delete</Button>
                    </DialogActions>
                </Dialog>

                {/* SRD pickers */}
                <SrdPickerDialog<AbilitySrd>
                    open={picker === "ability"} onClose={() => setPicker(null)}
                    title="Search Abilities (SRD)" load={loadAbilities}
                    getId={a => a.id} getName={a => a.name}
                    getMeta={a => a.cost || "No cost"} getDescription={a => a.description}
                    filter={(items, q) => searchSrd(items, q)}
                    onSelect={a => {
                        setNewAbility({ name: a.name, cost: a.cost ?? "", description: a.description });
                        setPicker(null);
                    }}
                />
                <SrdPickerDialog<CypherSrd>
                    open={picker === "cypher"} onClose={() => setPicker(null)}
                    title="Search Cyphers (SRD)" load={loadCyphers}
                    getId={c => c.id} getName={c => c.name}
                    getMeta={c => `${c.type} · Level ${c.level}`} getDescription={c => c.effect}
                    filter={(items, q) => searchSrd(items, q)}
                    onSelect={c => {
                        setNewCypher({ name: c.name, level: c.level, form: c.form ?? "", effect: c.effect });
                        setPicker(null);
                    }}
                />
                <SrdPickerDialog<ArcSrd>
                    open={picker === "arc"} onClose={() => setPicker(null)}
                    title="Search Character Arcs (SRD)" load={loadArcs}
                    getId={a => a.id} getName={a => a.name}
                    getDescription={a => a.description}
                    filter={(items, q) => searchSrd(items, q)}
                    onSelect={a => {
                        setNewArc({ name: a.name, description: a.description, status: "active", notes: formatArcSteps(a) });
                        setPicker(null);
                    }}
                />
            </Container>
        </Box>
    );
}

function SectionHeader({ label }: { label: string }) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <Typography sx={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: 2, color: "primary.dark",
                textTransform: "uppercase", whiteSpace: "nowrap" }}>
                {label}
            </Typography>
            <Box sx={{ flex: 1, height: "1px", backgroundColor: "divider" }} />
        </Box>
    );
}
