"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import {
    Box, Container, Typography, Button, TextField, Paper, Chip,
    Divider, IconButton, Tooltip, CircularProgress, Checkbox,
    LinearProgress, Accordion, AccordionSummary, AccordionDetails, Collapse,
} from "@mui/material";
import Link from "next/link";
import {
    ArrowLeft, Shield, Sparkles, ChevronDown, Plus, X, Trash2,
} from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import {
    DAMAGE_TRACK_INFO, DIFFICULTY_TABLE, EFFORT_COST_TABLE, STEP_MODIFIERS,
    DEFAULT_CYPHER_LIMIT, type DamageTrack,
} from "@/lib/cypherRules";

const client = generateClient<Schema>();
type PlayerCharacter = Schema["PlayerCharacter"]["type"];

// ── GM screen scratch data ────────────────────────────────────────────────────

interface IntrusionIdea { id: string; text: string; used: boolean }
interface GmScreenData { intrusionIdeas: IntrusionIdea[] }
const DEFAULT_GM_SCREEN: GmScreenData = { intrusionIdeas: [] };

function parseGmScreen(json: string | null | undefined): GmScreenData {
    if (!json) return { ...DEFAULT_GM_SCREEN };
    try { return { ...DEFAULT_GM_SCREEN, ...JSON.parse(json) }; }
    catch { return { ...DEFAULT_GM_SCREEN }; }
}

function uid() { return Math.random().toString(36).slice(2, 9); }

// ── Party snapshot, parsed from each PC's systemDataJson ─────────────────────

interface PoolState { current: number; max: number }
interface PartySnapshot {
    tier: number;
    xp: number;
    pools: { might: PoolState; speed: PoolState; intellect: PoolState };
    damageTrack: DamageTrack;
    cypherCount: number;
    activeArcs: string[];
}

function snapshot(pc: PlayerCharacter): PartySnapshot {
    let snap: Record<string, unknown> = {};
    try { snap = pc.systemDataJson ? JSON.parse(pc.systemDataJson) : {}; } catch { /* ignore */ }
    const cyphers = Array.isArray(snap.cyphers) ? snap.cyphers as unknown[] : [];
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
        cypherCount: cyphers.length,
        activeArcs: arcs.filter(a => a.status === "active").map(a => a.name ?? "").filter(Boolean),
    };
}

// ── Party card ────────────────────────────────────────────────────────────────

function PartyCard({ pc, onAwardXp }: { pc: PlayerCharacter; onAwardXp: (pcId: string, amount: number) => void }) {
    const [showFriend, setShowFriend] = useState(false);
    const snap = snapshot(pc);
    const dmg = DAMAGE_TRACK_INFO[snap.damageTrack];

    return (
        <Paper elevation={1} sx={{ p: 1.5, mb: 1.5, borderLeft: "4px solid", borderLeftColor: dmg.color }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Typography variant="body1" sx={{ fontWeight: 700, color: "primary.dark", flex: 1, minWidth: 100 }}>
                    {pc.characterName}
                </Typography>
                <Chip label={`Tier ${snap.tier}`} size="small" sx={{ backgroundColor: "primary.dark", color: "#fff", fontSize: "0.65rem", height: 20 }} />
                <Chip label={`${snap.xp} XP`} size="small" variant="outlined" sx={{ fontSize: "0.65rem", height: 20 }} />
                <Chip label={dmg.label} size="small" sx={{ backgroundColor: dmg.color, color: "#fff", fontSize: "0.65rem", height: 20 }} />
                {snap.cypherCount > DEFAULT_CYPHER_LIMIT && (
                    <Tooltip title={`Carrying ${snap.cypherCount} cyphers — over the default limit of ${DEFAULT_CYPHER_LIMIT}`}>
                        <Chip label={`${snap.cypherCount} cyphers ⚠`} size="small" color="warning" sx={{ fontSize: "0.65rem", height: 20 }} />
                    </Tooltip>
                )}
                <Tooltip title="GM Intrusion — award 1 XP">
                    <Button size="small" startIcon={<Sparkles size={12} />}
                        onClick={() => { onAwardXp(pc.id, 1); setShowFriend(true); }}
                        sx={{ fontSize: "0.65rem", color: "#7c3aed", minWidth: 0, px: 1 }}>
                        Intrusion
                    </Button>
                </Tooltip>
            </Box>

            <Box sx={{ display: "flex", gap: 2.5, mt: 1, flexWrap: "wrap" }}>
                {(["might", "speed", "intellect"] as const).map(p => {
                    const ps = snap.pools[p];
                    const pct = ps.max > 0 ? (ps.current / ps.max) * 100 : 0;
                    const barColor = pct > 50 ? "#2e7d32" : pct > 25 ? "#f57c00" : "#c62828";
                    return (
                        <Box key={p} sx={{ minWidth: 80 }}>
                            <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "capitalize" }}>{p}</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: barColor }}>{ps.current}/{ps.max}</Typography>
                            <LinearProgress variant="determinate" value={pct}
                                sx={{ width: 72, height: 4, borderRadius: 2, backgroundColor: "#e0e0e0",
                                    "& .MuiLinearProgress-bar": { backgroundColor: barColor } }} />
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GmDashboardPage() {
    const { campaignId } = useParams<{ campaignId: string }>();

    const [chars, setChars] = useState<PlayerCharacter[]>([]);
    const [campaignName, setCampaignName] = useState("");
    const [gmScreen, setGmScreen] = useState<GmScreenData>({ ...DEFAULT_GM_SCREEN });
    const [loading, setLoading] = useState(true);
    const [ideaInput, setIdeaInput] = useState("");
    const [savingIdeas, setSavingIdeas] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        client.models.Campaign.get({ id: campaignId }).then(({ data }) => {
            setCampaignName(data?.name ?? "Campaign");
            setGmScreen(parseGmScreen(data?.gmScreenJson));
            setLoading(false);
        });
    }, [campaignId]);

    useEffect(() => {
        const sub = client.models.PlayerCharacter.observeQuery({
            filter: { campaignId: { eq: campaignId } },
        }).subscribe({ next: ({ items }) => setChars([...items]) });
        return () => sub.unsubscribe();
    }, [campaignId]);

    const saveGmScreen = useCallback((next: GmScreenData) => {
        setGmScreen(next);
        clearTimeout(saveTimer.current);
        setSavingIdeas(true);
        saveTimer.current = setTimeout(async () => {
            await client.models.Campaign.update({ id: campaignId, gmScreenJson: JSON.stringify(next) });
            setSavingIdeas(false);
        }, 800);
    }, [campaignId]);

    function addIdea() {
        if (!ideaInput.trim()) return;
        saveGmScreen({ intrusionIdeas: [...gmScreen.intrusionIdeas, { id: uid(), text: ideaInput.trim(), used: false }] });
        setIdeaInput("");
    }
    function toggleIdea(id: string) {
        saveGmScreen({ intrusionIdeas: gmScreen.intrusionIdeas.map(i => i.id === id ? { ...i, used: !i.used } : i) });
    }
    function removeIdea(id: string) {
        saveGmScreen({ intrusionIdeas: gmScreen.intrusionIdeas.filter(i => i.id !== id) });
    }

    async function awardXp(pcId: string, amount: number) {
        const pc = chars.find(c => c.id === pcId);
        if (!pc) return;
        const newXp = (pc.xp ?? 0) + amount;
        setChars(prev => prev.map(c => c.id === pcId ? { ...c, xp: newXp } : c));
        await client.models.PlayerCharacter.update({ id: pcId, xp: newXp });
    }

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

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
                    <Shield size={28} color="#8C5A3A" />
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>GM Dashboard</Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>{campaignName} · Cypher System</Typography>
                    </Box>
                </Box>

                {/* Party tracker */}
                <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2, display: "block", mb: 1 }}>
                    Party
                </Typography>
                {chars.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "text.disabled", mb: 3 }}>No characters in this campaign yet.</Typography>
                ) : (
                    <Box sx={{ mb: 3 }}>
                        {chars.map(pc => <PartyCard key={pc.id} pc={pc} onAwardXp={awardXp} />)}
                    </Box>
                )}

                {/* GM intrusion idea log */}
                <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2, display: "block", mb: 1 }}>
                    GM Intrusion Ideas
                </Typography>
                <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                    {gmScreen.intrusionIdeas.length === 0 ? (
                        <Typography variant="body2" sx={{ color: "text.disabled", mb: 1.5 }}>
                            No ideas jotted yet. Prep a few intrusions before the session and check them off as you use them.
                        </Typography>
                    ) : (
                        <Box sx={{ mb: 1.5 }}>
                            {gmScreen.intrusionIdeas.map(idea => (
                                <Box key={idea.id} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                    <Checkbox size="small" checked={idea.used} onChange={() => toggleIdea(idea.id)} />
                                    <Typography variant="body2" sx={{
                                        flex: 1, color: idea.used ? "text.disabled" : "text.primary",
                                        textDecoration: idea.used ? "line-through" : "none",
                                    }}>
                                        {idea.text}
                                    </Typography>
                                    <IconButton size="small" onClick={() => removeIdea(idea.id)} sx={{ p: 0.25 }}>
                                        <Trash2 size={14} />
                                    </IconButton>
                                </Box>
                            ))}
                        </Box>
                    )}
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <TextField size="small" placeholder="A patrol notices the smoke from their fire…" fullWidth
                            value={ideaInput} onChange={e => setIdeaInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") addIdea(); }} />
                        <Button variant="outlined" startIcon={<Plus size={14} />} onClick={addIdea} disabled={!ideaInput.trim()}>
                            Add
                        </Button>
                    </Box>
                    {savingIdeas && <Typography variant="caption" sx={{ color: "text.disabled" }}>Saving…</Typography>}
                </Paper>

                {/* Rules quick reference */}
                <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2, display: "block", mb: 1 }}>
                    Rules Quick Reference
                </Typography>

                <Accordion>
                    <AccordionSummary expandIcon={<ChevronDown size={16} />}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Difficulty &amp; Target Numbers</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                            {DIFFICULTY_TABLE.map(d => (
                                <Box key={d.level} sx={{ minWidth: 90, textAlign: "center", border: "1px solid", borderColor: "divider", borderRadius: 1, p: 0.75 }}>
                                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>Lvl {d.level}</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{d.name}</Typography>
                                    <Typography variant="caption" sx={{ color: "primary.main" }}>TN {d.targetNumber}</Typography>
                                </Box>
                            ))}
                        </Box>
                        <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mt: 1.5 }}>
                            Target number is always the creature/task level × 3. Roll a d20 and meet or beat it.
                        </Typography>
                    </AccordionDetails>
                </Accordion>

                <Accordion>
                    <AccordionSummary expandIcon={<ChevronDown size={16} />}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Effort Costs</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                            {EFFORT_COST_TABLE.map(e => (
                                <Box key={e.level} sx={{ minWidth: 80, textAlign: "center", border: "1px solid", borderColor: "divider", borderRadius: 1, p: 0.75 }}>
                                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>Effort {e.level}</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{e.cumulativeCost} pts</Typography>
                                </Box>
                            ))}
                        </Box>
                        <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mt: 1.5 }}>
                            Cumulative cost from the relevant Pool. Subtract the matching Edge from the total (minimum 0) each time Effort is used.
                        </Typography>
                    </AccordionDetails>
                </Accordion>

                <Accordion>
                    <AccordionSummary expandIcon={<ChevronDown size={16} />}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Damage Track</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            {(["hale", "impaired", "debilitated"] as const).map(track => {
                                const info = DAMAGE_TRACK_INFO[track];
                                return (
                                    <Box key={track} sx={{ borderLeft: "3px solid", borderColor: info.color, pl: 1.5, py: 0.5 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: info.color }}>{info.label}</Typography>
                                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{info.effect}</Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                    </AccordionDetails>
                </Accordion>

                <Accordion sx={{ mb: 3 }}>
                    <AccordionSummary expandIcon={<ChevronDown size={16} />}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Assets, Skills &amp; Hindrances</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            {STEP_MODIFIERS.map(m => (
                                <Box key={m.label}>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{m.label}</Typography>
                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{m.effect}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </AccordionDetails>
                </Accordion>
            </Container>
        </Box>
    );
}
