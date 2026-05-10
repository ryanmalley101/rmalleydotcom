"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Box, Container, Button, Typography, Select, MenuItem,
    FormControl, InputLabel, Paper, Divider, Chip,
} from "@mui/material";
import { ArrowLeft, Gem, Dices } from "lucide-react";
import Link from "next/link";

interface MagicItem {
    name: string;
    type: string;
    rarity: string;
    requires_attunement: boolean;
    attunement_note: string | null;
    description: string;
}

const RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact", "Varies"];

const RARITY_COLOR: Record<string, string> = {
    Common:      "#607d8b",
    Uncommon:    "#2e7d32",
    Rare:        "#1565c0",
    "Very Rare": "#6a1b9a",
    Legendary:   "#b71c1c",
    Artifact:    "#e65100",
    Varies:      "#37474f",
};

export default function MagicItemPage() {
    const [items, setItems] = useState<MagicItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [rarity, setRarity] = useState("any");
    const [attunement, setAttunement] = useState("any");
    const [result, setResult] = useState<MagicItem | null>(null);
    const [rollCount, setRollCount] = useState(0);

    useEffect(() => {
        fetch("/5_5_SRD/magic_items.json")
            .then((r) => r.json())
            .then((data) => { setItems(data.items ?? []); setLoading(false); });
    }, []);

    const pool = useMemo(() =>
        items.filter((item) => {
            if (rarity !== "any" && item.rarity !== rarity) return false;
            if (attunement === "yes" && !item.requires_attunement) return false;
            if (attunement === "no" && item.requires_attunement) return false;
            return true;
        }),
        [items, rarity, attunement]
    );

    function draw() {
        if (!pool.length) return;
        setResult(pool[Math.floor(Math.random() * pool.length)]);
        setRollCount((c) => c + 1);
    }

    const color = result ? (RARITY_COLOR[result.rarity] ?? "#607d8b") : "#607d8b";

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
                    <Gem size={32} color="#8C5A3A" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        Magic Item
                    </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    Draw a random magic item from the 5.5e SRD.
                </Typography>

                <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Rarity</InputLabel>
                        <Select value={rarity} label="Rarity" onChange={(e) => setRarity(e.target.value)} disabled={loading}>
                            <MenuItem value="any">Any</MenuItem>
                            {RARITIES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 165 }}>
                        <InputLabel>Attunement</InputLabel>
                        <Select value={attunement} label="Attunement" onChange={(e) => setAttunement(e.target.value)} disabled={loading}>
                            <MenuItem value="any">Any</MenuItem>
                            <MenuItem value="yes">Required</MenuItem>
                            <MenuItem value="no">Not Required</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 5 }}>
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<Dices size={20} />}
                        onClick={draw}
                        disabled={loading || pool.length === 0}
                        sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" } }}
                    >
                        Draw Item
                    </Button>
                    {!loading && (
                        <Typography variant="body2" sx={{ color: pool.length === 0 ? "error.main" : "text.secondary" }}>
                            {pool.length} item{pool.length !== 1 ? "s" : ""} in pool
                        </Typography>
                    )}
                </Box>

                {result && (
                    <Paper
                        key={rollCount}
                        elevation={6}
                        sx={{ backgroundColor: "#F5E6C8", border: "2px solid #8C5A3A", borderRadius: 2, overflow: "hidden" }}
                    >
                        <Box sx={{
                            backgroundColor: "#8C5A3A", px: 3, py: 1.5,
                            textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75,
                        }}>
                            <Typography variant="overline" sx={{ color: "#F5E6C8", letterSpacing: 4, fontSize: "0.65rem", lineHeight: 1 }}>
                                Magic Item
                            </Typography>
                            <Chip
                                label={result.rarity}
                                size="small"
                                sx={{ backgroundColor: color, color: "#fff", fontWeight: 700, fontSize: "0.7rem", height: 20, "& .MuiChip-label": { px: 1 } }}
                            />
                        </Box>

                        <Box sx={{ px: 4, py: 3 }}>
                            <Typography variant="h4" sx={{
                                fontWeight: 800, color: "#3E1F00", textAlign: "center",
                                letterSpacing: 2, textTransform: "uppercase", mb: 0.75,
                            }}>
                                {result.name}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "#6B3A1F", textAlign: "center", fontStyle: "italic", mb: 2 }}>
                                {result.type}
                                {result.requires_attunement
                                    ? ` · Requires Attunement${result.attunement_note ? ` (${result.attunement_note})` : ""}`
                                    : ""}
                            </Typography>

                            <Divider sx={{ borderColor: "#8C5A3A55", mb: 2 }} />

                            <Typography variant="body2" sx={{ color: "#3E1F00", lineHeight: 1.75 }}>
                                {result.description}
                            </Typography>
                        </Box>
                    </Paper>
                )}
            </Container>
        </Box>
    );
}
