"use client";

import { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { ScrollText } from "lucide-react";
import type { Schema } from "@/amplify/data/resource";
import { EventCard, EVENT_TYPE_META } from "./EventCard";
import { SessionAnchor } from "./SessionAnchor";

type TimelineEvent = Schema["TimelineEvent"]["type"];
type CampaignSession = Schema["CampaignSession"]["type"];
type WikiArticle = Schema["WikiArticle"]["type"];

interface TimelineViewProps {
    events: TimelineEvent[];
    sessions: CampaignSession[];
    articles: WikiArticle[];
    campaignId: string;
    isGM: boolean;
    onEdit?: (event: TimelineEvent) => void;
    onDelete?: (event: TimelineEvent) => void;
}

type MergedEntry =
    | { kind: "event"; item: TimelineEvent; sortKey: string }
    | { kind: "session"; item: CampaignSession; sortKey: string };

// Sort key helpers — ISO date or createdAt for events, session.date or
// sessionNumber encoded as a high-value string for sessions without dates.
function eventSortKey(e: TimelineEvent): string {
    if (e.realDate) return e.realDate;
    return `9999-${e.createdAt ?? ""}`;
}

function sessionSortKey(s: CampaignSession): string {
    if (s.date) return s.date;
    const num = s.sessionNumber ?? 9999;
    return `9998-${String(num).padStart(6, "0")}`;
}

export function TimelineView({
    events, sessions, articles, campaignId, isGM, onEdit, onDelete,
}: TimelineViewProps) {
    const articleMap = useMemo(() => {
        const m: Record<string, { title: string; worldId: string }> = {};
        for (const a of articles) m[a.id] = { title: a.title, worldId: a.worldId };
        return m;
    }, [articles]);

    const merged: MergedEntry[] = useMemo(() => {
        const entries: MergedEntry[] = [
            ...events.map(e => ({ kind: "event" as const, item: e, sortKey: eventSortKey(e) })),
            ...sessions.map(s => ({ kind: "session" as const, item: s, sortKey: sessionSortKey(s) })),
        ];
        return entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }, [events, sessions]);

    if (merged.length === 0) {
        return (
            <Box sx={{ textAlign: "center", py: 10 }}>
                <ScrollText size={40} color="rgba(201,168,124,0.5)" style={{ marginBottom: 12 }} />
                <Typography sx={{ color: "text.secondary" }}>
                    No sessions or events yet. Create your first event to begin the chronicle.
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ position: "relative" }}>
            {/* Vertical timeline line */}
            <Box sx={{
                position: "absolute",
                left: "1.1rem",
                top: 0, bottom: 0,
                width: "3px",
                backgroundColor: "rgba(201,168,124,0.35)",
                borderRadius: 2,
                zIndex: 0,
            }} />

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {merged.map((entry, idx) => {
                    if (entry.kind === "session") {
                        return (
                            <Box key={`session-${entry.item.id}`} sx={{ pl: "2.5rem", position: "relative", zIndex: 1 }}>
                                {/* Node on line */}
                                <Box sx={{
                                    position: "absolute", left: "0.62rem", top: "50%", transform: "translateY(-50%)",
                                    width: 12, height: 12, borderRadius: "50%",
                                    backgroundColor: "rgba(201,168,124,0.9)",
                                    border: "2px solid rgba(201,168,124,0.4)",
                                    zIndex: 2,
                                }} />
                                <SessionAnchor session={entry.item} campaignId={campaignId} isGM={isGM} />
                            </Box>
                        );
                    }

                    const event = entry.item;
                    const meta = EVENT_TYPE_META[event.eventType ?? "other"] ?? EVENT_TYPE_META.other;

                    return (
                        <Box key={`event-${event.id}`} sx={{ pl: "2.5rem", position: "relative", zIndex: 1 }}>
                            {/* Node on line */}
                            <Box sx={{
                                position: "absolute", left: "0.6rem", top: "1.1rem",
                                width: 14, height: 14, borderRadius: "50%",
                                backgroundColor: meta.color,
                                border: "2px solid rgba(240,230,208,0.8)",
                                zIndex: 2,
                                display: "flex", alignItems: "center", justifyContent: "center",
                            }} />
                            <EventCard
                                event={event}
                                articleMap={articleMap}
                                isGM={isGM}
                                defaultExpanded={idx === merged.length - 1}
                                onEdit={onEdit}
                                onDelete={onDelete}
                            />
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}
