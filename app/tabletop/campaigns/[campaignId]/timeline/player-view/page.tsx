"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Box, Button, CircularProgress, Container, Typography } from "@mui/material";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { TimelineView } from "../_components/TimelineView";

const client = generateClient<Schema>();
type Campaign        = Schema["Campaign"]["type"];
type CampaignSession = Schema["CampaignSession"]["type"];
type TimelineEvent   = Schema["TimelineEvent"]["type"];
type WikiArticle     = Schema["WikiArticle"]["type"];

export default function TimelinePlayerView() {
    const { campaignId } = useParams<{ campaignId: string }>();

    const [campaign, setCampaign] = useState<Campaign | null>(null);
    const [sessions, setSessions] = useState<CampaignSession[]>([]);
    const [events, setEvents]     = useState<TimelineEvent[]>([]);
    const [articles, setArticles] = useState<WikiArticle[]>([]);
    const [loading, setLoading]   = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const [campaignRes, sessionsRes, eventsRes] = await Promise.all([
            client.models.Campaign.get({ id: campaignId }),
            client.models.CampaignSession.list(),
            client.models.TimelineEvent.list(),
        ]);
        const camp = campaignRes.data;
        setCampaign(camp);

        const filteredSessions = (sessionsRes.data ?? [])
            .filter(s => s.campaignId === campaignId && !!s.playerSummary)
            .sort((a, b) => (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0));
        setSessions(filteredSessions);

        // Player view: only show events the GM has marked visible
        const filteredEvents = (eventsRes.data ?? [])
            .filter(e => e.campaignId === campaignId && e.visibleToPlayers !== false);
        setEvents(filteredEvents);

        const worldIds = (camp?.worldIds ?? []).filter((id): id is string => !!id);
        if (worldIds.length > 0) {
            const artRes = await client.models.WikiArticle.list();
            // Only expose player-visible wiki articles
            setArticles((artRes.data ?? []).filter(a => worldIds.includes(a.worldId) && a.visibleToPlayers !== false));
        }
        setLoading(false);
    }, [campaignId]);

    useEffect(() => { load(); }, [load]);

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}/timeline`}
                    startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 3, color: "primary.main" }}>
                    Back to Full Timeline
                </Button>

                <Box sx={{ mb: 3 }}>
                    <Typography variant="h4" component="h1" sx={{ fontFamily: "'Cinzel', serif", fontWeight: 700 }}>
                        Chronicle
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        {campaign?.name} — Player View
                    </Typography>
                </Box>

                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <TimelineView
                        events={events}
                        sessions={sessions}
                        articles={articles}
                        campaignId={campaignId}
                        isGM={false}
                    />
                )}
            </Container>
        </Box>
    );
}
