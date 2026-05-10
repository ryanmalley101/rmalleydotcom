"use client";

import { Box, Container, Typography, Button, Divider } from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Dices, Sword, BookOpen, Wand2, Gem, Coins, User, ListOrdered, Calculator, ShieldAlert } from "lucide-react";
import type { EncounterTable } from "@/lib/encounterTables";

interface Props {
    encounterTables: Pick<EncounterTable, "name" | "slug" | "entries">[];
}

export default function TabletopContent({ encounterTables }: Props) {
    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button
                    component={Link}
                    href="/"
                    startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}
                >
                    Back
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                    <Sword size={32} color="#8C5A3A" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        Tabletop
                    </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 5 }}>
                    Tools for tabletop RPGs and D&amp;D 5e.
                </Typography>

                <Divider sx={{ mb: 4 }} />

                {/* Initiative Tracker */}
                <Box sx={{ mb: 5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                        <ListOrdered size={22} color="#8C5A3A" />
                        <Typography variant="h5" component={Link} href="/tabletop/initiative" sx={{
                            color: "primary.dark", fontWeight: 600, textDecoration: "none",
                            "&:hover": { textDecoration: "underline" },
                        }}>
                            Initiative Tracker
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Track turn order, HP, and conditions for every combatant. State persists in your browser.
                    </Typography>
                </Box>

                {/* Encounter Difficulty Calculator */}
                <Box sx={{ mb: 5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                        <Calculator size={22} color="#8C5A3A" />
                        <Typography variant="h5" component={Link} href="/tabletop/encounter-calc" sx={{
                            color: "primary.dark", fontWeight: 600, textDecoration: "none",
                            "&:hover": { textDecoration: "underline" },
                        }}>
                            Encounter Difficulty
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Calculate Easy / Medium / Hard / Deadly ratings using the XP budget method.
                    </Typography>
                </Box>

                {/* Condition Reference */}
                <Box sx={{ mb: 5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                        <ShieldAlert size={22} color="#8C5A3A" />
                        <Typography variant="h5" component={Link} href="/tabletop/conditions" sx={{
                            color: "primary.dark", fontWeight: 600, textDecoration: "none",
                            "&:hover": { textDecoration: "underline" },
                        }}>
                            Conditions
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Quick reference cards for all D&amp;D 2024 conditions. Click to expand full rules text.
                    </Typography>
                </Box>

                {/* Magic Item Generator */}
                <Box sx={{ mb: 5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                        <Gem size={22} color="#8C5A3A" />
                        <Typography variant="h5" component={Link} href="/tabletop/magic-item" sx={{
                            color: "primary.dark", fontWeight: 600, textDecoration: "none",
                            "&:hover": { textDecoration: "underline" },
                        }}>
                            Magic Item Generator
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Draw a random magic item filtered by rarity and attunement requirement.
                    </Typography>
                </Box>

                {/* Loot Hoard Generator */}
                <Box sx={{ mb: 5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                        <Coins size={22} color="#8C5A3A" />
                        <Typography variant="h5" component={Link} href="/tabletop/loot" sx={{
                            color: "primary.dark", fontWeight: 600, textDecoration: "none",
                            "&:hover": { textDecoration: "underline" },
                        }}>
                            Loot Hoard Generator
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Generate currency and magic items for a treasure hoard by CR range.
                    </Typography>
                </Box>

                {/* NPC Generator */}
                <Box sx={{ mb: 5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                        <User size={22} color="#8C5A3A" />
                        <Typography variant="h5" component={Link} href="/tabletop/npc" sx={{
                            color: "primary.dark", fontWeight: 600, textDecoration: "none",
                            "&:hover": { textDecoration: "underline" },
                        }}>
                            NPC Generator
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Generate a random NPC with species, class, background, and personality.
                    </Typography>
                </Box>

                {/* Spell Scroll Generator */}
                <Box sx={{ mb: 5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                        <Wand2 size={22} color="#8C5A3A" />
                        <Typography variant="h5" component={Link} href="/tabletop/spell-scroll" sx={{
                            color: "primary.dark", fontWeight: 600, textDecoration: "none",
                            "&:hover": { textDecoration: "underline" },
                        }}>
                            Spell Scroll Generator
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Roll a random spell scroll filtered by level, school, or class.
                    </Typography>
                </Box>

                {/* Monster Creator */}
                <Box sx={{ mb: 5 }}>
                    <Typography variant="h5" component={Link} href="/create/monster" sx={{
                        color: "primary.dark", fontWeight: 600, textDecoration: "none",
                        "&:hover": { textDecoration: "underline" },
                    }}>
                        Monster Creator
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                        Build and save custom D&amp;D 5e monster statblocks. Supports bulk import from JSON.
                    </Typography>
                </Box>

                {/* 5.5e SRD Reference */}
                <Box sx={{ mb: 5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                        <BookOpen size={22} color="#8C5A3A" />
                        <Typography variant="h5" component={Link} href="/tabletop/srd" sx={{
                            color: "primary.dark", fontWeight: 600, textDecoration: "none",
                            "&:hover": { textDecoration: "underline" },
                        }}>
                            5.5e SRD Reference
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Searchable D&amp;D 2024 System Reference Document — monsters, spells, magic items, classes, and more.
                    </Typography>
                </Box>

                {/* Random Encounter Tables */}
                <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
                        <Dices size={22} color="#8C5A3A" />
                        <Typography variant="h5" component={Link} href="/tabletop/encounters" sx={{
                            color: "primary.dark", fontWeight: 600, textDecoration: "none",
                            "&:hover": { textDecoration: "underline" },
                        }}>
                            Random Encounter Tables
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                        d100 tables for generating encounters on the fly.
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pl: 1 }}>
                        {encounterTables.map(table => (
                            <Typography
                                key={table.slug}
                                variant="body2"
                                component={Link}
                                href={`/tabletop/encounters/${table.slug}`}
                                sx={{
                                    color: "primary.main",
                                    textDecoration: "none",
                                    "&:hover": { textDecoration: "underline" },
                                }}
                            >
                                {table.name} ({table.entries.length} entries)
                            </Typography>
                        ))}
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}
