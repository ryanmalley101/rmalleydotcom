"use client";

import { Fragment, useState, useEffect, useMemo } from "react";
import {
    Box, Container, Button, Typography, Select, MenuItem,
    FormControl, InputLabel, Paper, Divider, Chip,
} from "@mui/material";
import { ArrowLeft, Wand2, Dices } from "lucide-react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface Spell {
    name: string;
    level: number;
    school: string;
    classes: string[];
    casting_time: { raw: string; ritual: boolean };
    range: string;
    components: { verbal: boolean; somatic: boolean; has_material: boolean; material: string | null };
    duration: { raw: string; concentration: boolean };
    description: string;
    upcast?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const LEVEL_LABELS = ["Cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
const SCHOOLS = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];
const CLASSES = ["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];

const RARITY: Array<{ label: string; color: string }> = [
    { label: "Common",    color: "#607d8b" }, // 0
    { label: "Common",    color: "#607d8b" }, // 1
    { label: "Uncommon",  color: "#2e7d32" }, // 2
    { label: "Uncommon",  color: "#2e7d32" }, // 3
    { label: "Rare",      color: "#1565c0" }, // 4
    { label: "Rare",      color: "#1565c0" }, // 5
    { label: "Very Rare", color: "#6a1b9a" }, // 6
    { label: "Very Rare", color: "#6a1b9a" }, // 7
    { label: "Legendary", color: "#b71c1c" }, // 8
    { label: "Legendary", color: "#b71c1c" }, // 9
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatComponents(c: Spell["components"]): string {
    const parts: string[] = [];
    if (c.verbal) parts.push("V");
    if (c.somatic) parts.push("S");
    if (c.has_material) parts.push(`M (${c.material})`);
    return parts.join(", ") || "—";
}

function levelDisplay(level: number): string {
    if (level === 0) return "Cantrip";
    return `${LEVEL_LABELS[level]}-Level Spell`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SpellScrollPage() {
    const [spells, setSpells] = useState<Spell[]>([]);
    const [loading, setLoading] = useState(true);
    const [level, setLevel] = useState<number | "any">("any");
    const [school, setSchool] = useState("any");
    const [cls, setCls] = useState("any");
    const [result, setResult] = useState<Spell | null>(null);
    const [hasRolled, setHasRolled] = useState(false);

    useEffect(() => {
        fetch("/5_5_SRD/spells.json")
            .then((r) => r.json())
            .then((data) => {
                setSpells(data.spells ?? []);
                setLoading(false);
            });
    }, []);

    const pool = useMemo(() =>
        spells.filter((s) => {
            if (level !== "any" && s.level !== level) return false;
            if (school !== "any" && s.school !== school) return false;
            if (cls !== "any" && !s.classes.includes(cls)) return false;
            return true;
        }),
        [spells, level, school, cls]
    );

    function roll() {
        if (!pool.length) return;
        setResult(pool[Math.floor(Math.random() * pool.length)]);
        setHasRolled(true);
    }

    const rarity = result ? RARITY[result.level] : null;

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="sm">
                <Button
                    component={Link}
                    href="/tabletop"
                    startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}
                >
                    Back
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                    <Wand2 size={32} color="#8C5A3A" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        Spell Scroll
                    </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    Generate a random spell scroll. Leave filters as &ldquo;Any&rdquo; to draw from the full pool.
                </Typography>

                {/* Filters */}
                <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
                    <FormControl size="small" sx={{ minWidth: 110 }}>
                        <InputLabel>Level</InputLabel>
                        <Select
                            value={level}
                            label="Level"
                            onChange={(e) => setLevel(e.target.value as number | "any")}
                            disabled={loading}
                        >
                            <MenuItem value="any">Any</MenuItem>
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => (
                                <MenuItem key={l} value={l}>
                                    {LEVEL_LABELS[l]}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>School</InputLabel>
                        <Select
                            value={school}
                            label="School"
                            onChange={(e) => setSchool(e.target.value)}
                            disabled={loading}
                        >
                            <MenuItem value="any">Any</MenuItem>
                            {SCHOOLS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 130 }}>
                        <InputLabel>Class</InputLabel>
                        <Select
                            value={cls}
                            label="Class"
                            onChange={(e) => setCls(e.target.value)}
                            disabled={loading}
                        >
                            <MenuItem value="any">Any</MenuItem>
                            {CLASSES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 5 }}>
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<Dices size={20} />}
                        onClick={roll}
                        disabled={loading || pool.length === 0}
                        sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" } }}
                    >
                        Roll Scroll
                    </Button>
                    {!loading && (
                        <Typography variant="body2" sx={{ color: pool.length === 0 ? "error.main" : "text.secondary" }}>
                            {pool.length} spell{pool.length !== 1 ? "s" : ""} in pool
                        </Typography>
                    )}
                </Box>

                {/* Scroll result */}
                {hasRolled && result && rarity && (
                    <Paper
                        key={result.name + Date.now()}
                        elevation={6}
                        sx={{
                            backgroundColor: "#F5E6C8",
                            border: "2px solid #8C5A3A",
                            borderRadius: 2,
                            overflow: "hidden",
                        }}
                    >
                        {/* Header band */}
                        <Box
                            sx={{
                                backgroundColor: "#8C5A3A",
                                px: 3, py: 1.5,
                                textAlign: "center",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 0.75,
                            }}
                        >
                            <Typography
                                variant="overline"
                                sx={{ color: "#F5E6C8", letterSpacing: 4, fontSize: "0.65rem", lineHeight: 1 }}
                            >
                                Spell Scroll
                            </Typography>
                            <Chip
                                label={rarity.label}
                                size="small"
                                sx={{
                                    backgroundColor: rarity.color,
                                    color: "#fff",
                                    fontWeight: 700,
                                    fontSize: "0.7rem",
                                    height: 20,
                                    "& .MuiChip-label": { px: 1 },
                                }}
                            />
                        </Box>

                        <Box sx={{ px: 4, py: 3 }}>
                            {/* Spell name */}
                            <Typography
                                variant="h4"
                                sx={{
                                    fontWeight: 800,
                                    color: "#3E1F00",
                                    textAlign: "center",
                                    letterSpacing: 3,
                                    textTransform: "uppercase",
                                    mb: 0.75,
                                }}
                            >
                                {result.name}
                            </Typography>

                            <Typography
                                variant="body2"
                                sx={{ color: "#6B3A1F", textAlign: "center", mb: 1.5, fontStyle: "italic" }}
                            >
                                {levelDisplay(result.level)}
                                {" • "}
                                {result.school}
                                {result.casting_time.ritual ? " • Ritual" : ""}
                            </Typography>

                            <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 0.5, mb: 2 }}>
                                {result.classes.map((c) => (
                                    <Chip
                                        key={c}
                                        label={c}
                                        size="small"
                                        sx={{
                                            backgroundColor: "#8C5A3A22",
                                            color: "#3E1F00",
                                            fontSize: "0.68rem",
                                            height: 20,
                                            border: "1px solid #8C5A3A66",
                                            "& .MuiChip-label": { px: 1 },
                                        }}
                                    />
                                ))}
                            </Box>

                            <Divider sx={{ borderColor: "#8C5A3A55", mb: 2 }} />

                            {/* Stats */}
                            <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 3, rowGap: 0.75, mb: 2 }}>
                                {[
                                    ["Casting Time", result.casting_time.raw],
                                    ["Range",        result.range],
                                    ["Components",   formatComponents(result.components)],
                                    ["Duration",     result.duration.raw + (result.duration.concentration ? " (Concentration)" : "")],
                                ].map(([label, value]) => (
                                    <Fragment key={label}>
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: "#6B3A1F", whiteSpace: "nowrap" }}>
                                            {label}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: "#3E1F00" }}>
                                            {value}
                                        </Typography>
                                    </Fragment>
                                ))}
                            </Box>

                            <Divider sx={{ borderColor: "#8C5A3A55", mb: 2 }} />

                            {/* Description */}
                            <Typography variant="body2" sx={{ color: "#3E1F00", lineHeight: 1.75 }}>
                                {result.description}
                            </Typography>

                            {result.upcast && (
                                <>
                                    <Divider sx={{ borderColor: "#8C5A3A55", my: 2 }} />
                                    <Typography variant="body2" sx={{ color: "#6B3A1F", lineHeight: 1.7, fontStyle: "italic" }}>
                                        {result.upcast}
                                    </Typography>
                                </>
                            )}
                        </Box>
                    </Paper>
                )}
            </Container>
        </Box>
    );
}
