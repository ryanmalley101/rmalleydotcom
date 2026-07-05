"use client";

import { useState } from "react";
import { Box, Chip, Collapse, IconButton, Paper, Tooltip, Typography } from "@mui/material";
import Link from "next/link";
import { BookOpen, ChevronDown, ChevronRight, EyeOff, Pencil, Trash2 } from "lucide-react";
import type { Schema } from "@/amplify/data/resource";
import { MarkdownContent } from "@/lib/MarkdownContent";

type TimelineEvent = Schema["TimelineEvent"]["type"];

export const EVENT_TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
    battle:      { label: "Battle",      color: "#b91c1c", icon: "⚔" },
    death:       { label: "Death",       color: "#374151", icon: "💀" },
    revelation:  { label: "Revelation",  color: "#7c3aed", icon: "👁" },
    alliance:    { label: "Alliance",    color: "#1d4ed8", icon: "🤝" },
    quest:       { label: "Quest",       color: "#92400e", icon: "📜" },
    milestone:   { label: "Milestone",   color: "#d97706", icon: "⭐" },
    other:       { label: "Event",       color: "#6b7280", icon: "◆" },
};

interface EventCardProps {
    event: TimelineEvent;
    articleMap: Record<string, { title: string; worldId: string }>;
    isGM: boolean;
    defaultExpanded?: boolean;
    onEdit?: (event: TimelineEvent) => void;
    onDelete?: (event: TimelineEvent) => void;
}

export function EventCard({ event, articleMap, isGM, defaultExpanded = false, onEdit, onDelete }: EventCardProps) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const meta = EVENT_TYPE_META[event.eventType ?? "other"] ?? EVENT_TYPE_META.other;
    const isHidden = event.visibleToPlayers === false;
    const linkedArticles = (event.articleIds ?? []).filter((id): id is string => !!id && !!articleMap[id]);

    return (
        <Paper elevation={1} sx={{
            borderLeft: "4px solid",
            borderColor: meta.color,
            p: 0,
            overflow: "hidden",
            opacity: isHidden && !isGM ? 0 : 1, // player should never see hidden events, but just in case
        }}>
            <Box sx={{ display: "flex", alignItems: "center", px: 1.5, py: 1, gap: 1, cursor: "pointer" }}
                onClick={() => setExpanded(v => !v)}>
                <Typography sx={{ fontSize: "1.1rem", lineHeight: 1, flexShrink: 0 }}>{meta.icon}</Typography>
                <IconButton size="small" sx={{ p: 0.25, flexShrink: 0 }}>
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </IconButton>
                <Typography sx={{ fontWeight: 700, flex: 1, fontSize: "0.95rem", fontFamily: "'Cinzel', serif" }}>
                    {event.title}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                    {event.inWorldDate && (
                        <Chip label={event.inWorldDate} size="small" sx={{ fontSize: "0.62rem", height: 18 }} />
                    )}
                    {event.realDate && (
                        <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.68rem" }}>
                            {event.realDate}
                        </Typography>
                    )}
                    {isHidden && isGM && (
                        <Tooltip title="Hidden from players">
                            <EyeOff size={13} color="#6a1b9a" />
                        </Tooltip>
                    )}
                    {isGM && onEdit && (
                        <IconButton size="small" sx={{ p: 0.25 }} onClick={e => { e.stopPropagation(); onEdit(event); }}>
                            <Pencil size={13} />
                        </IconButton>
                    )}
                    {isGM && onDelete && (
                        <IconButton size="small" sx={{ p: 0.25, color: "error.main" }}
                            onClick={e => { e.stopPropagation(); onDelete(event); }}>
                            <Trash2 size={13} />
                        </IconButton>
                    )}
                </Box>
            </Box>

            <Collapse in={expanded}>
                <Box sx={{ px: 2, pb: 1.5 }}>
                    {event.description && (
                        <MarkdownContent dim sx={{ mb: 1 }}>{event.description}</MarkdownContent>
                    )}
                    {linkedArticles.length > 0 && (
                        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.5 }}>
                            <BookOpen size={12} color="#92400e" style={{ flexShrink: 0 }} />
                            {linkedArticles.map(id => {
                                const a = articleMap[id];
                                return (
                                    <Chip key={id} label={a.title} size="small"
                                        component={Link}
                                        href={`/tabletop/worlds/${a.worldId}/wiki/${id}`}
                                        clickable
                                        sx={{
                                            fontSize: "0.65rem", height: 18,
                                            backgroundColor: "rgba(146,64,14,0.1)",
                                            color: "primary.main",
                                            "&:hover": { backgroundColor: "rgba(146,64,14,0.2)" },
                                        }} />
                                );
                            })}
                        </Box>
                    )}
                </Box>
            </Collapse>
        </Paper>
    );
}
