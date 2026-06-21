"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
    Box, Container, Typography, Button, TextField, Paper, Chip,
    IconButton, Tooltip, CircularProgress, Checkbox,
    Accordion, AccordionSummary, AccordionDetails, Switch, FormControlLabel, Alert,
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import Link from "next/link";
import {
    ArrowLeft, Shield, ChevronDown, ChevronRight, Plus, Trash2,
    Search, Eye, Printer, BookOpen, Moon, Swords, Calculator, Gem, Sparkles as Wand,
} from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import {
    DEATH_SAVES_REFERENCE, CONCENTRATION_REFERENCE, COVER_REFERENCE,
    EXHAUSTION_REFERENCE, RESTING_REFERENCE,
} from "@/lib/dndRules";
import { useGmDashboardLayout } from "@/lib/useGmDashboardLayout";
import { TABLE_MODE_PALETTE } from "@/lib/tableModeTheme";
import { PartyCard, snapshot, type PartySnapshot } from "./PartyCard";
import { MonsterLookup } from "./MonsterLookup";
import { SessionPrepCard, loadLatestSession } from "../_dashboard-shared/SessionPrepCard";
import { SpotlightNpcs } from "../_dashboard-shared/SpotlightNpcs";
import { QuestProgress } from "../_dashboard-shared/QuestProgress";
import { QuickWikiDialog } from "../_dashboard-shared/QuickWikiDialog";
import { WikiSearchPin } from "../_dashboard-shared/WikiSearchPin";

const client = generateClient<Schema>();
type PlayerCharacter = Schema["PlayerCharacter"]["type"];
type CampaignSession = Schema["CampaignSession"]["type"];

// ── GM screen scratch data ────────────────────────────────────────────────────

interface IdeaItem { id: string; text: string; used: boolean }
interface GmScreenData {
    inspirationIdeas: IdeaItem[];
    pinnedNpcIds: string[];
    pinnedArticleIds: string[];
    pinnedMonsterIds: string[];
}
const DEFAULT_GM_SCREEN: GmScreenData = {
    inspirationIdeas: [], pinnedNpcIds: [], pinnedArticleIds: [], pinnedMonsterIds: [],
};

function parseGmScreen(json: string | null | undefined): GmScreenData {
    if (!json) return { ...DEFAULT_GM_SCREEN };
    try { return { ...DEFAULT_GM_SCREEN, ...JSON.parse(json) }; }
    catch { return { ...DEFAULT_GM_SCREEN }; }
}

function uid() { return Math.random().toString(36).slice(2, 9); }

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

export default function DndDashboardPage() {
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

    const [wikiOpen, setWikiOpen] = useState(false);
    const [monsterSearchOpen, setMonsterSearchOpen] = useState(false);

    const [spotlightId, setSpotlightId] = useState<string | null>(null);
    const [downedAlert, setDownedAlert] = useState<string | null>(null);
    const prevSnapshotsRef = useRef<Map<string, PartySnapshot>>(new Map());

    const { layout, toggleSection, setTableMode } = useGmDashboardLayout();

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
        if (prev && !prev.downed && next.downed) {
            setDownedAlert(`${pc.characterName} has dropped to 0 HP!`);
        }
        prevSnapshotsRef.current.set(pc.id, next);
        setSpotlightId(pc.id);
    }

    // See the Cypher GM Dashboard for why this avoids observeQuery() — same
    // null-payload crash risk applies here since it's the same model.
    useEffect(() => {
        let cancelled = false;
        const filter = { campaignId: { eq: campaignId } };

        client.models.PlayerCharacter.list({ filter }).then(({ data }) => {
            if (cancelled) return;
            const list = data ?? [];
            list.forEach(pc => prevSnapshotsRef.current.set(pc.id, snapshot(pc)));
            setChars(list);
        });

        const onCreate = client.models.PlayerCharacter.onCreate().subscribe({
            next: (item) => {
                if (!item || item.campaignId !== campaignId) return;
                prevSnapshotsRef.current.set(item.id, snapshot(item));
                setChars(prev => prev.some(c => c.id === item.id) ? prev : [...prev, item]);
            },
            error: (err) => console.error("[D&D Dashboard] onCreate subscription error", err),
        });
        const onUpdate = client.models.PlayerCharacter.onUpdate().subscribe({
            next: (item) => {
                if (!item || item.campaignId !== campaignId) return;
                checkForChange(item);
                setChars(prev => prev.map(c => c.id === item.id ? { ...c, ...item } : c));
            },
            error: (err) => console.error("[D&D Dashboard] onUpdate subscription error", err),
        });
        const onDelete = client.models.PlayerCharacter.onDelete().subscribe({
            next: (item) => {
                if (!item || item.campaignId !== campaignId) return;
                setChars(prev => prev.filter(c => c.id !== item.id));
            },
            error: (err) => console.error("[D&D Dashboard] onDelete subscription error", err),
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
        saveGmScreen({ ...gmScreen, inspirationIdeas: [...gmScreen.inspirationIdeas, { id: uid(), text: text.trim(), used: false }] });
    }
    function toggleIdea(id: string) {
        saveGmScreen({ ...gmScreen, inspirationIdeas: gmScreen.inspirationIdeas.map(i => i.id === id ? { ...i, used: !i.used } : i) });
    }
    function removeIdea(id: string) {
        saveGmScreen({ ...gmScreen, inspirationIdeas: gmScreen.inspirationIdeas.filter(i => i.id !== id) });
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
    function toggleMonsterPin(monsterId: string) {
        const pinned = gmScreen.pinnedMonsterIds.includes(monsterId)
            ? gmScreen.pinnedMonsterIds.filter(id => id !== monsterId)
            : [...gmScreen.pinnedMonsterIds, monsterId];
        saveGmScreen({ ...gmScreen, pinnedMonsterIds: pinned });
    }

    async function updatePc(pcId: string, patch: Partial<PlayerCharacter>) {
        setChars(prev => prev.map(c => c.id === pcId ? { ...c, ...patch } : c));
        await client.models.PlayerCharacter.update({ id: pcId, ...patch });
    }

    async function applyLongRestToAll() {
        for (const pc of chars) {
            const patch: Partial<PlayerCharacter> = {
                currentHp: pc.maxHp ?? pc.currentHp ?? 0,
                exhaustion: Math.max(0, (pc.exhaustion ?? 0) - 1),
            };
            if (pc.spellSlotsJson) {
                try {
                    const slots = JSON.parse(pc.spellSlotsJson) as Record<string, { max: number; used: number }>;
                    for (const lvl of Object.keys(slots)) slots[lvl].used = 0;
                    patch.spellSlotsJson = JSON.stringify(slots);
                } catch { /* leave as-is if unparseable */ }
            }
            await updatePc(pc.id, patch);
        }
    }

    const lowHpChars = useMemo(() => {
        return chars
            .map(pc => ({ pc, snap: snapshot(pc) }))
            .filter(({ snap }) => !snap.downed && snap.hp.max > 0 && snap.hp.current / snap.hp.max <= 0.25);
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
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>{campaignName} · D&amp;D 5e</Typography>
                    </Box>
                    <FormControlLabel
                        control={<Switch size="small" checked={layout.tableMode} onChange={e => setTableMode(e.target.checked)} />}
                        label={<Typography variant="caption">Table Mode</Typography>} />
                    <Tooltip title="Open a read-only player-facing view in a new tab">
                        <Button size="small" variant="outlined" startIcon={<Eye size={14} />}
                            onClick={() => window.open(`/tabletop/campaigns/${campaignId}/dnd-dashboard/player-view`, "_blank")}>
                            Player View
                        </Button>
                    </Tooltip>
                    <Tooltip title="Print a one-page party summary">
                        <Button size="small" variant="outlined" startIcon={<Printer size={14} />} onClick={() => window.print()}>
                            Print
                        </Button>
                    </Tooltip>
                </Box>

                {/* Alerts */}
                {downedAlert && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDownedAlert(null)}>{downedAlert}</Alert>
                )}
                {lowHpChars.length > 0 && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Low HP: {lowHpChars.map(({ pc }) => pc.characterName).join(", ")}
                    </Alert>
                )}

                <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start", flexWrap: "wrap" }}>
                    {/* Main column */}
                    <Box sx={{ flex: "2 1 560px", minWidth: 0 }}>
                        <SectionHeader label="Party" sectionKey="party" collapsed={collapsed("party")} onToggle={toggleSection}
                            action={
                                <Tooltip title="Search your saved monsters">
                                    <Button size="small" startIcon={<Search size={12} />} onClick={() => setMonsterSearchOpen(o => !o)}
                                        sx={{ fontSize: "0.65rem" }}>
                                        Monster Lookup
                                    </Button>
                                </Tooltip>
                            } />
                        {!collapsed("party") && (
                            chars.length === 0 ? (
                                <Typography variant="body2" sx={{ color: "text.disabled", mb: 3 }}>No characters in this campaign yet.</Typography>
                            ) : (
                                <Box sx={{ mb: 3 }}>
                                    {chars.map(pc => (
                                        <PartyCard key={pc.id} pc={pc} isSpotlight={pc.id === spotlightId} onUpdate={updatePc} />
                                    ))}
                                </Box>
                            )
                        )}

                        {monsterSearchOpen && (
                            <MonsterLookup pinnedIds={gmScreen.pinnedMonsterIds} onTogglePin={toggleMonsterPin}
                                onClose={() => setMonsterSearchOpen(false)} />
                        )}

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
                            <SpotlightNpcs campaignId={campaignId} pinnedIds={gmScreen.pinnedNpcIds} onTogglePin={toggleNpcPin} />
                        )}

                        <SectionHeader label="Resting" sectionKey="rest" collapsed={collapsed("rest")} onToggle={toggleSection} />
                        {!collapsed("rest") && (
                            <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                                    Short rests are resolved by each player (spend Hit Dice) — nothing to apply here.
                                </Typography>
                                <Button size="small" variant="outlined" startIcon={<Moon size={14} />} onClick={applyLongRestToAll}>
                                    Apply Long Rest to Party
                                </Button>
                                <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mt: 1 }}>
                                    Restores full HP, all spell slots, and 1 Exhaustion level for everyone. Hit Dice recovery and class feature recharges aren't tracked here — check those manually.
                                </Typography>
                            </Paper>
                        )}

                        <SectionHeader label="Inspiration Ideas" sectionKey="inspiration" collapsed={collapsed("inspiration")} onToggle={toggleSection} />
                        {!collapsed("inspiration") && (
                            <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                                {gmScreen.inspirationIdeas.length === 0 ? (
                                    <Typography variant="body2" sx={{ color: "text.disabled", mb: 1.5 }}>
                                        Jot down moments worth rewarding with Inspiration — great roleplay, a clever plan, someone covering for a teammate.
                                    </Typography>
                                ) : (
                                    <Box sx={{ mb: 1.5 }}>
                                        {gmScreen.inspirationIdeas.map(idea => (
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
                                    <TextField size="small" placeholder="Anyone who finds the hidden lever…" fullWidth
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

                        <SectionHeader label="Quick Tools" sectionKey="tools" collapsed={collapsed("tools")} onToggle={toggleSection} />
                        {!collapsed("tools") && (
                            <Paper elevation={1} sx={{ p: 2, mb: 3, display: "flex", flexDirection: "column", gap: 1 }}>
                                <Button size="small" variant="outlined" startIcon={<Swords size={14} />}
                                    onClick={() => window.open("/tabletop/initiative", "_blank")}>
                                    Initiative Tracker
                                </Button>
                                <Button size="small" variant="outlined" startIcon={<Calculator size={14} />}
                                    onClick={() => window.open("/tabletop/encounter-calc", "_blank")}>
                                    Encounter Calculator
                                </Button>
                                <Button size="small" variant="outlined" startIcon={<Gem size={14} />}
                                    onClick={() => window.open("/tabletop/loot", "_blank")}>
                                    Loot Generator
                                </Button>
                                <Button size="small" variant="outlined" startIcon={<Wand size={14} />}
                                    onClick={() => window.open("/tabletop/magic-item", "_blank")}>
                                    Magic Item Generator
                                </Button>
                            </Paper>
                        )}

                        <SectionHeader label="Rules Quick Reference" sectionKey="rules" collapsed={collapsed("rules")} onToggle={toggleSection} />
                        {!collapsed("rules") && (
                            <>
                                <Accordion>
                                    <AccordionSummary expandIcon={<ChevronDown size={16} />}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Death Saves &amp; Dying</Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                                            {DEATH_SAVES_REFERENCE.intro}
                                        </Typography>
                                        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                                            {DEATH_SAVES_REFERENCE.bullets.map(b => (
                                                <Typography key={b} component="li" variant="caption" sx={{ color: "text.secondary", mb: 0.5 }}>{b}</Typography>
                                            ))}
                                        </Box>
                                    </AccordionDetails>
                                </Accordion>

                                <Accordion>
                                    <AccordionSummary expandIcon={<ChevronDown size={16} />}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Concentration</Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                                            {CONCENTRATION_REFERENCE.intro}
                                        </Typography>
                                        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                                            {CONCENTRATION_REFERENCE.bullets.map(b => (
                                                <Typography key={b} component="li" variant="caption" sx={{ color: "text.secondary", mb: 0.5 }}>{b}</Typography>
                                            ))}
                                        </Box>
                                    </AccordionDetails>
                                </Accordion>

                                <Accordion>
                                    <AccordionSummary expandIcon={<ChevronDown size={16} />}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Cover</Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                                            {COVER_REFERENCE.intro}
                                        </Typography>
                                        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                                            {COVER_REFERENCE.bullets.map(b => (
                                                <Typography key={b} component="li" variant="caption" sx={{ color: "text.secondary", mb: 0.5 }}>{b}</Typography>
                                            ))}
                                        </Box>
                                    </AccordionDetails>
                                </Accordion>

                                <Accordion>
                                    <AccordionSummary expandIcon={<ChevronDown size={16} />}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Exhaustion</Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                                            {EXHAUSTION_REFERENCE.intro2024}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: "text.disabled", display: "block" }}>
                                            {EXHAUSTION_REFERENCE.intro2014}
                                        </Typography>
                                    </AccordionDetails>
                                </Accordion>

                                <Accordion sx={{ mb: 3 }}>
                                    <AccordionSummary expandIcon={<ChevronDown size={16} />}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Resting</Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Short Rest</Typography>
                                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>{RESTING_REFERENCE.shortRest}</Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>Long Rest</Typography>
                                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{RESTING_REFERENCE.longRest}</Typography>
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
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>{pc.characterName} — {snap.classLabel}</Typography>
                            <Typography variant="body1">
                                HP {snap.hp.current}/{snap.hp.max} · AC {snap.ac}
                                {snap.conditions.length > 0 && ` · ${snap.conditions.join(", ")}`}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>

            <QuickWikiDialog open={wikiOpen} onClose={() => setWikiOpen(false)} worldIds={worldIds} />
        </Box>
        </ThemeProvider>
    );
}
