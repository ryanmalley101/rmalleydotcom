"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Box, Container, Typography, Button, TextField, Paper, Chip,
    IconButton, Tooltip, Divider, CircularProgress, InputAdornment,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Plus, Minus, X, Swords, Search, Play, Users } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { loadCreatures, searchSrd, creatureMeta, type CreatureSrd } from "@/lib/cypherSrd";

const client = generateClient<Schema>();
type EncounterRecord = Schema["Encounter"]["type"];
type PlayerCharacter = Schema["PlayerCharacter"]["type"];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CypherEncounterEntry {
    id: string;
    type: "creature" | "placeholder";
    creatureId?: string;
    name: string;
    count: number;
    level?: number;
    placeholderLevel?: number;
    placeholderHealth?: number;
    placeholderArmor?: number;
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function tierFromPc(pc: PlayerCharacter): number {
    return pc.level ?? 1;
}

// Cypher System deliberately has no XP-budget math for encounters — this is a
// rule-of-thumb guidance band only, not a precise difficulty calculation.
function guidance(avgLevel: number, avgTier: number): { label: string; color: string } {
    const diff = avgLevel - avgTier;
    if (diff <= 0) return { label: "Easy", color: "#43a047" };
    if (diff <= 2) return { label: "Moderate", color: "#f57c00" };
    if (diff <= 4) return { label: "Hard", color: "#ef6c00" };
    return { label: "Deadly", color: "#c62828" };
}

export default function CypherEncounterBuilder() {
    const { campaignId, encounterId } = useParams<{ campaignId: string; encounterId: string }>();
    const router = useRouter();

    const [encounter, setEncounter] = useState<EncounterRecord | null>(null);
    const [entries, setEntries]     = useState<CypherEncounterEntry[]>([]);
    const [chars, setChars]         = useState<PlayerCharacter[]>([]);
    const [allCreatures, setAllCreatures] = useState<CreatureSrd[]>([]);
    const [creatureSearch, setCreatureSearch] = useState("");
    const [loading, setLoading]     = useState(true);
    const [nameEditing, setNameEditing] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [notes, setNotes]         = useState("");
    const [notesSaving, setNotesSaving] = useState(false);
    const notesTimer = useRef<ReturnType<typeof setTimeout>>();
    const [phName, setPhName]   = useState("");
    const [phLevel, setPhLevel] = useState("3");
    const [phHealth, setPhHealth] = useState("");
    const [phArmor, setPhArmor] = useState("");

    async function load() {
        const [encRes, pcRes, creatures] = await Promise.all([
            client.models.Encounter.get({ id: encounterId }),
            client.models.PlayerCharacter.list(),
            loadCreatures(),
        ]);
        const enc = encRes.data;
        if (!enc) { router.push(`/tabletop/campaigns/${campaignId}`); return; }
        setEncounter(enc);
        setNameDraft(enc.name);
        setNotes(enc.description ?? "");
        setEntries(JSON.parse(enc.monstersJson ?? "[]"));
        setChars((pcRes.data ?? []).filter(pc => pc.campaignId === enc.campaignId));
        setAllCreatures(creatures);
        setLoading(false);
    }

    useEffect(() => { load(); }, [encounterId]);

    const saveEntries = useCallback(async (updated: CypherEncounterEntry[]) => {
        await client.models.Encounter.update({ id: encounterId, monstersJson: JSON.stringify(updated) });
    }, [encounterId]);

    async function saveName() {
        if (!nameDraft.trim()) return;
        await client.models.Encounter.update({ id: encounterId, name: nameDraft.trim() });
        setEncounter(prev => prev ? { ...prev, name: nameDraft.trim() } : prev);
        setNameEditing(false);
    }

    function saveNotes(val: string) {
        clearTimeout(notesTimer.current);
        setNotesSaving(true);
        notesTimer.current = setTimeout(async () => {
            await client.models.Encounter.update({ id: encounterId, description: val || undefined });
            setNotesSaving(false);
        }, 1500);
    }

    function addCreature(c: CreatureSrd) {
        const existing = entries.find(e => e.creatureId === c.id);
        const updated = existing
            ? entries.map(e => e.creatureId === c.id ? { ...e, count: e.count + 1 } : e)
            : [...entries, { id: uid(), type: "creature" as const, creatureId: c.id, name: c.name, count: 1, level: c.level }];
        setEntries(updated);
        saveEntries(updated);
    }

    function addPlaceholder() {
        if (!phName.trim()) return;
        const updated = [...entries, {
            id: uid(), type: "placeholder" as const, name: phName.trim(), count: 1,
            placeholderLevel: parseInt(phLevel, 10) || 3,
            placeholderHealth: parseInt(phHealth, 10) || (parseInt(phLevel, 10) || 3) * 3,
            placeholderArmor: parseInt(phArmor, 10) || 0,
        }];
        setEntries(updated);
        saveEntries(updated);
        setPhName(""); setPhHealth(""); setPhArmor("");
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

    // ── Guidance (not a precise budget — Cypher avoids encounter math) ───────

    const guidanceData = useMemo(() => {
        const tiers = chars.map(tierFromPc);
        const avgTier = tiers.length ? tiers.reduce((s, t) => s + t, 0) / tiers.length : 1;
        const levels = entries.flatMap(e => Array(e.count).fill(e.level ?? e.placeholderLevel ?? 3));
        const avgLevel = levels.length ? levels.reduce((s, l) => s + l, 0) / levels.length : 0;
        const totalCount = entries.reduce((s, e) => s + e.count, 0);
        return { avgTier, avgLevel, totalCount, ...guidance(avgLevel, avgTier) };
    }, [entries, chars]);

    // ── Filtered creature search ───────────────────────────────────────────────

    const filteredCreatures = useMemo(() => searchSrd(allCreatures, creatureSearch, 25), [allCreatures, creatureSearch]);

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
                    <Chip label="Cypher System" size="small" variant="outlined"
                        sx={{ borderColor: "secondary.main", color: "secondary.main" }} />
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
                        placeholder="Describe the scene, motives, GM intrusions to set up, or other prep notes…"
                        value={notes}
                        onChange={e => { setNotes(e.target.value); saveNotes(e.target.value); }}
                        sx={{ "& .MuiOutlinedInput-root": { fontSize: "0.875rem" } }}
                    />
                </Paper>

                <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "flex-start" }}>

                    {/* ── Left: Add Creatures + Placeholders ── */}
                    <Box sx={{ flex: "1 1 300px" }}>

                        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                            <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                                Add from SRD (Creatures &amp; NPCs)
                            </Typography>
                            <TextField
                                size="small" placeholder="Search creatures…" value={creatureSearch} fullWidth
                                onChange={e => setCreatureSearch(e.target.value)}
                                InputProps={{ startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment> }}
                                sx={{ mt: 1.5, mb: 1 }}
                            />
                            <Box sx={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0.5 }}>
                                {filteredCreatures.map(c => (
                                    <Box key={c.id} onClick={() => addCreature(c)}
                                        sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75,
                                            borderRadius: 1, cursor: "pointer", "&:hover": { backgroundColor: "action.hover" } }}>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant="body2" sx={{ color: "text.primary" }}>{c.name}</Typography>
                                            <Typography variant="caption" sx={{ color: "text.secondary" }}>{creatureMeta(c)}</Typography>
                                        </Box>
                                        <Plus size={14} color="#8C5A3A" />
                                    </Box>
                                ))}
                                {filteredCreatures.length === 0 && (
                                    <Typography variant="body2" sx={{ color: "text.disabled", py: 2, textAlign: "center" }}>
                                        No creatures found
                                    </Typography>
                                )}
                            </Box>
                        </Paper>

                        {/* Placeholder form */}
                        <Paper elevation={1} sx={{ p: 2 }}>
                            <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                                Add Custom NPC
                            </Typography>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1.5 }}>
                                <TextField size="small" label="Name" value={phName} onChange={e => setPhName(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") addPlaceholder(); }} />
                                <Box sx={{ display: "flex", gap: 1 }}>
                                    <TextField size="small" label="Level" type="number" value={phLevel}
                                        onChange={e => setPhLevel(e.target.value)} sx={{ flex: 1 }}
                                        inputProps={{ min: 1, max: 10 }} />
                                    <TextField size="small" label="Health" type="number" value={phHealth}
                                        placeholder={String((parseInt(phLevel, 10) || 3) * 3)}
                                        onChange={e => setPhHealth(e.target.value)} sx={{ flex: 1 }} />
                                    <TextField size="small" label="Armor" type="number" value={phArmor}
                                        onChange={e => setPhArmor(e.target.value)} sx={{ flex: 1 }} />
                                </Box>
                                <Button variant="outlined" startIcon={<Plus size={14} />} onClick={addPlaceholder}
                                    disabled={!phName.trim()} sx={{ borderColor: "primary.main", color: "primary.main" }}>
                                    Add NPC
                                </Button>
                            </Box>
                        </Paper>
                    </Box>

                    {/* ── Right: Roster + PCs + Guidance ── */}
                    <Box sx={{ flex: "1 1 300px" }}>

                        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
                            <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                                Encounter Roster
                            </Typography>
                            {entries.length === 0 ? (
                                <Typography variant="body2" sx={{ color: "text.disabled", py: 2, textAlign: "center" }}>
                                    Add creatures from the SRD or a custom NPC
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
                                            <Chip label={`Level ${e.level ?? e.placeholderLevel ?? "?"}`} size="small"
                                                sx={{ height: 18, fontSize: "0.6rem", backgroundColor: "#8C5A3A22" }} />
                                            <IconButton size="small" onClick={() => removeEntry(e.id)} sx={{ p: 0.25, color: "text.disabled", "&:hover": { color: "error.main" } }}>
                                                <X size={14} />
                                            </IconButton>
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Paper>

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
                                            <Chip label={`Tier ${tierFromPc(pc)}`} size="small"
                                                sx={{ height: 18, fontSize: "0.6rem", backgroundColor: "#1565c022", color: "#1565c0" }} />
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Paper>

                        {(entries.length > 0 || chars.length > 0) && (
                            <Paper elevation={1} sx={{ p: 2, borderLeft: "4px solid", borderLeftColor: guidanceData.color }}>
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                                    <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                                        Rough Guidance
                                    </Typography>
                                    <Chip label={guidanceData.label.toUpperCase()} size="small"
                                        sx={{ backgroundColor: guidanceData.color, color: "#fff", fontWeight: 700, fontSize: "0.68rem" }} />
                                </Box>
                                <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                                    Avg. creature level {guidanceData.avgLevel.toFixed(1)} vs. avg. party tier {guidanceData.avgTier.toFixed(1)}
                                    {" "}({guidanceData.totalCount} creature{guidanceData.totalCount !== 1 ? "s" : ""})
                                </Typography>
                                <Divider sx={{ my: 1 }} />
                                <Typography variant="caption" sx={{ color: "text.disabled", fontStyle: "italic" }}>
                                    Cypher System intentionally has no XP-budget math for encounters — this is a rough
                                    rule-of-thumb only. A single creature several levels above the party can still be
                                    a fair fight depending on the situation; trust the fiction over the number.
                                </Typography>
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
            </Container>
        </Box>
    );
}
