"use client";

import { Box, Button, Container, Divider, Typography } from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Dices } from "lucide-react";
import type { EncounterTable } from "@/lib/encounterTables";

interface Props {
    tables: Pick<EncounterTable, "name" | "slug" | "entries">[];
}

export default function EncountersContent({ tables }: Props) {
    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button
                    component={Link}
                    href="/tabletop"
                    startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}
                >
                    Back
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                    <Dices size={32} color="#8C5A3A" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        Random Encounter Tables
                    </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 5 }}>
                    d100 tables for generating random encounters. Click a table to roll or browse entries.
                </Typography>

                <Divider sx={{ mb: 4 }} />

                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {tables.map(table => (
                        <Box
                            key={table.slug}
                            component={Link}
                            href={`/tabletop/encounters/${table.slug}`}
                            sx={{
                                display: "block",
                                p: 3,
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 2,
                                textDecoration: "none",
                                "&:hover": { borderColor: "primary.main", backgroundColor: "action.hover" },
                            }}
                        >
                            <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.dark", mb: 0.5 }}>
                                {table.name}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                {table.entries.length} entries &mdash; d100
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </Container>
        </Box>
    );
}
