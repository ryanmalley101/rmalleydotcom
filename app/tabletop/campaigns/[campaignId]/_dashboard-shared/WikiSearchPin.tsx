"use client";

import { useState, useEffect, useMemo } from "react";
import { Box, Paper, Typography, TextField, IconButton, InputAdornment, Chip, Tooltip } from "@mui/material";
import { Search, Pin, EyeOff, PanelTopOpen } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { WikiArticleWindow } from "./WikiArticleWindow";

const client = generateClient<Schema>();
type WikiArticle = Schema["WikiArticle"]["type"];

interface WikiSearchPinProps {
    worldIds: string[];
    pinnedIds: string[];
    onTogglePin: (articleId: string) => void;
}

function ArticleRow({ article, isPinned, isOpen, onOpen, onTogglePin }: {
    article: WikiArticle; isPinned: boolean; isOpen: boolean;
    onOpen: () => void; onTogglePin: () => void;
}) {
    return (
        <Box sx={{ borderLeft: "3px solid", borderColor: isOpen ? "primary.main" : "primary.light", pl: 1.5, py: 0.5, mb: 0.5,
            backgroundColor: isOpen ? "action.selected" : "transparent" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box onClick={onOpen} sx={{ display: "flex", alignItems: "center", gap: 0.75, flex: 1, minWidth: 0, cursor: "pointer",
                    "&:hover .wiki-row-title": { textDecoration: "underline" } }}>
                    <PanelTopOpen size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                    <Typography className="wiki-row-title" variant="body2" noWrap sx={{ fontWeight: 700 }}>{article.title}</Typography>
                </Box>
                {article.articleType && <Chip label={article.articleType} size="small" sx={{ height: 18, fontSize: "0.6rem" }} />}
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
        </Box>
    );
}

export function WikiSearchPin({ worldIds, pinnedIds, onTogglePin }: WikiSearchPinProps) {
    const [articles, setArticles] = useState<WikiArticle[]>([]);
    const [search, setSearch] = useState("");
    // Articles opened in the floating window, most recent last — the window
    // shows the last one and its Back button pops the stack.
    const [history, setHistory] = useState<string[]>([]);
    const openId = history[history.length - 1] ?? null;
    const openArticle = useMemo(() => articles.find(a => a.id === openId) ?? null, [articles, openId]);

    function openInWindow(articleId: string) {
        setHistory(h => h[h.length - 1] === articleId ? h : [...h, articleId]);
    }

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
                            isOpen={openId === a.id} onOpen={() => openInWindow(a.id)}
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
                            isOpen={openId === a.id} onOpen={() => openInWindow(a.id)}
                            onTogglePin={() => onTogglePin(a.id)} />
                    ))}
                </Box>
            )}
            {openArticle && (
                <WikiArticleWindow article={openArticle} articles={articles}
                    isPinned={pinnedIds.includes(openArticle.id)} canGoBack={history.length > 1}
                    onNavigate={openInWindow} onBack={() => setHistory(h => h.slice(0, -1))}
                    onTogglePin={() => onTogglePin(openArticle.id)} onClose={() => setHistory([])} />
            )}
        </Paper>
    );
}
