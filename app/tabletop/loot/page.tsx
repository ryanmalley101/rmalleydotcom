"use client";

import { useState, useEffect } from "react";
import {
    Box, Container, Button, Typography, Select, MenuItem,
    FormControl, InputLabel, Paper, Divider, Chip,
} from "@mui/material";
import { ArrowLeft, Coins, Dices } from "lucide-react";
import Link from "next/link";

interface MagicItem {
    name: string;
    type: string;
    rarity: string;
    requires_attunement: boolean;
    attunement_note: string | null;
    description: string;
}

interface Currency { pp: number; gp: number; sp: number; cp: number }
interface HoardResult { currency: Currency; items: MagicItem[] }

// ── Tier config ───────────────────────────────────────────────────────────────

function d(n: number, sides: number) {
    let t = 0;
    for (let i = 0; i < n; i++) t += Math.floor(Math.random() * sides) + 1;
    return t;
}

type TierKey = "cr04" | "cr510" | "cr1116" | "cr17plus";

const TIERS: Record<TierKey, {
    label: string;
    currency: () => Currency;
    itemCount: () => number;
    rarities: string[];
}> = {
    cr04: {
        label: "CR 0–4",
        currency: () => ({ pp: 0, gp: d(2, 6) * 10, sp: d(3, 6) * 100, cp: d(2, 6) * 100 }),
        itemCount: () => Math.max(0, d(1, 4) - 2),
        rarities: ["Common", "Uncommon"],
    },
    cr510: {
        label: "CR 5–10",
        currency: () => ({ pp: 0, gp: d(4, 6) * 100, sp: 0, cp: 0 }),
        itemCount: () => d(1, 3),
        rarities: ["Uncommon", "Rare"],
    },
    cr1116: {
        label: "CR 11–16",
        currency: () => ({ pp: d(5, 6) * 10, gp: d(4, 6) * 1000, sp: 0, cp: 0 }),
        itemCount: () => d(1, 4),
        rarities: ["Rare", "Very Rare"],
    },
    cr17plus: {
        label: "CR 17+",
        currency: () => ({ pp: d(8, 6) * 100, gp: d(6, 6) * 1000, sp: 0, cp: 0 }),
        itemCount: () => d(1, 4) + 2,
        rarities: ["Very Rare", "Legendary"],
    },
};

const RARITY_COLOR: Record<string, string> = {
    Common:      "#607d8b",
    Uncommon:    "#2e7d32",
    Rare:        "#1565c0",
    "Very Rare": "#6a1b9a",
    Legendary:   "#b71c1c",
};

function fmt(n: number): string {
    return n.toLocaleString();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LootPage() {
    const [allItems, setAllItems] = useState<MagicItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [tier, setTier] = useState<TierKey>("cr510");
    const [result, setResult] = useState<HoardResult | null>(null);
    const [rollCount, setRollCount] = useState(0);

    useEffect(() => {
        fetch("/5_5_SRD/magic_items.json")
            .then((r) => r.json())
            .then((data) => { setAllItems(data.items ?? []); setLoading(false); });
    }, []);

    function generate() {
        const config = TIERS[tier];
        const currency = config.currency();
        const count = config.itemCount();

        const pool = allItems.filter((item) => config.rarities.includes(item.rarity));
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const items = shuffled.slice(0, count);

        setResult({ currency, items });
        setRollCount((c) => c + 1);
    }

    const { pp, gp, sp, cp } = result?.currency ?? { pp: 0, gp: 0, sp: 0, cp: 0 };
    const coins = [
        { label: "Platinum", abbr: "pp", value: pp, color: "#90a4ae" },
        { label: "Gold",     abbr: "gp", value: gp, color: "#f9a825" },
        { label: "Silver",   abbr: "sp", value: sp, color: "#90a4ae" },
        { label: "Copper",   abbr: "cp", value: cp, color: "#a1887f" },
    ].filter((c) => c.value > 0);

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
                    <Coins size={32} color="#8C5A3A" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        Loot Hoard
                    </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    Generate currency and magic items for a treasure hoard.
                </Typography>

                <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel>CR Range</InputLabel>
                        <Select
                            value={tier}
                            label="CR Range"
                            onChange={(e) => setTier(e.target.value as TierKey)}
                            disabled={loading}
                        >
                            {(Object.keys(TIERS) as TierKey[]).map((key) => (
                                <MenuItem key={key} value={key}>{TIERS[key].label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 5 }}>
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<Dices size={20} />}
                        onClick={generate}
                        disabled={loading}
                        sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" } }}
                    >
                        Open Chest
                    </Button>
                </Box>

                {result && (
                    <Paper
                        key={rollCount}
                        elevation={6}
                        sx={{ backgroundColor: "#F5E6C8", border: "2px solid #8C5A3A", borderRadius: 2, overflow: "hidden" }}
                    >
                        {/* Header */}
                        <Box sx={{
                            backgroundColor: "#8C5A3A", px: 3, py: 1.5,
                            textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5,
                        }}>
                            <Typography variant="overline" sx={{ color: "#F5E6C8", letterSpacing: 4, fontSize: "0.65rem", lineHeight: 1 }}>
                                Treasure Hoard
                            </Typography>
                            <Typography variant="caption" sx={{ color: "#F5E6C8CC", letterSpacing: 1 }}>
                                {TIERS[tier].label} Encounter
                            </Typography>
                        </Box>

                        <Box sx={{ px: 4, py: 3 }}>
                            {/* Currency */}
                            <Typography variant="overline" sx={{ color: "#6B3A1F", letterSpacing: 2, fontSize: "0.65rem" }}>
                                Currency
                            </Typography>
                            <Divider sx={{ borderColor: "#8C5A3A55", mb: 1.5, mt: 0.5 }} />

                            {coins.length === 0 ? (
                                <Typography variant="body2" sx={{ color: "#6B3A1F", fontStyle: "italic", mb: 2 }}>
                                    No coins.
                                </Typography>
                            ) : (
                                <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 2 }}>
                                    {coins.map(({ label, abbr, value, color }) => (
                                        <Box key={abbr} sx={{ textAlign: "center" }}>
                                            <Typography variant="h5" sx={{ fontWeight: 800, color, lineHeight: 1 }}>
                                                {fmt(value)}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: "#6B3A1F", letterSpacing: 1, textTransform: "uppercase", fontSize: "0.65rem" }}>
                                                {abbr} · {label}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            )}

                            {/* Magic items */}
                            <Typography variant="overline" sx={{ color: "#6B3A1F", letterSpacing: 2, fontSize: "0.65rem" }}>
                                Magic Items ({result.items.length})
                            </Typography>
                            <Divider sx={{ borderColor: "#8C5A3A55", mb: 1.5, mt: 0.5 }} />

                            {result.items.length === 0 ? (
                                <Typography variant="body2" sx={{ color: "#6B3A1F", fontStyle: "italic" }}>
                                    No magic items found for this tier.
                                </Typography>
                            ) : (
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    {result.items.map((item, i) => {
                                        const itemColor = RARITY_COLOR[item.rarity] ?? "#607d8b";
                                        return (
                                            <Box
                                                key={i}
                                                sx={{
                                                    borderLeft: `3px solid ${itemColor}`,
                                                    pl: 1.5,
                                                    py: 0.5,
                                                }}
                                            >
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "#3E1F00" }}>
                                                        {item.name}
                                                    </Typography>
                                                    <Chip
                                                        label={item.rarity}
                                                        size="small"
                                                        sx={{ backgroundColor: itemColor, color: "#fff", fontSize: "0.65rem", height: 18, "& .MuiChip-label": { px: 0.75 } }}
                                                    />
                                                </Box>
                                                <Typography variant="caption" sx={{ color: "#6B3A1F", display: "block", mb: 0.5, fontStyle: "italic" }}>
                                                    {item.type}{item.requires_attunement ? " · Requires Attunement" : ""}
                                                </Typography>
                                                <Typography variant="body2" sx={{ color: "#3E1F00", lineHeight: 1.6, fontSize: "0.8rem" }}>
                                                    {item.description}
                                                </Typography>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            )}
                        </Box>
                    </Paper>
                )}
            </Container>
        </Box>
    );
}
