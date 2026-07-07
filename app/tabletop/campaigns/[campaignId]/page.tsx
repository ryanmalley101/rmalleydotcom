"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import {
    ActionIcon, Anchor, Badge, Box, Button, Center, Divider, Group,
    Loader, Modal, Paper, Select, SimpleGrid, Stack, Text, TextInput,
    ThemeIcon, Title, Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
    // MUI kept only for CombatSettingsDialog — full migration deferred
    Box as MuiBox, Dialog, DialogTitle, DialogContent, DialogActions,
    Typography, FormControlLabel, Switch, Button as MuiButton,
    Snackbar, Alert,
} from "@mui/material";
import Link from "next/link";
import {
    ArrowLeft, Bookmark, BookMarked, BookOpen, CalendarDays, ChevronRight,
    Copy, Gauge, Globe, LayoutGrid, ListOrdered, Map, PawPrint,
    Pencil, Plus, RotateCcw, ScrollText, Settings, Shield,
    Swords, Trash2, UserPlus, Users,
} from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { DEFAULT_COMBAT_SETTINGS, SETTING_META, parseSettings, type CombatSettings } from "./combatSettings";
import { useCampaignRole } from "@/lib/useCampaignRole";

const client = generateClient<Schema>();
type Campaign        = Schema["Campaign"]["type"];
type Session         = Schema["CampaignSession"]["type"];
type PlayerCharacter = Schema["PlayerCharacter"]["type"];
type World           = Schema["DnDWorld"]["type"];
type Encounter       = Schema["Encounter"]["type"];
type CampaignMember  = Schema["CampaignMember"]["type"];
type Companion       = Schema["Companion"]["type"];
type WorldMap        = Schema["WorldMap"]["type"];

const T = {
    pageBg: "#1a0d05", cardBg: "#261508", cardHover: "#321b0c",
    border: "rgba(210,140,70,0.22)", borderHot: "rgba(239,107,26,0.55)",
    divider: "rgba(210,140,70,0.18)", cream: "#f0ddb5", amber: "#d4aa72",
    dimmed: "#a67c4a", accent: "#ef6b1a", heading: "#e8c060",
    deepBorder: "rgba(239,107,26,0.3)",
};

const STATUS_COLOR: Record<string, string> = {
    Active: "#15803d", Paused: "#b45309", Completed: "#1d4ed8", Planning: "#7e22ce",
};

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
        try { return (JSON.parse(pc.classesJson) as { level: number }[]).reduce((s, c) => s + c.level, 0); }
        catch { /* fall through */ }
    }
    return pc.level ?? undefined;
}

// CombatSettingsDialog — kept as MUI since it's internal/complex and deferred from this migration pass
function CombatSettingsDialog({ open, value, title, subtitle, inheritLabel, onClose, onSave, onReset }: {
    open: boolean; value: CombatSettings; title: string; subtitle?: string;
    inheritLabel?: string; onClose: () => void; onSave: (s: CombatSettings) => void; onReset?: () => void;
}) {
    const [draft, setDraft] = useState<CombatSettings>({ ...DEFAULT_COMBAT_SETTINGS });
    useEffect(() => { if (open) setDraft({ ...value }); }, [open, value]);
    const toggle = (k: keyof CombatSettings) => setDraft(prev => ({ ...prev, [k]: !prev[k] }));
    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                {subtitle && <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>{subtitle}</Typography>}
                <MuiBox sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {(Object.keys(SETTING_META) as (keyof CombatSettings)[]).map(k => (
                        <MuiBox key={k} sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                            <FormControlLabel
                                control={<Switch checked={draft[k]} onChange={() => toggle(k)} size="small" color="warning" />}
                                label={<Typography variant="body2" sx={{ fontWeight: 600 }}>{SETTING_META[k].label}</Typography>}
                            />
                            <Typography variant="caption" sx={{ color: "text.secondary", pl: 5.5 }}>
                                {SETTING_META[k].desc}
                            </Typography>
                        </MuiBox>
                    ))}
                </MuiBox>
            </DialogContent>
            <DialogActions sx={{ justifyContent: onReset ? "space-between" : "flex-end" }}>
                {onReset && <MuiButton size="small" onClick={onReset} sx={{ color: "text.secondary" }}>{inheritLabel ?? "Reset to defaults"}</MuiButton>}
                <MuiBox sx={{ display: "flex", gap: 1 }}>
                    <MuiButton onClick={onClose}>Cancel</MuiButton>
                    <MuiButton variant="contained" onClick={() => onSave(draft)} sx={{ backgroundColor: "primary.main" }}>Save</MuiButton>
                </MuiBox>
            </DialogActions>
        </Dialog>
    );
}

// ── Section divider ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label, actions }: { icon: React.ElementType; label: string; actions?: React.ReactNode }) {
    return (
        <Box my="xl">
            <Group gap="sm" mb={6}>
                <ThemeIcon size="sm" radius="xs" style={{ background: `${T.accent}22`, color: T.accent }}>
                    <Icon size={13} />
                </ThemeIcon>
                <Text size="xs" fw={800} tt="uppercase"
                    style={{ letterSpacing: 3, color: T.accent, fontFamily: "var(--font-cinzel), serif" }}>
                    {label}
                </Text>
                {actions && <Box ml="auto">{actions}</Box>}
            </Group>
            <Divider style={{ borderColor: T.divider }} />
        </Box>
    );
}

// ── Tool shortcut ─────────────────────────────────────────────────────────────
function ToolCard({ icon: Icon, label, href }: { icon: React.ElementType; label: string; href: string }) {
    return (
        <Anchor component={Link} href={href} underline="never">
            <Paper p="sm" radius="sm" style={{
                background: T.cardBg, border: `1px solid ${T.border}`,
                borderTop: `2px solid ${T.deepBorder}`,
            }}>
                <Group gap="xs" wrap="nowrap">
                    <ThemeIcon size="sm" radius="xs" style={{ background: T.accent, color: T.pageBg, flexShrink: 0 }}>
                        <Icon size={12} />
                    </ThemeIcon>
                    <Text size="sm" fw={600} style={{ color: T.cream, flex: 1 }}>{label}</Text>
                    <ChevronRight size={12} style={{ color: T.dimmed }} />
                </Group>
            </Paper>
        </Anchor>
    );
}

// ── Nav card (World section) ──────────────────────────────────────────────────
function NavCard({ icon: Icon, label, desc, href }: { icon: React.ElementType; label: string; desc: string; href: string }) {
    return (
        <Anchor component={Link} href={href} underline="never">
            <Paper p="md" radius="sm" style={{
                background: T.cardBg, border: `1px solid ${T.border}`,
                borderTop: `3px solid ${T.accent}`,
            }}>
                <Group gap="sm" mb={4} wrap="nowrap">
                    <ThemeIcon size="sm" radius="xs" style={{ background: `${T.accent}22`, color: T.accent, flexShrink: 0 }}>
                        <Icon size={12} />
                    </ThemeIcon>
                    <Text fw={700} size="sm" style={{ color: T.cream, flex: 1 }}>{label}</Text>
                    <ChevronRight size={13} style={{ color: T.dimmed }} />
                </Group>
                <Text size="xs" style={{ color: T.dimmed }}>{desc}</Text>
            </Paper>
        </Anchor>
    );
}

// ── Confirm delete modal ──────────────────────────────────────────────────────
function ConfirmModal({ opened, onClose, onConfirm, title, message }: {
    opened: boolean; onClose: () => void; onConfirm: () => void; title: string; message?: string;
}) {
    return (
        <Modal opened={opened} onClose={onClose} title={title} size="sm"
            styles={{ content: { background: T.cardBg, border: `1px solid ${T.border}` },
                      header: { background: T.cardBg }, title: { color: T.cream } }}>
            <Text style={{ color: T.amber }} mb="lg">{message ?? "This cannot be undone."}</Text>
            <Group justify="flex-end" gap="sm">
                <Button variant="subtle" style={{ color: T.dimmed }} onClick={onClose}>Cancel</Button>
                <Button color="red" onClick={onConfirm}>Delete</Button>
            </Group>
        </Modal>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CampaignPage() {
    const { campaignId } = useParams<{ campaignId: string }>();
    const router = useRouter();
    const { isGm: isGM } = useCampaignRole(campaignId);

    const [campaign, setCampaign]   = useState<Campaign | null>(null);
    useDocumentTitle(campaign?.name ?? null);
    const [sessions, setSessions]   = useState<Session[]>([]);
    const [characters, setChars]    = useState<PlayerCharacter[]>([]);
    const [worlds, setWorlds]       = useState<World[]>([]);
    const [worldMaps, setWorldMaps] = useState<WorldMap[]>([]);
    const [encounters, setEncounters] = useState<Encounter[]>([]);
    const [members, setMembers]     = useState<CampaignMember[]>([]);
    const [companions, setCompanions] = useState<Companion[]>([]);
    const [loading, setLoading]     = useState(true);

    const [deleteSession, setDelSess] = useState<string | null>(null);
    const [deleteChar, setDelChar]    = useState<string | null>(null);
    const [deleteEnc, setDelEnc]      = useState<string | null>(null);
    const [creatingEnc, setCreatingEnc] = useState(false);
    const [inviteLink, setInviteLink]   = useState<string | null>(null);
    const [copiedSnack, setCopiedSnack] = useState(false);
    const [combatSettings, setCombatSettings] = useState<CombatSettings>({ ...DEFAULT_COMBAT_SETTINGS });

    const [editOpen, { open: openEdit, close: closeEdit }]         = useDisclosure(false);
    const [settingsOpen, { open: openSettings, close: closeSettings }] = useDisclosure(false);
    const [editName, setEditName]     = useState("");
    const [editDesc, setEditDesc]     = useState("");
    const [editStatus, setEditStatus] = useState("");
    const [editSystem, setEditSystem] = useState("");

    async function load() {
        const [cRes, sRes, pcRes, wRes, encRes, memRes, compRes, mapsRes] = await Promise.all([
            client.models.Campaign.get({ id: campaignId }),
            client.models.CampaignSession.list(),
            client.models.PlayerCharacter.list(),
            client.models.DnDWorld.list(),
            client.models.Encounter.list(),
            client.models.CampaignMember.list(),
            client.models.Companion.list(),
            client.models.WorldMap.list(),
        ]);
        const camp = cRes.data;
        setCampaign(camp);
        setCombatSettings(parseSettings(camp?.settingsJson));
        setSessions((sRes.data ?? []).filter(s => s.campaignId === campaignId)
            .sort((a, b) => (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0)));
        setChars((pcRes.data ?? []).filter(pc => pc.campaignId === campaignId));
        setEncounters((encRes.data ?? []).filter(e => e.campaignId === campaignId));
        setMembers((memRes.data ?? []).filter(m => m.campaignId === campaignId));
        setCompanions((compRes.data ?? []).filter(c => c.campaignId === campaignId));
        if (camp) {
            const wIds = (camp.worldIds ?? []).filter((id): id is string => !!id);
            setWorlds((wRes.data ?? []).filter(w => wIds.includes(w.id)));
            setWorldMaps((mapsRes.data ?? []).filter(m => wIds.includes(m.worldId)));
        }
        setLoading(false);
    }

    async function generateInvite(role: "player" | "gm") {
        const { data } = await client.models.CampaignInvite.create({
            campaignId, role,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (data) setInviteLink(`${window.location.origin}/tabletop/join?code=${data.id}`);
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
        setDelSess(null); load();
    }
    async function confirmDeleteChar() {
        if (!deleteChar) return;
        await client.models.PlayerCharacter.delete({ id: deleteChar });
        setDelChar(null); load();
    }
    async function confirmDeleteEnc() {
        if (!deleteEnc) return;
        await client.models.Encounter.delete({ id: deleteEnc });
        setDelEnc(null); load();
    }
    async function createEncounter() {
        setCreatingEnc(true);
        const res = await client.models.Encounter.create({ campaignId, name: "New Encounter", status: "planned" });
        if (res.data?.id) router.push(`/tabletop/campaigns/${campaignId}/encounters/${res.data.id}`);
        setCreatingEnc(false);
    }
    async function saveCampaignEdit() {
        if (!editName.trim()) return;
        await client.models.Campaign.update({
            id: campaignId, name: editName.trim(),
            description: editDesc || undefined, status: editStatus || undefined, system: editSystem || undefined,
        });
        setCampaign(prev => prev ? { ...prev, name: editName.trim(), description: editDesc || null,
            status: editStatus || null, system: editSystem || null } : prev);
        closeEdit();
    }
    async function saveSettings(s: CombatSettings) {
        setCombatSettings(s);
        await client.models.Campaign.update({ id: campaignId, settingsJson: JSON.stringify(s) });
        closeSettings();
    }

    const dashboardHref = campaign?.system === "Cypher System"
        ? `/tabletop/campaigns/${campaignId}/gm-dashboard`
        : `/tabletop/campaigns/${campaignId}/dnd-dashboard`;

    if (loading) return (
        <Center mih="100vh" style={{ background: T.pageBg }}>
            <Loader style={{ color: T.accent }} />
        </Center>
    );
    if (!campaign) return (
        <Center mih="100vh" style={{ background: T.pageBg }}>
            <Text c="red">Campaign not found.</Text>
        </Center>
    );

    return (
        <Box mih="100vh" py="xl" style={{ background: T.pageBg }}>
            <Box maw={900} mx="auto" px="md">
                <Button component={Link} href="/tabletop/campaigns" variant="subtle" size="sm" mb="xl"
                    leftSection={<ArrowLeft size={14} />} style={{ color: T.accent }}>
                    My Campaigns
                </Button>

                {/* Hero header */}
                <Paper p="xl" radius="lg" mb="xl" style={{
                    background: `linear-gradient(135deg, ${T.cardBg}, #1e0c04)`,
                    border: `1px solid ${T.deepBorder}`,
                    boxShadow: `0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 ${T.deepBorder}`,
                }}>
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Box>
                            <Title order={1}
                                style={{ color: T.heading, lineHeight: 1.1, textShadow: `0 2px 16px ${T.heading}44` }}>
                                {campaign.name}
                            </Title>
                            <Group gap="sm" mt="xs" wrap="wrap">
                                {campaign.status && (
                                    <Badge size="sm"
                                        style={{ background: `${STATUS_COLOR[campaign.status] ?? "#555"}22`,
                                            color: STATUS_COLOR[campaign.status] ?? T.amber,
                                            border: `1px solid ${STATUS_COLOR[campaign.status] ?? T.border}44` }}>
                                        {campaign.status}
                                    </Badge>
                                )}
                                {campaign.system && (
                                    <Text size="xs" tt="uppercase" fw={600}
                                        style={{ letterSpacing: 2, color: T.dimmed }}>
                                        {campaign.system}
                                    </Text>
                                )}
                                {worlds.map(w => (
                                    <Anchor key={w.id} component={Link}
                                        href={`/tabletop/worlds/${w.id}`} size="xs" style={{ color: T.accent }}>
                                        🌍 {w.name}
                                    </Anchor>
                                ))}
                            </Group>
                            {campaign.description && (
                                <Text size="sm" mt="sm" maw={480} style={{ color: T.amber }}>
                                    {campaign.description}
                                </Text>
                            )}
                        </Box>
                        <Group gap={4} style={{ flexShrink: 0 }}>
                            <Tooltip label="Edit campaign">
                                <ActionIcon variant="subtle" size="lg" style={{ color: T.amber }}
                                    onClick={() => {
                                        setEditName(campaign.name);
                                        setEditDesc(campaign.description ?? "");
                                        setEditStatus(campaign.status ?? "");
                                        setEditSystem(campaign.system ?? "");
                                        openEdit();
                                    }}>
                                    <Pencil size={16} />
                                </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Combat settings">
                                <ActionIcon variant="subtle" size="lg" style={{ color: T.amber }} onClick={openSettings}>
                                    <Settings size={16} />
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                    </Group>
                </Paper>

                {/* Active tools */}
                <SimpleGrid cols={{ base: 2, sm: campaign.system ? 4 : 3 }} spacing="sm" mb="xl">
                    {campaign.system && <ToolCard icon={Shield} label="GM Dashboard" href={dashboardHref} />}
                    <ToolCard icon={LayoutGrid} label="Virtual Table" href={`/tabletop/campaigns/${campaignId}/vtt`} />
                    <ToolCard icon={BookMarked} label="Chronicle" href={`/tabletop/campaigns/${campaignId}/timeline`} />
                    <ToolCard icon={CalendarDays} label="Calendar" href={`/tabletop/campaigns/${campaignId}/calendar`} />
                </SimpleGrid>

                {/* Maps */}
                {worldMaps.length > 0 && (
                    <>
                        <SectionHeader icon={Map} label="Maps" />
                        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm" mb="xl">
                            {worldMaps.map(m => (
                                <Anchor key={m.id} component={Link}
                                    href={`/tabletop/worlds/${m.worldId}/maps/${m.id}?campaign=${campaignId}`}
                                    underline="never">
                                    <Paper p="sm" radius="sm" style={{ background: T.cardBg, border: `1px solid ${T.border}` }}>
                                        <Group gap="xs" wrap="nowrap">
                                            <Map size={14} style={{ color: T.accent }} />
                                            <Text size="sm" fw={600} style={{ color: T.cream, flex: 1 }} lineClamp={1}>{m.name}</Text>
                                            <ChevronRight size={12} style={{ color: T.dimmed }} />
                                        </Group>
                                    </Paper>
                                </Anchor>
                            ))}
                        </SimpleGrid>
                    </>
                )}

                {/* Story & History — Sessions */}
                <SectionHeader icon={CalendarDays} label="Story & History"
                    actions={isGM && (
                        <Button component={Link} href={`/tabletop/campaigns/${campaignId}/sessions/new`}
                            size="xs" leftSection={<Plus size={12} />}
                            style={{ background: T.accent, color: T.pageBg }}>
                            New Session
                        </Button>
                    )} />

                {sessions.length === 0 ? (
                    <Text size="sm" ta="center" py="xl" style={{ color: T.dimmed }}>No sessions yet.</Text>
                ) : (
                    <Stack gap="xs" mb="xl">
                        {sessions.map(s => (
                            <Paper key={s.id} radius="sm" style={{
                                background: T.cardBg, border: `1px solid ${T.border}`,
                                borderLeft: `4px solid ${T.accent}`, overflow: "hidden",
                            }}>
                                <Group wrap="nowrap">
                                    <Anchor component={Link}
                                        href={`/tabletop/campaigns/${campaignId}/sessions/${s.id}`}
                                        underline="never" style={{ flex: 1, minWidth: 0 }}>
                                        <Box p="sm">
                                            <Group gap="sm" wrap="nowrap">
                                                <Text size="xs" style={{ color: T.dimmed, minWidth: 28, textAlign: "center" }}>
                                                    #{s.sessionNumber ?? "?"}
                                                </Text>
                                                <Box style={{ flex: 1, minWidth: 0 }}>
                                                    <Text fw={600} size="sm" style={{ color: T.cream }} lineClamp={1}>
                                                        {s.title || "Untitled Session"}
                                                    </Text>
                                                    {s.prepNotes && (
                                                        <Text size="xs" style={{ color: T.dimmed }} lineClamp={1}>
                                                            {s.prepNotes.slice(0, 120)}
                                                        </Text>
                                                    )}
                                                </Box>
                                                {s.date && <Text size="xs" style={{ color: T.dimmed, flexShrink: 0 }}>{s.date}</Text>}
                                            </Group>
                                        </Box>
                                    </Anchor>
                                    {isGM && (
                                        <Box pr="xs">
                                            <Tooltip label="Delete session">
                                                <ActionIcon variant="subtle" color="red" size="sm"
                                                    onClick={() => setDelSess(s.id)}>
                                                    <Trash2 size={13} />
                                                </ActionIcon>
                                            </Tooltip>
                                        </Box>
                                    )}
                                </Group>
                            </Paper>
                        ))}
                    </Stack>
                )}

                {/* Characters & Combat */}
                <SectionHeader icon={Users} label="Characters & Combat"
                    actions={isGM && (
                        <Group gap="xs">
                            <Button component={Link} href={`/tabletop/campaigns/${campaignId}/characters/new`}
                                size="xs" variant="subtle" leftSection={<Plus size={12} />}
                                style={{ color: T.accent }}>Add Character</Button>
                            <Button size="xs" variant="subtle" leftSection={<Plus size={12} />}
                                onClick={createEncounter} disabled={creatingEnc}
                                style={{ color: T.accent }}>
                                {creatingEnc ? "Creating…" : "New Encounter"}
                            </Button>
                            <Button component={Link} href={`/tabletop/campaigns/${campaignId}/initiative`}
                                size="xs" variant="subtle" leftSection={<ListOrdered size={12} />}
                                style={{ color: T.accent }}>Initiative</Button>
                        </Group>
                    )} />

                {(characters.length > 0 || encounters.length > 0) ? (
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mb="xl">
                        {characters.length > 0 && (
                            <Stack gap="xs">
                                {characters.map(pc => (
                                    <Paper key={pc.id} radius="sm" style={{
                                        background: T.cardBg, border: `1px solid ${T.border}`,
                                        borderLeft: `4px solid ${T.heading}`, overflow: "hidden",
                                    }}>
                                        <Group wrap="nowrap">
                                            <Anchor component={Link}
                                                href={`/tabletop/campaigns/${campaignId}/characters/${pc.id}`}
                                                underline="never" style={{ flex: 1, minWidth: 0 }}>
                                                <Box p="sm">
                                                    <Group gap="xs" mb={2}>
                                                        <Text fw={700} size="sm" style={{ color: T.cream }}>{pc.characterName}</Text>
                                                        {totalLevel(pc) && (
                                                            <Badge size="xs" style={{ background: T.heading, color: T.pageBg, fontWeight: 800 }}>
                                                                Lv {totalLevel(pc)}
                                                            </Badge>
                                                        )}
                                                    </Group>
                                                    <Text size="xs" style={{ color: T.dimmed }} lineClamp={1}>
                                                        {[pc.race, parseClasses(pc)].filter(Boolean).join(" · ")}
                                                        {pc.playerName ? ` — ${pc.playerName}` : ""}
                                                    </Text>
                                                    {companions.filter(c => c.characterId === pc.id).map(c => (
                                                        <Group key={c.id} gap={4} mt={4}>
                                                            <PawPrint size={11} style={{ color: T.dimmed }} />
                                                            <Text size="xs" style={{ color: T.dimmed, fontStyle: "italic" }}>
                                                                {c.name}{c.companionType ? ` (${c.companionType})` : ""}
                                                                {c.currentHp != null && c.maxHp != null ? ` — ${c.currentHp}/${c.maxHp} HP` : ""}
                                                            </Text>
                                                        </Group>
                                                    ))}
                                                </Box>
                                            </Anchor>
                                            {isGM && (
                                                <Box pr="xs">
                                                    <Tooltip label="Delete character">
                                                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => setDelChar(pc.id)}>
                                                            <Trash2 size={13} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                </Box>
                                            )}
                                        </Group>
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                        {encounters.length > 0 && (
                            <Stack gap="xs">
                                {encounters.map(enc => (
                                    <Paper key={enc.id} radius="sm" style={{
                                        background: T.cardBg, border: `1px solid ${T.border}`,
                                        borderLeft: `4px solid #c44426`, overflow: "hidden",
                                    }}>
                                        <Group wrap="nowrap">
                                            <Anchor component={Link}
                                                href={`/tabletop/campaigns/${campaignId}/encounters/${enc.id}`}
                                                underline="never" style={{ flex: 1, minWidth: 0 }}>
                                                <Box p="sm">
                                                    <Group gap="xs">
                                                        <Text fw={600} size="sm" style={{ color: T.cream }}>{enc.name}</Text>
                                                        {enc.status && enc.status !== "planned" && (
                                                            <Badge size="xs" tt="capitalize"
                                                                style={{ background: `${T.accent}22`, color: T.accent }}>
                                                                {enc.status}
                                                            </Badge>
                                                        )}
                                                    </Group>
                                                </Box>
                                            </Anchor>
                                            {isGM && (
                                                <Box pr="xs">
                                                    <Tooltip label="Delete encounter">
                                                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => setDelEnc(enc.id)}>
                                                            <Trash2 size={13} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                </Box>
                                            )}
                                        </Group>
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                    </SimpleGrid>
                ) : (
                    <Text size="sm" ta="center" py="lg" mb="xl" style={{ color: T.dimmed }}>No characters or encounters yet.</Text>
                )}

                {/* World */}
                <SectionHeader icon={Globe} label="World" />
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm" mb="xl">
                    <NavCard icon={Users} label="NPCs" desc="Non-player characters" href={`/tabletop/campaigns/${campaignId}/npcs`} />
                    <NavCard icon={ScrollText} label="Quests" desc="Active & completed" href={`/tabletop/campaigns/${campaignId}/quests`} />
                    <NavCard icon={Shield} label="Factions" desc="Reputation tracker" href={`/tabletop/campaigns/${campaignId}/factions`} />
                    <NavCard icon={Gauge} label="Resources" desc="Custom trackers" href={`/tabletop/campaigns/${campaignId}/resources`} />
                    <NavCard icon={BookOpen} label="Handouts" desc="Share notes & images" href={`/tabletop/campaigns/${campaignId}/handouts`} />
                </SimpleGrid>

                {/* Campaign — Members */}
                <SectionHeader icon={UserPlus} label="Campaign"
                    actions={isGM && (
                        <Group gap="xs">
                            <Button size="xs" variant="subtle" leftSection={<UserPlus size={12} />}
                                style={{ color: T.accent }} onClick={() => generateInvite("player")}>
                                Invite Player
                            </Button>
                            <Button size="xs" variant="subtle" leftSection={<UserPlus size={12} />}
                                style={{ color: T.accent }} onClick={() => generateInvite("gm")}>
                                Invite GM
                            </Button>
                        </Group>
                    )} />

                {inviteLink && (
                    <Paper p="sm" radius="sm" mb="md"
                        style={{ background: T.cardBg, border: `1px solid ${T.deepBorder}` }}>
                        <Text size="xs" style={{ color: T.amber }} mb={6}>Invite link (expires in 7 days)</Text>
                        <Group gap="sm">
                            <TextInput value={inviteLink} readOnly size="xs" style={{ flex: 1 }}
                                styles={{ input: { background: T.pageBg, borderColor: T.border, color: T.cream, fontSize: "0.78rem" } }} />
                            <Button size="xs" leftSection={<Copy size={12} />} onClick={copyInvite}
                                style={{ background: T.accent, color: T.pageBg }}>Copy</Button>
                        </Group>
                    </Paper>
                )}

                {members.length > 0 && (
                    <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm" mb="xl">
                        {members.map(m => (
                            <Paper key={m.id} p="sm" radius="sm" style={{
                                background: T.cardBg, border: `1px solid ${T.border}`,
                                borderLeft: `4px solid ${m.role === "gm" ? T.heading : T.accent}`,
                            }}>
                                <Group justify="space-between">
                                    <Text size="sm" fw={600} style={{ color: T.cream }}>{m.playerName || "—"}</Text>
                                    <Badge size="xs"
                                        style={{ background: `${m.role === "gm" ? T.heading : T.accent}22`,
                                            color: m.role === "gm" ? T.heading : T.accent }}>
                                        {m.role === "gm" ? "GM" : "Player"}
                                    </Badge>
                                </Group>
                            </Paper>
                        ))}
                    </SimpleGrid>
                )}
            </Box>

            {/* ── Dialogs ── */}
            <ConfirmModal opened={!!deleteSession} onClose={() => setDelSess(null)} onConfirm={confirmDeleteSession} title="Delete Session?" />
            <ConfirmModal opened={!!deleteChar} onClose={() => setDelChar(null)} onConfirm={confirmDeleteChar} title="Delete Character?" />
            <ConfirmModal opened={!!deleteEnc} onClose={() => setDelEnc(null)} onConfirm={confirmDeleteEnc} title="Delete Encounter?" />

            {/* Edit campaign modal */}
            <Modal opened={editOpen} onClose={closeEdit} title="Edit Campaign"
                styles={{ content: { background: T.cardBg, border: `1px solid ${T.border}` },
                          header: { background: T.cardBg }, title: { color: T.cream } }}>
                <Stack gap="sm">
                    <TextInput label="Campaign Name" required autoFocus value={editName}
                        onChange={e => setEditName(e.target.value)}
                        styles={{ input: { background: T.pageBg, borderColor: T.border, color: T.cream }, label: { color: T.amber } }} />
                    <TextInput label="Description" value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        styles={{ input: { background: T.pageBg, borderColor: T.border, color: T.cream }, label: { color: T.amber } }} />
                    <SimpleGrid cols={2} spacing="sm">
                        <Select label="Status" value={editStatus || null} onChange={v => setEditStatus(v ?? "")}
                            clearable data={["Planning","Active","Paused","Completed"]}
                            styles={{ input: { background: T.pageBg, borderColor: T.border, color: T.cream }, label: { color: T.amber } }} />
                        <TextInput label="System" value={editSystem} onChange={e => setEditSystem(e.target.value)}
                            placeholder="e.g. D&D 5e"
                            styles={{ input: { background: T.pageBg, borderColor: T.border, color: T.cream }, label: { color: T.amber } }} />
                    </SimpleGrid>
                    <Group justify="flex-end" gap="sm" mt="sm">
                        <Button variant="subtle" style={{ color: T.dimmed }} onClick={closeEdit}>Cancel</Button>
                        <Button disabled={!editName.trim()} onClick={saveCampaignEdit}
                            style={{ background: T.accent, color: T.pageBg }}>Save</Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Combat Settings Dialog (MUI, deferred from migration) */}
            <CombatSettingsDialog
                open={settingsOpen} value={combatSettings} onClose={closeSettings} onSave={saveSettings}
                title="Campaign Combat Settings"
                subtitle="Defaults for all encounters in this campaign. Individual encounters can override." />

            {/* Copied snackbar (MUI) */}
            <Snackbar open={copiedSnack} autoHideDuration={3000} onClose={() => setCopiedSnack(false)}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
                <Alert severity="success" onClose={() => setCopiedSnack(false)}>Invite link copied!</Alert>
            </Snackbar>
        </Box>
    );
}
