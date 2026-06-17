"use client";

import { useState, useCallback } from "react";
import {
    Box, Container, Typography, Button, TextField, Paper,
    Chip, Divider, CircularProgress, MenuItem, Select,
    FormControl, InputLabel, IconButton, Tooltip, Dialog,
    DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Pencil, Save, X, Trash2, Plus } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import { useRouter } from "next/navigation";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type PC = Schema["PlayerCharacter"]["type"];

// ── Data types ────────────────────────────────────────────────────────────────

interface SkillEntry    { name: string; level: "trained" | "specialized" | "inability" }
interface AbilityEntry  { name: string; cost?: string; description: string }
interface CypherEntry   { name: string; level: number; form?: string; effect: string }
interface ArtifactEntry { name: string; level?: number; form?: string; effect: string; depletion?: string }
interface EquipmentEntry{ name: string; quantity?: number }

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
    skills: [], abilities: [], cyphers: [], artifacts: [], equipment: [],
    shins: 0, notes: "", backstory: "", links: "",
};

function parseData(json: string | null | undefined): CypherData {
    if (!json) return { ...DEFAULT_DATA };
    try { return { ...DEFAULT_DATA, ...JSON.parse(json) }; }
    catch { return { ...DEFAULT_DATA }; }
}

// ── Skill level badge ─────────────────────────────────────────────────────────

const SKILL_COLORS: Record<string, string> = {
    trained:      "#1565c0",
    specialized:  "#6a1b9a",
    inability:    "#c62828",
};

// ── Stat pool cell ────────────────────────────────────────────────────────────

function PoolCell({ label, current, pool, edge, editing, onChange }: {
    label: string; current: number; pool: number; edge: number;
    editing: boolean;
    onChange: (field: "current" | "pool" | "edge", v: number) => void;
}) {
    const pct = pool > 0 ? Math.round((current / pool) * 100) : 0;
    const barColor = pct > 50 ? "#2e7d32" : pct > 25 ? "#f57c00" : "#c62828";

    return (
        <Paper elevation={2} sx={{ p: 2, textAlign: "center", minWidth: 140 }}>
            <Typography variant="overline" sx={{ color: "primary.dark", fontWeight: 700, letterSpacing: 2, fontSize: "0.7rem" }}>
                {label}
            </Typography>
            {editing ? (
                <Box sx={{ display: "flex", gap: 0.75, mt: 1 }}>
                    <TextField label="Cur" type="number" size="small" value={current}
                        onChange={e => onChange("current", parseInt(e.target.value, 10) || 0)}
                        inputProps={{ min: 0 }} sx={{ width: 64 }} />
                    <TextField label="Max" type="number" size="small" value={pool}
                        onChange={e => onChange("pool", parseInt(e.target.value, 10) || 0)}
                        inputProps={{ min: 1 }} sx={{ width: 64 }} />
                    <TextField label="Edge" type="number" size="small" value={edge}
                        onChange={e => onChange("edge", parseInt(e.target.value, 10) || 0)}
                        inputProps={{ min: 0, max: 6 }} sx={{ width: 64 }} />
                </Box>
            ) : (
                <>
                    <Box sx={{ mt: 1, mb: 0.5 }}>
                        <Typography component="span" variant="h4" sx={{ fontWeight: 800, color: barColor }}>
                            {current}
                        </Typography>
                        <Typography component="span" variant="body2" sx={{ color: "text.secondary" }}>
                            {" / "}{pool}
                        </Typography>
                    </Box>
                    <Box sx={{ height: 4, borderRadius: 2, backgroundColor: "#e0e0e0", overflow: "hidden", mx: 1 }}>
                        <Box sx={{ height: "100%", width: `${pct}%`, backgroundColor: barColor, transition: "width 0.3s" }} />
                    </Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", mt: 0.5, display: "block" }}>
                        Edge {edge}
                    </Typography>
                </>
            )}
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
    const [tier,       setTier]       = useState(String(pc.level ?? 1));
    const [xp,         setXp]         = useState(String(pc.xp ?? 0));

    // Inline list editors
    const [newSkill,    setNewSkill]    = useState<SkillEntry>({ name: "", level: "trained" });
    const [newAbility,  setNewAbility]  = useState<AbilityEntry>({ name: "", cost: "", description: "" });
    const [newCypher,   setNewCypher]   = useState<CypherEntry>({ name: "", level: 1, form: "", effect: "" });
    const [newArtifact, setNewArtifact] = useState<ArtifactEntry>({ name: "", level: undefined, form: "", effect: "", depletion: "" });
    const [newEquip,    setNewEquip]    = useState<EquipmentEntry>({ name: "", quantity: 1 });

    const upd = useCallback((patch: Partial<CypherData>) => setData(d => ({ ...d, ...patch })), []);

    function poolChange(stat: "might" | "speed" | "intellect", field: "current" | "pool" | "edge", v: number) {
        const keys: Record<typeof field, keyof CypherData> = {
            current: `current${stat.charAt(0).toUpperCase() + stat.slice(1)}` as keyof CypherData,
            pool:    `${stat}Pool` as keyof CypherData,
            edge:    `${stat}Edge` as keyof CypherData,
        };
        setData(d => ({ ...d, [keys[field]]: v }));
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
            level:         parseInt(tier, 10) || 1,
            xp:            parseInt(xp, 10) || 0,
            systemDataJson: JSON.stringify(data),
        });
        setSaving(false);
        setEditing(false);
    }

    async function quickSave(patch: Partial<CypherData>) {
        const next = { ...data, ...patch };
        setData(next);
        await client.models.PlayerCharacter.update({ id: pc.id, systemDataJson: JSON.stringify(next) });
    }

    async function deleteChar() {
        await client.models.PlayerCharacter.delete({ id: pc.id });
        router.push(`/tabletop/campaigns/${campaignId}`);
    }

    const dmgColors: Record<string, string> = {
        hale: "#2e7d32", impaired: "#f57c00", debilitated: "#c62828",
    };
    const dmgLabel: Record<string, string> = {
        hale: "Hale", impaired: "Impaired", debilitated: "Debilitated",
    };

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
                                <Button size="small" startIcon={<X size={14} />} onClick={() => setEditing(false)}>
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
                            <TextField label="Tier" type="number" size="small" value={tier}
                                onChange={e => setTier(e.target.value)} inputProps={{ min: 1, max: 6 }} sx={{ width: 72 }} />
                            <TextField label="XP" type="number" size="small" value={xp}
                                onChange={e => setXp(e.target.value)} inputProps={{ min: 0 }} sx={{ width: 80 }} />
                        </Box>
                    ) : (
                        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
                            <Typography variant="body1" sx={{ color: "text.primary" }}>
                                <strong>{descriptor || "—"}</strong>
                                {" "}
                                {type || "—"}
                                {focus ? ` who ${focus}` : ""}
                            </Typography>
                            <Box sx={{ display: "flex", gap: 1 }}>
                                <Chip label={`Tier ${tier}`} size="small" sx={{ backgroundColor: "primary.dark", color: "#fff", fontSize: "0.7rem" }} />
                                <Chip label={`${xp} XP`} size="small" variant="outlined" sx={{ borderColor: "primary.main", color: "primary.main", fontSize: "0.7rem" }} />
                                <Chip label={`Effort ${data.effort}`} size="small" variant="outlined" sx={{ fontSize: "0.7rem" }} />
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
                                current={(data as any)[`current${stat.charAt(0).toUpperCase() + stat.slice(1)}`]}
                                pool={(data as any)[`${stat}Pool`]}
                                edge={(data as any)[`${stat}Edge`]}
                                editing={editing}
                                onChange={(f, v) => poolChange(stat, f, v)}
                            />
                        </Box>
                    ))}
                </Box>

                {/* Damage Track + Recovery + Effort */}
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
                        <Box>
                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>Damage Track</Typography>
                            <Box sx={{ display: "flex", gap: 1 }}>
                                {(["hale","impaired","debilitated"] as const).map(track => (
                                    <Chip key={track} label={dmgLabel[track]} size="small"
                                        onClick={() => quickSave({ damageTrack: track })}
                                        sx={{
                                            backgroundColor: data.damageTrack === track ? dmgColors[track] : "transparent",
                                            color: data.damageTrack === track ? "#fff" : dmgColors[track],
                                            border: `1px solid ${dmgColors[track]}`,
                                            cursor: "pointer",
                                            fontWeight: data.damageTrack === track ? 700 : 400,
                                        }} />
                                ))}
                            </Box>
                        </Box>

                        <Box>
                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>Recovery Rolls</Typography>
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

                        {editing && (
                            <TextField label="Effort" type="number" size="small" value={data.effort}
                                onChange={e => upd({ effort: parseInt(e.target.value, 10) || 1 })}
                                inputProps={{ min: 1, max: 6 }} sx={{ width: 80 }} />
                        )}
                    </Box>
                </Paper>

                {/* Skills */}
                <SectionHeader label="Skills" />
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    {data.skills.length === 0 && !editing && (
                        <Typography variant="body2" sx={{ color: "text.disabled" }}>No skills added.</Typography>
                    )}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: editing ? 2 : 0 }}>
                        {data.skills.map((sk, i) => (
                            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5,
                                border: "1px solid", borderColor: "divider", borderRadius: 1, px: 1, py: 0.25 }}>
                                <Typography variant="body2" sx={{ color: "text.primary", fontSize: "0.82rem" }}>{sk.name}</Typography>
                                <Chip label={sk.level} size="small"
                                    sx={{ backgroundColor: SKILL_COLORS[sk.level], color: "#fff",
                                        fontSize: "0.6rem", height: 16, "& .MuiChip-label": { px: 0.5 } }} />
                                {editing && (
                                    <IconButton size="small" sx={{ p: 0.25 }}
                                        onClick={() => upd({ skills: data.skills.filter((_, j) => j !== i) })}>
                                        <X size={10} />
                                    </IconButton>
                                )}
                            </Box>
                        ))}
                    </Box>
                    {editing && (
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
                                onClick={() => { upd({ skills: [...data.skills, { ...newSkill }] }); setNewSkill({ name: "", level: "trained" }); }}>
                                Add
                            </Button>
                        </Box>
                    )}
                </Paper>

                {/* Abilities */}
                <SectionHeader label="Abilities" />
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    {data.abilities.length === 0 && !editing && (
                        <Typography variant="body2" sx={{ color: "text.disabled" }}>No abilities added.</Typography>
                    )}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: editing ? 2 : 0 }}>
                        {data.abilities.map((ab, i) => (
                            <Box key={i} sx={{ borderLeft: "3px solid", borderColor: "primary.light", pl: 1.5, py: 0.5 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>{ab.name}</Typography>
                                    {ab.cost && <Chip label={ab.cost} size="small" sx={{ fontSize: "0.65rem", height: 18 }} />}
                                    {editing && (
                                        <IconButton size="small" sx={{ ml: "auto", p: 0.25 }}
                                            onClick={() => upd({ abilities: data.abilities.filter((_, j) => j !== i) })}>
                                            <X size={10} />
                                        </IconButton>
                                    )}
                                </Box>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>{ab.description}</Typography>
                            </Box>
                        ))}
                    </Box>
                    {editing && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            <Box sx={{ display: "flex", gap: 1 }}>
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
                                        upd({ abilities: [...data.abilities, { ...newAbility }] });
                                        setNewAbility({ name: "", cost: "", description: "" });
                                    }}>
                                    Add
                                </Button>
                            </Box>
                        </Box>
                    )}
                </Paper>

                {/* Cyphers */}
                <SectionHeader label={`Cyphers (${data.cyphers.length})`} />
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    {data.cyphers.length === 0 && !editing && (
                        <Typography variant="body2" sx={{ color: "text.disabled" }}>No cyphers.</Typography>
                    )}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: editing ? 2 : 0 }}>
                        {data.cyphers.map((cy, i) => (
                            <Box key={i} sx={{ borderLeft: "3px solid #6a1b9a", pl: 1.5, py: 0.5 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>{cy.name}</Typography>
                                    <Chip label={`Level ${cy.level}`} size="small"
                                        sx={{ backgroundColor: "#6a1b9a", color: "#fff", fontSize: "0.65rem", height: 18 }} />
                                    {cy.form && <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>{cy.form}</Typography>}
                                    {editing && (
                                        <IconButton size="small" sx={{ ml: "auto", p: 0.25 }}
                                            onClick={() => upd({ cyphers: data.cyphers.filter((_, j) => j !== i) })}>
                                            <X size={10} />
                                        </IconButton>
                                    )}
                                </Box>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>{cy.effect}</Typography>
                            </Box>
                        ))}
                    </Box>
                    {editing && (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                <TextField label="Name" size="small" value={newCypher.name}
                                    onChange={e => setNewCypher(c => ({ ...c, name: e.target.value }))} sx={{ flex: 2 }} />
                                <TextField label="Level" type="number" size="small" value={newCypher.level}
                                    onChange={e => setNewCypher(c => ({ ...c, level: parseInt(e.target.value, 10) || 1 }))}
                                    inputProps={{ min: 1, max: 10 }} sx={{ width: 80 }} />
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
                                        upd({ cyphers: [...data.cyphers, { ...newCypher }] });
                                        setNewCypher({ name: "", level: 1, form: "", effect: "" });
                                    }}>
                                    Add
                                </Button>
                            </Box>
                        </Box>
                    )}
                </Paper>

                {/* Artifacts */}
                <SectionHeader label={`Artifacts (${data.artifacts.length})`} />
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    {data.artifacts.length === 0 && !editing && (
                        <Typography variant="body2" sx={{ color: "text.disabled" }}>No artifacts.</Typography>
                    )}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: editing ? 2 : 0 }}>
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
                                    {editing && (
                                        <IconButton size="small" sx={{ ml: "auto", p: 0.25 }}
                                            onClick={() => upd({ artifacts: data.artifacts.filter((_, j) => j !== i) })}>
                                            <X size={10} />
                                        </IconButton>
                                    )}
                                </Box>
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>{ar.effect}</Typography>
                            </Box>
                        ))}
                    </Box>
                    {editing && (
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
                                        upd({ artifacts: [...data.artifacts, { ...newArtifact }] });
                                        setNewArtifact({ name: "", level: undefined, form: "", effect: "", depletion: "" });
                                    }}>
                                    Add
                                </Button>
                            </Box>
                        </Box>
                    )}
                </Paper>

                {/* Equipment */}
                <SectionHeader label="Equipment" />
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    {data.equipment.length === 0 && !editing && (
                        <Typography variant="body2" sx={{ color: "text.disabled" }}>No equipment.</Typography>
                    )}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: editing ? 1.5 : 0 }}>
                        {data.equipment.map((eq, i) => (
                            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5,
                                border: "1px solid", borderColor: "divider", borderRadius: 1, px: 1, py: 0.25 }}>
                                <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>
                                    {eq.quantity && eq.quantity > 1 ? `${eq.quantity}× ` : ""}{eq.name}
                                </Typography>
                                {editing && (
                                    <IconButton size="small" sx={{ p: 0.2 }}
                                        onClick={() => upd({ equipment: data.equipment.filter((_, j) => j !== i) })}>
                                        <X size={10} />
                                    </IconButton>
                                )}
                            </Box>
                        ))}
                    </Box>
                    {editing && (
                        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
                            <TextField label="Item" size="small" value={newEquip.name}
                                onChange={e => setNewEquip(q => ({ ...q, name: e.target.value }))} sx={{ flex: 1 }} />
                            <TextField label="Qty" type="number" size="small" value={newEquip.quantity ?? 1}
                                onChange={e => setNewEquip(q => ({ ...q, quantity: parseInt(e.target.value, 10) || 1 }))}
                                sx={{ width: 72 }} />
                            <Button size="small" variant="outlined" startIcon={<Plus size={12} />}
                                disabled={!newEquip.name.trim()}
                                onClick={() => {
                                    upd({ equipment: [...data.equipment, { ...newEquip }] });
                                    setNewEquip({ name: "", quantity: 1 });
                                }}>
                                Add
                            </Button>
                        </Box>
                    )}
                    <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>Shins:</Typography>
                        {editing ? (
                            <TextField type="number" size="small" value={data.shins}
                                onChange={e => upd({ shins: parseInt(e.target.value, 10) || 0 })}
                                sx={{ width: 90 }} />
                        ) : (
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{data.shins}</Typography>
                        )}
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
