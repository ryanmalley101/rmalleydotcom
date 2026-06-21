"use client";

import { useState, useEffect, useMemo } from "react";
import { Box, Paper, Typography, TextField, IconButton, InputAdornment, Collapse, Chip, Tooltip } from "@mui/material";
import { Search, Pin, ChevronDown, ChevronRight, EyeOff } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type WikiArticle = Schema["WikiArticle"]["type"];

interface WikiSearchPinProps {
    worldIds: string[];
    pinnedIds: string[];
    onTogglePin: (articleId: string) => void;
}

function ArticleRow({ article, isPinned, expanded, onToggleExpand, onTogglePin }: {
    article: WikiArticle; isPinned: boolean; expanded: boolean;
    onToggleExpand: () => void; onTogglePin: () => void;
}) {
    return (
        <Box sx={{ borderLeft: "3px solid", borderColor: "primary.light", pl: 1.5, py: 0.5, mb: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <IconButton size="small" sx={{ p: 0.25 }} onClick={onToggleExpand}>
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </IconButton>
                <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>{article.title}</Typography>
                {article.category && <Chip label={article.category} size="small" sx={{ height: 18, fontSize: "0.6rem" }} />}
                {article.visibleToPlayers === false && (
                    <Tooltip title="Not visible to players">
                        <EyeOff size={13} color="#6a1b9a" />
                    </Tooltip>
                )}
                <IconButton size="small" onClick={onTogglePin}
                    sx={{ p: 0.25, color: isPinned ? "warning.main" : "text.disabled" }}>
                    <Pin size={13} />
                </IconButton>
            </Box>
            <Collapse in={expanded}>
                <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "pre-wrap", display: "block",
                    pl: 3.5, maxHeight: 220, overflowY: "auto" }}>
                    {article.excerpt || article.content || "No content yet."}
                </Typography>
            </Collapse>
        </Box>
    );
}

export function WikiSearchPin({ worldIds, pinnedIds, onTogglePin }: WikiSearchPinProps) {
    const [articles, setArticles] = useState<WikiArticle[]>([]);
    const [search, setSearch] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        if (worldIds.length === 0) return;
        client.models.WikiArticle.list().then(({ data }) => {
            setArticles((data ?? []).filter(a => worldIds.includes(a.worldId)));
        });
    }, [worldIds]);

    const pinned = useMemo(() => articles.filter(a => pinnedIds.includes(a.id)), [articles, pinnedIds]);
    const results = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return articles.filter(a => !pinnedIds.includes(a.id) && a.title.toLowerCase().includes(q)).slice(0, 8);
    }, [articles, search, pinnedIds]);

    if (worldIds.length === 0) {
        return (
            <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="body2" sx={{ color: "text.disabled" }}>
                    No worlds linked to this campaign yet.
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            {pinned.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                    {pinned.map(a => (
                        <ArticleRow key={a.id} article={a} isPinned
                            expanded={expandedId === a.id} onToggleExpand={() => setExpandedId(expandedId === a.id ? null : a.id)}
                            onTogglePin={() => onTogglePin(a.id)} />
                    ))}
                </Box>
            )}
            <TextField size="small" fullWidth placeholder="Search wiki articles…" value={search}
                onChange={e => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment> }} />
            {results.length > 0 && (
                <Box sx={{ mt: 1 }}>
                    {results.map(a => (
                        <ArticleRow key={a.id} article={a} isPinned={false}
                            expanded={expandedId === a.id} onToggleExpand={() => setExpandedId(expandedId === a.id ? null : a.id)}
                            onTogglePin={() => onTogglePin(a.id)} />
                    ))}
                </Box>
            )}
        </Paper>
    );
}
