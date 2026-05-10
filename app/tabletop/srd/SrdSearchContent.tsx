"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Box, Container, Button, Typography, TextField, Chip,
    Collapse, CircularProgress, Skeleton, InputAdornment, Divider,
} from "@mui/material";
import { Search, ArrowLeft, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

type SrdCategory =
    | "Monster" | "Spell" | "Magic Item" | "Weapon"
    | "Feat" | "Class" | "Species" | "Background" | "Rule";

interface SrdEntry {
    id: string;
    name: string;
    category: SrdCategory;
    meta: string;
    description: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CAT_COLOR: Record<SrdCategory, string> = {
    Monster:    "#c62828",
    Spell:      "#6a1b9a",
    "Magic Item": "#e65100",
    Weapon:     "#37474f",
    Feat:       "#2e7d32",
    Class:      "#0d47a1",
    Species:    "#00695c",
    Background: "#4e342e",
    Rule:       "#424242",
};

const ALL_CATEGORIES: Array<"All" | SrdCategory> = [
    "All", "Monster", "Spell", "Magic Item", "Weapon",
    "Feat", "Class", "Species", "Background", "Rule",
];

// ── Utilities ────────────────────────────────────────────────────────────────

function formatCR(cr: number): string {
    if (cr === 0) return "0";
    if (cr <= 0.13) return "1/8";
    if (cr <= 0.26) return "1/4";
    if (cr <= 0.51) return "1/2";
    return Number.isInteger(cr) ? String(cr) : String(Math.round(cr));
}

function sign(n: number): string {
    return n >= 0 ? `+${n}` : String(n);
}

// ── Data processors ──────────────────────────────────────────────────────────

function buildMonsterDesc(m: any): string {
    const parts: string[] = [];

    const speeds = Object.entries(m.speed || {}).map(([k, v]) =>
        k === "walk" ? `${v} ft.` : `${k} ${v} ft.`
    );
    if (speeds.length) parts.push(`**Speed:** ${speeds.join(", ")}`);

    parts.push(
        `STR ${m.strength} (${sign(m.strength_mod)})  DEX ${m.dexterity} (${sign(m.dexterity_mod)})  CON ${m.constitution} (${sign(m.constitution_mod)})  ` +
        `INT ${m.intelligence} (${sign(m.intelligence_mod)})  WIS ${m.wisdom} (${sign(m.wisdom_mod)})  CHA ${m.charisma} (${sign(m.charisma_mod)})`
    );

    const senses: string[] = [];
    if (m.senses?.darkvision) senses.push(`Darkvision ${m.senses.darkvision} ft.`);
    if (m.senses?.passive_perception != null) senses.push(`Passive Perception ${m.senses.passive_perception}`);
    if (senses.length) parts.push(`**Senses:** ${senses.join(", ")}`);

    if (m.languages?.length) parts.push(`**Languages:** ${m.languages.join(", ")}`);

    const resList: string[] = [];
    if (m.damage_resistances?.length) resList.push(`Resistances: ${m.damage_resistances.join(", ")}`);
    if (m.damage_immunities?.length) resList.push(`Immunities: ${m.damage_immunities.join(", ")}`);
    if (m.damage_vulnerabilities?.length) resList.push(`Vulnerabilities: ${m.damage_vulnerabilities.join(", ")}`);
    if (resList.length) parts.push(resList.join(" | "));

    const sections: [keyof any, string][] = [
        ["traits", "Traits"],
        ["actions", "Actions"],
        ["bonus_actions", "Bonus Actions"],
        ["reactions", "Reactions"],
        ["legendary_actions", "Legendary Actions"],
    ];
    for (const [key, label] of sections) {
        const items = m[key as string];
        if (items?.length) {
            if (key !== "traits") parts.push(`**${label}**`);
            items.forEach((t: any) => parts.push(`**${t.name}.** ${t.desc}`));
        }
    }

    return parts.join("\n\n");
}

function processMonsters(data: any): SrdEntry[] {
    const list: any[] = data.monsters ?? data.animals ?? [];
    return list.map((m) => ({
        id: `monster-${m.name}`,
        name: m.name,
        category: "Monster" as SrdCategory,
        meta: `CR ${formatCR(m.cr)} | ${m.size} ${m.type}${m.subtype ? ` (${m.subtype})` : ""} | HP ${m.hit_points} | AC ${m.armor_class}`,
        description: buildMonsterDesc(m),
    }));
}

function processSpells(data: any): SrdEntry[] {
    return (data.spells ?? []).map((s: any) => {
        const comps: string[] = [];
        if (s.components?.verbal) comps.push("V");
        if (s.components?.somatic) comps.push("S");
        if (s.components?.has_material) comps.push(`M (${s.components.material})`);

        let desc =
            `**Casting Time:** ${s.casting_time?.raw ?? ""}${s.casting_time?.ritual ? " (Ritual)" : ""}\n` +
            `**Range:** ${s.range ?? "—"}\n` +
            `**Components:** ${comps.join(", ") || "—"}\n` +
            `**Duration:** ${s.duration?.raw ?? ""}${s.duration?.concentration ? " (Concentration)" : ""}\n\n` +
            (s.description ?? "");
        if (s.upcast) desc += `\n\n${s.upcast}`;

        return {
            id: `spell-${s.name}`,
            name: s.name,
            category: "Spell" as SrdCategory,
            meta: `${s.level === 0 ? "Cantrip" : `Level ${s.level}`} | ${s.school} | ${(s.classes ?? []).join(", ")}`,
            description: desc,
        };
    });
}

function processMagicItems(data: any): SrdEntry[] {
    return (data.items ?? []).map((item: any) => {
        let meta = `${item.rarity} | ${item.type}`;
        if (item.requires_attunement) {
            meta += ` | Requires Attunement${item.attunement_note ? ` (${item.attunement_note})` : ""}`;
        }
        return {
            id: `magic-item-${item.name}`,
            name: item.name,
            category: "Magic Item" as SrdCategory,
            meta,
            description: item.description ?? "",
        };
    });
}

function processWeapons(data: any): SrdEntry[] {
    return (data.weapons ?? []).map((w: any) => {
        const costStr = w.cost?.gp ? ` | ${w.cost.gp} gp` : "";
        return {
            id: `weapon-${w.name}`,
            name: w.name,
            category: "Weapon" as SrdCategory,
            meta: `${w.combat_type ?? ""} ${w.category ?? ""} | ${w.damage_dice ?? ""} ${w.damage_type ?? ""}${costStr}`.trim(),
            description: [
                w.properties?.length ? `**Properties:** ${w.properties.join(", ")}` : "",
                w.mastery ? `**Mastery:** ${w.mastery}` : "",
                w.weight ? `**Weight:** ${w.weight} lb.` : "",
            ].filter(Boolean).join("\n\n"),
        };
    });
}

function processFeats(data: any): SrdEntry[] {
    return (data.feats ?? []).map((f: any) => {
        let desc = f.description ?? "";
        if (f.benefits) {
            desc += "\n\n" + Object.entries(f.benefits).map(([k, v]) => `**${k}.** ${v}`).join("\n\n");
        }
        return {
            id: `feat-${f.name}`,
            name: f.name,
            category: "Feat" as SrdCategory,
            meta: [
                f.category,
                f.prerequisites ? `Prereq: ${f.prerequisites}` : "",
                f.repeatable ? "Repeatable" : "",
            ].filter(Boolean).join(" | "),
            description: desc,
        };
    });
}

function processClasses(data: any): SrdEntry[] {
    return (data.classes ?? []).map((c: any) => {
        const traits = Object.entries(c.core_traits ?? {})
            .map(([k, v]) => `**${k}:** ${v}`)
            .join("\n");

        let featureText = "";
        if (c.feature_table?.length) {
            const lines = (c.feature_table as any[])
                .filter((row) => row.features?.length)
                .map((row) => `Level ${row.level}: ${row.features.join(", ")}`);
            if (lines.length) featureText = "\n\n**Features:**\n" + lines.join("\n");
        }

        return {
            id: `class-${c.name}`,
            name: c.name,
            category: "Class" as SrdCategory,
            meta: c.is_spellcaster
                ? `Spellcaster | ${c.spellcasting_ability ?? "—"}`
                : "Non-Spellcaster",
            description: traits + featureText,
        };
    });
}

function processSpecies(data: any): SrdEntry[] {
    return (data.species ?? []).map((s: any) => {
        const traitText = Object.entries(s.traits ?? {})
            .map(([k, v]) => `**${k}.** ${v}`)
            .join("\n\n");
        return {
            id: `species-${s.name}`,
            name: s.name,
            category: "Species" as SrdCategory,
            meta: "Species",
            description: (s.description ? s.description + "\n\n" : "") + traitText,
        };
    });
}

function processBackgrounds(data: any): SrdEntry[] {
    return (data.backgrounds ?? []).map((b: any) => {
        const skills = Array.isArray(b.skill_proficiencies)
            ? b.skill_proficiencies.join(", ")
            : (b.skill_proficiencies ?? "—");
        return {
            id: `background-${b.name}`,
            name: b.name,
            category: "Background" as SrdCategory,
            meta: `Skills: ${skills}`,
            description: [
                b.ability_scores ? `**Ability Score Increases:** ${b.ability_scores}` : "",
                b.feat ? `**Feat:** ${b.feat}` : "",
                b.skill_proficiencies ? `**Skill Proficiencies:** ${skills}` : "",
                b.tool_proficiency ? `**Tool Proficiency:** ${b.tool_proficiency}` : "",
                b.equipment ? `**Equipment:** ${b.equipment}` : "",
            ].filter(Boolean).join("\n\n"),
        };
    });
}

function processRules(data: any): SrdEntry[] {
    return (data.entries ?? []).map((r: any) => ({
        id: `rule-${r.term}`,
        name: r.term,
        category: "Rule" as SrdCategory,
        meta: r.tag ?? "Rule",
        description: (r.description ?? "") + (r.see_also ? `\n\n*See also: ${r.see_also}*` : ""),
    }));
}

// ── Sub-components ───────────────────────────────────────────────────────────

function DescText({ text }: { text: string }) {
    return (
        <Box>
            {text.split("\n\n").map((para, i) => (
                <Typography key={i} variant="body2" sx={{ mb: 0.75, lineHeight: 1.65 }}>
                    {para.split(/\*\*(.*?)\*\*/g).map((part, j) =>
                        j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                    )}
                </Typography>
            ))}
        </Box>
    );
}

function ResultCard({ entry }: { entry: SrdEntry }) {
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
                    <DescText text={entry.description} />
                </Box>
            </Collapse>
        </Box>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

const SOURCES: Array<[string, (d: any) => SrdEntry[]]> = [
    ["/5_5_SRD/monsters.json",      processMonsters],
    ["/5_5_SRD/animals.json",       processMonsters],
    ["/5_5_SRD/spells.json",        processSpells],
    ["/5_5_SRD/magic_items.json",   processMagicItems],
    ["/5_5_SRD/equipment.json",     processWeapons],
    ["/5_5_SRD/feats.json",         processFeats],
    ["/5_5_SRD/classes.json",       processClasses],
    ["/5_5_SRD/species.json",       processSpecies],
    ["/5_5_SRD/backgrounds.json",   processBackgrounds],
    ["/5_5_SRD/rules_glossary.json", processRules],
];

export default function SrdSearchContent() {
    const [entries, setEntries] = useState<SrdEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState<"All" | SrdCategory>("All");

    useEffect(() => {
        Promise.all(
            SOURCES.map(([url, fn]) =>
                fetch(url).then((r) => r.json()).then(fn).catch(() => [] as SrdEntry[])
            )
        ).then((results) => {
            setEntries(results.flat());
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
                const rank = (e: SrdEntry) =>
                    e.name.toLowerCase().includes(q) ? 0
                    : e.meta.toLowerCase().includes(q) ? 1
                    : 2;
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
                    <BookOpen size={32} color="#8C5A3A" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        5.5e SRD Reference
                    </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    Search the D&amp;D 2024 System Reference Document.
                    {!loading && ` ${entries.length.toLocaleString()} entries indexed.`}
                </Typography>

                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search monsters, spells, items, rules…"
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
                                        backgroundColor: CAT_COLOR[cat as SrdCategory],
                                        color: "#fff",
                                        "&:hover": { backgroundColor: CAT_COLOR[cat as SrdCategory] },
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
                        Search or select a category to explore the SRD.
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
                            <ResultCard key={entry.id} entry={entry} />
                        ))}
                    </>
                )}
            </Container>
        </Box>
    );
}
