"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
    Box, Container, Typography, Button, TextField, Paper, Chip,
    IconButton, Tooltip, CircularProgress, Checkbox, Popover,
    Accordion, AccordionSummary, AccordionDetails, Switch, FormControlLabel, Alert,
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import Link from "next/link";
import {
    ArrowLeft, Shield, ChevronDown, ChevronRight, Plus, Trash2,
    Search, Sparkles, Eye, Printer, BookOpen, Music,
} from "lucide-react";
import { generateClient } from "aws-amplify/data";
import { getCurrentUser } from "aws-amplify/auth";
import type { Schema } from "@/amplify/data/resource";
import {
    DAMAGE_TRACK_INFO, DIFFICULTY_TABLE, EFFORT_COST_TABLE, STEP_MODIFIERS,
    TIER_ADVANCEMENT_OPTIONS, XP_USES, type DamageTrack,
} from "@/lib/cypherRules";
import { useGmDashboardLayout } from "@/lib/useGmDashboardLayout";
import { TABLE_MODE_PALETTE } from "@/lib/tableModeTheme";
import { CommonIntrusionsDialog } from "../CommonIntrusionsDialog";
import { PartyCard, snapshot, type PartySnapshot } from "./PartyCard";
import { SessionPrepCard, loadLatestSession } from "../_dashboard-shared/SessionPrepCard";
import { SpotlightNpcs } from "../_dashboard-shared/SpotlightNpcs";
import { QuestProgress } from "../_dashboard-shared/QuestProgress";
import { QuickWikiDialog } from "../_dashboard-shared/QuickWikiDialog";
import { WikiSearchPin } from "../_dashboard-shared/WikiSearchPin";
import { RollLog } from "../_dashboard-shared/RollLog";
import { SessionAudioPlayer } from "../_dashboard-shared/SessionAudioPlayer";
import { CreatureLookup } from "./CreatureLookup";

const client = generateClient<Schema>();
type PlayerCharacter = Schema["PlayerCharacter"]["type"];
type CampaignSession = Schema["CampaignSession"]["type"];

// ── GM screen scratch data ────────────────────────────────────────────────────

interface IntrusionIdea { id: string; text: string; used: boolean }
interface GmScreenData {
    intrusionIdeas: IntrusionIdea[];
    pinnedNpcIds: string[];
    pinnedArticleIds: string[];
    pinnedCreatureIds: string[];
}
const DEFAULT_GM_SCREEN: GmScreenData = {
    intrusionIdeas: [], pinnedNpcIds: [], pinnedArticleIds: [], pinnedCreatureIds: [],
};

function parseGmScreen(json: string | null | undefined): GmScreenData {
    if (!json) return { ...DEFAULT_GM_SCREEN };
    try { return { ...DEFAULT_GM_SCREEN, ...JSON.parse(json) }; }
    catch { return { ...DEFAULT_GM_SCREEN }; }
}

function uid() { return Math.random().toString(36).slice(2, 9); }

const DAMAGE_SEVERITY: Record<DamageTrack, number> = { hale: 0, impaired: 1, debilitated: 2 };

// ── Collapsible section wrapper ───────────────────────────────────────────────

function SectionHeader({ label, sectionKey, collapsed, onToggle, action }: {
    label: string; sectionKey: string; collapsed: boolean; onToggle: (key: string) => void;
    action?: React.ReactNode;
}) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
            <IconButton size="small" sx={{ p: 0.25 }} onClick={() => onToggle(sectionKey)}>
                {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </IconButton>
            <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2, flex: 1 }}>
                {label}
            </Typography>
            {action}
        </Box>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GmDashboardPage() {
    const { campaignId } = useParams<{ campaignId: string }>();

    const [chars, setChars] = useState<PlayerCharacter[]>([]);
    const [campaignName, setCampaignName] = useState("");
    const [worldIds, setWorldIds] = useState<string[]>([]);
    const [gmScreen, setGmScreen] = useState<GmScreenData>({ ...DEFAULT_GM_SCREEN });
    const [latestSession, setLatestSession] = useState<CampaignSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [ideaInput, setIdeaInput] = useState("");
    const [savingIdeas, setSavingIdeas] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout>>();

    const [commonOpen, setCommonOpen] = useState(false);
    const [wikiOpen, setWikiOpen] = useState(false);
    const [creatureSearchOpen, setCreatureSearchOpen] = useState(false);

    const [spotlightId, setSpotlightId] = useState<string | null>(null);
    const [worsenedAlert, setWorsenedAlert] = useState<{ name: string; track: DamageTrack } | null>(null);
    const prevSnapshotsRef = useRef<Map<string, PartySnapshot>>(new Map());

    const { layout, toggleSection, setTableMode } = useGmDashboardLayout();
    const [musicAnchor, setMusicAnchor] = useState<HTMLElement | null>(null);
    const [displayName, setDisplayName] = useState("GM");
    useEffect(() => {
        getCurrentUser().then(u => setDisplayName(u.signInDetails?.loginId ?? u.username)).catch(() => {});
    }, []);

    useEffect(() => {
        client.models.Campaign.get({ id: campaignId }).then(({ data }) => {
            setCampaignName(data?.name ?? "Campaign");
            setWorldIds((data?.worldIds ?? []).filter((id): id is string => id != null));
            setGmScreen(parseGmScreen(data?.gmScreenJson));
            setLoading(false);
        });
        loadLatestSession(campaignId).then(setLatestSession);
    }, [campaignId]);

    function checkForChange(pc: PlayerCharacter) {
        const prev = prevSnapshotsRef.current.get(pc.id);
        const next = snapshot(pc);
        if (prev && DAMAGE_SEVERITY[next.damageTrack] > DAMAGE_SEVERITY[prev.damageTrack]) {
            setWorsenedAlert({ name: pc.characterName, track: next.damageTrack });
        }
        prevSnapshotsRef.current.set(pc.id, next);
        setSpotlightId(pc.id);
    }

    // Deliberately not observeQuery(): its internal merge helper
    // (findIndexByFields) doesn't null-check the incoming subscription
    // payload, and AppSync can legitimately deliver a null item on some
    // update events — that throws inside Amplify's own code, before it
    // ever reaches a try/catch here. Doing the list + merge ourselves lets
    // us just ignore null payloads instead of crashing the page on them.
    useEffect(() => {
        let cancelled = false;
        const filter = { campaignId: { eq: campaignId } };

        client.models.PlayerCharacter.list({ filter }).then(({ data }) => {
            if (cancelled) return;
            const list = data ?? [];
            list.forEach(pc => prevSnapshotsRef.current.set(pc.id, snapshot(pc)));
            setChars(list);
        });

        // No server-side `filter` here — kept from troubleshooting a null-payload
        // issue (root cause turned out to be an incomplete selection set on a
        // mutation elsewhere, not the filter itself, but this still works fine).
        const onCreate = client.models.PlayerCharacter.onCreate().subscribe({
            next: (item) => {
                if (!item || item.campaignId !== campaignId) return;
                prevSnapshotsRef.current.set(item.id, snapshot(item));
                setChars(prev => prev.some(c => c.id === item.id) ? prev : [...prev, item]);
            },
            error: (err) => console.error("[GM Dashboard] onCreate subscription error", err),
        });
        const onUpdate = client.models.PlayerCharacter.onUpdate().subscribe({
            next: (item) => {
                if (!item || item.campaignId !== campaignId) return;
                checkForChange(item);
                setChars(prev => prev.map(c => c.id === item.id ? { ...c, ...item } : c));
            },
            error: (err) => console.error("[GM Dashboard] onUpdate subscription error", err),
        });
        const onDelete = client.models.PlayerCharacter.onDelete().subscribe({
            next: (item) => {
                if (!item || item.campaignId !== campaignId) return;
                setChars(prev => prev.filter(c => c.id !== item.id));
            },
            error: (err) => console.error("[GM Dashboard] onDelete subscription error", err),
        });

        return () => {
            cancelled = true;
            onCreate.unsubscribe();
            onUpdate.unsubscribe();
            onDelete.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    function addIdea(text: string) {
        if (!text.trim()) return;
        saveGmScreen({ ...gmScreen, intrusionIdeas: [...gmScreen.intrusionIdeas, { id: uid(), text: text.trim(), used: false }] });
    }
    function toggleIdea(id: string) {
        saveGmScreen({ ...gmScreen, intrusionIdeas: gmScreen.intrusionIdeas.map(i => i.id === id ? { ...i, used: !i.used } : i) });
    }
    function removeIdea(id: string) {
        saveGmScreen({ ...gmScreen, intrusionIdeas: gmScreen.intrusionIdeas.filter(i => i.id !== id) });
    }
    function toggleNpcPin(npcId: string) {
        const pinned = gmScreen.pinnedNpcIds.includes(npcId)
            ? gmScreen.pinnedNpcIds.filter(id => id !== npcId)
            : [...gmScreen.pinnedNpcIds, npcId];
        saveGmScreen({ ...gmScreen, pinnedNpcIds: pinned });
    }
    function toggleArticlePin(articleId: string) {
        const pinned = gmScreen.pinnedArticleIds.includes(articleId)
            ? gmScreen.pinnedArticleIds.filter(id => id !== articleId)
            : [...gmScreen.pinnedArticleIds, articleId];
        saveGmScreen({ ...gmScreen, pinnedArticleIds: pinned });
    }
    function toggleCreaturePin(creatureId: string) {
        const pinned = gmScreen.pinnedCreatureIds.includes(creatureId)
            ? gmScreen.pinnedCreatureIds.filter(id => id !== creatureId)
            : [...gmScreen.pinnedCreatureIds, creatureId];
        saveGmScreen({ ...gmScreen, pinnedCreatureIds: pinned });
    }

    async function awardXp(pcId: string, amount: number) {
        const pc = chars.find(c => c.id === pcId);
        if (!pc) return;
        const newXp = (pc.xp ?? 0) + amount;
        setChars(prev => prev.map(c => c.id === pcId ? { ...c, xp: newXp } : c));
        await client.models.PlayerCharacter.update({ id: pcId, xp: newXp });
    }

    async function adjustPcPool(pcId: string, pool: "might" | "speed" | "intellect", delta: number) {
        const pc = chars.find(c => c.id === pcId);
        if (!pc) return;
        let snap: Record<string, unknown> = {};
        try { snap = pc.systemDataJson ? JSON.parse(pc.systemDataJson) : {}; } catch { /* start fresh */ }
        const currentKey = `current${pool.charAt(0).toUpperCase()}${pool.slice(1)}`;
        const maxKey = `${pool}Pool`;
        const current = Number(snap[currentKey] ?? 10);
        const max = Number(snap[maxKey] ?? 10);
        const raw = current + delta;
        const next = Math.max(0, Math.min(max, raw));
        const merged: Record<string, unknown> = { ...snap, [currentKey]: next };
        if (delta < 0 && raw < 0) {
            const order: DamageTrack[] = ["hale", "impaired", "debilitated"];
            const idx = order.indexOf((snap.damageTrack as DamageTrack) ?? "hale");
            if (idx < order.length - 1) merged.damageTrack = order[idx + 1];
        }
        const systemDataJson = JSON.stringify(merged);
        setChars(prev => prev.map(c => c.id === pcId ? { ...c, systemDataJson } : c));
        await client.models.PlayerCharacter.update({ id: pcId, systemDataJson });
    }

    const lowPoolChars = useMemo(() => {
        return chars
            .map(pc => ({ pc, snap: snapshot(pc) }))
            .filter(({ snap }) => (["might", "speed", "intellect"] as const).some(p => {
                const ps = snap.pools[p];
                return ps.max > 0 && ps.current / ps.max <= 0.25;
            }));
    }, [chars]);

    const collapsed = (key: string) => layout.collapsedSections.includes(key);

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );

    return (
        <ThemeProvider theme={(outer) => layout.tableMode ? createTheme(outer, { palette: TABLE_MODE_PALETTE }) : outer}>
        <Box sx={{
            minHeight: "100vh", py: 6,
            backgroundColor: "background.default",
            color: "text.primary",
            "@media print": { backgroundColor: "#fff", color: "#000" },
        }}>
            <Container maxWidth="xl" className="no-print">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 3, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1, flexWrap: "wrap" }}>
                    <Shield size={28} color="#8C5A3A" />
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>GM Dashboard</Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>{campaignName} · Cypher System</Typography>
                    </Box>
                    <FormControlLabel
                        control={<Switch size="small" checked={layout.tableMode} onChange={e => setTableMode(e.target.checked)} />}
                        label={<Typography variant="caption">Table Mode</Typography>} />
                    <Tooltip title="Open a read-only player-facing view in a new tab">
                        <Button size="small" variant="outlined" startIcon={<Eye size={14} />}
                            onClick={() => window.open(`/tabletop/campaigns/${campaignId}/gm-dashboard/player-view`, "_blank")}>
                            Player View
                        </Button>
                    </Tooltip>
                    <Tooltip title="Print a one-page party summary">
                        <Button size="small" variant="outlined" startIcon={<Printer size={14} />} onClick={() => window.print()}>
                            Print
                        </Button>
                    </Tooltip>
                    <Tooltip title="Session music">
                        <Button size="small" variant="outlined" startIcon={<Music size={14} />} onClick={e => setMusicAnchor(e.currentTarget)}>
                            Music
                        </Button>
                    </Tooltip>
                </Box>

                <Popover open={!!musicAnchor} anchorEl={musicAnchor} onClose={() => setMusicAnchor(null)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                    <SessionAudioPlayer campaignId={campaignId} displayName={displayName} controlsEnabled />
                </Popover>

                {/* Alerts */}
                {worsenedAlert && (
                    <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setWorsenedAlert(null)}>
                        {worsenedAlert.name} moved to <strong>{DAMAGE_TRACK_INFO[worsenedAlert.track].label}</strong>.
                    </Alert>
                )}
                {lowPoolChars.length > 0 && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        Low pool: {lowPoolChars.map(({ pc }) => pc.characterName).join(", ")}
                    </Alert>
                )}

                {/* Two-column layout: live session tools on the left, prep/reference on the right */}
                <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start", flexWrap: "wrap" }}>
                    {/* Main column */}
                    <Box sx={{ flex: "2 1 560px", minWidth: 0 }}>
                        <SectionHeader label="Party" sectionKey="party" collapsed={collapsed("party")} onToggle={toggleSection}
                            action={
                                <Tooltip title="Search the SRD for a creature or NPC">
                                    <Button size="small" startIcon={<Search size={12} />} onClick={() => setCreatureSearchOpen(o => !o)}
                                        sx={{ fontSize: "0.65rem" }}>
                                        Creature Lookup
                                    </Button>
                                </Tooltip>
                            } />
                        {!collapsed("party") && (
                            chars.length === 0 ? (
                                <Typography variant="body2" sx={{ color: "text.disabled", mb: 3 }}>No characters in this campaign yet.</Typography>
                            ) : (
                                <Box sx={{ mb: 3 }}>
                                    {chars.map(pc => (
                                        <PartyCard key={pc.id} pc={pc} isSpotlight={pc.id === spotlightId}
                                            onAwardXp={awardXp} onAdjustPool={adjustPcPool} />
                                    ))}
                                </Box>
                            )
                        )}

                        {creatureSearchOpen && (
                            <CreatureLookup pinnedIds={gmScreen.pinnedCreatureIds} onTogglePin={toggleCreaturePin}
                                onClose={() => setCreatureSearchOpen(false)} />
                        )}

                        <SectionHeader label="Dice Rolls" sectionKey="rolls" collapsed={collapsed("rolls")} onToggle={toggleSection} />
                        {!collapsed("rolls") && <RollLog campaignId={campaignId} />}

                        <SectionHeader label="Active Quests" sectionKey="quests" collapsed={collapsed("quests")} onToggle={toggleSection} />
                        {!collapsed("quests") && <QuestProgress campaignId={campaignId} />}

                        <SectionHeader label="Wiki" sectionKey="wiki" collapsed={collapsed("wiki")} onToggle={toggleSection}
                            action={
                                <Button size="small" startIcon={<BookOpen size={12} />} onClick={() => setWikiOpen(true)} sx={{ fontSize: "0.65rem" }}>
                                    New Article
                                </Button>
                            } />
                        {!collapsed("wiki") && (
                            <WikiSearchPin worldIds={worldIds} pinnedIds={gmScreen.pinnedArticleIds} onTogglePin={toggleArticlePin} />
                        )}
                    </Box>

                    {/* Sidebar column */}
                    <Box sx={{ flex: "1 1 340px", minWidth: 300 }}>
                        <SectionHeader label="Session Prep" sectionKey="prep" collapsed={collapsed("prep")} onToggle={toggleSection} />
                        {!collapsed("prep") && <SessionPrepCard session={latestSession} campaignId={campaignId} />}

                        <SectionHeader label="Spotlight NPCs" sectionKey="npcs" collapsed={collapsed("npcs")} onToggle={toggleSection} />
                        {!collapsed("npcs") && (
                            <SpotlightNpcs campaignId={campaignId} worldIds={worldIds} pinnedIds={gmScreen.pinnedNpcIds} onTogglePin={toggleNpcPin} />
                        )}

                        <SectionHeader label="GM Intrusion Ideas" sectionKey="intrusions" collapsed={collapsed("intrusions")} onToggle={toggleSection}
                            action={
                                <Button size="small" startIcon={<Sparkles size={12} />} onClick={() => setCommonOpen(true)} sx={{ fontSize: "0.65rem" }}>
                                    Common Ideas
                                </Button>
                            } />
                        {!collapsed("intrusions") && (
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
                                        onKeyDown={e => { if (e.key === "Enter") { addIdea(ideaInput); setIdeaInput(""); } }} />
                                    <Button variant="outlined" startIcon={<Plus size={14} />}
                                        onClick={() => { addIdea(ideaInput); setIdeaInput(""); }} disabled={!ideaInput.trim()}>
                                        Add
                                    </Button>
                                </Box>
                                {savingIdeas && <Typography variant="caption" sx={{ color: "text.disabled" }}>Saving…</Typography>}
                            </Paper>
                        )}

                        <SectionHeader label="Rules Quick Reference" sectionKey="rules" collapsed={collapsed("rules")} onToggle={toggleSection} />
                        {!collapsed("rules") && (
                            <>
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

                                <Accordion>
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

                                <Accordion>
                                    <AccordionSummary expandIcon={<ChevronDown size={16} />}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Tier Advancement (4 XP)</Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mb: 1 }}>
                                            Reference only — pick one benefit per tier. Nothing here updates a character automatically.
                                        </Typography>
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                            {TIER_ADVANCEMENT_OPTIONS.map(opt => (
                                                <Box key={opt.label}>
                                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{opt.label}</Typography>
                                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{opt.detail}</Typography>
                                                </Box>
                                            ))}
                                        </Box>
                                    </AccordionDetails>
                                </Accordion>

                                <Accordion sx={{ mb: 3 }}>
                                    <AccordionSummary expandIcon={<ChevronDown size={16} />}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Other Ways to Spend XP</Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                            {XP_USES.map(u => (
                                                <Box key={u.label}>
                                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                        {u.label}{!u.core && <Typography component="span" variant="caption" sx={{ color: "warning.main", ml: 0.75 }}>(house rule)</Typography>}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>{u.detail}</Typography>
                                                </Box>
                                            ))}
                                        </Box>
                                    </AccordionDetails>
                                </Accordion>
                            </>
                        )}
                    </Box>
                </Box>
            </Container>

            {/* Printable table-tent summary — hidden on screen, shown only when printing */}
            <Box className="print-only" sx={{ display: "none", "@media print": { display: "block", p: 4 } }}>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>{campaignName}</Typography>
                {chars.map(pc => {
                    const snap = snapshot(pc);
                    return (
                        <Box key={pc.id} sx={{ mb: 3, pageBreakInside: "avoid" }}>
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>{pc.characterName} — Tier {snap.tier}</Typography>
                            <Typography variant="body1">
                                Might {snap.pools.might.current}/{snap.pools.might.max} ·{" "}
                                Speed {snap.pools.speed.current}/{snap.pools.speed.max} ·{" "}
                                Intellect {snap.pools.intellect.current}/{snap.pools.intellect.max}
                            </Typography>
                            <Typography variant="body1">Damage Track: {DAMAGE_TRACK_INFO[snap.damageTrack].label}</Typography>
                        </Box>
                    );
                })}
            </Box>

            <CommonIntrusionsDialog open={commonOpen} onClose={() => setCommonOpen(false)}
                onPick={text => { addIdea(text); setCommonOpen(false); }} />
            <QuickWikiDialog open={wikiOpen} onClose={() => setWikiOpen(false)} worldIds={worldIds} />
        </Box>
        </ThemeProvider>
    );
}
