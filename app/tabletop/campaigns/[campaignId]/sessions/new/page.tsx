"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Box, Container, Typography, Button, TextField,
    CircularProgress, Divider,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

export default function NewSessionPage() {
    const { campaignId } = useParams<{ campaignId: string }>();
    const router = useRouter();

    const [sessionNumber, setNumber] = useState("");
    const [title, setTitle]          = useState("");
    const [date, setDate]            = useState("");
    const [prepNotes, setPrep]       = useState("");
    const [saving, setSaving]        = useState(false);
    const createdIdRef = useRef<string | null>(null);
    const [autoSaved, setAutoSaved] = useState<Date | null>(null);
    const [autoSaving, setAutoSaving] = useState(false);

    // Silently create or update the draft whenever any content is entered
    useEffect(() => {
        const hasContent = title.trim() || prepNotes.trim() || date || sessionNumber;
        if (!hasContent) return;
        const timer = setTimeout(async () => {
            setAutoSaving(true);
            try {
                if (!createdIdRef.current) {
                    const { data } = await client.models.CampaignSession.create({
                        campaignId,
                        sessionNumber: sessionNumber ? parseInt(sessionNumber, 10) : undefined,
                        title: title.trim() || undefined,
                        date: date || undefined,
                        prepNotes,
                        sessionNotes: "",
                    });
                    if (data) createdIdRef.current = data.id;
                } else {
                    await client.models.CampaignSession.update({
                        id: createdIdRef.current,
                        sessionNumber: sessionNumber ? parseInt(sessionNumber, 10) : undefined,
                        title: title.trim() || undefined,
                        date: date || undefined,
                        prepNotes,
                    });
                }
                setAutoSaved(new Date());
            } finally {
                setAutoSaving(false);
            }
        }, 2000);
        return () => clearTimeout(timer);
    }, [title, sessionNumber, date, prepNotes, campaignId]);

    async function save() {
        setSaving(true);
        let sessionId = createdIdRef.current;
        if (!sessionId) {
            const { data } = await client.models.CampaignSession.create({
                campaignId,
                sessionNumber: sessionNumber ? parseInt(sessionNumber, 10) : undefined,
                title: title.trim() || undefined,
                date: date || undefined,
                prepNotes,
                sessionNotes: "",
            });
            if (!data) { setSaving(false); return; }
            sessionId = data.id;
        } else {
            await client.models.CampaignSession.update({
                id: sessionId,
                sessionNumber: sessionNumber ? parseInt(sessionNumber, 10) : undefined,
                title: title.trim() || undefined,
                date: date || undefined,
                prepNotes,
            });
        }
        setSaving(false);
        router.push(`/tabletop/campaigns/${campaignId}/sessions/${sessionId}`);
    }

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                    <CalendarDays size={28} color="#8C5A3A" />
                    <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        New Session
                    </Typography>
                </Box>

                <Divider sx={{ mb: 4 }} />

                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <Box sx={{ display: "flex", gap: 2 }}>
                        <TextField
                            label="Session #" type="number" sx={{ width: 120 }}
                            value={sessionNumber} onChange={e => setNumber(e.target.value)}
                            inputProps={{ min: 1 }}
                        />
                        <TextField
                            label="Title" fullWidth placeholder="e.g. The Siege of Ironhaven"
                            value={title} onChange={e => setTitle(e.target.value)}
                        />
                        <TextField
                            label="Date" type="date" sx={{ width: 180 }}
                            value={date} onChange={e => setDate(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Box>

                    <TextField
                        label="Prep Notes" multiline minRows={14} fullWidth
                        placeholder={"Notes for before the session — encounters, hooks, NPCs, locations...\n\nYou can add session recap notes after the session runs."}
                        value={prepNotes} onChange={e => setPrep(e.target.value)}
                        sx={{ "& textarea": { fontFamily: "inherit", fontSize: "0.95rem" } }}
                    />

                    <Box sx={{ display: "flex", gap: 2, alignItems: "center", justifyContent: "flex-end" }}>
                        {autoSaving && (
                            <Typography variant="caption" sx={{ color: "text.disabled" }}>Saving…</Typography>
                        )}
                        {!autoSaving && autoSaved && (
                            <Typography variant="caption" sx={{ color: "text.disabled" }}>
                                Draft saved at {autoSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </Typography>
                        )}
                        <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}>Cancel</Button>
                        <Button variant="contained" onClick={save} disabled={saving}
                            sx={{ backgroundColor: "primary.main" }}>
                            {saving ? <CircularProgress size={18} /> : "Create Session"}
                        </Button>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}
