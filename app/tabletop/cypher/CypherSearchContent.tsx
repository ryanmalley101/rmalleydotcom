"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Box, Container, Button, Typography, TextField, Chip,
    Collapse, CircularProgress, Skeleton, InputAdornment, Divider,
} from "@mui/material";
import { Search, ArrowLeft, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

type CypherCategory =
    | "Ability" | "Character Arc" | "Creature" | "Cypher" | "Descriptor"
    | "Flavor" | "Focus" | "Mutation" | "NPC" | "Rule" | "Type" | "Glossary" | "Vehicle";

interface CypherEntry {
    id: string;
    name: string;
    category: CypherCategory;
    meta: string;
    description: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CAT_COLOR: Record<CypherCategory, string> = {
    Ability:         "#9a3412",
    "Character Arc": "#92400e",
    Creature:        "#7c2d12",
    Cypher:          "#b45309",
    Descriptor:      "#15803d",
    Flavor:          "#065f46",
    Focus:           "#1d4ed8",
    Mutation:        "#6d28d9",
    NPC:             "#7e22ce",
    Rule:            "#0e7490",
    Type:            "#0f766e",
    Glossary:        "#374151",
    Vehicle:         "#1e3a5f",
};

const ALL_CATEGORIES: Array<"All" | CypherCategory> = [
    "All", "Ability", "Character Arc", "Creature", "Cypher", "Descriptor",
    "Flavor", "Focus", "Mutation", "NPC", "Rule", "Type", "Vehicle", "Glossary",
];

// ── Data processors ──────────────────────────────────────────────────────────

function processAbilities(data: any[]): CypherEntry[] {
    // ability-mutation-* IDs are also in mutations.json — skip them here to avoid duplicates
    return data
        .filter((a) => !a.id.startsWith("ability-mutation-"))
        .map((a) => ({
            id: a.id,
            name: a.name,
            category: "Ability" as CypherCategory,
            meta: a.cost ? `Cost: ${a.cost}` : "Enabler / No cost",
            description: a.description ?? "",
        }));
}

function processCreatures(data: any[], category: CypherCategory): CypherEntry[] {
    return data.map((c) => {
        const parts: string[] = [];
        if (c.description) parts.push(c.description);
        if (c.motive) parts.push(`**Motive:** ${c.motive}`);
        if (c.environment) parts.push(`**Environment:** ${c.environment}`);
        if (c.combat) parts.push(`**Combat:** ${c.combat}`);
        if (c.interaction) parts.push(`**Interaction:** ${c.interaction}`);
        if (c.uses) parts.push(`**Uses:** ${c.uses}`);
        if (c.loot) parts.push(`**Loot:** ${c.loot}`);
        if (c.gm_intrusion) parts.push(`**GM Intrusion:** ${c.gm_intrusion}`);

        const metaParts: string[] = [];
        if (c.level != null) metaParts.push(`Level ${c.level} (TN ${c.target_number ?? c.level * 3})`);
        if (c.health) metaParts.push(`HP ${c.health}`);
        if (c.damage_inflicted) metaParts.push(`Dmg ${c.damage_inflicted}`);
        if (c.armor) metaParts.push(`Armor ${c.armor}`);
        if (c.movement) metaParts.push(`Move: ${c.movement}`);

        return {
            id: c.id,
            name: c.name,
            category,
            meta: metaParts.join(" | "),
            description: parts.join("\n\n"),
        };
    });
}

function processCyphers(data: any[]): CypherEntry[] {
    return data.map((c) => {
        const parts: string[] = [];
        if (c.effect) parts.push(c.effect);
        if (c.options) parts.push(`**Options:** ${c.options}`);

        return {
            id: c.id,
            name: c.name,
            category: "Cypher" as CypherCategory,
            meta: [
                c.type ? c.type.charAt(0).toUpperCase() + c.type.slice(1) : "",
                c.level ? `Level ${c.level}` : "",
                c.form || "",
            ].filter(Boolean).join(" | "),
            description: parts.join("\n\n"),
        };
    });
}

function processDescriptors(data: any[]): CypherEntry[] {
    return data.map((d) => {
        const parts: string[] = [];
        if (d.description) parts.push(d.description);
        if (d.characteristics?.length) {
            parts.push("**Characteristics:**\n" + d.characteristics.join("\n"));
        }
        if (d.initial_links?.length) {
            parts.push("**Initial Links:**\n" + d.initial_links.map((l: string, i: number) => `${i + 1}. ${l}`).join("\n"));
        }
        return {
            id: d.id,
            name: d.name,
            category: "Descriptor" as CypherCategory,
            meta: "Descriptor",
            description: parts.join("\n\n"),
        };
    });
}

function processFoci(data: any[]): CypherEntry[] {
    return data.map((f) => {
        const parts: string[] = [];
        if (f.description) parts.push(f.description);
        if (f.tier_abilities?.length) {
            const grouped: Record<number, string[]> = {};
            for (const ta of f.tier_abilities) {
                if (!grouped[ta.tier]) grouped[ta.tier] = [];
                grouped[ta.tier].push(ta.abilities);
            }
            const tiers = Object.entries(grouped)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([tier, abs]) => `**Tier ${tier}:** ${abs.join("; ")}`);
            parts.push(tiers.join("\n"));
        }
        if (f.gm_intrusion) parts.push(`**GM Intrusion:** ${f.gm_intrusion}`);
        return {
            id: f.id,
            name: f.name,
            category: "Focus" as CypherCategory,
            meta: "Focus",
            description: parts.join("\n\n"),
        };
    });
}

function processTypes(data: any[]): CypherEntry[] {
    return data.map((t) => ({
        id: t.id,
        name: t.name,
        category: "Type" as CypherCategory,
        meta: "Character Type",
        description: t.description ?? "",
    }));
}

function buildRuleDesc(text: string, bullets: any[]): string {
    const parts: string[] = [];
    if (text) parts.push(text);
    if (bullets?.length) {
        const lines = bullets
            .filter((b: any) => b.text)
            .map((b: any) => b.name ? `**${b.name}.** ${b.text}` : b.text);
        if (lines.length) parts.push(lines.join("\n\n"));
    }
    return parts.join("\n\n");
}

function processRules(data: any[], defaultMeta = ""): CypherEntry[] {
    // Build an ID map so parent entries can detect where their intro ends and child content begins
    const byId = new Map<string, any>(data.map((r: any) => [r.id, r]));

    return data.map((r) => {
        let text: string = r.text || "";
        let bullets: any[] = r.bullets ?? [];

        if (r.subsections?.length && text) {
            // Find the earliest position where a child's text appears inside the parent blob
            let cutAt = text.length;
            for (const sub of r.subsections) {
                const child = byId.get(sub.id);
                if (child?.text?.length > 30) {
                    const probe = child.text.slice(0, 50);
                    const idx = text.indexOf(probe);
                    if (idx > 0 && idx < cutAt) cutAt = idx;
                }
            }
            if (cutAt < text.length) {
                text = text.slice(0, cutAt).trim();
                // Bullets following the cut point belong to subsections — drop them
                bullets = [];
            }
        }

        return {
            id: r.id,
            name: r.name,
            category: "Rule" as CypherCategory,
            meta: [r.chapter, r.category].filter(Boolean).join(" — ") || defaultMeta,
            description: buildRuleDesc(text, bullets),
        };
    });
}

function processGenreRules(data: any[]): CypherEntry[] {
    const entries: CypherEntry[] = [];
    for (const g of data) {
        for (const r of (g.rules ?? [])) {
            entries.push({
                id: r.id,
                name: r.name,
                category: "Rule" as CypherCategory,
                meta: `${g.genre} Genre`,
                description: buildRuleDesc(r.text || "", r.bullets ?? []),
            });
        }
    }
    return entries;
}

function processFlavors(data: any[]): CypherEntry[] {
    return data.map((f) => {
        const parts: string[] = [];
        if (f.description) parts.push(f.description);
        if (f.tiers) {
            const tierLines = Object.entries(f.tiers)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([tier, abilities]) => `**Tier ${tier}:** ${(abilities as string[]).join(", ")}`);
            parts.push(tierLines.join("\n"));
        }
        return {
            id: f.id,
            name: f.name,
            category: "Flavor" as CypherCategory,
            meta: "Flavor",
            description: parts.join("\n\n"),
        };
    });
}

function processCharacterArcs(data: any[]): CypherEntry[] {
    return data.map((a) => {
        const parts: string[] = [];
        if (a.description) parts.push(a.description);
        if (a.steps?.length) {
            parts.push(a.steps.map((s: any) => `**${s.name}:** ${s.text}`).join("\n\n"));
        }
        if (a.notes?.length) {
            parts.push(a.notes.join("\n\n"));
        }
        return {
            id: a.id,
            name: a.name,
            category: "Character Arc" as CypherCategory,
            meta: "Character Arc",
            description: parts.join("\n\n"),
        };
    });
}

function processVehicles(data: any[]): CypherEntry[] {
    return data.map((v) => {
        const parts: string[] = [];
        if (v.description) parts.push(v.description);
        if (v.details) parts.push(v.details);
        if (v.modifications) parts.push(`**Modifications:** ${v.modifications}`);

        const metaParts: string[] = [];
        if (v.level != null) metaParts.push(`Level ${v.level}`);
        if (v.price) metaParts.push(v.price);
        if (v.health) metaParts.push(`HP ${v.health}`);
        if (v.armor) metaParts.push(`Armor ${v.armor}`);
        if (v.movement) metaParts.push(`Move: ${v.movement}`);

        return {
            id: v.id,
            name: v.name,
            category: "Vehicle" as CypherCategory,
            meta: metaParts.join(" | "),
            description: parts.join("\n\n"),
        };
    });
}

function processMutations(data: any[]): CypherEntry[] {
    return data.map((m) => {
        let name = m.name;
        if (!name) {
            const prefix = `ability-mutation-${m.category}-`;
            const slug = m.id.startsWith(prefix) ? m.id.slice(prefix.length) : m.id;
            name = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        }
        return {
            id: m.id,
            name,
            category: "Mutation" as CypherCategory,
            meta: m.category
                ? m.category.charAt(0).toUpperCase() + m.category.slice(1) + " Mutation"
                : "Mutation",
            description: m.description ?? "",
        };
    });
}

function processGlossary(data: any[]): CypherEntry[] {
    return data.map((g) => ({
        id: `glossary-${g.term}`,
        name: g.term,
        category: "Glossary" as CypherCategory,
        meta: "Glossary Term",
        description: g.definition ?? "",
    }));
}

// ── Sub-components ───────────────────────────────────────────────────────────

function highlight(text: string, query: string): React.ReactNode {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    if (parts.length === 1) return text;
    return parts.map((part, i) =>
        i % 2 === 1
            ? <mark key={i} style={{ backgroundColor: "#fde68a", borderRadius: 2, padding: "0 1px", fontWeight: 700 }}>{part}</mark>
            : part
    );
}

function DescText({ text, query }: { text: string; query: string }) {
    return (
        <Box>
            {text.split("\n\n").map((para, i) => (
                <Typography key={i} variant="body2" sx={{ mb: 0.75, lineHeight: 1.65, whiteSpace: "pre-line" }}>
                    {para.split(/\*\*(.*?)\*\*/g).map((part, j) =>
                        j % 2 === 1
                            ? <strong key={j}>{highlight(part, query)}</strong>
                            : highlight(part, query)
                    )}
                </Typography>
            ))}
        </Box>
    );
}

function ResultCard({ entry, query }: { entry: CypherEntry; query: string }) {
    const [expanded, setExpanded] = useState(false);
    const color = CAT_COLOR[entry.category];

    return (
        <Box
            sx={{
                borderLeft: `4px solid ${color}`,
                borderRadius: "4px 8px 8px 4px",
                backgroundColor: "background.paper",
                boxShadow: 1,
                overflow: "hidden",
                mb: 1.5,
            }}
        >
            <Box
                sx={{ p: 2, cursor: "pointer", "&:hover": { backgroundColor: "action.hover" } }}
                onClick={() => setExpanded((e) => !e)}
            >
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, justifyContent: "space-between" }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem", color: "text.primary" }}>
                                {entry.name}
                            </Typography>
                            <Chip
                                label={entry.category}
                                size="small"
                                sx={{
                                    backgroundColor: color,
                                    color: "#fff",
                                    fontWeight: 600,
                                    fontSize: "0.7rem",
                                    height: 20,
                                    "& .MuiChip-label": { px: 1 },
                                }}
                            />
                        </Box>
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                            {entry.meta}
                        </Typography>
                    </Box>
                    <Box sx={{ color: "text.secondary", flexShrink: 0, mt: 0.25 }}>
                        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </Box>
                </Box>
            </Box>
            <Collapse in={expanded}>
                <Divider />
                <Box sx={{ p: 2, pt: 1.5, backgroundColor: "background.default" }}>
                    <DescText text={entry.description} query={query} />
                    {entry.category !== "Glossary" && entry.category !== "Type" && (
                        <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mt: 1 }}>
                            {/* source field rendered as caption when present */}
                        </Typography>
                    )}
                </Box>
            </Collapse>
        </Box>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

const SOURCES: Array<[string, (d: any) => CypherEntry[]]> = [
    ["/Cypher_SRD/abilities.json",   (d) => processAbilities(d)],
    ["/Cypher_SRD/creatures.json",   (d) => processCreatures(d, "Creature")],
    ["/Cypher_SRD/cyphers.json",     (d) => processCyphers(d)],
    ["/Cypher_SRD/descriptors.json", (d) => processDescriptors(d)],
    ["/Cypher_SRD/foci.json",        (d) => processFoci(d)],
    ["/Cypher_SRD/npcs.json",        (d) => processCreatures(d, "NPC")],
    ["/Cypher_SRD/types.json",          (d) => processTypes(d)],
    ["/Cypher_SRD/rules.json",          (d) => processRules(d)],
    ["/Cypher_SRD/optional_rules.json", (d) => processRules(d, "Optional Rule")],
    ["/Cypher_SRD/genres.json",         (d) => processGenreRules(d)],
    ["/Cypher_SRD/flavors.json",        (d) => processFlavors(d)],
    ["/Cypher_SRD/character_arcs.json", (d) => processCharacterArcs(d)],
    ["/Cypher_SRD/vehicles.json",       (d) => processVehicles(d)],
    ["/Cypher_SRD/mutations.json",      (d) => processMutations(d)],
    ["/Cypher_SRD/glossary.json",       (d) => processGlossary(d)],
];

export default function CypherSearchContent() {
    const [entries, setEntries] = useState<CypherEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState<"All" | CypherCategory>("All");

    useEffect(() => {
        Promise.all(
            SOURCES.map(([url, fn]) =>
                fetch(url).then((r) => r.json()).then(fn).catch(() => [] as CypherEntry[])
            )
        ).then((results) => {
            // Deduplicate by ID — later sources (e.g. mutations.json) take precedence over earlier ones
            const seen = new Map<string, CypherEntry>();
            for (const entry of results.flat()) {
                seen.set(entry.id, entry);
            }
            setEntries(Array.from(seen.values()));
            setLoading(false);
        });
    }, []);

    const results = useMemo(() => {
        const q = query.toLowerCase().trim();
        if (!q && category === "All") return [];

        const filtered = entries.filter((e) => {
            if (category !== "All" && e.category !== category) return false;
            if (!q) return true;
            return (
                e.name.toLowerCase().includes(q) ||
                e.meta.toLowerCase().includes(q) ||
                e.description.toLowerCase().includes(q)
            );
        });

        if (q) {
            filtered.sort((a, b) => {
                const rank = (e: CypherEntry) => {
                    // Genre-specific entries (meta ends in "Genre") are deprioritised
                    const genrePenalty = e.meta.endsWith("Genre") ? 10 : 0;
                    const relevance =
                        e.name.toLowerCase().includes(q) ? 0
                        : e.meta.toLowerCase().includes(q) ? 1
                        : 2;
                    return genrePenalty + relevance;
                };
                const diff = rank(a) - rank(b);
                return diff !== 0 ? diff : a.name.localeCompare(b.name);
            });
        }

        return filtered;
    }, [entries, query, category]);

    const shown = results.slice(0, 100);
    const hasFilter = query.trim() !== "" || category !== "All";

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
                    <BookOpen size={32} color="#9a3412" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        Cypher System SRD
                    </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    Search the Cypher System Reference Document — abilities, creatures, cyphers, descriptors, foci, and more.
                    {!loading && ` ${entries.length.toLocaleString()} entries indexed.`}
                </Typography>

                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search abilities, creatures, cyphers, foci…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={loading}
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    {loading
                                        ? <CircularProgress size={18} />
                                        : <Search size={18} />}
                                </InputAdornment>
                            ),
                        },
                    }}
                    sx={{ mb: 2 }}
                />

                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 4 }}>
                    {ALL_CATEGORIES.map((cat) => (
                        <Chip
                            key={cat}
                            label={cat}
                            onClick={() => setCategory(cat)}
                            variant={category === cat ? "filled" : "outlined"}
                            sx={
                                category === cat && cat !== "All"
                                    ? {
                                        backgroundColor: CAT_COLOR[cat as CypherCategory],
                                        color: "#fff",
                                        "&:hover": { backgroundColor: CAT_COLOR[cat as CypherCategory] },
                                    }
                                    : {}
                            }
                        />
                    ))}
                </Box>

                {loading ? (
                    [1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} variant="rectangular" height={72} sx={{ borderRadius: 1, mb: 1.5 }} />
                    ))
                ) : !hasFilter ? (
                    <Typography sx={{ color: "text.secondary", textAlign: "center", py: 8 }}>
                        Search or select a category to explore the Cypher System SRD.
                    </Typography>
                ) : shown.length === 0 ? (
                    <Typography sx={{ color: "text.secondary", textAlign: "center", py: 8 }}>
                        No results found.
                    </Typography>
                ) : (
                    <>
                        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                            Showing {shown.length} of {results.length} results
                            {results.length > 100 ? " — refine your search to see more" : ""}
                        </Typography>
                        {shown.map((entry) => (
                            <ResultCard key={entry.id} entry={entry} query={query.trim()} />
                        ))}
                    </>
                )}
            </Container>
        </Box>
    );
}
