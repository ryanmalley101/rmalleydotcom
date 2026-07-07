"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
    ActionIcon, Anchor, Badge, Box, Button, Card, Center, Divider,
    Grid, Group, Loader, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title, Tooltip,
} from "@mantine/core";
import Link from "next/link";
import {
    IconArrowLeft, IconBookmark, IconCalendar, IconChevronRight,
    IconClipboardList, IconGauge, IconLayoutGrid, IconMap, IconPlus,
    IconShield, IconSwords, IconUsers,
} from "@tabler/icons-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { useCampaignRole } from "@/lib/useCampaignRole";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

const client = generateClient<Schema>();
type Campaign        = Schema["Campaign"]["type"];
type Session         = Schema["CampaignSession"]["type"];
type PlayerCharacter = Schema["PlayerCharacter"]["type"];
type World           = Schema["DnDWorld"]["type"];
type Encounter       = Schema["Encounter"]["type"];
type CampaignMember  = Schema["CampaignMember"]["type"];
type WorldMap        = Schema["WorldMap"]["type"];

// ── Token set ─────────────────────────────────────────────────────────────────

export interface TokenSet {
    pageBg:     string;
    cardBg:     string;
    cardHover:  string;
    border:     string;
    borderHot:  string;
    divider:    string;
    cream:      string; // primary text
    amber:      string; // secondary text
    dimmed:     string; // tertiary / disabled
    accent:     string; // interactive / highlight
    heading:    string; // title color
    deepBorder: string;
}

export const PALETTES: Record<string, { label: string; dot: string; slug: string; tokens: TokenSet }> = {
    daylight: {
        label: "Daylight Parchment", dot: "#c45214", slug: "preview/daylight",
        tokens: {
            pageBg:    "#f5e8d4", cardBg:    "#fdf5e8", cardHover: "#fff9f0",
            border:    "rgba(160,90,30,0.18)", borderHot: "rgba(196,82,20,0.4)",
            divider:   "rgba(160,90,30,0.15)",
            cream:     "#1a0d05", // dark body text on light background
            amber:     "#5c2e0a", // dark brown secondary
            dimmed:    "#9a6040", // muted mid-brown tertiary
            accent:    "#c45214", // ember darkened for light-bg contrast
            heading:   "#7c2810", // deep burnt sienna
            deepBorder: "rgba(160,70,15,0.3)",
        },
    },
    ember: {
        label: "Ember Leather", dot: "#ef6b1a", slug: "preview",
        tokens: {
            pageBg: "#1a0d05", cardBg: "#261508", cardHover: "#321b0c",
            border: "rgba(210,140,70,0.22)", borderHot: "rgba(239,107,26,0.55)",
            divider: "rgba(210,140,70,0.18)", cream: "#f0ddb5", amber: "#d4aa72",
            dimmed: "#a67c4a", accent: "#ef6b1a", heading: "#e8c060",
            deepBorder: "rgba(239,107,26,0.3)",
        },
    },
    arcane: {
        label: "Arcane Midnight", dot: "#4dbce9", slug: "preview/arcane",
        tokens: {
            pageBg: "#070b14", cardBg: "#0e1528", cardHover: "#152040",
            border: "rgba(77,188,233,0.2)", borderHot: "rgba(77,188,233,0.45)",
            divider: "rgba(77,188,233,0.15)", cream: "#e2f0ff", amber: "#93c5fd",
            dimmed: "#4f7aa8", accent: "#4dbce9", heading: "#c084fc",
            deepBorder: "rgba(77,188,233,0.3)",
        },
    },
    verdant: {
        label: "Verdant Depths", dot: "#4ade80", slug: "preview/verdant",
        tokens: {
            pageBg: "#040e06", cardBg: "#0c1e0f", cardHover: "#132817",
            border: "rgba(74,222,128,0.18)", borderHot: "rgba(74,222,128,0.4)",
            divider: "rgba(74,222,128,0.15)", cream: "#d1fae5", amber: "#86efac",
            dimmed: "#4a8c5e", accent: "#4ade80", heading: "#fbbf24",
            deepBorder: "rgba(74,222,128,0.3)",
        },
    },
    void: {
        label: "Void Crimson", dot: "#ef4444", slug: "preview/void",
        tokens: {
            pageBg: "#0e0204", cardBg: "#1f060b", cardHover: "#2d080f",
            border: "rgba(239,68,68,0.2)", borderHot: "rgba(239,68,68,0.45)",
            divider: "rgba(239,68,68,0.15)", cream: "#fef2f2", amber: "#fca5a5",
            dimmed: "#8b3030", accent: "#ef4444", heading: "#c4a044",
            deepBorder: "rgba(239,68,68,0.3)",
        },
    },
    underdark: {
        label: "Underdark", dot: "#a855f7", slug: "preview/underdark",
        tokens: {
            pageBg: "#07030f", cardBg: "#0e0820", cardHover: "#160c2e",
            border: "rgba(168,85,247,0.2)", borderHot: "rgba(168,85,247,0.45)",
            divider: "rgba(168,85,247,0.15)", cream: "#f3e8ff", amber: "#c4b5fd",
            dimmed: "#6b4fa0", accent: "#a855f7", heading: "#22d3ee",
            deepBorder: "rgba(168,85,247,0.3)",
        },
    },
    gilded: {
        label: "Gilded Obsidian", dot: "#e8c060", slug: "preview/gilded",
        tokens: {
            pageBg: "#090909", cardBg: "#111111", cardHover: "#1a1a1a",
            border: "rgba(232,192,96,0.2)", borderHot: "rgba(232,192,96,0.5)",
            divider: "rgba(232,192,96,0.15)", cream: "#f9f5e7", amber: "#d4aa60",
            dimmed: "#7a6030", accent: "#e8c060", heading: "#e8c060",
            deepBorder: "rgba(232,192,96,0.35)",
        },
    },
};

// ── Palette switcher ──────────────────────────────────────────────────────────
function PaletteSwitcher({ current, campaignId, T }: { current: string; campaignId: string; T: TokenSet }) {
    return (
        <Group gap="xs">
            {Object.entries(PALETTES).map(([key, p]) => (
                <Tooltip key={key} label={p.label} withArrow>
                    <Box
                        component={Link}
                        href={`/tabletop/campaigns/${campaignId}/${p.slug}`}
                        style={{
                            width: 20, height: 20, borderRadius: "50%",
                            background: p.dot,
                            border: current === key ? `3px solid ${T.cream}` : "3px solid transparent",
                            boxShadow: current === key ? `0 0 8px ${p.dot}` : "none",
                            display: "block",
                            flexShrink: 0,
                            transition: "border-color 120ms, box-shadow 120ms",
                        }}
                    />
                </Tooltip>
            ))}
        </Group>
    );
}

// ── Section divider ───────────────────────────────────────────────────────────
function SectionHeader({ icon, label, T }: { icon: React.ReactNode; label: string; T: TokenSet }) {
    return (
        <Box my="xl">
            <Group gap="sm" mb={6}>
                <ThemeIcon size="sm" radius="xs" style={{ background: T.accent, color: T.pageBg }}>
                    {icon}
                </ThemeIcon>
                <Text size="xs" fw={800} tt="uppercase"
                    style={{ letterSpacing: 3, color: T.accent, fontFamily: "var(--font-cinzel), serif" }}>
                    {label}
                </Text>
            </Group>
            <Divider style={{ borderColor: T.divider }} />
        </Box>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SessionRow({ s, campaignId, T }: { s: Session; campaignId: string; T: TokenSet }) {
    return (
        <Card component={Link} href={`/tabletop/campaigns/${campaignId}/sessions/${s.id}`}
            p="sm" radius="sm"
            style={{ background: T.cardBg, border: `1px solid ${T.border}`,
                borderLeft: `4px solid ${T.accent}`, textDecoration: "none" }}>
            <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                    <Text size="xs" w={28} ta="center" style={{ color: T.dimmed }}>
                        #{s.sessionNumber ?? "?"}
                    </Text>
                    <div>
                        <Text fw={600} size="sm" lineClamp={1} style={{ color: T.cream }}>
                            {s.title || "Untitled Session"}
                        </Text>
                        {s.prepNotes && (
                            <Text size="xs" lineClamp={1} style={{ color: T.dimmed }}>
                                {s.prepNotes.slice(0, 100)}
                            </Text>
                        )}
                    </div>
                </Group>
                {s.date && <Text size="xs" style={{ color: T.dimmed }}>{s.date}</Text>}
            </Group>
        </Card>
    );
}

function CharCard({ pc, campaignId, T }: { pc: PlayerCharacter; campaignId: string; T: TokenSet }) {
    const level = (() => {
        if (!pc.classesJson) return pc.level;
        try { return (JSON.parse(pc.classesJson) as { level: number }[]).reduce((s, c) => s + c.level, 0); } catch { return pc.level; }
    })();
    return (
        <Card component={Link} href={`/tabletop/campaigns/${campaignId}/characters/${pc.id}`}
            p="sm" radius="sm"
            style={{ background: T.cardBg, border: `1px solid ${T.border}`,
                borderLeft: `4px solid ${T.heading}`, textDecoration: "none" }}>
            <Group justify="space-between">
                <div>
                    <Text fw={700} size="sm" style={{ color: T.cream }}>{pc.characterName}</Text>
                    <Text size="xs" style={{ color: T.dimmed }}>
                        {[pc.race, pc.characterClass].filter(Boolean).join(" · ")}
                        {pc.playerName ? ` — ${pc.playerName}` : ""}
                    </Text>
                </div>
                {level && (
                    <Badge size="xs" style={{ background: T.heading, color: T.pageBg, fontWeight: 800 }}>
                        Lv {level}
                    </Badge>
                )}
            </Group>
        </Card>
    );
}

function NavCard({ icon, label, desc, href, T }: {
    icon: React.ReactNode; label: string; desc: string; href: string; T: TokenSet;
}) {
    return (
        <Card component={Link} href={href} p="md" radius="sm"
            style={{ background: T.cardBg, border: `1px solid ${T.border}`,
                borderTop: `3px solid ${T.accent}`, textDecoration: "none" }}>
            <Group gap="sm" mb={4} wrap="nowrap">
                <ThemeIcon size="sm" radius="xs" style={{ background: `${T.accent}22`, color: T.accent }}>
                    {icon}
                </ThemeIcon>
                <Text fw={700} size="sm" style={{ color: T.cream, flex: 1 }}>{label}</Text>
                <IconChevronRight size={13} style={{ color: T.dimmed }} />
            </Group>
            <Text size="xs" style={{ color: T.dimmed }}>{desc}</Text>
        </Card>
    );
}

function ToolCard({ icon, label, href, T }: { icon: React.ReactNode; label: string; href: string; T: TokenSet }) {
    return (
        <Card component={Link} href={href} p="sm" radius="sm"
            style={{ background: T.cardBg, border: `1px solid ${T.border}`,
                borderTop: `2px solid ${T.deepBorder}`, textDecoration: "none" }}>
            <Group gap="xs" wrap="nowrap">
                <ThemeIcon size="sm" radius="xs" style={{ background: T.accent, color: T.pageBg }}>
                    {icon}
                </ThemeIcon>
                <Text size="sm" fw={600} style={{ color: T.cream, flex: 1 }}>{label}</Text>
                <IconChevronRight size={12} style={{ color: T.dimmed }} />
            </Group>
        </Card>
    );
}

// ── Main template ─────────────────────────────────────────────────────────────

interface Props { T: TokenSet; paletteKey: string; }

export function CampaignTemplate({ T, paletteKey }: Props) {
    const { campaignId } = useParams<{ campaignId: string }>();
    const { isGm: isGM } = useCampaignRole(campaignId);

    const [campaign, setCampaign]   = useState<Campaign | null>(null);
    const [sessions, setSessions]   = useState<Session[]>([]);
    const [characters, setChars]    = useState<PlayerCharacter[]>([]);
    const [worlds, setWorlds]       = useState<World[]>([]);
    const [encounters, setEncounters] = useState<Encounter[]>([]);
    const [members, setMembers]     = useState<CampaignMember[]>([]);
    const [worldMaps, setWorldMaps] = useState<WorldMap[]>([]);
    const [loading, setLoading]     = useState(true);

    useDocumentTitle(campaign?.name ?? null);

    useEffect(() => {
        Promise.all([
            client.models.Campaign.get({ id: campaignId }),
            client.models.CampaignSession.list(),
            client.models.PlayerCharacter.list(),
            client.models.DnDWorld.list(),
            client.models.Encounter.list(),
            client.models.CampaignMember.list(),
            client.models.WorldMap.list(),
        ]).then(([cRes, sRes, pcRes, wRes, encRes, memRes, mapRes]) => {
            const camp = cRes.data;
            setCampaign(camp);
            setSessions((sRes.data ?? []).filter(s => s.campaignId === campaignId)
                .sort((a, b) => (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0)));
            setChars((pcRes.data ?? []).filter(pc => pc.campaignId === campaignId));
            setEncounters((encRes.data ?? []).filter(e => e.campaignId === campaignId));
            setMembers((memRes.data ?? []).filter(m => m.campaignId === campaignId));
            if (camp) {
                const wIds = (camp.worldIds ?? []).filter((id): id is string => !!id);
                setWorlds((wRes.data ?? []).filter(w => wIds.includes(w.id)));
                setWorldMaps((mapRes.data ?? []).filter(m => wIds.includes(m.worldId)));
            }
        }).finally(() => setLoading(false));
    }, [campaignId]);

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
            <Text style={{ color: T.accent }}>Campaign not found.</Text>
        </Center>
    );

    return (
        <Box mih="100vh" py="xl" style={{ background: T.pageBg }}>
            <Box maw={900} mx="auto" px="md">

                {/* Top bar */}
                <Group justify="space-between" mb="xl">
                    <Anchor component={Link} href="/tabletop/campaigns" size="sm" fw={500}
                        style={{ color: T.accent, textDecoration: "none" }}>
                        <Group gap={4}><IconArrowLeft size={14} /> My Campaigns</Group>
                    </Anchor>
                    <Group gap="lg">
                        <PaletteSwitcher current={paletteKey} campaignId={campaignId} T={T} />
                        <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                            size="xs" variant="subtle" style={{ color: T.dimmed }}>
                            ← MUI version
                        </Button>
                    </Group>
                </Group>

                {/* Hero header */}
                <Paper radius="lg" p="xl" mb="xl"
                    style={{
                        background: `linear-gradient(135deg, ${T.cardBg}, ${T.pageBg})`,
                        border: `1px solid ${T.deepBorder}`,
                        boxShadow: `0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 ${T.deepBorder}`,
                    }}>
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <div>
                            <Title order={1}
                                style={{ color: T.heading, lineHeight: 1.1,
                                    textShadow: `0 2px 16px ${T.heading}44` }}>
                                {campaign.name}
                            </Title>
                            <Group gap="sm" mt="xs" wrap="wrap">
                                {campaign.status && (
                                    <Badge size="sm" style={{ background: `${T.accent}22`, color: T.accent,
                                        border: `1px solid ${T.accent}44` }}>
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
                                        href={`/tabletop/worlds/${w.id}`}
                                        size="xs" style={{ color: T.accent }}>
                                        🌍 {w.name}
                                    </Anchor>
                                ))}
                            </Group>
                            {campaign.description && (
                                <Text size="sm" mt="sm" maw={480} style={{ color: T.amber }}>
                                    {campaign.description}
                                </Text>
                            )}
                        </div>
                        <ActionIcon.Group>
                            <Tooltip label="Edit">
                                <ActionIcon variant="subtle" size="lg" style={{ color: T.amber }}>✏️</ActionIcon>
                            </Tooltip>
                            <Tooltip label="Settings">
                                <ActionIcon variant="subtle" size="lg" style={{ color: T.amber }}>⚙️</ActionIcon>
                            </Tooltip>
                        </ActionIcon.Group>
                    </Group>
                </Paper>

                {/* Active tools */}
                <SimpleGrid cols={{ base: 2, sm: campaign.system ? 4 : 3 }} spacing="sm" mb="xl">
                    {campaign.system && (
                        <ToolCard icon={<IconShield size={14} />} label="GM Dashboard" href={dashboardHref} T={T} />
                    )}
                    <ToolCard icon={<IconLayoutGrid size={14} />} label="Virtual Table"
                        href={`/tabletop/campaigns/${campaignId}/vtt`} T={T} />
                    <ToolCard icon={<IconBookmark size={14} />} label="Chronicle"
                        href={`/tabletop/campaigns/${campaignId}/timeline`} T={T} />
                    <ToolCard icon={<IconCalendar size={14} />} label="Calendar"
                        href={`/tabletop/campaigns/${campaignId}/calendar`} T={T} />
                </SimpleGrid>

                {/* Maps */}
                {worldMaps.length > 0 && (
                    <>
                        <SectionHeader icon={<IconMap size={14} />} label="Maps" T={T} />
                        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm" mb="lg">
                            {worldMaps.map(m => (
                                <Card key={m.id} component={Link}
                                    href={`/tabletop/worlds/${m.worldId}/maps/${m.id}?campaign=${campaignId}`}
                                    p="sm" radius="sm"
                                    style={{ background: T.cardBg, border: `1px solid ${T.border}`, textDecoration: "none" }}>
                                    <Group gap="xs" wrap="nowrap">
                                        <IconMap size={14} style={{ color: T.accent }} />
                                        <Text size="sm" fw={600} lineClamp={1} style={{ color: T.cream, flex: 1 }}>
                                            {m.name}
                                        </Text>
                                        <IconChevronRight size={12} style={{ color: T.dimmed }} />
                                    </Group>
                                </Card>
                            ))}
                        </SimpleGrid>
                    </>
                )}

                {/* Story & History */}
                <SectionHeader icon={<IconCalendar size={14} />} label="Story & History" T={T} />
                <Group justify="flex-end" mb="sm">
                    {isGM && (
                        <Button size="xs" leftSection={<IconPlus size={12} />}
                            component={Link} href={`/tabletop/campaigns/${campaignId}/sessions/new`}
                            style={{ background: T.accent, color: T.pageBg, border: "none" }}>
                            New Session
                        </Button>
                    )}
                </Group>
                {sessions.length === 0 ? (
                    <Text size="sm" ta="center" py="xl" style={{ color: T.dimmed }}>No sessions yet.</Text>
                ) : (
                    <Stack gap="xs" mb="xl">
                        {sessions.map(s => <SessionRow key={s.id} s={s} campaignId={campaignId} T={T} />)}
                    </Stack>
                )}

                {/* Characters & Combat */}
                <SectionHeader icon={<IconUsers size={14} />} label="Characters & Combat" T={T} />
                <Group gap="sm" mb="sm" wrap="wrap">
                    {isGM && (
                        <>
                            <Button size="xs" variant="subtle" leftSection={<IconPlus size={12} />}
                                component={Link} href={`/tabletop/campaigns/${campaignId}/characters/new`}
                                style={{ color: T.accent }}>
                                Add Character
                            </Button>
                            <Button size="xs" variant="subtle" leftSection={<IconSwords size={12} />}
                                component={Link} href={`/tabletop/campaigns/${campaignId}/initiative`}
                                style={{ color: T.accent }}>
                                Initiative
                            </Button>
                        </>
                    )}
                </Group>
                {(characters.length > 0 || encounters.length > 0) ? (
                    <Grid gutter="sm" mb="xl">
                        {characters.length > 0 && (
                            <Grid.Col span={{ base: 12, sm: 6 }}>
                                <Stack gap="xs">
                                    {characters.map(pc => <CharCard key={pc.id} pc={pc} campaignId={campaignId} T={T} />)}
                                </Stack>
                            </Grid.Col>
                        )}
                        {encounters.length > 0 && (
                            <Grid.Col span={{ base: 12, sm: 6 }}>
                                <Stack gap="xs">
                                    {encounters.map(enc => (
                                        <Card key={enc.id} component={Link}
                                            href={`/tabletop/campaigns/${campaignId}/encounters/${enc.id}`}
                                            p="sm" radius="sm"
                                            style={{ background: T.cardBg, border: `1px solid ${T.border}`,
                                                borderLeft: `4px solid ${T.accent}aa`, textDecoration: "none" }}>
                                            <Group justify="space-between">
                                                <Text fw={600} size="sm" style={{ color: T.cream }}>{enc.name}</Text>
                                                {enc.status && enc.status !== "planned" && (
                                                    <Badge size="xs"
                                                        style={{ background: `${T.accent}22`, color: T.accent }}
                                                        tt="capitalize">{enc.status}</Badge>
                                                )}
                                            </Group>
                                        </Card>
                                    ))}
                                </Stack>
                            </Grid.Col>
                        )}
                    </Grid>
                ) : (
                    <Text size="sm" ta="center" py="lg" mb="xl" style={{ color: T.dimmed }}>
                        No characters or encounters yet.
                    </Text>
                )}

                {/* World */}
                <SectionHeader icon={<IconMap size={14} />} label="World" T={T} />
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm" mb="xl">
                    <NavCard icon={<IconUsers size={14} />} label="NPCs" desc="Non-player characters"
                        href={`/tabletop/campaigns/${campaignId}/npcs`} T={T} />
                    <NavCard icon={<IconClipboardList size={14} />} label="Quests" desc="Active & completed"
                        href={`/tabletop/campaigns/${campaignId}/quests`} T={T} />
                    <NavCard icon={<IconShield size={14} />} label="Factions" desc="Reputation tracker"
                        href={`/tabletop/campaigns/${campaignId}/factions`} T={T} />
                    <NavCard icon={<IconGauge size={14} />} label="Resources" desc="Custom trackers"
                        href={`/tabletop/campaigns/${campaignId}/resources`} T={T} />
                </SimpleGrid>

                {/* Campaign */}
                <SectionHeader icon={<IconUsers size={14} />} label="Campaign" T={T} />
                {members.length > 0 && (
                    <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm" mb="md">
                        {members.map(m => (
                            <Card key={m.id} p="sm" radius="sm"
                                style={{ background: T.cardBg, border: `1px solid ${T.border}`,
                                    borderLeft: `4px solid ${m.role === "gm" ? T.heading : T.accent}` }}>
                                <Group justify="space-between">
                                    <Text size="sm" fw={600} style={{ color: T.cream }}>
                                        {m.playerName || "—"}
                                    </Text>
                                    <Badge size="xs"
                                        style={{ background: `${m.role === "gm" ? T.heading : T.accent}22`,
                                            color: m.role === "gm" ? T.heading : T.accent }}>
                                        {m.role === "gm" ? "GM" : "Player"}
                                    </Badge>
                                </Group>
                            </Card>
                        ))}
                    </SimpleGrid>
                )}
                {isGM && (
                    <Group gap="sm">
                        {["Invite Player", "Invite GM"].map(label => (
                            <Button key={label} size="xs" leftSection={<IconPlus size={12} />}
                                style={{ border: `1px solid ${T.deepBorder}`, background: "transparent", color: T.accent }}>
                                {label}
                            </Button>
                        ))}
                    </Group>
                )}

            </Box>
        </Box>
    );
}
