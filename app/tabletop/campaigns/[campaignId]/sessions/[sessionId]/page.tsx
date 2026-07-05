"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Box, Container, Typography, Button, TextField,
    CircularProgress, Divider, IconButton, Tooltip,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Chip, InputAdornment, Switch,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Pencil, Save, X, Trash2, CalendarDays, BookOpen, Search, Plus, Image } from "lucide-react";
import { MarkdownContent } from "@/lib/MarkdownContent";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { useAutosaveDefault } from "@/lib/useAutosaveDefault";
import { NoteImages } from "../../_dashboard-shared/NoteImages";

const client = generateClient<Schema>();
type Session = Schema["CampaignSession"]["type"];
type Article = Schema["WikiArticle"]["type"];

const ARTICLE_TYPE_COLORS: Record<string, string> = {
    Settlement: "#0e7490", Location: "#92400e", Landmark: "#7e22ce",
    Person: "#1d4ed8", Organization: "#15803d", Lore: "#374151",
};

export default function SessionPage() {
    const { campaignId, sessionId } = useParams<{ campaignId: string; sessionId: string }>();
    const router = useRouter();

    const [session, setSession]       = useState<Session | null>(null);
    const [pinned, setPinned]         = useState<Article[]>([]);
    const [allArticles, setAll]       = useState<Article[]>([]);
    const [editing, setEditing]       = useState(false);
    const [loading, setLoading]       = useState(true);
    const [saving, setSaving]         = useState(false);
    const [autosaving, setAutosaving] = useState(false);
    const [lastAutosaved, setLastAutosaved] = useState<Date | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const { autosaveDefault, autosaveDefaultLoaded, setAutosaveDefault } = useAutosaveDefault();
    const [autosaveEnabled, setAutosaveEnabled] = useState(true);
    const autosaveSeededRef = useRef(false);

    useEffect(() => {
        if (autosaveDefaultLoaded && !autosaveSeededRef.current) {
            setAutosaveEnabled(autosaveDefault);
            autosaveSeededRef.current = true;
        }
    }, [autosaveDefaultLoaded, autosaveDefault]);
    const [articleSearch, setArticleSearch] = useState("");
    const [pinDialogOpen, setPinDialog]     = useState(false);

    const [title, setTitle]        = useState("");
    const [number, setNumber]      = useState("");
    const [date, setDate]          = useState("");
    const [prepNotes, setPrep]     = useState("");
    const [sessionNotes, setNotes] = useState("");
    const [playerSummary, setPlayerSummary] = useState("");
    const [imageKeys, setImageKeys] = useState<string[]>([]);

    const isDirty = useMemo(() => {
        if (!session || !editing) return false;
        return (
            title !== (session.title ?? "") ||
            number !== (session.sessionNumber?.toString() ?? "") ||
            date !== (session.date ?? "") ||
            prepNotes !== (session.prepNotes ?? "") ||
            sessionNotes !== (session.sessionNotes ?? "") ||
            playerSummary !== (session.playerSummary ?? "")
        );
    }, [session, editing, title, number, date, prepNotes, sessionNotes, playerSummary]);

    useEffect(() => {
        function handler(e: BeforeUnloadEvent) {
            if (isDirty) { e.preventDefault(); e.returnValue = ""; }
        }
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [isDirty]);

    useEffect(() => {
        if (!editing || !autosaveEnabled || !isDirty) return;
        const timer = setTimeout(() => { silentSave(); }, 4000);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing, autosaveEnabled, isDirty, title, number, date, prepNotes, sessionNotes, playerSummary]);

    async function load() {
        const { data: s } = await client.models.CampaignSession.get({ id: sessionId });
        setSession(s);
        if (s) {
            setTitle(s.title ?? "");
            setNumber(s.sessionNumber?.toString() ?? "");
            setDate(s.date ?? "");
            setPrep(s.prepNotes ?? "");
            setNotes(s.sessionNotes ?? "");
            setPlayerSummary(s.playerSummary ?? "");
            setImageKeys((s.imageKeys ?? []).filter((k): k is string => !!k));

            // Load campaign → worldIds → articles
            const { data: campaign } = await client.models.Campaign.get({ id: campaignId });
            if (campaign?.worldIds?.length) {
                const { data: articles } = await client.models.WikiArticle.list();
                const worldArticles = (articles ?? []).filter(a =>
                    (campaign.worldIds ?? []).includes(a.worldId)
                ).sort((a, b) => a.title.localeCompare(b.title));
                setAll(worldArticles);
                const ids = s.articleIds ?? [];
                setPinned(worldArticles.filter(a => ids.includes(a.id)));
            }
        }
        setLoading(false);
    }

    useEffect(() => { load(); }, [sessionId]);

    async function silentSave() {
        if (!session) return;
        setAutosaving(true);
        await client.models.CampaignSession.update({
            id: session.id,
            title: title.trim() || undefined,
            sessionNumber: number ? parseInt(number, 10) : undefined,
            date: date || undefined,
            prepNotes,
            sessionNotes,
            playerSummary: playerSummary || undefined,
        });
        setSession(prev => prev ? {
            ...prev,
            title: title.trim() || null,
            sessionNumber: number ? parseInt(number, 10) : null,
            date: date || null,
            prepNotes,
            sessionNotes,
            playerSummary: playerSummary || null,
        } : prev);
        setAutosaving(false);
        setLastAutosaved(new Date());
    }

    async function save() {
        if (!session) return;
        setSaving(true);
        await client.models.CampaignSession.update({
            id: session.id,
            title: title.trim() || undefined,
            sessionNumber: number ? parseInt(number, 10) : undefined,
            date: date || undefined,
            prepNotes,
            sessionNotes,
            playerSummary: playerSummary || undefined,
        });
        setSaving(false);
        setEditing(false);
        load();
    }

    async function deleteSession() {
        if (!session) return;
        await client.models.CampaignSession.delete({ id: session.id });
        router.push(`/tabletop/campaigns/${campaignId}`);
    }

    async function updateImageKeys(keys: string[]) {
        if (!session) return;
        setImageKeys(keys); // optimistic
        await client.models.CampaignSession.update({ id: session.id, imageKeys: keys });
    }

    async function togglePin(article: Article) {
        if (!session) return;
        const current = session.articleIds ?? [];
        const alreadyPinned = current.includes(article.id);
        const next = alreadyPinned
            ? current.filter(id => id !== article.id)
            : [...current, article.id];
        await client.models.CampaignSession.update({ id: session.id, articleIds: next });
        load();
    }

    function cancelEdit() {
        if (session) {
            setTitle(session.title ?? "");
            setNumber(session.sessionNumber?.toString() ?? "");
            setDate(session.date ?? "");
            setPrep(session.prepNotes ?? "");
            setNotes(session.sessionNotes ?? "");
            setPlayerSummary(session.playerSummary ?? "");
        }
        setEditing(false);
    }

    const pinnedIds = useMemo(() => new Set(pinned.map(a => a.id)), [pinned]);

    const searchResults = useMemo(() => {
        if (!articleSearch.trim()) return allArticles.slice(0, 20);
        const q = articleSearch.toLowerCase();
        return allArticles.filter(a =>
            a.title.toLowerCase().includes(q) ||
            a.excerpt?.toLowerCase().includes(q)
        ).slice(0, 20);
    }, [allArticles, articleSearch]);

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );

    if (!session) return (
        <Box sx={{ textAlign: "center", pt: 12 }}>
            <Typography color="error">Session not found.</Typography>
            <Button component={Link} href={`/tabletop/campaigns/${campaignId}`} sx={{ mt: 2 }}>
                Back to Campaign
            </Button>
        </Box>
    );

    const displayTitle  = session.title || "Untitled Session";
    const displayNumber = session.sessionNumber ? `Session #${session.sessionNumber}` : "Session";

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                {editing ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <Box sx={{ display: "flex", gap: 2 }}>
                            <TextField label="Session #" type="number" sx={{ width: 120 }}
                                value={number} onChange={e => setNumber(e.target.value)}
                                inputProps={{ min: 1 }} />
                            <TextField label="Title" fullWidth
                                value={title} onChange={e => setTitle(e.target.value)} />
                            <TextField label="Date" type="date" sx={{ width: 180 }}
                                value={date} onChange={e => setDate(e.target.value)}
                                InputLabelProps={{ shrink: true }} />
                        </Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "primary.dark" }}>
                            Prep Notes
                        </Typography>
                        <TextField multiline minRows={10} fullWidth label="Prep Notes"
                            value={prepNotes} onChange={e => setPrep(e.target.value)}
                            sx={{ "& textarea": { fontFamily: "inherit", fontSize: "0.95rem" } }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "primary.dark" }}>
                            Session Recap
                        </Typography>
                        <TextField multiline minRows={10} fullWidth label="Session Notes / Recap"
                            value={sessionNotes} onChange={e => setNotes(e.target.value)}
                            sx={{ "& textarea": { fontFamily: "inherit", fontSize: "0.95rem" } }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "primary.dark" }}>
                            Player Summary
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", mb: 0.5, display: "block" }}>
                            A player-facing recap shared with all campaign members. Keep it spoiler-free.
                        </Typography>
                        <TextField multiline minRows={5} fullWidth label="Player Summary"
                            value={playerSummary} onChange={e => setPlayerSummary(e.target.value)}
                            sx={{ "& textarea": { fontFamily: "inherit", fontSize: "0.95rem" } }} />
                        <Box sx={{ display: "flex", gap: 2, justifyContent: "space-between", alignItems: "center" }}>
                            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                <Switch size="small" checked={autosaveEnabled}
                                    onChange={e => setAutosaveEnabled(e.target.checked)} />
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>Autosave</Typography>
                                {autosaveDefaultLoaded && autosaveEnabled !== autosaveDefault && (
                                    <Button size="small" onClick={() => setAutosaveDefault(autosaveEnabled)}
                                        sx={{ fontSize: "0.65rem", minWidth: 0, p: 0, textTransform: "none", color: "primary.main" }}>
                                        Set as default
                                    </Button>
                                )}
                                {autosaving ? (
                                    <Typography variant="caption" sx={{ color: "text.disabled" }}>Saving…</Typography>
                                ) : lastAutosaved ? (
                                    <Typography variant="caption" sx={{ color: "text.disabled" }}>
                                        Autosaved {lastAutosaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </Typography>
                                ) : null}
                            </Box>
                            <Box sx={{ display: "flex", gap: 2 }}>
                                <Button startIcon={<X size={16} />} onClick={cancelEdit}>Cancel</Button>
                                <Button variant="contained" startIcon={<Save size={16} />}
                                    onClick={save} disabled={saving} sx={{ backgroundColor: "primary.main" }}>
                                    {saving ? <CircularProgress size={18} /> : "Save"}
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                ) : (
                    <>
                        {/* Header */}
                        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                <CalendarDays size={28} color="#8C5A3A" />
                                <Box>
                                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                                        {displayNumber}{session.date ? ` · ${session.date}` : ""}
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>
                                        {displayTitle}
                                    </Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: "flex", gap: 0.5 }}>
                                <Tooltip title="Edit session">
                                    <IconButton onClick={() => setEditing(true)} size="small">
                                        <Pencil size={18} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete session">
                                    <IconButton size="small" color="error" onClick={() => setConfirmDelete(true)}>
                                        <Trash2 size={18} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>

                        <Divider sx={{ my: 3 }} />

                        {/* Prep Notes */}
                        <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.dark", mb: 1 }}>
                            Prep Notes
                        </Typography>
                        {session.prepNotes ? (
                            <Box sx={{ mb: 4 }}>
                                <MarkdownContent>{session.prepNotes}</MarkdownContent>
                            </Box>
                        ) : (
                            <Typography sx={{ color: "text.secondary", fontStyle: "italic", mb: 4 }}>
                                No prep notes.
                            </Typography>
                        )}

                        <Divider sx={{ my: 3 }} />

                        {/* Session Recap */}
                        <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.dark", mb: 1 }}>
                            Session Recap
                        </Typography>
                        {session.sessionNotes ? (
                            <MarkdownContent>{session.sessionNotes}</MarkdownContent>
                        ) : (
                            <Box sx={{ textAlign: "center", py: 4 }}>
                                <Typography sx={{ color: "text.secondary", fontStyle: "italic", mb: 2 }}>
                                    No session recap yet.
                                </Typography>
                                <Button variant="outlined" startIcon={<Pencil size={16} />}
                                    onClick={() => setEditing(true)}
                                    sx={{ borderColor: "primary.main", color: "primary.main" }}>
                                    Add recap
                                </Button>
                            </Box>
                        )}

                        <Divider sx={{ my: 3 }} />

                        {/* Player Summary */}
                        <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.dark", mb: 0.5 }}>
                            Player Summary
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                            Shared with all campaign members
                        </Typography>
                        {session.playerSummary ? (
                            <MarkdownContent>{session.playerSummary}</MarkdownContent>
                        ) : (
                            <Typography sx={{ color: "text.secondary", fontStyle: "italic" }}>
                                No player summary yet.
                            </Typography>
                        )}

                        <Divider sx={{ my: 3 }} />

                        {/* ── Pinned Articles ── */}
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <BookOpen size={18} color="#8C5A3A" />
                                <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.dark" }}>
                                    Pinned Articles
                                </Typography>
                                {pinned.length > 0 && (
                                    <Chip label={pinned.length} size="small"
                                        sx={{ backgroundColor: "primary.main", color: "#fff", height: 18, fontSize: "0.7rem" }} />
                                )}
                            </Box>
                            {allArticles.length > 0 && (
                                <Button size="small" startIcon={<Plus size={14} />}
                                    onClick={() => { setArticleSearch(""); setPinDialog(true); }}
                                    sx={{ color: "primary.main" }}>
                                    Pin article
                                </Button>
                            )}
                        </Box>

                        {pinned.length === 0 ? (
                            <Typography sx={{ color: "text.secondary", fontStyle: "italic", fontSize: "0.9rem" }}>
                                No articles pinned.{allArticles.length > 0
                                    ? " Pin wiki articles that are relevant to this session."
                                    : " Link a world to this campaign to pin articles."}
                            </Typography>
                        ) : (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                {pinned.map(a => (
                                    <Box key={a.id} sx={{
                                        display: "flex", alignItems: "center",
                                        border: "1px solid", borderColor: "divider",
                                        borderRadius: 1.5, px: 1.5, py: 1,
                                        gap: 1,
                                    }}>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <Typography component={Link}
                                                    href={`/tabletop/worlds/${a.worldId}/wiki/${a.id}`}
                                                    variant="body2" sx={{
                                                        fontWeight: 600, color: "primary.dark",
                                                        textDecoration: "none",
                                                        "&:hover": { textDecoration: "underline" },
                                                    }}>
                                                    {a.title}
                                                </Typography>
                                                {a.articleType && (
                                                    <Chip label={a.articleType} size="small"
                                                        sx={{
                                                            height: 16, fontSize: "0.6rem",
                                                            backgroundColor: ARTICLE_TYPE_COLORS[a.articleType] ?? undefined,
                                                            color: ARTICLE_TYPE_COLORS[a.articleType] ? "#fff" : undefined,
                                                        }} />
                                                )}
                                            </Box>
                                            {a.excerpt && (
                                                <Typography variant="caption" sx={{
                                                    color: "text.secondary", display: "block",
                                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                }}>
                                                    {a.excerpt}
                                                </Typography>
                                            )}
                                        </Box>
                                        <Tooltip title="Unpin">
                                            <IconButton size="small" onClick={() => togglePin(a)}>
                                                <X size={14} />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </>
                )}

                {/* ── Attachments ── */}
                <Divider sx={{ my: 3 }} />
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                    <Image size={18} color="#8C5A3A" />
                    <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.dark" }}>
                        Attachments
                    </Typography>
                    {imageKeys.length > 0 && (
                        <Chip label={imageKeys.length} size="small"
                            sx={{ backgroundColor: "primary.main", color: "#fff", height: 18, fontSize: "0.7rem" }} />
                    )}
                </Box>
                <NoteImages
                    imageKeys={imageKeys}
                    storagePath={`session-notes/${campaignId}/${sessionId}`}
                    onKeysChange={updateImageKeys}
                />

                {/* ── Pin Article dialog ── */}
                <Dialog open={pinDialogOpen} onClose={() => setPinDialog(false)}
                    fullWidth maxWidth="sm">
                    <DialogTitle>Pin an Article</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus fullWidth size="small" placeholder="Search articles…"
                            value={articleSearch} onChange={e => setArticleSearch(e.target.value)}
                            sx={{ mb: 2, mt: 1 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search size={16} />
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, maxHeight: 360, overflow: "auto" }}>
                            {searchResults.map(a => {
                                const already = pinnedIds.has(a.id);
                                return (
                                    <Box key={a.id} onClick={() => togglePin(a)} sx={{
                                        display: "flex", alignItems: "center", gap: 1,
                                        px: 1.5, py: 1, borderRadius: 1, cursor: "pointer",
                                        backgroundColor: already ? "rgba(154,52,18,0.08)" : "transparent",
                                        "&:hover": { backgroundColor: "rgba(154,52,18,0.06)" },
                                    }}>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                    {a.title}
                                                </Typography>
                                                {a.articleType && (
                                                    <Chip label={a.articleType} size="small"
                                                        sx={{
                                                            height: 16, fontSize: "0.6rem",
                                                            backgroundColor: ARTICLE_TYPE_COLORS[a.articleType] ?? undefined,
                                                            color: ARTICLE_TYPE_COLORS[a.articleType] ? "#fff" : undefined,
                                                        }} />
                                                )}
                                            </Box>
                                            {a.excerpt && (
                                                <Typography variant="caption" sx={{
                                                    color: "text.secondary", display: "block",
                                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                }}>
                                                    {a.excerpt}
                                                </Typography>
                                            )}
                                        </Box>
                                        <Chip
                                            label={already ? "Pinned" : "Pin"}
                                            size="small"
                                            sx={already ? {
                                                backgroundColor: "primary.main", color: "#fff",
                                            } : {}}
                                            variant={already ? "filled" : "outlined"}
                                        />
                                    </Box>
                                );
                            })}
                            {searchResults.length === 0 && (
                                <Typography sx={{ color: "text.secondary", textAlign: "center", py: 4 }}>
                                    No articles found.
                                </Typography>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setPinDialog(false)}>Done</Button>
                    </DialogActions>
                </Dialog>

                {/* Delete confirmation */}
                <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
                    <DialogTitle>Delete session?</DialogTitle>
                    <DialogContent>
                        <Typography>This cannot be undone.</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={deleteSession}>Delete</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
