"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    Box, Container, Typography, Button, TextField,
    CircularProgress, Paper, Chip,
} from "@mui/material";
import Link from "next/link";
import { UserPlus, ScrollText } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

function JoinCampaignContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const code = searchParams.get("code") ?? "";
    const [playerName, setPlayerName] = useState("");
    const [invite, setInvite]         = useState<Schema["CampaignInvite"]["type"] | null>(null);
    const [campaign, setCampaign]     = useState<Schema["DnDCampaign"]["type"] | null>(null);
    const [loading, setLoading]       = useState(true);
    const [joining, setJoining]       = useState(false);
    const [error, setError]           = useState("");
    const [joined, setJoined]         = useState(false);

    useEffect(() => {
        if (!code) { setLoading(false); return; }
        async function fetchInvite() {
            const { data: inv } = await client.models.CampaignInvite.get({ id: code });
            if (!inv) { setError("Invite not found or expired."); setLoading(false); return; }
            if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
                setError("This invite link has expired."); setLoading(false); return;
            }
            setInvite(inv);
            const { data: camp } = await client.models.DnDCampaign.get({ id: inv.campaignId });
            setCampaign(camp);
            setLoading(false);
        }
        fetchInvite();
    }, [code]);

    async function joinCampaign() {
        if (!invite || !playerName.trim()) return;
        setJoining(true);
        await client.models.CampaignMember.create({
            campaignId: invite.campaignId,
            role:       invite.role,
            playerName: playerName.trim(),
        });
        setJoined(true);
        setJoining(false);
    }

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );

    if (!code) return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="sm">
                <Box sx={{ textAlign: "center", py: 8 }}>
                    <UserPlus size={48} color="#c9a87c" style={{ marginBottom: 16 }} />
                    <Typography variant="h5" sx={{ fontWeight: 700, color: "primary.dark", mb: 1 }}>
                        Join a Campaign
                    </Typography>
                    <Typography sx={{ color: "text.secondary", mb: 3 }}>
                        You need a valid invite link to join a campaign. Ask your GM for one.
                    </Typography>
                    <Button component={Link} href="/tabletop/campaigns" variant="outlined">
                        Browse My Campaigns
                    </Button>
                </Box>
            </Container>
        </Box>
    );

    if (error) return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="sm">
                <Box sx={{ textAlign: "center", py: 8 }}>
                    <Typography color="error" variant="h6" sx={{ mb: 2 }}>{error}</Typography>
                    <Button component={Link} href="/tabletop/campaigns" variant="outlined">
                        Go to My Campaigns
                    </Button>
                </Box>
            </Container>
        </Box>
    );

    if (joined) return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="sm">
                <Box sx={{ textAlign: "center", py: 8 }}>
                    <UserPlus size={48} color="#15803d" style={{ marginBottom: 16 }} />
                    <Typography variant="h5" sx={{ fontWeight: 700, color: "primary.dark", mb: 1 }}>
                        You&apos;re in!
                    </Typography>
                    <Typography sx={{ color: "text.secondary", mb: 3 }}>
                        You&apos;ve joined <strong>{campaign?.name ?? "the campaign"}</strong> as a {invite?.role === "gm" ? "GM" : "player"}.
                    </Typography>
                    <Button variant="contained" onClick={() => router.push(`/tabletop/campaigns/${invite!.campaignId}`)}
                        sx={{ backgroundColor: "primary.main" }}>
                        Go to Campaign
                    </Button>
                </Box>
            </Container>
        </Box>
    );

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="sm">
                <Paper elevation={2} sx={{ p: 4, borderRadius: 3, mt: 4 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                        <ScrollText size={32} color="#8C5A3A" />
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: "primary.dark" }}>
                                Join Campaign
                            </Typography>
                            {campaign && (
                                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                    {campaign.name}
                                </Typography>
                            )}
                        </Box>
                    </Box>

                    {campaign?.description && (
                        <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
                            {campaign.description}
                        </Typography>
                    )}

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
                        <Typography variant="body2">You are joining as:</Typography>
                        <Chip
                            label={invite?.role === "gm" ? "GM" : "Player"}
                            color={invite?.role === "gm" ? "warning" : "primary"}
                            size="small"
                        />
                    </Box>

                    <TextField
                        label="Your Name"
                        fullWidth
                        required
                        value={playerName}
                        onChange={e => setPlayerName(e.target.value)}
                        placeholder="How should other players know you?"
                        sx={{ mb: 3 }}
                    />

                    <Button
                        variant="contained"
                        fullWidth
                        startIcon={joining ? <CircularProgress size={16} color="inherit" /> : <UserPlus size={16} />}
                        onClick={joinCampaign}
                        disabled={joining || !playerName.trim()}
                        sx={{ backgroundColor: "primary.main", py: 1.5 }}
                    >
                        {joining ? "Joining…" : "Join Campaign"}
                    </Button>
                </Paper>
            </Container>
        </Box>
    );
}

export default function JoinCampaignPage() {
    return (
        <Suspense fallback={
            <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
                <CircularProgress sx={{ color: "primary.main" }} />
            </Box>
        }>
            <JoinCampaignContent />
        </Suspense>
    );
}
