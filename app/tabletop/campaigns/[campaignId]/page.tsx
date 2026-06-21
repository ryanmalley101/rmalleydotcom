"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Box, Container, Typography, Button, Chip, Divider,
    CircularProgress, Card, CardActionArea, CardContent,
    IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
    DialogActions, Tabs, Tab, TextField, Snackbar, Alert,
    MenuItem, Select, FormControl, InputLabel, Switch, FormControlLabel,
} from "@mui/material";
import { DEFAULT_COMBAT_SETTINGS, SETTING_META, parseSettings, type CombatSettings } from "./combatSettings";
import Link from "next/link";
import { ArrowLeft, Plus, ScrollText, Users, BookOpen, Trash2, CalendarDays, Swords, UserPlus, Copy, Shield, Pencil, Settings, PawPrint, LayoutGrid } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type Campaign        = Schema["Campaign"]["type"];
type Session         = Schema["CampaignSession"]["type"];
type PlayerCharacter = Schema["PlayerCharacter"]["type"];
type World           = Schema["DnDWorld"]["type"];
type Encounter       = Schema["Encounter"]["type"];
type CampaignMember = Schema["CampaignMember"]["type"];
type Companion       = Schema["Companion"]["type"];

function parseClasses(pc: PlayerCharacter): string {
    if (pc.classesJson) {
        try {
            const arr: { class: string; level: number; subclass?: string }[] = JSON.parse(pc.classesJson);
            return arr.map(c => `${c.class} ${c.level}`).join(" / ");
        } catch { /* fall through */ }
    }
    return [pc.characterClass, pc.subclass].filter(Boolean).join(" — ");
}
function totalLevel(pc: PlayerCharacter): number | undefined {
    if (pc.classesJson) {
        try {
            const arr: { level: number }[] = JSON.parse(pc.classesJson);
            return arr.reduce((s, c) => s + c.level, 0);
        } catch { /* fall through */ }
    }
    return pc.level ?? undefined;
}

function CombatSettingsDialog({
    open, value, title, subtitle, inheritLabel, onClose, onSave, onReset,
}: {
    open: boolean;
    value: CombatSettings;
    title: string;
    subtitle?: string;
    inheritLabel?: string;
    onClose: () => void;
    onSave: (s: CombatSettings) => void;
    onReset?: () => void;
}) {
    const [draft, setDraft] = useState<CombatSettings>({ ...DEFAULT_COMBAT_SETTINGS });
    useEffect(() => { if (open) setDraft({ ...value }); }, [open, value]);
    const toggle = (k: keyof CombatSettings) => setDraft(prev => ({ ...prev, [k]: !prev[k] }));
    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                {subtitle && (
                    <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>{subtitle}</Typography>
                )}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {(Object.keys(SETTING_META) as (keyof CombatSettings)[]).map(k => (
                        <Box key={k} sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                            <FormControlLabel
                                control={<Switch checked={draft[k]} onChange={() => toggle(k)} size="small" color="warning" />}
                                label={<Typography variant="body2" sx={{ fontWeight: 600 }}>{SETTING_META[k].label}</Typography>}
                            />
                            <Typography variant="caption" sx={{ color: "text.secondary", pl: 5.5 }}>
                                {SETTING_META[k].desc}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </DialogContent>
            <DialogActions sx={{ justifyContent: onReset ? "space-between" : "flex-end" }}>
                {onReset && (
                    <Button size="small" onClick={onReset} sx={{ color: "text.secondary" }}>
                        {inheritLabel ?? "Reset to defaults"}
                    </Button>
                )}
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="contained" onClick={() => onSave(draft)} sx={{ backgroundColor: "primary.main" }}>
                        Save
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
}

export default function CampaignPage() {
    const { campaignId } = useParams<{ campaignId: string }>();
    const router = useRouter();

    const [campaign, setCampaign]   = useState<Campaign | null>(null);
    const [sessions, setSessions]   = useState<Session[]>([]);
    const [characters, setChars]    = useState<PlayerCharacter[]>([]);
    const [worlds, setWorlds]       = useState<World[]>([]);
    const [encounters, setEncounters] = useState<Encounter[]>([]);
    const [members, setMembers]     = useState<CampaignMember[]>([]);
    const [tab, setTab]             = useState(0);
    const [loading, setLoading]     = useState(true);
    const [deleteSession, setDelSess]  = useState<string | null>(null);
    const [deleteChar, setDelChar]     = useState<string | null>(null);
    const [deleteEnc, setDelEnc]       = useState<string | null>(null);
    const [creatingEnc, setCreatingEnc] = useState(false);
    const [companions, setCompanions]   = useState<Companion[]>([]);
    const [inviteRole, setInviteRole]   = useState<"player"|"gm">("player");
    const [inviteLink, setInviteLink]   = useState<string | null>(null);
    const [copiedSnack, setCopiedSnack] = useState(false);
    const [editOpen, setEditOpen]       = useState(false);
    const [editName, setEditName]       = useState("");
    const [editDesc, setEditDesc]       = useState("");
    const [editStatus, setEditStatus]   = useState("");
    const [editSystem, setEditSystem]   = useState("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [combatSettings, setCombatSettings] = useState<CombatSettings>({ ...DEFAULT_COMBAT_SETTINGS });

    async function load() {
        const [cRes, sRes, pcRes, wRes, encRes, memRes, compRes] = await Promise.all([
            client.models.Campaign.get({ id: campaignId }),
            client.models.CampaignSession.list(),
            client.models.PlayerCharacter.list(),
            client.models.DnDWorld.list(),
            client.models.Encounter.list(),
            client.models.CampaignMember.list(),
            client.models.Companion.list(),
        ]);
        const camp = cRes.data;
        setCampaign(camp);
        setCombatSettings(parseSettings(camp?.settingsJson));
        setSessions(
            (sRes.data ?? [])
                .filter(s => s.campaignId === campaignId)
                .sort((a, b) => (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0))
        );
        setChars((pcRes.data ?? []).filter(pc => pc.campaignId === campaignId));
        setEncounters((encRes.data ?? []).filter(e => e.campaignId === campaignId));
        setMembers((memRes.data ?? []).filter(m => m.campaignId === campaignId));
        setCompanions((compRes.data ?? []).filter(c => c.campaignId === campaignId));
        if (camp) {
            setWorlds((wRes.data ?? []).filter(w => (camp.worldIds ?? []).includes(w.id)));
        }
        setLoading(false);
    }

    async function generateInvite(role: "player" | "gm") {
        const { data } = await client.models.CampaignInvite.create({
            campaignId,
            role,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (data) {
            const link = `${window.location.origin}/tabletop/join?code=${data.id}`;
            setInviteLink(link);
        }
    }

    async function copyInvite() {
        if (!inviteLink) return;
        await navigator.clipboard.writeText(inviteLink);
        setCopiedSnack(true);
    }

    useEffect(() => { load(); }, [campaignId]);

    async function confirmDeleteSession() {
        if (!deleteSession) return;
        await client.models.CampaignSession.delete({ id: deleteSession });
        setDelSess(null);
        load();
    }

    async function confirmDeleteChar() {
        if (!deleteChar) return;
        await client.models.PlayerCharacter.delete({ id: deleteChar });
        setDelChar(null);
        load();
    }

    async function confirmDeleteEnc() {
        if (!deleteEnc) return;
        await client.models.Encounter.delete({ id: deleteEnc });
        setDelEnc(null);
        load();
    }

    async function createEncounter() {
        setCreatingEnc(true);
        const res = await client.models.Encounter.create({
            campaignId,
            name: "New Encounter",
            status: "planned",
        });
        if (res.data?.id) {
            router.push(`/tabletop/campaigns/${campaignId}/encounters/${res.data.id}`);
        }
        setCreatingEnc(false);
    }

    function openEdit() {
        setEditName(campaign?.name ?? "");
        setEditDesc(campaign?.description ?? "");
        setEditStatus(campaign?.status ?? "");
        setEditSystem(campaign?.system ?? "");
        setEditOpen(true);
    }

    async function saveCampaignEdit() {
        if (!editName.trim()) return;
        await client.models.Campaign.update({
            id: campaignId,
            name: editName.trim(),
            description: editDesc || undefined,
            status: editStatus || undefined,
            system: editSystem || undefined,
        });
        setCampaign(prev => prev ? {
            ...prev,
            name: editName.trim(),
            description: editDesc || null,
            status: editStatus || null,
            system: editSystem || null,
        } : prev);
        setEditOpen(false);
    }

    async function saveSettings(s: CombatSettings) {
        setCombatSettings(s);
        await client.models.Campaign.update({ id: campaignId, settingsJson: JSON.stringify(s) });
        setSettingsOpen(false);
    }

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );

    if (!campaign) return (
        <Box sx={{ textAlign: "center", pt: 12 }}>
            <Typography color="error">Campaign not found.</Typography>
            <Button component={Link} href="/tabletop/campaigns" sx={{ mt: 2 }}>Back to Campaigns</Button>
        </Box>
    );

    const statusColor: Record<string, string> = {
        Active: "#15803d", Paused: "#b45309", Completed: "#1d4ed8", Planning: "#7e22ce",
    };

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href="/tabletop/campaigns" startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}>
                    My Campaigns
                </Button>

                {/* Header */}
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1 }}>
                    <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <ScrollText size={28} color="#8C5A3A" />
                            <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                                {campaign.name}
                            </Typography>
                        </Box>
                        <Box sx={{ display: "flex", gap: 1, ml: 6, mt: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                            {campaign.status && (
                                <Chip label={campaign.status} size="small"
                                    sx={{ backgroundColor: statusColor[campaign.status] ?? "#555", color: "#fff" }} />
                            )}
                            {campaign.system && (
                                <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 1 }}>
                                    {campaign.system}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        <Tooltip title="Edit campaign details">
                            <IconButton onClick={openEdit} sx={{ color: "primary.main", mt: 0.5 }}>
                                <Pencil size={18} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Combat automation settings">
                            <IconButton onClick={() => setSettingsOpen(true)} sx={{ color: "text.secondary", mt: 0.5 }}>
                                <Settings size={18} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                {campaign.description && (
                    <Typography variant="body1" sx={{ color: "text.secondary", mb: 2, ml: 6 }}>
                        {campaign.description}
                    </Typography>
                )}

                {/* Linked worlds */}
                {worlds.length > 0 && (
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", ml: 6, mb: 3 }}>
                        {worlds.map(w => (
                            <Chip
                                key={w.id} label={w.name} size="small" clickable
                                component={Link} href={`/tabletop/worlds/${w.id}`}
                                icon={<BookOpen size={12} />}
                            />
                        ))}
                    </Box>
                )}

                <Box sx={{ display: "flex", gap: 1, ml: 6, mb: 3 }}>
                    <Button
                        component={Link}
                        href={`/tabletop/campaigns/${campaignId}/vtt`}
                        variant="outlined"
                        size="small"
                        startIcon={<LayoutGrid size={14} />}
                        sx={{ borderColor: "primary.light", color: "primary.main", fontSize: "0.78rem" }}
                    >
                        Virtual Table
                    </Button>
                    {campaign.system === "Cypher System" && (
                        <Button
                            component={Link}
                            href={`/tabletop/campaigns/${campaignId}/gm-dashboard`}
                            variant="outlined"
                            size="small"
                            startIcon={<Shield size={14} />}
                            sx={{ borderColor: "primary.light", color: "primary.main", fontSize: "0.78rem" }}
                        >
                            GM Dashboard
                        </Button>
                    )}
                    {(campaign.system === "D&D 5e" || campaign.system === "D&D 5.5e (2024)") && (
                        <Button
                            component={Link}
                            href={`/tabletop/campaigns/${campaignId}/dnd-dashboard`}
                            variant="outlined"
                            size="small"
                            startIcon={<Shield size={14} />}
                            sx={{ borderColor: "primary.light", color: "primary.main", fontSize: "0.78rem" }}
                        >
                            GM Dashboard
                        </Button>
                    )}
                </Box>

                <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
                    sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
                    <Tab label={`Sessions (${sessions.length})`} icon={<CalendarDays size={16} />} iconPosition="start" />
                    <Tab label={`Characters (${characters.length})`} icon={<Users size={16} />} iconPosition="start" />
                    <Tab label={`Encounters (${encounters.length})`} icon={<Swords size={16} />} iconPosition="start" />
                    <Tab label={`Members (${members.length})`} icon={<UserPlus size={16} />} iconPosition="start" />
                    <Tab label="NPCs" icon={<Users size={16} />} iconPosition="start" />
                    <Tab label="Quests" icon={<ScrollText size={16} />} iconPosition="start" />
                    <Tab label="Factions" icon={<Shield size={16} />} iconPosition="start" />
                </Tabs>

                {/* ── Sessions tab ── */}
                {tab === 0 && (
                    <>
                        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
                            <Button variant="contained" startIcon={<Plus size={16} />}
                                component={Link} href={`/tabletop/campaigns/${campaignId}/sessions/new`}
                                sx={{ backgroundColor: "primary.main", whiteSpace: "nowrap" }}>
                                New Session
                            </Button>
                        </Box>

                        {sessions.length === 0 ? (
                            <Box sx={{ textAlign: "center", py: 8 }}>
                                <CalendarDays size={40} color="#c9a87c" style={{ marginBottom: 12 }} />
                                <Typography sx={{ color: "text.secondary" }}>
                                    No sessions yet. Add your first session to get started.
                                </Typography>
                            </Box>
                        ) : (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                                {sessions.map(s => (
                                    <Card key={s.id} sx={{ borderLeft: "3px solid", borderColor: "primary.light" }}>
                                        <Box sx={{ display: "flex", alignItems: "stretch" }}>
                                            <CardActionArea component={Link}
                                                href={`/tabletop/campaigns/${campaignId}/sessions/${s.id}`} sx={{ flex: 1 }}>
                                                <CardContent sx={{ py: 1.5 }}>
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                        <Typography variant="subtitle2" sx={{ color: "text.secondary", minWidth: 28 }}>
                                                            #{s.sessionNumber ?? "?"}
                                                        </Typography>
                                                        <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.dark", fontSize: "1rem" }}>
                                                            {s.title || "Untitled Session"}
                                                        </Typography>
                                                        {s.date && (
                                                            <Typography variant="caption" sx={{ color: "text.secondary", ml: "auto" }}>
                                                                {s.date}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                    {s.prepNotes && (
                                                        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5,
                                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                            {s.prepNotes.slice(0, 120)}
                                                        </Typography>
                                                    )}
                                                </CardContent>
                                            </CardActionArea>
                                            <Box sx={{ display: "flex", alignItems: "center", pr: 1 }}>
                                                <Tooltip title="Delete session">
                                                    <IconButton size="small" color="error" onClick={() => setDelSess(s.id)}>
                                                        <Trash2 size={14} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </Box>
                                    </Card>
                                ))}
                            </Box>
                        )}
                    </>
                )}

                {/* ── Characters tab ── */}
                {tab === 1 && (
                    <>
                        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
                            <Button variant="contained" startIcon={<Plus size={16} />}
                                component={Link} href={`/tabletop/campaigns/${campaignId}/characters/new`}
                                sx={{ backgroundColor: "primary.main", whiteSpace: "nowrap" }}>
                                Add Character
                            </Button>
                        </Box>

                        {characters.length === 0 ? (
                            <Box sx={{ textAlign: "center", py: 8 }}>
                                <Users size={40} color="#c9a87c" style={{ marginBottom: 12 }} />
                                <Typography sx={{ color: "text.secondary" }}>
                                    No characters yet. Add player characters for this campaign.
                                </Typography>
                            </Box>
                        ) : (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                                {characters.map(pc => (
                                    <Card key={pc.id} sx={{ borderLeft: "3px solid", borderColor: "secondary.main" }}>
                                        <Box sx={{ display: "flex", alignItems: "stretch" }}>
                                            <CardActionArea component={Link}
                                                href={`/tabletop/campaigns/${campaignId}/characters/${pc.id}`} sx={{ flex: 1 }}>
                                                <CardContent sx={{ py: 1.5 }}>
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                        <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.dark", fontSize: "1rem" }}>
                                                            {pc.characterName}
                                                        </Typography>
                                                        {totalLevel(pc) && (
                                                            <Chip label={`Lv ${totalLevel(pc)}`} size="small"
                                                                sx={{ height: 18, fontSize: "0.65rem" }} />
                                                        )}
                                                    </Box>
                                                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                                        {[pc.race, parseClasses(pc)].filter(Boolean).join(" · ")}
                                                        {pc.playerName ? ` — played by ${pc.playerName}` : ""}
                                                    </Typography>
                                                </CardContent>
                                            </CardActionArea>
                                            <Box sx={{ display: "flex", alignItems: "center", pr: 1 }}>
                                                <Tooltip title="Delete character">
                                                    <IconButton size="small" color="error" onClick={() => setDelChar(pc.id)}>
                                                        <Trash2 size={14} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </Box>
                                        {companions.filter(c => c.characterId === pc.id).map(c => (
                                            <Box key={c.id} sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 0.75,
                                                borderTop: 1, borderColor: "divider", backgroundColor: "action.hover" }}>
                                                <PawPrint size={12} color="#8C5A3A" />
                                                <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                                                    {c.name}{c.companionType ? ` (${c.companionType})` : ""}
                                                    {c.currentHp != null && c.maxHp != null ? ` — ${c.currentHp}/${c.maxHp} HP` : ""}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Card>
                                ))}
                            </Box>
                        )}
                    </>
                )}

                {/* ── Encounters tab ── */}
                {tab === 2 && (
                    <>
                        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
                            <Button variant="contained" startIcon={<Plus size={16} />}
                                onClick={createEncounter} disabled={creatingEnc}
                                sx={{ backgroundColor: "primary.main", whiteSpace: "nowrap" }}>
                                {creatingEnc ? "Creating…" : "New Encounter"}
                            </Button>
                        </Box>

                        {encounters.length === 0 ? (
                            <Box sx={{ textAlign: "center", py: 8 }}>
                                <Swords size={40} color="#c9a87c" style={{ marginBottom: 12 }} />
                                <Typography sx={{ color: "text.secondary" }}>
                                    No encounters yet. Build one to plan and run combat!
                                </Typography>
                            </Box>
                        ) : (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                                {encounters.map(enc => (
                                    <Card key={enc.id} sx={{ borderLeft: "3px solid #8C5A3A" }}>
                                        <Box sx={{ display: "flex", alignItems: "stretch" }}>
                                            <CardActionArea component={Link}
                                                href={`/tabletop/campaigns/${campaignId}/encounters/${enc.id}`} sx={{ flex: 1 }}>
                                                <CardContent sx={{ py: 1.5 }}>
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                        <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.dark", fontSize: "1rem" }}>
                                                            {enc.name}
                                                        </Typography>
                                                        {enc.status && enc.status !== "planned" && (
                                                            <Chip label={enc.status} size="small"
                                                                sx={{ height: 18, fontSize: "0.65rem", textTransform: "capitalize" }} />
                                                        )}
                                                    </Box>
                                                    {enc.description && (
                                                        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5,
                                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                            {enc.description}
                                                        </Typography>
                                                    )}
                                                </CardContent>
                                            </CardActionArea>
                                            <Box sx={{ display: "flex", alignItems: "center", pr: 1 }}>
                                                <Tooltip title="Delete encounter">
                                                    <IconButton size="small" color="error" onClick={() => setDelEnc(enc.id)}>
                                                        <Trash2 size={14} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </Box>
                                    </Card>
                                ))}
                            </Box>
                        )}
                    </>
                )}

                {/* ── Members tab ── */}
                {tab === 3 && (
                    <>
                        <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
                            <Button variant="outlined" startIcon={<UserPlus size={16} />}
                                onClick={() => generateInvite("player")}>
                                Invite Player
                            </Button>
                            <Button variant="outlined" startIcon={<UserPlus size={16} />}
                                onClick={() => generateInvite("gm")}>
                                Invite GM
                            </Button>
                        </Box>

                        {inviteLink && (
                            <Box sx={{ mb: 3, p: 2, border: 1, borderColor: "primary.light", borderRadius: 2, backgroundColor: "background.paper" }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, color: "primary.dark" }}>Invite Link (expires in 7 days)</Typography>
                                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                    <TextField value={inviteLink} fullWidth size="small" slotProps={{ input: { readOnly: true } }} />
                                    <Button variant="contained" startIcon={<Copy size={14} />} onClick={copyInvite} sx={{ whiteSpace: "nowrap" }}>
                                        Copy
                                    </Button>
                                </Box>
                            </Box>
                        )}

                        {members.length === 0 ? (
                            <Box sx={{ textAlign: "center", py: 8 }}>
                                <UserPlus size={40} color="#c9a87c" style={{ marginBottom: 12 }} />
                                <Typography sx={{ color: "text.secondary" }}>
                                    No members yet. Generate an invite link to share with players.
                                </Typography>
                            </Box>
                        ) : (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                                {members.map(m => (
                                    <Card key={m.id} sx={{ borderLeft: "3px solid", borderColor: m.role === "gm" ? "warning.main" : "primary.light" }}>
                                        <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <Typography variant="subtitle2" sx={{ flex: 1, color: "primary.dark" }}>
                                                    {m.playerName || "Unknown Player"}
                                                </Typography>
                                                <Chip
                                                    label={m.role === "gm" ? "GM" : "Player"}
                                                    size="small"
                                                    color={m.role === "gm" ? "warning" : "default"}
                                                />
                                            </Box>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Box>
                        )}
                    </>
                )}

                {/* ── NPCs tab ── */}
                {tab === 4 && (
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6, gap: 3 }}>
                        <Users size={48} color="#8C5A3A" />
                        <Typography variant="h5" sx={{ fontWeight: 600, color: "primary.dark" }}>NPC Tracker</Typography>
                        <Typography sx={{ color: "text.secondary", textAlign: "center", maxWidth: 400 }}>
                            Track the non-player characters your party encounters — their roles, locations, motivations, and relationships.
                        </Typography>
                        <Button variant="contained" size="large"
                            component={Link} href={`/tabletop/campaigns/${campaignId}/npcs`}
                            sx={{ backgroundColor: "primary.main" }}>
                            Open NPC Tracker
                        </Button>
                    </Box>
                )}

                {/* ── Quests tab ── */}
                {tab === 5 && (
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6, gap: 3 }}>
                        <ScrollText size={48} color="#8C5A3A" />
                        <Typography variant="h5" sx={{ fontWeight: 600, color: "primary.dark" }}>Quest Tracker</Typography>
                        <Typography sx={{ color: "text.secondary", textAlign: "center", maxWidth: 400 }}>
                            Manage active quests, objectives, rewards, and completed adventures.
                        </Typography>
                        <Button variant="contained" size="large"
                            component={Link} href={`/tabletop/campaigns/${campaignId}/quests`}
                            sx={{ backgroundColor: "primary.main" }}>
                            Open Quest Tracker
                        </Button>
                    </Box>
                )}

                {/* ── Factions tab ── */}
                {tab === 6 && (
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6, gap: 3 }}>
                        <Shield size={48} color="#8C5A3A" />
                        <Typography variant="h5" sx={{ fontWeight: 600, color: "primary.dark" }}>Faction Tracker</Typography>
                        <Typography sx={{ color: "text.secondary", textAlign: "center", maxWidth: 400 }}>
                            Track factions and organizations, and the party's reputation with each.
                        </Typography>
                        <Button variant="contained" size="large"
                            component={Link} href={`/tabletop/campaigns/${campaignId}/factions`}
                            sx={{ backgroundColor: "primary.main" }}>
                            Open Faction Tracker
                        </Button>
                    </Box>
                )}

                {/* Combat settings dialog */}
                <CombatSettingsDialog
                    open={settingsOpen}
                    value={combatSettings}
                    title="Campaign Combat Settings"
                    subtitle="These are the defaults for all encounters in this campaign. Individual encounters can override them."
                    onClose={() => setSettingsOpen(false)}
                    onSave={saveSettings}
                />

                {/* Campaign edit dialog */}
                <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Edit Campaign</DialogTitle>
                    <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
                        <TextField
                            label="Campaign Name" value={editName} autoFocus fullWidth
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveCampaignEdit(); }}
                        />
                        <TextField
                            label="Description" value={editDesc} fullWidth multiline minRows={3}
                            onChange={e => setEditDesc(e.target.value)}
                            placeholder="What is this campaign about?"
                        />
                        <Box sx={{ display: "flex", gap: 2 }}>
                            <FormControl size="small" sx={{ flex: 1 }}>
                                <InputLabel>Status</InputLabel>
                                <Select value={editStatus} label="Status" onChange={e => setEditStatus(e.target.value)}>
                                    <MenuItem value="">None</MenuItem>
                                    <MenuItem value="Planning">Planning</MenuItem>
                                    <MenuItem value="Active">Active</MenuItem>
                                    <MenuItem value="Paused">Paused</MenuItem>
                                    <MenuItem value="Completed">Completed</MenuItem>
                                </Select>
                            </FormControl>
                            <TextField
                                label="System" value={editSystem} size="small" sx={{ flex: 1 }}
                                onChange={e => setEditSystem(e.target.value)}
                                placeholder="e.g. D&D 5e, Pathfinder 2e"
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setEditOpen(false)}>Cancel</Button>
                        <Button variant="contained" onClick={saveCampaignEdit} disabled={!editName.trim()}
                            sx={{ backgroundColor: "primary.main" }}>
                            Save
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete session confirmation */}
                <Dialog open={!!deleteSession} onClose={() => setDelSess(null)}>
                    <DialogTitle>Delete Session?</DialogTitle>
                    <DialogContent><Typography>This cannot be undone.</Typography></DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDelSess(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={confirmDeleteSession}>Delete</Button>
                    </DialogActions>
                </Dialog>

                {/* Delete character confirmation */}
                <Dialog open={!!deleteChar} onClose={() => setDelChar(null)}>
                    <DialogTitle>Delete Character?</DialogTitle>
                    <DialogContent><Typography>This cannot be undone.</Typography></DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDelChar(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={confirmDeleteChar}>Delete</Button>
                    </DialogActions>
                </Dialog>

                {/* Delete encounter confirmation */}
                <Dialog open={!!deleteEnc} onClose={() => setDelEnc(null)}>
                    <DialogTitle>Delete Encounter?</DialogTitle>
                    <DialogContent><Typography>This cannot be undone.</Typography></DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDelEnc(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={confirmDeleteEnc}>Delete</Button>
                    </DialogActions>
                </Dialog>
            </Container>

            <Snackbar open={copiedSnack} autoHideDuration={3000} onClose={() => setCopiedSnack(false)}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
                <Alert severity="success" onClose={() => setCopiedSnack(false)}>Invite link copied!</Alert>
            </Snackbar>
        </Box>
    );
}
