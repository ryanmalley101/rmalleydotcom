"use client";

import { Box, Paper, Typography, Button } from "@mui/material";
import Link from "next/link";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type CampaignSession = Schema["CampaignSession"]["type"];

// Read-only pull-in of the latest session's prep notes — editing still
// happens on the full Sessions page, this just saves a trip to see it.
export async function loadLatestSession(campaignId: string): Promise<CampaignSession | null> {
    const { data } = await client.models.CampaignSession.list();
    const sessions = (data ?? []).filter(s => s.campaignId === campaignId);
    if (sessions.length === 0) return null;
    sessions.sort((a, b) => (b.sessionNumber ?? 0) - (a.sessionNumber ?? 0));
    return sessions[0];
}

export function SessionPrepCard({ session, campaignId }: { session: CampaignSession | null; campaignId: string }) {
    if (!session) {
        return (
            <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="body2" sx={{ color: "text.disabled" }}>
                    No sessions logged yet.
                </Typography>
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}/sessions/new`}
                    size="small" sx={{ mt: 1 }}>
                    Create one
                </Button>
            </Paper>
        );
    }

    return (
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Session {session.sessionNumber ?? "?"}{session.title ? `: ${session.title}` : ""}
                </Typography>
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}/sessions/${session.id}`}
                    size="small" sx={{ fontSize: "0.7rem" }}>
                    Open
                </Button>
            </Box>
            {session.prepNotes ? (
                <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "pre-wrap" }}>
                    {session.prepNotes}
                </Typography>
            ) : (
                <Typography variant="body2" sx={{ color: "text.disabled" }}>
                    No prep notes written for this session yet.
                </Typography>
            )}
        </Paper>
    );
}
