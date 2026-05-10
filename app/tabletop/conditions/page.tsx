"use client";

import { useState, useEffect } from "react";
import {
    Box, Container, Button, Typography, Paper, Skeleton, Grid,
} from "@mui/material";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";

// ── Condition colors ──────────────────────────────────────────────────────────

const CONDITION_COLOR: Record<string, string> = {
    Blinded:       "#546e7a",
    Charmed:       "#880e4f",
    Deafened:      "#37474f",
    Exhaustion:    "#bf360c",
    Frightened:    "#e65100",
    Grappled:      "#4e342e",
    Incapacitated: "#616161",
    Invisible:     "#0277bd",
    Paralyzed:     "#b71c1c",
    Petrified:     "#78909c",
    Poisoned:      "#2e7d32",
    Prone:         "#795548",
    Restrained:    "#5d4037",
    Stunned:       "#6a1b9a",
    Unconscious:   "#1a1a2e",
};

// ── Description parser ────────────────────────────────────────────────────────

interface ParsedCondition {
    term: string;
    intro: string;
    sections: Array<{ heading: string; text: string }>;
}

function parseEntry(term: string, description: string): ParsedCondition {
    const parts = description.split(/\*\*_(.*?)_\*\*/g);
    const intro = parts[0].trim();
    const sections: Array<{ heading: string; text: string }> = [];
    for (let i = 1; i < parts.length; i += 2) {
        sections.push({ heading: parts[i].trim(), text: (parts[i + 1] ?? "").trim() });
    }
    return { term, intro, sections };
}

// ── Condition card ────────────────────────────────────────────────────────────

function ConditionCard({ condition }: { condition: ParsedCondition }) {
    const [expanded, setExpanded] = useState(false);
    const color = CONDITION_COLOR[condition.term] ?? "#607d8b";

    return (
        <Paper
            elevation={2}
            sx={{
                overflow: "hidden",
                borderTop: `4px solid ${color}`,
                cursor: "pointer",
                "&:hover": { boxShadow: 4 },
                transition: "box-shadow 0.15s",
                height: "100%",
            }}
            onClick={() => setExpanded((v) => !v)}
        >
            <Box sx={{ px: 2, pt: 1.5, pb: expanded ? 0.5 : 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color, fontSize: "0.95rem" }}>
                        {condition.term}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.7rem" }}>
                        {expanded ? "▲" : "▼"}
                    </Typography>
                </Box>

                {/* Always show the section headings as a quick summary */}
                {!expanded && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {condition.sections.map((s) => (
                            <Typography
                                key={s.heading}
                                variant="caption"
                                sx={{ color: "text.secondary", fontSize: "0.68rem", lineHeight: 1.4 }}
                            >
                                {s.heading.replace(/\.$/, "")}
                                {" · "}
                            </Typography>
                        ))}
                    </Box>
                )}

                {expanded && (
                    <Box sx={{ mt: 0.5, pb: 1.5 }}>
                        <Typography variant="body2" sx={{ color: "text.secondary", mb: 1, fontStyle: "italic", fontSize: "0.8rem" }}>
                            {condition.intro}
                        </Typography>
                        {condition.sections.map((s) => (
                            <Box key={s.heading} sx={{ mb: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color, fontSize: "0.8rem", mb: 0.25 }}>
                                    {s.heading}
                                </Typography>
                                <Typography variant="body2" sx={{ color: "text.primary", fontSize: "0.8rem", lineHeight: 1.6 }}>
                                    {s.text}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>
        </Paper>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ConditionsPage() {
    const [conditions, setConditions] = useState<ParsedCondition[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/5_5_SRD/rules_glossary.json")
            .then((r) => r.json())
            .then((data) => {
                const parsed: ParsedCondition[] = (data.entries ?? [])
                    .filter((e: any) => e.tag === "Condition")
                    .sort((a: any, b: any) => a.term.localeCompare(b.term))
                    .map((e: any) => parseEntry(e.term, e.description));
                setConditions(parsed);
                setLoading(false);
            });
    }, []);

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href="/tabletop" startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                    <ShieldAlert size={32} color="#8C5A3A" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        Conditions
                    </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    D&amp;D 2024 condition reference. Click a card to expand the full rules text.
                </Typography>

                {loading ? (
                    <Grid container spacing={2}>
                        {Array.from({ length: 12 }).map((_, i) => (
                            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                                <Skeleton variant="rectangular" height={90} sx={{ borderRadius: 1 }} />
                            </Grid>
                        ))}
                    </Grid>
                ) : (
                    <Grid container spacing={2}>
                        {conditions.map((c) => (
                            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={c.term}>
                                <ConditionCard condition={c} />
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Container>
        </Box>
    );
}
