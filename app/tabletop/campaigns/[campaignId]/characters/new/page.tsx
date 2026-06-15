"use client";

import { useState } from "react";
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

const CLASSES = [
    "Barbarian","Bard","Cleric","Druid","Fighter","Monk",
    "Paladin","Ranger","Rogue","Sorcerer","Warlock","Wizard","Artificer","Other",
];
const ALIGNMENTS = [
    "Lawful Good","Neutral Good","Chaotic Good",
    "Lawful Neutral","True Neutral","Chaotic Neutral",
    "Lawful Evil","Neutral Evil","Chaotic Evil","Unaligned",
];

export default function NewCharacterPage() {
    const { campaignId } = useParams<{ campaignId: string }>();
    const router = useRouter();

    const [form, setForm] = useState({
        characterName: "",
        playerName: "",
        characterClass: "",
        subclass: "",
        race: "",
        background: "",
        alignment: "True Neutral",
        level: "1",
        xp: "0",
        strength: "10",
        dexterity: "10",
        constitution: "10",
        intelligence: "10",
        wisdom: "10",
        charisma: "10",
        maxHp: "10",
        currentHp: "10",
        armorClass: "10",
        speed: "30",
    });
    const [saving, setSaving] = useState(false);

    function set(field: string) {
        return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setForm(f => ({ ...f, [field]: e.target.value }));
    }

    async function save() {
        if (!form.characterName.trim()) return;
        setSaving(true);
        const num = (v: string) => parseInt(v, 10) || undefined;
        const { data } = await client.models.PlayerCharacter.create({
            campaignId,
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

    const scoreMod = (score: string) => {
        const m = Math.floor((parseInt(score, 10) - 10) / 2);
        return m >= 0 ? `+${m}` : `${m}`;
    };

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                    <User size={28} color="#8C5A3A" />
                    <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        New Character
                    </Typography>
                </Box>

                <Divider sx={{ mb: 4 }} />

                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {/* Identity */}
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "primary.dark" }}>Identity</Typography>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField label="Character Name" fullWidth required
                                value={form.characterName} onChange={set("characterName")} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField label="Player Name" fullWidth
                                value={form.playerName} onChange={set("playerName")} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <FormControl fullWidth>
                                <InputLabel>Class</InputLabel>
                                <Select label="Class" value={form.characterClass}
                                    onChange={e => setForm(f => ({ ...f, characterClass: e.target.value }))}>
                                    {CLASSES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField label="Subclass" fullWidth
                                value={form.subclass} onChange={set("subclass")} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField label="Level" type="number" fullWidth
                                value={form.level} onChange={set("level")} inputProps={{ min: 1, max: 20 }} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField label="Race / Species" fullWidth
                                value={form.race} onChange={set("race")} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField label="Background" fullWidth
                                value={form.background} onChange={set("background")} />
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

                    {/* Ability Scores */}
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "primary.dark" }}>Ability Scores</Typography>
                    <Grid container spacing={2}>
                        {(["strength","dexterity","constitution","intelligence","wisdom","charisma"] as const).map(stat => (
                            <Grid size={{ xs: 4, sm: 2 }} key={stat}>
                                <TextField label={stat.slice(0, 3).toUpperCase()} type="number"
                                    fullWidth value={(form as Record<string, string>)[stat]}
                                    onChange={set(stat)} inputProps={{ min: 1, max: 30 }}
                                    helperText={`Mod: ${scoreMod((form as Record<string, string>)[stat])}`}
                                />
                            </Grid>
                        ))}
                    </Grid>

                    <Divider />

                    {/* Combat Stats */}
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "primary.dark" }}>Combat</Typography>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <TextField label="Max HP" type="number" fullWidth
                                value={form.maxHp} onChange={set("maxHp")} inputProps={{ min: 1 }} />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <TextField label="Armor Class" type="number" fullWidth
                                value={form.armorClass} onChange={set("armorClass")} inputProps={{ min: 0 }} />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <TextField label="Speed (ft)" type="number" fullWidth
                                value={form.speed} onChange={set("speed")} inputProps={{ min: 0 }} />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                            <TextField label="XP" type="number" fullWidth
                                value={form.xp} onChange={set("xp")} inputProps={{ min: 0 }} />
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
            </Container>
        </Box>
    );
}
