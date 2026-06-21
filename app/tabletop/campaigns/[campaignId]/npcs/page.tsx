"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import {
    Box, Container, Typography, Button, TextField, Chip,
    CircularProgress, Card, CardContent, CardActionArea,
    IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
    DialogActions, Collapse, Switch, FormControlLabel, Autocomplete,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Plus, Users, Trash2, ChevronDown, ChevronUp, Skull, BookOpen } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { ensureNpcLink } from "@/lib/npcLinks";
import { QuickWikiDialog } from "../_dashboard-shared/QuickWikiDialog";

const client = generateClient<Schema>();
type NPC = Schema["NPC"]["type"];
type WikiArticle = Schema["WikiArticle"]["type"];

// An NPC is a WikiArticle (category "Person") plus this campaign's tracking
// state — name/description/role/etc. all live on the article; isAlive,
// relationship, and notes are specific to running this campaign.
export default function NpcsPage() {
    const { campaignId } = useParams<{ campaignId: string }>();

    const [npcs, setNpcs]           = useState<NPC[]>([]);
    const [articles, setArticles]   = useState<WikiArticle[]>([]);
    const [worldIds, setWorldIds]   = useState<string[]>([]);
    const [loading, setLoading]     = useState(true);
    const [deleteNpc, setDeleteNpc] = useState<NPC | null>(null);
    const [expanded, setExpanded]   = useState<Record<string, boolean>>({});
    const [filter, setFilter]       = useState<"all" | "alive" | "dead">("all");
    const [addOpen, setAddOpen]     = useState(false);
    const [wikiOpen, setWikiOpen]   = useState(false);
    const [linking, setLinking]     = useState(false);

    async function load() {
        const [npcRes, campRes] = await Promise.all([
            client.models.NPC.list(),
            client.models.Campaign.get({ id: campaignId }),
        ]);
        const ids = (campRes.data?.worldIds ?? []).filter((id): id is string => id != null);
        setWorldIds(ids);
        setNpcs((npcRes.data ?? []).filter(n => n.campaignId === campaignId));
        if (ids.length > 0) {
            const { data } = await client.models.WikiArticle.list();
            setArticles((data ?? []).filter(a => ids.includes(a.worldId) && a.category === "Person"));
        }
        setLoading(false);
    }

    useEffect(() => { load(); }, [campaignId]);

    const articleById = useMemo(() => new Map(articles.map(a => [a.id, a])), [articles]);
    const unlinkedArticles = useMemo(() => {
        const linkedIds = new Set(npcs.map(n => n.articleId));
        return articles.filter(a => !linkedIds.has(a.id));
    }, [articles, npcs]);

    async function updateNpc(npc: NPC, patch: Partial<NPC>) {
        setNpcs(prev => prev.map(n => n.id === npc.id ? { ...n, ...patch } : n));
        await client.models.NPC.update({ id: npc.id, ...patch });
    }

    async function handleDelete() {
        if (!deleteNpc) return;
        await client.models.NPC.delete({ id: deleteNpc.id });
        setDeleteNpc(null);
        load();
    }

    async function linkArticle(article: WikiArticle) {
        setLinking(true);
        await ensureNpcLink(campaignId, article.id);
        setLinking(false);
        setAddOpen(false);
        load();
    }

    async function handleWikiCreated(articleId: string) {
        await ensureNpcLink(campaignId, articleId);
        setWikiOpen(false);
        load();
    }

    const filtered = npcs.filter(n =>
        filter === "all" ? true : filter === "alive" ? (n.isAlive ?? true) : !(n.isAlive ?? true)
    );

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 3, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, flexWrap: "wrap", gap: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Users size={26} color="#8C5A3A" />
                        <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>NPCs</Typography>
                        <Chip label={`${npcs.length} total`} size="small" />
                    </Box>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                        {(["all", "alive", "dead"] as const).map(f => (
                            <Chip key={f} label={f === "all" ? "All" : f === "alive" ? "Alive" : "Dead"}
                                onClick={() => setFilter(f)}
                                variant={filter === f ? "filled" : "outlined"}
                                color={filter === f ? "primary" : "default"}
                                size="small" />
                        ))}
                        <Button variant="outlined" startIcon={<BookOpen size={14} />} onClick={() => setWikiOpen(true)}>
                            New Article
                        </Button>
                        <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setAddOpen(true)}
                            sx={{ backgroundColor: "primary.main" }}>
                            Track NPC
                        </Button>
                    </Box>
                </Box>
                <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mb: 3 }}>
                    Each NPC is a "Person" wiki article — its name, description, and lore live there. This page
                    tracks who's currently relevant to this campaign, plus alive/dead status and notes.
                </Typography>

                {filtered.length === 0 ? (
                    <Box sx={{ textAlign: "center", py: 10 }}>
                        <Users size={40} color="#c9a87c" style={{ marginBottom: 12 }} />
                        <Typography sx={{ color: "text.secondary" }}>
                            {npcs.length === 0
                                ? "No NPCs tracked yet. Track an existing Person wiki article, or create a new one."
                                : "No NPCs match this filter."}
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                        {filtered.map(npc => {
                            const article = articleById.get(npc.articleId);
                            const alive = npc.isAlive ?? true;
                            return (
                                <Card key={npc.id} sx={{ borderLeft: "4px solid", borderColor: alive ? "primary.light" : "#9e9e9e" }}>
                                    <Box sx={{ display: "flex", alignItems: "stretch" }}>
                                        <CardActionArea sx={{ flex: 1 }} onClick={() => setExpanded(p => ({ ...p, [npc.id]: !p[npc.id] }))}>
                                            <CardContent sx={{ py: 1.5 }}>
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                                    {!alive && <Skull size={14} color="#9e9e9e" />}
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: alive ? "primary.dark" : "text.disabled" }}>
                                                        {article?.title ?? "(article deleted)"}
                                                    </Typography>
                                                    {(article?.tags ?? []).slice(0, 3).map(t => (
                                                        <Chip key={t} label={t} size="small" sx={{ height: 18, fontSize: "0.65rem", backgroundColor: "#8C5A3A22" }} />
                                                    ))}
                                                </Box>
                                                {article?.excerpt && !expanded[npc.id] && (
                                                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5,
                                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {article.excerpt}
                                                    </Typography>
                                                )}
                                            </CardContent>
                                        </CardActionArea>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, pr: 1 }}>
                                            <IconButton size="small" onClick={() => setExpanded(p => ({ ...p, [npc.id]: !p[npc.id] }))}>
                                                {expanded[npc.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </IconButton>
                                            {article && (
                                                <Tooltip title="Open wiki article">
                                                    <IconButton size="small" component={Link} href={`/tabletop/worlds/${article.worldId}/wiki/${article.id}`}>
                                                        <BookOpen size={14} />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            <Tooltip title="Stop tracking (article isn't deleted)">
                                                <IconButton size="small" color="error" onClick={() => setDeleteNpc(npc)}><Trash2 size={14} /></IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                    <Collapse in={!!expanded[npc.id]}>
                                        <CardContent sx={{ pt: 0, pb: "12px !important" }}>
                                            {article?.excerpt && <Typography variant="body2" sx={{ mb: 1.5 }}>{article.excerpt}</Typography>}
                                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                                                <FormControlLabel
                                                    control={<Switch checked={alive} onChange={e => updateNpc(npc, { isAlive: e.target.checked })} />}
                                                    label="Alive" />
                                                <TextField label="Relationship to party" size="small" fullWidth
                                                    value={npc.relationship ?? ""} onChange={e => updateNpc(npc, { relationship: e.target.value })} />
                                                <TextField label="Campaign notes" size="small" multiline minRows={2} fullWidth
                                                    value={npc.notes ?? ""} onChange={e => updateNpc(npc, { notes: e.target.value })} />
                                            </Box>
                                        </CardContent>
                                    </Collapse>
                                </Card>
                            );
                        })}
                    </Box>
                )}

                {/* Track an existing Person article */}
                <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Track an NPC</DialogTitle>
                    <DialogContent sx={{ pt: 2 }}>
                        {worldIds.length === 0 ? (
                            <Typography variant="body2" sx={{ color: "text.disabled" }}>
                                This campaign has no linked worlds yet — link one from the Campaign page first.
                            </Typography>
                        ) : unlinkedArticles.length === 0 ? (
                            <Typography variant="body2" sx={{ color: "text.disabled" }}>
                                No untracked "Person" wiki articles in this campaign's worlds. Create one instead.
                            </Typography>
                        ) : (
                            <Autocomplete
                                options={unlinkedArticles}
                                getOptionLabel={a => a.title}
                                onChange={(_, article) => { if (article) linkArticle(article); }}
                                loading={linking}
                                renderInput={params => <TextField {...params} label="Search Person articles…" autoFocus />}
                            />
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setAddOpen(false)}>Close</Button>
                    </DialogActions>
                </Dialog>

                <QuickWikiDialog open={wikiOpen} onClose={() => setWikiOpen(false)} worldIds={worldIds}
                    defaultCategory="Person" onCreated={handleWikiCreated} />

                {/* Stop-tracking confirmation */}
                <Dialog open={!!deleteNpc} onClose={() => setDeleteNpc(null)}>
                    <DialogTitle>Stop tracking {articleById.get(deleteNpc?.articleId ?? "")?.title ?? "this NPC"}?</DialogTitle>
                    <DialogContent>
                        <Typography>This removes it from this campaign's NPC tracker. The wiki article itself is untouched.</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteNpc(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={handleDelete}>Stop tracking</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
