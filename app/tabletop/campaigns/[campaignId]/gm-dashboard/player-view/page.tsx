"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Box, Container, Typography, Paper, Chip, CircularProgress } from "@mui/material";
import { Shield } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { DAMAGE_TRACK_INFO } from "@/lib/cypherRules";
import { snapshot } from "../PartyCard";
import { QuestProgress } from "../../_dashboard-shared/QuestProgress";
import { PinnedArticlesView } from "../../_dashboard-shared/PinnedArticlesView";
import { SessionAudioPlayer } from "../../_dashboard-shared/SessionAudioPlayer";

const client = generateClient<Schema>();
type PlayerCharacter = Schema["PlayerCharacter"]["type"];

interface GmScreenData { pinnedArticleIds?: string[] }

// Read-only, no GM controls or secrets — meant to be cast to a shared screen.
export default function PlayerViewPage() {
    const { campaignId } = useParams<{ campaignId: string }>();
    const [chars, setChars] = useState<PlayerCharacter[]>([]);
    const [campaignName, setCampaignName] = useState("");
    const [worldIds, setWorldIds] = useState<string[]>([]);
    const [pinnedArticleIds, setPinnedArticleIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        client.models.Campaign.get({ id: campaignId }).then(({ data }) => {
            setCampaignName(data?.name ?? "Campaign");
            setWorldIds((data?.worldIds ?? []).filter((id): id is string => id != null));
            try {
                const screen: GmScreenData = data?.gmScreenJson ? JSON.parse(data.gmScreenJson) : {};
                setPinnedArticleIds(screen.pinnedArticleIds ?? []);
            } catch { setPinnedArticleIds([]); }
        });
    }, [campaignId]);

    useEffect(() => {
        let cancelled = false;
        const filter = { campaignId: { eq: campaignId } };
        client.models.PlayerCharacter.list({ filter }).then(({ data }) => {
            if (!cancelled) setChars(data ?? []);
            setLoading(false);
        });

        const onUpdate = client.models.PlayerCharacter.onUpdate().subscribe({
            next: (item) => {
                if (!item || item.campaignId !== campaignId) return;
                setChars(prev => prev.map(c => c.id === item.id ? { ...c, ...item } : c));
            },
            error: (err) => console.error("[Player View] onUpdate subscription error", err),
        });
        return () => { cancelled = true; onUpdate.unsubscribe(); };
    }, [campaignId]);

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 6 }}>
            <Container maxWidth="md">
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
                    <Shield size={28} color="#8C5A3A" />
                    <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>{campaignName}</Typography>
                </Box>

                <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2, display: "block", mb: 1 }}>
                    Party
                </Typography>
                {chars.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "text.disabled", mb: 3 }}>No characters yet.</Typography>
                ) : (
                    <Box sx={{ mb: 4 }}>
                        {chars.map(pc => {
                            const snap = snapshot(pc);
                            const dmg = DAMAGE_TRACK_INFO[snap.damageTrack];
                            return (
                                <Paper key={pc.id} elevation={1} sx={{ p: 2, mb: 1.5, borderLeft: "4px solid", borderLeftColor: dmg.color }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                                        <Typography variant="h6" sx={{ fontWeight: 700, color: "primary.dark", flex: 1, minWidth: 100 }}>
                                            {pc.characterName}
                                        </Typography>
                                        <Chip label={`Tier ${snap.tier}`} size="small" sx={{ backgroundColor: "primary.dark", color: "#fff" }} />
                                        <Chip label={dmg.label} size="small" sx={{ backgroundColor: dmg.color, color: "#fff" }} />
                                    </Box>
                                    <Box sx={{ display: "flex", gap: 3, mt: 1.5, flexWrap: "wrap" }}>
                                        {(["might", "speed", "intellect"] as const).map(p => {
                                            const ps = snap.pools[p];
                                            return (
                                                <Box key={p}>
                                                    <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "capitalize", display: "block" }}>{p}</Typography>
                                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{ps.current}/{ps.max}</Typography>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                </Paper>
                            );
                        })}
                    </Box>
                )}

                <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2, display: "block", mb: 1 }}>
                    Active Quests
                </Typography>
                <QuestProgress campaignId={campaignId} />

                <PinnedArticlesView worldIds={worldIds} pinnedArticleIds={pinnedArticleIds} />
            </Container>

            <Paper elevation={6} sx={{ position: "fixed", bottom: 16, right: 16, zIndex: 10 }}>
                <SessionAudioPlayer campaignId={campaignId} displayName="Viewer" controlsEnabled={false} />
            </Paper>
        </Box>
    );
}
