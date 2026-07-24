"use client";

import { Box, Chip, Divider, Typography } from "@mui/material";
import Link from "next/link";
import type { Schema } from "@/amplify/data/resource";

type CampaignSession = Schema["CampaignSession"]["type"];

interface SessionAnchorProps {
    session: CampaignSession;
    campaignId: string;
    isGM: boolean;
}

export function SessionAnchor({ session, campaignId, isGM }: SessionAnchorProps) {
    const title = session.title
        ? `Session ${session.sessionNumber ?? "?"}: ${session.title}`
        : `Session ${session.sessionNumber ?? "?"}`;

    return (
        <Box sx={{ my: 1 }}>
            <Divider sx={{ borderColor: "rgba(201,168,124,0.4)" }}>
                <Box
                    component={Link}
                    href={`/tabletop/campaigns/${campaignId}/sessions/${session.id}`}
                    sx={{
                        display: "flex", alignItems: "center", gap: 1,
                        textDecoration: "none",
                        px: 2, py: 0.5,
                        borderRadius: 1,
                        border: "1px solid rgba(201,168,124,0.35)",
                        backgroundColor: "rgba(201,168,124,0.08)",
                        "&:hover": { backgroundColor: "rgba(201,168,124,0.18)" },
                        transition: "background-color 0.15s",
                    }}>
                    <Typography sx={{
                        fontFamily: "'Cinzel', serif",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        color: "text.primary",
                        letterSpacing: "0.05em",
                    }}>
                        {title}
                    </Typography>
                    {session.date && (
                        <Chip label={session.date} size="small"
                            sx={{ height: 16, fontSize: "0.6rem", backgroundColor: "rgba(201,168,124,0.2)", color: "text.secondary" }} />
                    )}
                </Box>
            </Divider>
        </Box>
    );
}
