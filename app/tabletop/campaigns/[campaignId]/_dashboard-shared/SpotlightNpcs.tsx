"use client";

import { useState, useEffect, useMemo } from "react";
import { Box, Paper, Typography, TextField, Chip, IconButton, InputAdornment } from "@mui/material";
import { Search, X } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { ensureNpcLink } from "@/lib/npcLinks";

const client = generateClient<Schema>();
type NPC = Schema["NPC"]["type"];
type WikiArticle = Schema["WikiArticle"]["type"];

interface SpotlightNpcsProps {
    campaignId: string;
    worldIds: string[];
    pinnedIds: string[];
    onTogglePin: (npcId: string) => void;
}

// An NPC is a WikiArticle (articleType "Character") plus this campaign's
// tracking state (alive/dead, relationship, notes) — see lib/npcLinks.ts.
export function SpotlightNpcs({ campaignId, worldIds, pinnedIds, onTogglePin }: SpotlightNpcsProps) {
    const [npcs, setNpcs] = useState<NPC[]>([]);
    const [articles, setArticles] = useState<WikiArticle[]>([]);
    const [search, setSearch] = useState("");
    const [linking, setLinking] = useState<string | null>(null);

    useEffect(() => {
        client.models.NPC.list().then(({ data }) => {
            setNpcs((data ?? []).filter(n => n.campaignId === campaignId));
        });
    }, [campaignId]);

    useEffect(() => {
        if (worldIds.length === 0) return;
        client.models.WikiArticle.list().then(({ data }) => {
            setArticles((data ?? []).filter(a => worldIds.includes(a.worldId) && a.articleType === "Character"));
        });
    }, [worldIds]);

    const articleById = useMemo(() => new Map(articles.map(a => [a.id, a])), [articles]);

    const pinned = useMemo(() => npcs.filter(n => pinnedIds.includes(n.id)), [npcs, pinnedIds]);
    const results = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        const pinnedArticleIds = new Set(pinned.map(n => n.articleId));
        return articles
            .filter(a => !pinnedArticleIds.has(a.id) && a.title.toLowerCase().includes(q))
            .slice(0, 8);
    }, [articles, search, pinned]);

    async function pinArticle(article: WikiArticle) {
        setLinking(article.id);
        const npcId = await ensureNpcLink(campaignId, article.id);
        const { data } = await client.models.NPC.get({ id: npcId });
        if (data) setNpcs(prev => prev.some(n => n.id === npcId) ? prev : [...prev, data]);
        setLinking(null);
        setSearch("");
        onTogglePin(npcId);
    }

    return (
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            {pinned.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.disabled", mb: 1.5 }}>
                    No NPCs pinned. Search below to pin a few likely to show up this session.
                </Typography>
            ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 1.5 }}>
                    {pinned.map(npc => {
                        const article = articleById.get(npc.articleId);
                        return (
                            <Box key={npc.id} sx={{ borderLeft: "3px solid", borderColor: "secondary.main", pl: 1.5, py: 0.5,
                                display: "flex", alignItems: "flex-start", gap: 1 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{article?.title ?? "(deleted article)"}</Typography>
                                        {npc.isAlive === false && <Chip label="Deceased" size="small" color="error" sx={{ height: 18, fontSize: "0.6rem" }} />}
                                    </Box>
                                    {npc.relationship && (
                                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                                            {npc.relationship}
                                        </Typography>
                                    )}
                                    {(npc.notes || article?.excerpt) && (
                                        <Typography variant="caption" sx={{ color: "text.disabled", display: "block" }}>
                                            {npc.notes || article?.excerpt}
                                        </Typography>
                                    )}
                                </Box>
                                <IconButton size="small" onClick={() => onTogglePin(npc.id)} sx={{ p: 0.25 }}>
                                    <X size={12} />
                                </IconButton>
                            </Box>
                        );
                    })}
                </Box>
            )}
            <TextField size="small" fullWidth placeholder="Search NPCs (Character wiki articles) to pin…" value={search}
                onChange={e => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment> }} />
            {results.length > 0 && (
                <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {results.map(article => (
                        <Chip key={article.id} label={article.title} size="small" clickable
                            disabled={linking === article.id}
                            onClick={() => pinArticle(article)}
                            sx={{ fontSize: "0.68rem" }} />
                    ))}
                </Box>
            )}
            {search.trim() && results.length === 0 && (
                <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mt: 1 }}>
                    No matching "Character" wiki articles. Create one from the Wiki section above, then it'll show up here.
                </Typography>
            )}
        </Paper>
    );
}
