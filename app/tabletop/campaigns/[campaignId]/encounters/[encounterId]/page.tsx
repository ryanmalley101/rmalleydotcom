"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Box, Container, Typography, Button, TextField, Paper, Chip,
    IconButton, Tooltip, Divider, CircularProgress, InputAdornment,
    Dialog, DialogTitle, DialogContent, DialogActions, Switch, FormControlLabel,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Plus, Minus, X, Swords, Search, Play, Users, Shield, Heart, Settings } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { DEFAULT_COMBAT_SETTINGS, SETTING_META, parseSettings, type CombatSettings } from "../../combatSettings";

const client = generateClient<Schema>();
type EncounterRecord  = Schema["Encounter"]["type"];
type MonsterStatblock = Schema["MonsterStatblock"]["type"];
type PlayerCharacter  = Schema["PlayerCharacter"]["type"];
type DnDCampaign      = Schema["DnDCampaign"]["type"];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EncounterEntry {
    id: string;
    type: "monster" | "placeholder";
    monsterId?: string;
    name: string;
    count: number;
    cr?: number;
    placeholderAc?: number;
    placeholderHp?: number;
}

// ── XP / Difficulty helpers ───────────────────────────────────────────────────

const XP_THRESHOLDS: Record<number, [number, number, number, number]> = {
    1:[25,50,75,100], 2:[50,100,150,200], 3:[75,150,225,400], 4:[125,250,375,500],
    5:[250,500,750,1100], 6:[300,600,900,1400], 7:[350,750,1100,1700], 8:[450,900,1400,2100],
    9:[550,1100,1600,2400], 10:[600,1200,1900,2800], 11:[800,1600,2400,3600],
    12:[1000,2000,3000,4500], 13:[1100,2200,3400,5100], 14:[1250,2500,3800,5700],
    15:[1400,2800,4300,6400], 16:[1600,3200,4800,7200], 17:[2000,3900,5900,8800],
    18:[2100,4200,6300,9500], 19:[2400,4900,7300,10900], 20:[2800,5700,8500,12700],
};
const CR_XP: Record<string, number> = {
    "0":10,"0.125":25,"0.25":50,"0.5":100,"1":200,"2":450,"3":700,"4":1100,
    "5":1800,"6":2300,"7":2900,"8":3900,"9":5000,"10":5900,"11":7200,"12":8400,
    "13":10000,"14":11500,"15":13000,"16":15000,"17":18000,"18":20000,"19":22000,
    "20":25000,"21":33000,"22":41000,"23":50000,"24":62000,"25":75000,
};
function getMultiplier(n: number) {
    if (n === 1) return 1; if (n === 2) return 1.5;
    if (n <= 6) return 2; if (n <= 10) return 2.5; if (n <= 14) return 3; return 4;
}
function fmt(n: number) { return n.toLocaleString(); }
function uid() { return Math.random().toString(36).slice(2, 9); }

const DIFF_COLOR: Record<string, string> = {
    trivial: "#90a4ae", easy: "#43a047", medium: "#f57c00", hard: "#ef6c00", deadly: "#c62828",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function EncounterBuilderPage() {
    const { campaignId, encounterId } = useParams<{ campaignId: string; encounterId: string }>();
    const router = useRouter();

    const [encounter, setEncounter]   = useState<EncounterRecord | null>(null);
    const [entries, setEntries]       = useState<EncounterEntry[]>([]);
    const [chars, setChars]           = useState<PlayerCharacter[]>([]);
    const [allMonsters, setAllMonsters] = useState<MonsterStatblock[]>([]);
    const [monsterSearch, setMonsterSearch] = useState("");
    const [loading, setLoading]       = useState(true);
    const [nameEditing, setNameEditing] = useState(false);
    const [nameDraft, setNameDraft]   = useState("");
    const [notes, setNotes]           = useState("");
    const [notesSaving, setNotesSaving] = useState(false);
    const notesTimer = useRef<ReturnType<typeof setTimeout>>();
    const [campaignSettings, setCampaignSettings] = useState<CombatSettings>({ ...DEFAULT_COMBAT_SETTINGS });
    const [encSettings, setEncSettings]           = useState<Partial<CombatSettings>>({});
    const [settingsOpen, setSettingsOpen]         = useState(false);
    const [settingsDraft, setSettingsDraft]       = useState<CombatSettings>({ ...DEFAULT_COMBAT_SETTINGS });
    const [phName, setPhName]         = useState("");
    const [phAc, setPhAc]             = useState("");
    const [phHp, setPhHp]             = useState("");

    async function load() {
        const [encRes, pcRes, monRes, campRes] = await Promise.all([
            client.models.Encounter.get({ id: encounterId }),
            client.models.PlayerCharacter.list(),
            client.models.MonsterStatblock.list({ limit: 1000 }),
            client.models.DnDCampaign.get({ id: campaignId }),
        ]);
        const enc = encRes.data;
        if (!enc) { router.push(`/tabletop/campaigns/${campaignId}`); return; }
        setEncounter(enc);
        setNameDraft(enc.name);
        setNotes(enc.description ?? "");
        setEntries(JSON.parse(enc.monstersJson ?? "[]"));
        setChars((pcRes.data ?? []).filter(pc => pc.campaignId === enc.campaignId));
        setAllMonsters((monRes.data ?? []).sort((a, b) => a.name.localeCompare(b.name)));
        const cs = parseSettings(campRes.data?.settingsJson);
        setCampaignSettings(cs);
        const overrides = enc.settingsJson ? JSON.parse(enc.settingsJson) as Partial<CombatSettings> : {};
        setEncSettings(overrides);
        setSettingsDraft({ ...cs, ...overrides });
        setLoading(false);
    }

    useEffect(() => { load(); }, [encounterId]);

    const saveEntries = useCallback(async (updated: EncounterEntry[]) => {
        await client.models.Encounter.update({ id: encounterId, monstersJson: JSON.stringify(updated) });
    }, [encounterId]);

    async function saveName() {
        if (!nameDraft.trim()) return;
        await client.models.Encounter.update({ id: encounterId, name: nameDraft.trim() });
        setEncounter(prev => prev ? { ...prev, name: nameDraft.trim() } : prev);
        setNameEditing(false);
    }

    function openSettings() {
        setSettingsDraft({ ...campaignSettings, ...encSettings });
        setSettingsOpen(true);
    }

    async function saveEncounterSettings(s: CombatSettings) {
        setEncSettings(s);
        await client.models.Encounter.update({ id: encounterId, settingsJson: JSON.stringify(s) });
        setSettingsOpen(false);
    }

    async function resetEncounterSettings() {
        setEncSettings({});
        setSettingsDraft({ ...campaignSettings });
        await client.models.Encounter.update({ id: encounterId, settingsJson: undefined });
        setSettingsOpen(false);
    }

    function saveNotes(val: string) {
        clearTimeout(notesTimer.current);
        setNotesSaving(true);
        notesTimer.current = setTimeout(async () => {
            await client.models.Encounter.update({ id: encounterId, description: val || undefined });
            setNotesSaving(false);
        }, 1500);
    }

    function addMonster(m: MonsterStatblock) {
        const existing = entries.find(e => e.monsterId === m.id);
        const updated = existing
            ? entries.map(e => e.monsterId === m.id ? { ...e, count: e.count + 1 } : e)
            : [...entries, { id: uid(), type: "monster" as const, monsterId: m.id, name: m.name, count: 1, cr: m.cr }];
        setEntries(updated);
        saveEntries(updated);
    }

    function addPlaceholder() {
        if (!phName.trim()) return;
        const updated = [...entries, {
            id: uid(), type: "placeholder" as const, name: phName.trim(), count: 1,
            placeholderAc: parseInt(phAc) || 10, placeholderHp: parseInt(phHp) || 10,
        }];
        setEntries(updated);
        saveEntries(updated);
        setPhName(""); setPhAc(""); setPhHp("");
    }

    function adjustCount(id: string, delta: number) {
        const updated = entries.flatMap(e => {
            if (e.id !== id) return [e];
            const next = e.count + delta;
            return next <= 0 ? [] : [{ ...e, count: next }];
        });
        setEntries(updated);
        saveEntries(updated);
    }

    function removeEntry(id: string) {
        const updated = entries.filter(e => e.id !== id);
        setEntries(updated);
        saveEntries(updated);
    }

    // ── Difficulty ────────────────────────────────────────────────────────────

    const difficulty = useMemo(() => {
        const levels = chars.map(c => c.level ?? 1);
        const monsterEntries = entries.filter(e => e.type === "monster" && e.cr != null);
        const totalCount = monsterEntries.reduce((s, e) => s + e.count, 0);
        const rawXP = monsterEntries.reduce((s, e) => s + (CR_XP[String(e.cr)] ?? 0) * e.count, 0);
        const multiplier = getMultiplier(totalCount);
        const adjXP = Math.floor(rawXP * multiplier);

        const thresholds = levels.reduce<[number,number,number,number]>(
            ([a,b,c,d], lv) => { const t = XP_THRESHOLDS[Math.max(1,Math.min(20,lv))]??[0,0,0,0]; return [a+t[0],b+t[1],c+t[2],d+t[3]]; },
            [0,0,0,0]
        );
        const label = adjXP >= thresholds[3] ? "deadly" : adjXP >= thresholds[2] ? "hard" :
                      adjXP >= thresholds[1] ? "medium" : adjXP >= thresholds[0] ? "easy" : "trivial";
        return { rawXP, adjXP, multiplier, thresholds, label, totalCount };
    }, [entries, chars]);

    // ── Filtered monster search ───────────────────────────────────────────────

    const filteredMonsters = useMemo(() => {
        const q = monsterSearch.trim().toLowerCase();
        if (!q) return allMonsters.slice(0, 25);
        return allMonsters.filter(m => m.name.toLowerCase().includes(q)).slice(0, 25);
    }, [allMonsters, monsterSearch]);

    // ── Render ────────────────────────────────────────────────────────────────

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 6 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 3, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                {/* Header */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
                    <Swords size={28} color="#8C5A3A" />
                    {nameEditing ? (
                        <Box sx={{ display: "flex", gap: 1, flex: 1 }}>
                            <TextField size="small" value={nameDraft} autoFocus
                                onChange={e => setNameDraft(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setNameEditing(false); }}
                                sx={{ flex: 1 }} />
                            <Button variant="contained" size="small" onClick={saveName}
                                sx={{ backgroundColor: "primary.main" }}>Save</Button>
                            <Button size="small" onClick={() => setNameEditing(false)}>Cancel</Button>
                        </Box>
                    ) : (
                        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: "primary.dark", cursor: "pointer", flex: 1 }}
                            onClick={() => setNameEditing(true)}>
                            {encounter?.name}
                        </Typography>
                    )}
                    <Tooltip title="Combat automation settings for this encounter">
                        <IconButton onClick={openSettings} sx={{ color: Object.keys(encSettings).length > 0 ? "warning.main" : "text.secondary" }}>
                            <Settings size={20} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Opens the live combat tracker in a new window">
                        <Button variant="contained" startIcon={<Play size={16} />}
                            onClick={() => window.open(`/tabletop/campaigns/${campaignId}/encounters/${encounterId}/run`, "_blank")}
                            sx={{ backgroundColor: "#8C1A1A", "&:hover": { backgroundColor: "#b71c1c" }, whiteSpace: "nowrap" }}>
                            Run Encounter
                        </Button>
                    </Tooltip>
                </Box>

                {/* Encounter Notes */}
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                        <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                            Prep Notes
                        </Typography>
                        {notesSaving && <Typography variant="caption" sx={{ color: "text.disabled" }}>Saving…</Typography>}
                    </Box>
                    <TextField
                        multiline minRows={3} maxRows={10} fullWidth size="small"
                        placeholder="Describe the encounter setting, objectives, tactics, or any other prep notes…"
                        value={notes}
                        onChange={e => { setNotes(e.target.value); saveNotes(e.target.value); }}
                        sx={{ "& .MuiOutlinedInput-root": { fontSize: "0.875rem" } }}
                    />
                </Paper>

                <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "flex-start" }}>

                    {/* ── Left: Add Monsters + Placeholders ── */}
                    <Box sx={{ flex: "1 1 300px" }}>

                        {/* Monster library search */}
                        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                            <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                                Add from Library
                            </Typography>
                            <TextField
                                size="small" placeholder="Search monsters…" value={monsterSearch} fullWidth
                                onChange={e => setMonsterSearch(e.target.value)}
                                InputProps={{ startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment> }}
                                sx={{ mt: 1.5, mb: 1 }}
                            />
                            <Box sx={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0.5 }}>
                                {filteredMonsters.map(m => (
                                    <Box key={m.id} onClick={() => addMonster(m)}
                                        sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75,
                                            borderRadius: 1, cursor: "pointer", "&:hover": { backgroundColor: "action.hover" } }}>
                                        <Typography variant="body2" sx={{ flex: 1, color: "text.primary" }}>{m.name}</Typography>
                                        <Chip label={`CR ${m.challenge_rating ?? m.cr}`} size="small"
                                            sx={{ height: 18, fontSize: "0.6rem", backgroundColor: "#8C5A3A22" }} />
                                        <Plus size={14} color="#8C5A3A" />
                                    </Box>
                                ))}
                                {filteredMonsters.length === 0 && (
                                    <Typography variant="body2" sx={{ color: "text.disabled", py: 2, textAlign: "center" }}>
                                        No monsters found
                                    </Typography>
                                )}
                            </Box>
                        </Paper>

                        {/* Placeholder form */}
                        <Paper elevation={1} sx={{ p: 2 }}>
                            <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                                Add Placeholder
                            </Typography>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1.5 }}>
                                <TextField size="small" label="Name" value={phName} onChange={e => setPhName(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") addPlaceholder(); }} />
                                <Box sx={{ display: "flex", gap: 1 }}>
                                    <TextField size="small" label="AC" type="number" value={phAc}
                                        onChange={e => setPhAc(e.target.value)} sx={{ flex: 1 }}
                                        InputProps={{ startAdornment: <InputAdornment position="start"><Shield size={12} /></InputAdornment> }} />
                                    <TextField size="small" label="HP" type="number" value={phHp}
                                        onChange={e => setPhHp(e.target.value)} sx={{ flex: 1 }}
                                        InputProps={{ startAdornment: <InputAdornment position="start"><Heart size={12} /></InputAdornment> }} />
                                </Box>
                                <Button variant="outlined" startIcon={<Plus size={14} />} onClick={addPlaceholder}
                                    disabled={!phName.trim()} sx={{ borderColor: "primary.main", color: "primary.main" }}>
                                    Add Placeholder
                                </Button>
                            </Box>
                        </Paper>
                    </Box>

                    {/* ── Right: Roster + PCs + Difficulty ── */}
                    <Box sx={{ flex: "1 1 300px" }}>

                        {/* Encounter roster */}
                        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                            <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                                Encounter Roster
                            </Typography>
                            {entries.length === 0 ? (
                                <Typography variant="body2" sx={{ color: "text.disabled", py: 2, textAlign: "center" }}>
                                    Add monsters from the library or a placeholder
                                </Typography>
                            ) : (
                                <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                                    {entries.map(e => (
                                        <Box key={e.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                            <IconButton size="small" onClick={() => adjustCount(e.id, -1)} sx={{ p: 0.25 }}>
                                                <Minus size={14} />
                                            </IconButton>
                                            <Typography variant="body2" sx={{ minWidth: 20, textAlign: "center", fontWeight: 700, color: "primary.dark" }}>
                                                {e.count}
                                            </Typography>
                                            <IconButton size="small" onClick={() => adjustCount(e.id, 1)} sx={{ p: 0.25 }}>
                                                <Plus size={14} />
                                            </IconButton>
                                            <Typography variant="body2" sx={{ flex: 1, color: "text.primary" }}>{e.name}</Typography>
                                            {e.type === "monster" && e.cr != null ? (
                                                <Chip label={`CR ${e.cr}`} size="small"
                                                    sx={{ height: 18, fontSize: "0.6rem", backgroundColor: "#8C5A3A22" }} />
                                            ) : (
                                                <Chip label={`AC ${e.placeholderAc} · ${e.placeholderHp} HP`} size="small"
                                                    sx={{ height: 18, fontSize: "0.6rem", backgroundColor: "#33333322" }} />
                                            )}
                                            <IconButton size="small" onClick={() => removeEntry(e.id)} sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: "error.main" } }}>
                                                <X size={14} />
                                            </IconButton>
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Paper>

                        {/* Player Characters (auto-included) */}
                        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                <Users size={14} color="#8C5A3A" />
                                <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                                    Player Characters (auto-included)
                                </Typography>
                            </Box>
                            {chars.length === 0 ? (
                                <Typography variant="body2" sx={{ color: "text.disabled", py: 1 }}>
                                    No characters in this campaign
                                </Typography>
                            ) : (
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                    {chars.map(pc => (
                                        <Box key={pc.id} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
                                            <Typography variant="body2" sx={{ flex: 1, color: "text.secondary" }}>
                                                {pc.characterName}
                                            </Typography>
                                            <Chip label={`Lv ${pc.level ?? "?"}`} size="small"
                                                sx={{ height: 18, fontSize: "0.6rem", backgroundColor: "#1565c022", color: "#1565c0" }} />
                                            <Chip label={`AC ${pc.armorClass ?? "?"}`} size="small"
                                                sx={{ height: 18, fontSize: "0.6rem" }} />
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Paper>

                        {/* Difficulty */}
                        {(entries.some(e => e.type === "monster") || chars.length > 0) && (
                            <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid", borderLeftColor: DIFF_COLOR[difficulty.label] }}>
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                                    <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                                        Difficulty
                                    </Typography>
                                    <Chip label={difficulty.label.toUpperCase()} size="small"
                                        sx={{ backgroundColor: DIFF_COLOR[difficulty.label], color: "#fff", fontWeight: 700, fontSize: "0.68rem" }} />
                                </Box>
                                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Adjusted XP</Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 700, color: DIFF_COLOR[difficulty.label] }}>
                                        {fmt(difficulty.adjXP)}
                                        {difficulty.multiplier > 1 && (
                                            <Typography component="span" variant="caption" sx={{ color: "text.disabled" }}>
                                                {" "}(×{difficulty.multiplier} for {difficulty.totalCount} monsters)
                                            </Typography>
                                        )}
                                    </Typography>
                                </Box>
                                <Divider sx={{ my: 1 }} />
                                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                    {(["Easy", "Medium", "Hard", "Deadly"] as const).map((label, i) => (
                                        <Box key={label} sx={{ textAlign: "center", flex: 1 }}>
                                            <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.6rem", display: "block" }}>
                                                {label}
                                            </Typography>
                                            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: "0.7rem" }}>
                                                {fmt(difficulty.thresholds[i])}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            </Paper>
                        )}
                    </Box>
                </Box>

                {/* Run button at bottom */}
                <Box sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
                    <Button variant="contained" size="large" startIcon={<Play size={20} />}
                        onClick={() => window.open(`/tabletop/campaigns/${campaignId}/encounters/${encounterId}/run`, "_blank")}
                        sx={{ backgroundColor: "#8C1A1A", "&:hover": { backgroundColor: "#b71c1c" }, px: 5, py: 1.5, fontSize: "1rem" }}>
                        Run Encounter
                    </Button>
                </Box>

                {/* Encounter combat settings dialog */}
                <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>Encounter Combat Settings</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                            Override the campaign defaults for this encounter only. Orange gear icon means custom settings are active.
                        </Typography>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                            {(Object.keys(SETTING_META) as (keyof CombatSettings)[]).map(k => (
                                <Box key={k} sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={settingsDraft[k]}
                                                onChange={() => setSettingsDraft(p => ({ ...p, [k]: !p[k] }))}
                                                size="small" color="warning"
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{SETTING_META[k].label}</Typography>
                                                {campaignSettings[k] !== settingsDraft[k] && (
                                                    <Typography variant="caption" sx={{ color: "warning.main" }}>
                                                        Campaign default: {campaignSettings[k] ? "On" : "Off"}
                                                    </Typography>
                                                )}
                                            </Box>
                                        }
                                    />
                                    <Typography variant="caption" sx={{ color: "text.secondary", pl: 5.5 }}>
                                        {SETTING_META[k].desc}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ justifyContent: "space-between" }}>
                        <Button size="small" onClick={resetEncounterSettings} sx={{ color: "text.secondary" }}>
                            Use campaign defaults
                        </Button>
                        <Box sx={{ display: "flex", gap: 1 }}>
                            <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
                            <Button variant="contained" onClick={() => saveEncounterSettings(settingsDraft)}
                                sx={{ backgroundColor: "primary.main" }}>
                                Save
                            </Button>
                        </Box>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
