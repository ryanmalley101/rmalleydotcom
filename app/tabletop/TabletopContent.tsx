"use client";

import {
    Anchor, Badge, Box, Button, Divider, Group,
    SimpleGrid, Text, ThemeIcon, Title,
} from "@mantine/core";
import Link from "next/link";
import {
    Atom, BookMarked, BookOpen, Calculator, Coins,
    Dices, Gem, Globe, ListOrdered, ScrollText,
    ShieldAlert, Sword, Swords, User, Wand2,
} from "lucide-react";
import type { EncounterTable } from "@/lib/encounterTables";

interface Props {
    encounterTables: Pick<EncounterTable, "name" | "slug" | "entries">[];
}

const T = {
    pageBg: "#1a0d05", cardBg: "#261508",
    border: "rgba(210,140,70,0.22)", divider: "rgba(210,140,70,0.18)",
    cream: "#f0ddb5", amber: "#d4aa72", dimmed: "#a67c4a",
    accent: "#ef6b1a", heading: "#e8c060", deepBorder: "rgba(239,107,26,0.3)",
};

function FeaturedCard({ icon: Icon, title, description, href, badge }: {
    icon: React.ElementType; title: string; description: string; href: string; badge?: string;
}) {
    return (
        <Anchor component={Link} href={href} underline="never" style={{ flex: "1 1 260px" }}>
            <Box
                style={{
                    background: T.cardBg, border: `1px solid ${T.border}`,
                    borderTop: `3px solid ${T.accent}`, borderRadius: 10,
                    padding: "1.25rem", display: "flex", flexDirection: "column", height: "100%",
                    transition: "box-shadow 0.15s, background 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 28px ${T.accent}40`; (e.currentTarget as HTMLElement).style.background = `${T.accent}12`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = ""; (e.currentTarget as HTMLElement).style.background = T.cardBg; }}
            >
                <Group justify="space-between" mb="md">
                    <ThemeIcon size="xl" radius="sm" style={{ background: `${T.accent}22`, color: T.accent }}>
                        <Icon size={22} />
                    </ThemeIcon>
                    {badge && (
                        <Badge size="xs" style={{ border: `1px solid ${T.accent}55`, background: "transparent", color: T.accent }}>
                            {badge}
                        </Badge>
                    )}
                </Group>
                <Text fw={700} size="lg" style={{ color: T.cream }} mb={6}>{title}</Text>
                <Text size="sm" style={{ color: T.dimmed, lineHeight: 1.6 }}>{description}</Text>
            </Box>
        </Anchor>
    );
}

function ToolCard({ icon: Icon, title, description, href }: {
    icon: React.ElementType; title: string; description: string; href: string;
}) {
    return (
        <Anchor component={Link} href={href} underline="never">
            <Box
                style={{
                    background: T.cardBg, border: `1px solid ${T.border}`,
                    borderRadius: 8, padding: "0.875rem",
                    transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${T.accent}80`; (e.currentTarget as HTMLElement).style.background = `${T.accent}12`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.border; (e.currentTarget as HTMLElement).style.background = T.cardBg; }}
            >
                <Icon size={18} style={{ color: T.accent, marginBottom: 8, flexShrink: 0 }} />
                <Text fw={600} size="sm" style={{ color: T.cream }} mb={4}>{title}</Text>
                <Text size="xs" style={{ color: T.dimmed, lineHeight: 1.5 }}>{description}</Text>
            </Box>
        </Anchor>
    );
}

function SectionDivider({ label }: { label: string }) {
    return (
        <Divider
            my="lg"
            labelPosition="left"
            label={
                <Text size="xs" fw={800} tt="uppercase" style={{ letterSpacing: 2.5, color: T.accent }}>
                    {label}
                </Text>
            }
            styles={{ label: { color: T.accent }, root: { borderColor: T.divider } }}
        />
    );
}

function SystemHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <Box
            mt={56} mb="lg" pb="sm"
            style={{ borderBottom: `2px solid ${T.deepBorder}`, display: "flex", alignItems: "center", gap: 10 }}
        >
            <Icon size={24} style={{ color: T.accent }} />
            <Title order={3} style={{ color: T.cream, fontFamily: "var(--font-cinzel), serif" }}>{label}</Title>
        </Box>
    );
}

export default function TabletopContent({ encounterTables }: Props) {
    return (
        <Box mih="100vh" py="xl" style={{ background: T.pageBg }}>
            <Box maw={768} mx="auto" px="md">
                <Button component={Link} href="/" variant="subtle" size="sm" mb="xl"
                    leftSection={<span style={{ fontSize: 14 }}>←</span>}
                    style={{ color: T.accent }}>
                    Back
                </Button>

                <Group gap="sm" mb={4}>
                    <Sword size={32} style={{ color: T.accent }} />
                    <Title order={1} style={{ color: T.cream }}>Tabletop</Title>
                </Group>
                <Text size="md" style={{ color: T.dimmed }} mb="xl">
                    Tools for tabletop RPGs and D&amp;D 5e.
                </Text>

                {/* Campaign Manager */}
                <SectionDivider label="Campaign Manager" />
                <Group gap="lg" mb="xl" grow>
                    <FeaturedCard
                        icon={Globe} title="My Worlds" badge="Wiki"
                        description="Build and manage D&D worlds with a full wiki — locations, factions, NPCs, lore, maps, and more."
                        href="/tabletop/worlds"
                    />
                    <FeaturedCard
                        icon={ScrollText} title="My Campaigns" badge="Live"
                        description="Track sessions, prep notes, encounters, and player character sheets across all your campaigns."
                        href="/tabletop/campaigns"
                    />
                </Group>

                {/* D&D 5e */}
                <SystemHeader icon={Sword} label="D&D 5e" />

                <SectionDivider label="Combat" />
                <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm" mb="xl">
                    <ToolCard icon={ListOrdered} title="Initiative Tracker"
                        description="Track turn order, HP, and conditions. State persists in browser."
                        href="/tabletop/initiative" />
                    <ToolCard icon={Swords} title="Encounter Difficulty"
                        description="Rate encounters Easy / Medium / Hard / Deadly by XP budget."
                        href="/tabletop/encounter-calc" />
                    <ToolCard icon={ShieldAlert} title="Conditions"
                        description="Quick-reference cards for all D&D 2024 conditions."
                        href="/tabletop/conditions" />
                </SimpleGrid>

                <SectionDivider label="Generators" />
                <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm" mb="xl">
                    <ToolCard icon={Gem} title="Magic Item"
                        description="Random magic item filtered by rarity and attunement."
                        href="/tabletop/magic-item" />
                    <ToolCard icon={Coins} title="Loot Hoard"
                        description="Generate currency and items for a treasure hoard by CR."
                        href="/tabletop/loot" />
                    <ToolCard icon={User} title="NPC"
                        description="Random NPC with species, class, background, and personality."
                        href="/tabletop/npc" />
                    <ToolCard icon={Wand2} title="Spell Scroll"
                        description="Random spell scroll filtered by level, school, or class."
                        href="/tabletop/spell-scroll" />
                    <ToolCard icon={Dices} title="Encounter Tables"
                        description={`d100 tables for on-the-fly encounters (${encounterTables.length} tables).`}
                        href="/tabletop/encounters" />
                </SimpleGrid>

                <SectionDivider label="Reference & Creation" />
                <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                    <ToolCard icon={Sword} title="Monster Creator"
                        description="Build and save custom D&D 5e monster statblocks."
                        href="/create/monster" />
                    <ToolCard icon={BookOpen} title="5.5e SRD"
                        description="Searchable D&D 2024 reference — monsters, spells, items, classes."
                        href="/tabletop/srd" />
                </SimpleGrid>

                {/* Cypher System */}
                <SystemHeader icon={Atom} label="Cypher System" />
                <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                    <ToolCard icon={BookMarked} title="Cypher System SRD"
                        description="Searchable Cypher System reference — abilities, cyphers, foci, and more."
                        href="/tabletop/cypher" />
                </SimpleGrid>
            </Box>
        </Box>
    );
}
