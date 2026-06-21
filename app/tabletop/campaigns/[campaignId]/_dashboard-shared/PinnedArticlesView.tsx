"use client";

import { useState, useEffect, useMemo } from "react";
import { Box, Paper, Typography, Collapse, IconButton, Chip } from "@mui/material";
import { ChevronDown, ChevronRight } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type WikiArticle = Schema["WikiArticle"]["type"];

interface PinnedArticlesViewProps {
    worldIds: string[];
    pinnedArticleIds: string[];
}

// Read-only — used on the player-facing dashboard views. Only shows articles
// the GM hasn't marked GM-only (visibleToPlayers === false).
export function PinnedArticlesView({ worldIds, pinnedArticleIds }: PinnedArticlesViewProps) {
    const [articles, setArticles] = useState<WikiArticle[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        if (worldIds.length === 0 || pinnedArticleIds.length === 0) return;
        client.models.WikiArticle.list().then(({ data }) => {
            setArticles((data ?? []).filter(a => worldIds.includes(a.worldId) && pinnedArticleIds.includes(a.id)));
        });
    }, [worldIds, pinnedArticleIds]);

    const visible = useMemo(() => articles.filter(a => a.visibleToPlayers !== false), [articles]);

    if (visible.length === 0) return null;

    return (
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            {visible.map(article => {
                const expanded = expandedId === article.id;
                return (
                    <Box key={article.id} sx={{ borderLeft: "3px solid", borderColor: "primary.light", pl: 1.5, py: 0.5, mb: 0.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "pointer" }}
                            onClick={() => setExpandedId(expanded ? null : article.id)}>
                            <IconButton size="small" sx={{ p: 0.25 }}>
                                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </IconButton>
                            <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>{article.title}</Typography>
                            {article.category && <Chip label={article.category} size="small" sx={{ height: 18, fontSize: "0.6rem" }} />}
                        </Box>
                        <Collapse in={expanded}>
                            <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "pre-wrap", display: "block",
                                pl: 3.5, maxHeight: 220, overflowY: "auto" }}>
                                {article.excerpt || article.content || "No content yet."}
                            </Typography>
                        </Collapse>
                    </Box>
                );
            })}
        </Paper>
    );
}
