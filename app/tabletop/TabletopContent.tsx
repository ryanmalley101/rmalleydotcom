"use client";

import { Box, Container, Typography, Button } from "@mui/material";
import Link from "next/link";
import {
    ArrowLeft, Dices, Sword, BookOpen, Wand2, Gem, Coins, User,
    ListOrdered, Calculator, ShieldAlert, Globe, ScrollText, Swords, BookMarked, Atom,
} from "lucide-react";
import type { EncounterTable } from "@/lib/encounterTables";

interface Props {
    encounterTables: Pick<EncounterTable, "name" | "slug" | "entries">[];
}

// ── Theme ─────────────────────────────────────────────────────────────────────

const T = {
    crimsonDeep:  "#7f1d1d",
    crimson:      "#991b1b",
    crimsonMid:   "#b91c1c",
    crimsonLight: "#ef4444",
    goldDeep:     "#78350f",
    gold:         "#92400e",
    goldMid:      "#b45309",
    goldLight:    "#f59e0b",
};

// ── Featured card ─────────────────────────────────────────────────────────────

function FeaturedCard({ icon: Icon, title, description, href, accent, iconColor, badge }: {
    icon: React.ElementType;
    title: string;
    description: string;
    href: string;
    accent: string;
    iconColor: string;
    badge?: string;
}) {
    return (
        <Box component={Link} href={href} sx={{
            flex: "1 1 260px",
            display: "flex", flexDirection: "column",
            backgroundColor: "background.paper",
            border: "1px solid rgba(153,27,27,0.25)",
            borderTop: `3px solid ${accent}`,
            borderRadius: "0 0 10px 10px",
            p: 3,
            textDecoration: "none",
            transition: "box-shadow 0.15s, background-color 0.15s",
            "&:hover": {
                backgroundColor: `${accent}14`,
                boxShadow: `0 6px 28px ${accent}40`,
            },
        }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Icon size={28} color={iconColor} />
                {badge && (
                    <Typography sx={{
                        fontSize: "0.6rem", fontWeight: 700, letterSpacing: 1.5,
                        color: accent, border: `1px solid ${accent}55`,
                        borderRadius: 1, px: 0.75, py: 0.25, textTransform: "uppercase",
                    }}>
                        {badge}
                    </Typography>
                )}
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: "1.1rem", color: "text.primary", mb: 1 }}>
                {title}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.6 }}>
                {description}
            </Typography>
        </Box>
    );
}

// ── Compact tool card ─────────────────────────────────────────────────────────

function ToolCard({ icon: Icon, title, description, href, accent }: {
    icon: React.ElementType;
    title: string;
    description: string;
    href: string;
    accent: string;
}) {
    return (
        <Box component={Link} href={href} sx={{
            display: "flex", flexDirection: "column",
            backgroundColor: "background.paper",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 2,
            p: 2,
            textDecoration: "none",
            transition: "border-color 0.15s, box-shadow 0.15s, background-color 0.15s",
            "&:hover": {
                borderColor: `${accent}80`,
                boxShadow: `0 2px 14px ${accent}25`,
                backgroundColor: `${accent}12`,
            },
        }}>
            <Icon size={18} color={accent} style={{ marginBottom: 8, flexShrink: 0 }} />
            <Typography sx={{ fontWeight: 600, fontSize: "0.88rem", color: "text.primary", mb: 0.5 }}>
                {title}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.5 }}>
                {description}
            </Typography>
        </Box>
    );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, accent }: { label: string; accent: string }) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <Typography sx={{
                fontSize: "0.6rem", fontWeight: 800, letterSpacing: 2.5,
                color: accent, textTransform: "uppercase", lineHeight: 1, whiteSpace: "nowrap",
            }}>
                {label}
            </Typography>
            <Box sx={{ flex: 1, height: "1px", backgroundColor: `${accent}40` }} />
        </Box>
    );
}

// ── Game-system banner — groups everything specific to one ruleset ───────────

function SystemHeader({ icon: Icon, label, accent }: { icon: React.ElementType; label: string; accent: string }) {
    return (
        <Box sx={{
            display: "flex", alignItems: "center", gap: 1.5, mt: 7, mb: 3,
            pb: 1.5, borderBottom: `2px solid ${accent}55`,
        }}>
            <Icon size={24} color={accent} />
            <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
                {label}
            </Typography>
        </Box>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TabletopContent({ encounterTables }: Props) {
    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href="/" startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: T.goldLight }}>
                    Back
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                    <Sword size={32} color={T.crimsonLight} />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "text.primary" }}>
                        Tabletop
                    </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 5 }}>
                    Tools for tabletop RPGs and D&amp;D 5e.
                </Typography>

                {/* ── Campaign Manager ── */}
                <SectionHeader label="Campaign Manager" accent={T.crimsonLight} />
                <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap", mb: 6 }}>
                    <FeaturedCard
                        icon={Globe}
                        title="My Worlds"
                        description="Build and manage D&D worlds with a full wiki — locations, factions, NPCs, lore, maps, and more."
                        href="/tabletop/worlds"
                        accent={T.crimsonMid}
                        iconColor={T.crimsonLight}
                        badge="Wiki"
                    />
                    <FeaturedCard
                        icon={ScrollText}
                        title="My Campaigns"
                        description="Track sessions, prep notes, encounters, and player character sheets across all your campaigns."
                        href="/tabletop/campaigns"
                        accent={T.crimson}
                        iconColor={T.crimsonLight}
                        badge="Live"
                    />
                </Box>

                {/* ════════════════════════ D&D 5e ════════════════════════ */}
                <SystemHeader icon={Sword} label="D&D 5e" accent={T.crimsonLight} />

                <SectionHeader label="Combat" accent={T.crimsonMid} />
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 1.5, mb: 5 }}>
                    <ToolCard icon={ListOrdered} accent={T.crimsonLight}
                        title="Initiative Tracker"
                        description="Track turn order, HP, and conditions. State persists in browser."
                        href="/tabletop/initiative" />
                    <ToolCard icon={Swords} accent={T.crimsonLight}
                        title="Encounter Difficulty"
                        description="Rate encounters Easy / Medium / Hard / Deadly by XP budget."
                        href="/tabletop/encounter-calc" />
                    <ToolCard icon={ShieldAlert} accent={T.crimsonLight}
                        title="Conditions"
                        description="Quick-reference cards for all D&D 2024 conditions."
                        href="/tabletop/conditions" />
                </Box>

                <SectionHeader label="Generators" accent={T.goldMid} />
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 1.5, mb: 5 }}>
                    <ToolCard icon={Gem} accent={T.goldLight}
                        title="Magic Item"
                        description="Random magic item filtered by rarity and attunement."
                        href="/tabletop/magic-item" />
                    <ToolCard icon={Coins} accent={T.goldLight}
                        title="Loot Hoard"
                        description="Generate currency and items for a treasure hoard by CR."
                        href="/tabletop/loot" />
                    <ToolCard icon={User} accent={T.goldLight}
                        title="NPC"
                        description="Random NPC with species, class, background, and personality."
                        href="/tabletop/npc" />
                    <ToolCard icon={Wand2} accent={T.goldLight}
                        title="Spell Scroll"
                        description="Random spell scroll filtered by level, school, or class."
                        href="/tabletop/spell-scroll" />
                    <ToolCard icon={Dices} accent={T.goldLight}
                        title="Encounter Tables"
                        description={`d100 tables for on-the-fly encounters (${encounterTables.length} tables).`}
                        href="/tabletop/encounters" />
                </Box>

                <SectionHeader label="Reference & Creation" accent={T.goldMid} />
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 1.5 }}>
                    <ToolCard icon={Sword} accent={T.goldLight}
                        title="Monster Creator"
                        description="Build and save custom D&D 5e monster statblocks."
                        href="/create/monster" />
                    <ToolCard icon={BookOpen} accent={T.goldLight}
                        title="5.5e SRD"
                        description="Searchable D&D 2024 reference — monsters, spells, items, classes."
                        href="/tabletop/srd" />
                </Box>

                {/* ════════════════════ Cypher System ════════════════════ */}
                <SystemHeader icon={Atom} label="Cypher System" accent={T.goldLight} />

                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 1.5 }}>
                    <ToolCard icon={BookMarked} accent={T.goldLight}
                        title="Cypher System SRD"
                        description="Searchable Cypher System reference — abilities, cyphers, foci, and more."
                        href="/tabletop/cypher" />
                </Box>
            </Container>
        </Box>
    );
}
