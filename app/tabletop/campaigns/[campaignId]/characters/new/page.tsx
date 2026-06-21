"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Box, Container, Typography, Button, TextField, MenuItem,
    Select, FormControl, InputLabel, CircularProgress, Divider,
    Grid,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, User } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

// ── D&D constants ─────────────────────────────────────────────────────────────

const DND_CLASSES = [
    "Barbarian","Bard","Cleric","Druid","Fighter","Monk",
    "Paladin","Ranger","Rogue","Sorcerer","Warlock","Wizard","Artificer","Other",
];
const ALIGNMENTS = [
    "Lawful Good","Neutral Good","Chaotic Good",
    "Lawful Neutral","True Neutral","Chaotic Neutral",
    "Lawful Evil","Neutral Evil","Chaotic Evil","Unaligned",
];

// ── Cypher constants ──────────────────────────────────────────────────────────

const CYPHER_TYPES = ["Warrior", "Adept", "Explorer", "Speaker", "Other"];

// ── D&D new character form ────────────────────────────────────────────────────

function DnDNewCharacterForm({ campaignId, system }: { campaignId: string; system: string }) {
    const router = useRouter();
    const [form, setForm] = useState({
        characterName: "", playerName: "",
        characterClass: "", subclass: "", race: "", background: "",
        alignment: "True Neutral", level: "1", xp: "0",
        strength: "10", dexterity: "10", constitution: "10",
        intelligence: "10", wisdom: "10", charisma: "10",
        maxHp: "10", armorClass: "10", speed: "30",
    });
    const [saving, setSaving] = useState(false);

    const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [field]: e.target.value }));

    const scoreMod = (score: string) => {
        const m = Math.floor((parseInt(score, 10) - 10) / 2);
        return m >= 0 ? `+${m}` : `${m}`;
    };

    async function save() {
        if (!form.characterName.trim()) return;
        setSaving(true);
        const num = (v: string) => parseInt(v, 10) || undefined;
        const { data } = await client.models.PlayerCharacter.create({
            campaignId,
            system,
            characterName: form.characterName.trim(),
            playerName: form.playerName.trim() || undefined,
            characterClass: form.characterClass || undefined,
            subclass: form.subclass.trim() || undefined,
            race: form.race.trim() || undefined,
            background: form.background.trim() || undefined,
            alignment: form.alignment || undefined,
            level: num(form.level),
            xp: num(form.xp),
            strength: num(form.strength),
            dexterity: num(form.dexterity),
            constitution: num(form.constitution),
            intelligence: num(form.intelligence),
            wisdom: num(form.wisdom),
            charisma: num(form.charisma),
            maxHp: num(form.maxHp),
            currentHp: num(form.maxHp),
            armorClass: num(form.armorClass),
            speed: num(form.speed),
        });
        setSaving(false);
        if (data) router.push(`/tabletop/campaigns/${campaignId}/characters/${data.id}`);
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "primary.dark" }}>Identity</Typography>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField label="Character Name" fullWidth required value={form.characterName} onChange={set("characterName")} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField label="Player Name" fullWidth value={form.playerName} onChange={set("playerName")} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth>
                        <InputLabel>Class</InputLabel>
                        <Select label="Class" value={form.characterClass}
                            onChange={e => setForm(f => ({ ...f, characterClass: e.target.value }))}>
                            {DND_CLASSES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField label="Subclass" fullWidth value={form.subclass} onChange={set("subclass")} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField label="Level" type="number" fullWidth value={form.level} onChange={set("level")} inputProps={{ min: 1, max: 20 }} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField label="Race / Species" fullWidth value={form.race} onChange={set("race")} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField label="Background" fullWidth value={form.background} onChange={set("background")} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth>
                        <InputLabel>Alignment</InputLabel>
                        <Select label="Alignment" value={form.alignment}
                            onChange={e => setForm(f => ({ ...f, alignment: e.target.value }))}>
                            {ALIGNMENTS.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Grid>
            </Grid>

            <Divider />

            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "primary.dark" }}>Ability Scores</Typography>
            <Grid container spacing={2}>
                {(["strength","dexterity","constitution","intelligence","wisdom","charisma"] as const).map(stat => (
                    <Grid size={{ xs: 4, sm: 2 }} key={stat}>
                        <TextField label={stat.slice(0,3).toUpperCase()} type="number" fullWidth
                            value={(form as Record<string,string>)[stat]} onChange={set(stat)}
                            inputProps={{ min: 1, max: 30 }}
                            helperText={`Mod: ${scoreMod((form as Record<string,string>)[stat])}`} />
                    </Grid>
                ))}
            </Grid>

            <Divider />

            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "primary.dark" }}>Combat</Typography>
            <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                    <TextField label="Max HP" type="number" fullWidth value={form.maxHp} onChange={set("maxHp")} inputProps={{ min: 1 }} />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                    <TextField label="Armor Class" type="number" fullWidth value={form.armorClass} onChange={set("armorClass")} />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                    <TextField label="Speed (ft)" type="number" fullWidth value={form.speed} onChange={set("speed")} />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                    <TextField label="XP" type="number" fullWidth value={form.xp} onChange={set("xp")} inputProps={{ min: 0 }} />
                </Grid>
            </Grid>

            <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end", mt: 1 }}>
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}>Cancel</Button>
                <Button variant="contained" onClick={save}
                    disabled={saving || !form.characterName.trim()}
                    sx={{ backgroundColor: "primary.main" }}>
                    {saving ? <CircularProgress size={18} /> : "Create Character"}
                </Button>
            </Box>
        </Box>
    );
}

// ── Cypher new character form ─────────────────────────────────────────────────

function CypherNewCharacterForm({ campaignId }: { campaignId: string }) {
    const router = useRouter();
    const [form, setForm] = useState({
        characterName: "", playerName: "",
        descriptor: "", type: "", focus: "",
        tier: "1", xp: "0",
        mightPool: "10", mightEdge: "0",
        speedPool: "10", speedEdge: "0",
        intellectPool: "10", intellectEdge: "0",
    });
    const [saving, setSaving] = useState(false);

    const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(f => ({ ...f, [field]: e.target.value }));
    const n = (v: string) => parseInt(v, 10) || 0;

    async function save() {
        if (!form.characterName.trim()) return;
        setSaving(true);
        const systemData = {
            mightPool: n(form.mightPool), mightEdge: n(form.mightEdge), currentMight: n(form.mightPool),
            speedPool: n(form.speedPool), speedEdge: n(form.speedEdge), currentSpeed: n(form.speedPool),
            intellectPool: n(form.intellectPool), intellectEdge: n(form.intellectEdge), currentIntellect: n(form.intellectPool),
            effort: 1,
            damageTrack: "hale",
            recovery: { action: false, tenMin: false, oneHour: false, tenHour: false },
            skills: [], abilities: [], cyphers: [], artifacts: [], equipment: [],
            shins: 0, notes: "", backstory: "", links: "",
        };
        const { data } = await client.models.PlayerCharacter.create({
            campaignId,
            system: "Cypher System",
            characterName: form.characterName.trim(),
            playerName: form.playerName.trim() || undefined,
            race: form.descriptor.trim() || undefined,       // Descriptor → race field
            characterClass: form.type || undefined,           // Type → class field
            subclass: form.focus.trim() || undefined,         // Focus → subclass field
            level: n(form.tier) || 1,
            xp: n(form.xp),
            systemDataJson: JSON.stringify(systemData),
        });
        setSaving(false);
        if (data) router.push(`/tabletop/campaigns/${campaignId}/characters/${data.id}`);
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "primary.dark" }}>Identity</Typography>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField label="Character Name" fullWidth required value={form.characterName} onChange={set("characterName")} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField label="Player Name" fullWidth value={form.playerName} onChange={set("playerName")} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField label="Descriptor" fullWidth placeholder="e.g. Swift, Clever, Resilient"
                        value={form.descriptor} onChange={set("descriptor")} />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControl fullWidth>
                        <InputLabel>Type</InputLabel>
                        <Select label="Type" value={form.type}
                            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                            {CYPHER_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField label="Focus" fullWidth placeholder="e.g. Carries a Quiver"
                        value={form.focus} onChange={set("focus")} />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                    <TextField label="Tier" type="number" fullWidth value={form.tier} onChange={set("tier")} inputProps={{ min: 1, max: 6 }} />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                    <TextField label="XP" type="number" fullWidth value={form.xp} onChange={set("xp")} inputProps={{ min: 0 }} />
                </Grid>
            </Grid>

            <Divider />

            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "primary.dark" }}>Stat Pools</Typography>
            <Grid container spacing={2}>
                {[
                    { label: "Might", poolKey: "mightPool", edgeKey: "mightEdge" },
                    { label: "Speed", poolKey: "speedPool", edgeKey: "speedEdge" },
                    { label: "Intellect", poolKey: "intellectPool", edgeKey: "intellectEdge" },
                ].map(({ label, poolKey, edgeKey }) => (
                    <Grid size={{ xs: 12, sm: 4 }} key={label}>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, display: "block", mb: 1 }}>
                            {label}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1 }}>
                            <TextField label="Pool" type="number" fullWidth size="small"
                                value={(form as Record<string,string>)[poolKey]}
                                onChange={set(poolKey)} inputProps={{ min: 1 }} />
                            <TextField label="Edge" type="number" fullWidth size="small"
                                value={(form as Record<string,string>)[edgeKey]}
                                onChange={set(edgeKey)} inputProps={{ min: 0, max: 6 }} />
                        </Box>
                    </Grid>
                ))}
            </Grid>

            <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end", mt: 1 }}>
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}>Cancel</Button>
                <Button variant="contained" onClick={save}
                    disabled={saving || !form.characterName.trim()}
                    sx={{ backgroundColor: "primary.main" }}>
                    {saving ? <CircularProgress size={18} /> : "Create Character"}
                </Button>
            </Box>
        </Box>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewCharacterPage() {
    const { campaignId } = useParams<{ campaignId: string }>();
    const [system, setSystem] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        client.models.Campaign.get({ id: campaignId })
            .then(res => {
                setSystem(res.data?.system ?? "D&D 5e");
                setLoading(false);
            });
    }, [campaignId]);

    const isCypher = system === "Cypher System";

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                    <User size={28} color="#8C5A3A" />
                    <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        New Character
                    </Typography>
                </Box>
                {system && (
                    <Typography variant="caption" sx={{ color: "text.secondary", ml: 0.5, display: "block", mb: 2 }}>
                        {system}
                    </Typography>
                )}

                <Divider sx={{ mb: 4 }} />

                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                        <CircularProgress sx={{ color: "primary.main" }} />
                    </Box>
                ) : isCypher ? (
                    <CypherNewCharacterForm campaignId={campaignId} />
                ) : (
                    <DnDNewCharacterForm campaignId={campaignId} system={system ?? "D&D 5e"} />
                )}
            </Container>
        </Box>
    );
}
