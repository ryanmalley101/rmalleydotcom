"use client";

import { Fragment, useState, useEffect } from "react";
import {
    Box, Container, Button, Typography, Select, MenuItem,
    FormControl, InputLabel, Paper, Divider, Chip,
} from "@mui/material";
import { ArrowLeft, User, Dices } from "lucide-react";
import Link from "next/link";

// ── Static tables ─────────────────────────────────────────────────────────────

const NAMES: Record<string, string[]> = {
    Dragonborn: ["Arjhan","Balasar","Donaar","Ghesh","Heskan","Kriv","Medrash","Nadarr","Patrin","Rhogar","Tarhun","Torinn","Akra","Biri","Daar","Farideh","Harann","Korinn","Mishann","Nala","Raiann","Thava","Uadjit"],
    Dwarf:      ["Adrik","Alberich","Baern","Darrak","Eberk","Einkil","Fargrim","Gardain","Kildrak","Morgran","Orsik","Rangrim","Thoradin","Thorin","Tordek","Ulfgar","Vondal","Amber","Artin","Audhild","Dagnal","Diesa","Eldeth","Gunnloda","Helja","Kathra","Mardred","Riswynn","Torbera","Vistra"],
    Elf:        ["Adran","Aramil","Carric","Erdan","Galinndan","Hadarai","Heian","Immeral","Laucian","Paelias","Peren","Quarion","Rolen","Soveliss","Varis","Adrie","Anastrianna","Andraste","Bethrynna","Caelynn","Drusilia","Enna","Felosial","Keyleth","Leshanna","Mialee","Quelenna","Sariel","Silaqui","Thiala"],
    Gnome:      ["Alston","Alvyn","Brocc","Dimble","Ellywick","Fonkin","Gimble","Glim","Namfoodle","Orryn","Sindri","Wrenn","Zook","Bimpnottin","Breena","Caramip","Donella","Ella","Lilli","Nissa","Nyx","Oda","Roywyn","Tana","Zanna"],
    Halfling:   ["Alton","Cade","Corrin","Eldon","Finnan","Garret","Merric","Milo","Osborn","Perrin","Reed","Roscoe","Wellby","Andry","Bree","Cora","Euphemia","Jillian","Kithri","Lavinia","Lidda","Merla","Paela","Seraphina","Trym","Vani"],
    Orc:        ["Dench","Feng","Gell","Henk","Holg","Keth","Krusk","Mhurren","Ront","Shump","Thokk","Baggi","Engong","Kansif","Myev","Neega","Ovak","Ownka","Shautha","Sutha","Vola","Yevelda"],
    Tiefling:   ["Akmenos","Amnon","Barakas","Damakos","Ekemon","Iados","Kairon","Leucis","Mordai","Morthos","Therai","Akta","Anakis","Bryseis","Criella","Damaia","Kallista","Lerissa","Makaria","Nemeia","Orianna","Phelaia","Rieta"],
    _default:   ["Aiden","Aldric","Bram","Caelan","Declan","Dorin","Farrel","Gareth","Hadwin","Ilya","Jorin","Kevan","Lena","Mira","Nadia","Owen","Petra","Quinn","Rory","Silas","Tara","Ulric","Vera","Wren","Xander","Yara","Zara"],
};

const ALIGNMENTS = [
    "Lawful Good","Neutral Good","Chaotic Good",
    "Lawful Neutral","True Neutral","Chaotic Neutral",
    "Lawful Evil","Neutral Evil","Chaotic Evil",
];

const TRAITS = [
    "Prefers to keep to themselves and shares little about their past.",
    "Speaks bluntly — often offending people they actually like.",
    "Has a dry wit and a tendency to find the wrong moment to use it.",
    "Unfailingly polite, makes every stranger feel welcome.",
    "Tells long, wandering stories that rarely have a point.",
    "Never backs down from a challenge, even an obviously unwinnable one.",
    "Gets lost in thought without warning; haunted by something.",
    "Obsessively collects small trinkets from everywhere they travel.",
    "Treats every stranger as a potential ally until proven otherwise.",
    "Quotes obscure texts and expects others to keep up.",
    "Deeply superstitious — sees omens in nearly everything.",
    "Asks too many questions and rarely lets others finish a thought.",
    "Eerily calm in dangerous situations; unsettling to some.",
    "Suspects anyone who seems to want something from them.",
    "Hums or whistles constantly when their hands are idle.",
    "Takes obvious pride in their appearance and keeps immaculate.",
    "Fiercely loyal — never forgets a debt, good or bad.",
    "Recklessly generous; always seems to end up broke.",
    "Too proud to admit when wrong, even when it's obvious.",
    "Follows rules with unusual precision; disorder makes them anxious.",
];

const IDEALS = [
    "Freedom. No one tells me what to do — or what to believe.",
    "Justice. The law should protect the powerless, not just the powerful.",
    "Knowledge. Understanding the world is worth any price.",
    "Tradition. The old ways endure because they work.",
    "Community. We rise or fall together.",
    "Redemption. It's never too late to make things right.",
    "Power. Strength is the only thing that earns real respect.",
    "Beauty. The world should be made more beautiful wherever possible.",
    "Survival. Everyone dies; I intend to die last.",
    "Honor. My word is everything — without it I have nothing.",
    "Change. The status quo is an excuse for the comfortable.",
    "Loyalty. I will not betray those I have sworn to protect.",
    "Wealth. Coin means options, and options mean freedom.",
    "Balance. The world thrives only when kept in harmony.",
    "Glory. What is life without deeds worth singing about?",
];

const BONDS = [
    "Owes a debt they may never be able to repay.",
    "Family is their anchor, even when they're far from home.",
    "Searching for someone who vanished without explanation.",
    "Keeping a terrible secret to protect someone they love.",
    "Their homeland was destroyed; they carry its memory everywhere.",
    "A mentor gave them everything. They won't let that legacy die.",
    "Made a promise they regret but cannot break.",
    "A rival who wronged them occupies too much of their thoughts.",
    "Belongs to a group or order they would die for.",
    "Lost something precious and is still searching for it.",
    "A younger person looks up to them — they cannot fail them.",
    "Was once betrayed; the wound has never fully healed.",
    "Guards a relic, heirloom, or artifact with their life.",
    "Fell in love once. Still hasn't stopped thinking about them.",
    "Believes they were meant for something; refuses to die before finding out what.",
];

const FLAWS = [
    "Can't resist a dare, even a genuinely stupid one.",
    "Lies compulsively, even when the truth would serve better.",
    "Holds grudges forever and never truly forgives.",
    "Arrogant — dismisses those they see as beneath them.",
    "Drinks too much when anxious, which is often.",
    "Panics when cornered and sometimes does things they regret.",
    "Too generous with money; always seems to end up broke.",
    "Puts their own comfort ahead of others more than they should.",
    "Ruled by their temper — says things they immediately regret.",
    "Paralyzed by indecision when the stakes are genuinely high.",
    "Trusts the wrong people; always assumes the best of others.",
    "Judges people too quickly on first impressions.",
    "Avoids conflict at all costs, even when they clearly shouldn't.",
    "Hoards information and shares it only when it benefits them.",
    "Pride won't let them back down, even when clearly wrong.",
];

const APPEARANCES = [
    "Weathered hands and a permanent, calculating squint.",
    "An old scar runs from one cheekbone toward their jaw.",
    "Always seems slightly overdressed for the occasion.",
    "Missing the tip of one finger on their left hand.",
    "Eyes that catch the light in an unusual, unsettling way.",
    "Extremely tall, with the habit of ducking through doorways.",
    "Short even for their kind — but with surprising presence.",
    "A lazy eye that makes it hard to tell exactly who they're looking at.",
    "Elaborate, faded tattoos up both forearms.",
    "Unusually pale, as if they rarely see sunlight.",
    "Moves with deliberate military precision.",
    "A warm, easy smile that reaches their eyes without effort.",
    "Permanently ink-stained fingers.",
    "A nervous habit of touching their collar or hood.",
    "The kind of face you forget almost as soon as you look away.",
    "Unnervingly still when they're listening to you.",
    "A deep, resonant voice that seems too big for their frame.",
    "Wears mismatched, practical clothes in muted, earthy tones.",
    "Carries too many bags and pouches, all stuffed with unknowns.",
    "An old burn mark on the back of one hand.",
];

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface NpcResult {
    name: string;
    species: string;
    background: string;
    cls: string;
    alignment: string;
    trait: string;
    ideal: string;
    bond: string;
    flaw: string;
    appearance: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NpcPage() {
    const [speciesList, setSpeciesList] = useState<string[]>([]);
    const [backgroundList, setBackgroundList] = useState<string[]>([]);
    const [classList, setClassList] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const [filterSpecies, setFilterSpecies] = useState("any");
    const [filterBackground, setFilterBackground] = useState("any");
    const [filterClass, setFilterClass] = useState("any");

    const [result, setResult] = useState<NpcResult | null>(null);
    const [rollCount, setRollCount] = useState(0);

    useEffect(() => {
        Promise.all([
            fetch("/5_5_SRD/species.json").then((r) => r.json()),
            fetch("/5_5_SRD/backgrounds.json").then((r) => r.json()),
            fetch("/5_5_SRD/classes.json").then((r) => r.json()),
        ]).then(([s, b, c]) => {
            setSpeciesList((s.species ?? []).map((x: any) => x.name as string));
            setBackgroundList((b.backgrounds ?? []).map((x: any) => x.name as string));
            setClassList((c.classes ?? []).map((x: any) => x.name as string));
            setLoading(false);
        });
    }, []);

    function generate() {
        const species = filterSpecies === "any" ? pick(speciesList) : filterSpecies;
        const background = filterBackground === "any" ? pick(backgroundList) : filterBackground;
        const cls = filterClass === "any" ? pick(classList) : filterClass;

        const namePool = NAMES[species] ?? NAMES._default;

        setResult({
            name: pick(namePool),
            species,
            background,
            cls,
            alignment: pick(ALIGNMENTS),
            trait: pick(TRAITS),
            ideal: pick(IDEALS),
            bond: pick(BONDS),
            flaw: pick(FLAWS),
            appearance: pick(APPEARANCES),
        });
        setRollCount((c) => c + 1);
    }

    const rows: Array<[string, string]> = result
        ? [
            ["Trait",      result.trait],
            ["Ideal",      result.ideal],
            ["Bond",       result.bond],
            ["Flaw",       result.flaw],
            ["Appearance", result.appearance],
        ]
        : [];

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
                    <User size={32} color="#8C5A3A" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        NPC Generator
                    </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    Generate a random NPC with species, class, background, and personality. Leave filters as &ldquo;Any&rdquo; for a fully random result.
                </Typography>

                {/* Filters */}
                <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
                    <FormControl size="small" sx={{ minWidth: 130 }}>
                        <InputLabel>Species</InputLabel>
                        <Select value={filterSpecies} label="Species" onChange={(e) => setFilterSpecies(e.target.value)} disabled={loading}>
                            <MenuItem value="any">Any</MenuItem>
                            {speciesList.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Background</InputLabel>
                        <Select value={filterBackground} label="Background" onChange={(e) => setFilterBackground(e.target.value)} disabled={loading}>
                            <MenuItem value="any">Any</MenuItem>
                            {backgroundList.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 130 }}>
                        <InputLabel>Class</InputLabel>
                        <Select value={filterClass} label="Class" onChange={(e) => setFilterClass(e.target.value)} disabled={loading}>
                            <MenuItem value="any">Any</MenuItem>
                            {classList.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Box>

                <Box sx={{ mb: 5 }}>
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<Dices size={20} />}
                        onClick={generate}
                        disabled={loading || speciesList.length === 0}
                        sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" } }}
                    >
                        Generate NPC
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
                            backgroundColor: "#8C5A3A", px: 3, py: 2,
                            textAlign: "center",
                        }}>
                            <Typography variant="h4" sx={{
                                fontWeight: 800, color: "#F5E6C8",
                                letterSpacing: 3, textTransform: "uppercase",
                            }}>
                                {result.name}
                            </Typography>
                        </Box>

                        <Box sx={{ px: 4, py: 3 }}>
                            {/* Identity chips */}
                            <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
                                {[result.species, result.background, result.cls].map((label) => (
                                    <Chip
                                        key={label}
                                        label={label}
                                        size="small"
                                        sx={{
                                            backgroundColor: "#8C5A3A22",
                                            color: "#3E1F00",
                                            fontSize: "0.75rem",
                                            fontWeight: 600,
                                            border: "1px solid #8C5A3A66",
                                        }}
                                    />
                                ))}
                            </Box>
                            <Typography variant="body2" sx={{ color: "#6B3A1F", textAlign: "center", fontStyle: "italic", mb: 2 }}>
                                {result.alignment}
                            </Typography>

                            <Divider sx={{ borderColor: "#8C5A3A55", mb: 2 }} />

                            {/* Personality rows */}
                            <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 2.5, rowGap: 1.25 }}>
                                {rows.map(([label, value]) => (
                                    <Fragment key={label}>
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: "#6B3A1F", whiteSpace: "nowrap", pt: 0.1 }}>
                                            {label}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: "#3E1F00", lineHeight: 1.6 }}>
                                            {value}
                                        </Typography>
                                    </Fragment>
                                ))}
                            </Box>
                        </Box>
                    </Paper>
                )}
            </Container>
        </Box>
    );
}
