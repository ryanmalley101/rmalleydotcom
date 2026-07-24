"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import {
    Box, Container, Typography, Button, TextField, Chip,
    Divider, CircularProgress, MenuItem, Select, FormControl,
    InputLabel, IconButton, Tooltip, Dialog, DialogTitle,
    DialogContent, DialogActions, Tabs, Tab, Autocomplete, Switch,
    FormControlLabel,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, Save, X, ChevronUp, BookOpen, ScrollText, Upload, Image as ImageIcon, ImagePlus, History, EyeOff } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import { uploadData, getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useWikiLinkInsert } from "../useWikiLinkInsert";
import { useFileDrop } from "@/lib/useFileDrop";
import { Lightbox } from "../Lightbox";
import { useAutosaveDefault } from "@/lib/useAutosaveDefault";
import { snapshotRevision } from "@/lib/wikiRevisions";
import { RevisionHistoryDialog } from "./RevisionHistoryDialog";
import { ARTICLE_TYPES, ARTICLE_TYPE_COLORS, DEFAULT_ARTICLE_TYPE } from "@/lib/wikiArticleTypes";

const client = generateClient<Schema>();
type Article = Schema["WikiArticle"]["type"];
type Session = Schema["CampaignSession"]["type"];

const STATUS_OPTIONS = ["published", "draft", "stub"] as const;
type ArticleStatus = typeof STATUS_OPTIONS[number];
const STATUS_COLOR: Record<ArticleStatus, string> = {
    published: "#2e7d32",
    draft:     "#f57c00",
    stub:      "#546e7a",
};
const STATUS_LABEL: Record<ArticleStatus, string> = {
    published: "Published",
    draft:     "Draft",
    stub:      "Stub",
};

// ── WikiContent — markdown + [[link]] rendering ───────────────────────────────
//
// Strategy: pre-process [[Title]] → [Title](wiki://Title), then let
// react-markdown handle the full markdown pass. The custom `a` component
// intercepts wiki:// hrefs and renders internal links / unresolved stubs.

function preprocessLinks(content: string): string {
    return content.replace(/\[\[([^\]]+)\]\]/g, (_, title: string) =>
        `[${title}](wiki://${encodeURIComponent(title)})`
    );
}

function WikiContent({ content, worldId, titleToId }: {
    content: string;
    worldId: string;
    titleToId: Map<string, string>;
}) {
    const processed = useMemo(() => preprocessLinks(content), [content]);

    return (
        <Box sx={{
            lineHeight: 1.8,
            "& h1,& h2,& h3,& h4": { color: "primary.dark", mt: 3, mb: 1, fontWeight: 700 },
            "& h1": { fontSize: "1.6rem" },
            "& h2": { fontSize: "1.3rem" },
            "& h3": { fontSize: "1.1rem" },
            "& p":  { mb: 1.5 },
            "& ul,& ol": { pl: 3, mb: 1.5 },
            "& li": { mb: 0.5 },
            "& blockquote": {
                borderLeft: "3px solid", borderColor: "primary.light",
                pl: 2, ml: 0, color: "text.secondary", fontStyle: "italic",
            },
            "& code": {
                fontFamily: "monospace", fontSize: "0.85em",
                backgroundColor: "rgba(0,0,0,0.06)", px: 0.5, borderRadius: 0.5,
            },
            "& pre": {
                backgroundColor: "rgba(0,0,0,0.06)", p: 1.5, borderRadius: 1,
                overflow: "auto", mb: 1.5,
                "& code": { backgroundColor: "transparent", px: 0 },
            },
            "& hr":    { my: 3, borderColor: "divider" },
            "& table": { borderCollapse: "collapse", width: "100%", mb: 1.5 },
            "& th,& td": {
                border: "1px solid", borderColor: "divider",
                px: 1.5, py: 0.75, textAlign: "left",
            },
            "& th": { backgroundColor: "rgba(0,0,0,0.04)", fontWeight: 700 },
            "& strong": { fontWeight: 700 },
        }}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a({ href, children }) {
                        if (href?.startsWith("wiki://")) {
                            const title = decodeURIComponent(href.slice(7));
                            const articleId = titleToId.get(title.toLowerCase());
                            if (articleId) {
                                return (
                                    <Link href={`/tabletop/worlds/${worldId}/wiki/${articleId}`}
                                        style={{ color: "#9a3412", fontWeight: 600, textDecoration: "underline" }}>
                                        {children}
                                    </Link>
                                );
                            }
                            return (
                                <span title="No article with this title exists yet"
                                    style={{ color: "#ea580c", fontStyle: "italic", cursor: "default" }}>
                                    {children}
                                </span>
                            );
                        }
                        return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                    },
                }}
            >
                {processed}
            </ReactMarkdown>
        </Box>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ArticlePage() {
    const { worldId, articleId } = useParams<{ worldId: string; articleId: string }>();
    const router = useRouter();

    const [article, setArticle]   = useState<Article | null>(null);
    useDocumentTitle(article?.title ?? null);
    const [allArticles, setAll]   = useState<Article[]>([]);
    const [sessions, setSessions] = useState<{ session: Session; campaignName: string }[]>([]);
    const [editing, setEditing]   = useState(false);
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [editTab, setEditTab]   = useState(0); // 0=write, 1=preview

    // Edit form state
    const [title, setTitle]             = useState("");
    const [articleType, setArticleType] = useState(DEFAULT_ARTICLE_TYPE);
    const [content, setContent]         = useState("");
    const [excerpt, setExcerpt]         = useState("");
    const [coverImageUrl, setCover]     = useState("");
    const [coverImageKey, setCoverKey]  = useState("");
    const [resolvedCoverUrl, setResolvedCoverUrl] = useState("");
    const [coverUploading, setCoverUploading] = useState(false);
    const [status, setStatus]           = useState<ArticleStatus>("published");
    const [visibleToPlayers, setVisibleToPlayers] = useState(true);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [parentTitle, setParentTitle] = useState("");
    const [tags, setTags]               = useState<string[]>([]);
    const [tagInput, setTagInput]       = useState("");
    const [galleryKeys, setGalleryKeys] = useState<string[]>([]);
    const [galleryUrls, setGalleryUrls] = useState<Record<string, string>>({});
    const [galleryUploading, setGalleryUploading] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    // Unsaved-changes tracking + leave confirmation
    const [discardAction, setDiscardAction] = useState<null | { type: "nav"; href: string } | { type: "cancelEdit" }>(null);

    // Autosave
    const { autosaveDefault, autosaveDefaultLoaded, setAutosaveDefault } = useAutosaveDefault();
    const [autosaveEnabled, setAutosaveEnabled] = useState(true);
    const [autosaving, setAutosaving]   = useState(false);
    const [lastAutosaved, setLastAutosaved] = useState<Date | null>(null);
    const autosaveSeededRef = useRef(false);

    useEffect(() => {
        if (autosaveDefaultLoaded && !autosaveSeededRef.current) {
            setAutosaveEnabled(autosaveDefault);
            autosaveSeededRef.current = true;
        }
    }, [autosaveDefaultLoaded, autosaveDefault]);

    async function load() {
        const [aRes, allRes, campRes] = await Promise.all([
            client.models.WikiArticle.get({ id: articleId }),
            client.models.WikiArticle.list(),
            client.models.Campaign.list(),
        ]);
        const a = aRes.data;
        setArticle(a);
        setAll((allRes.data ?? []).filter(x => x.worldId === worldId));
        if (a) {
            setTitle(a.title);
            setArticleType(a.articleType ?? DEFAULT_ARTICLE_TYPE);
            setContent(a.content ?? "");
            setExcerpt(a.excerpt ?? "");
            setCover(a.coverImageUrl ?? "");
            setCoverKey(a.coverImageKey ?? "");
            setStatus((a.status as ArticleStatus | null) ?? "published");
            setVisibleToPlayers(a.visibleToPlayers ?? true);
            setParentTitle(a.parentTitle ?? "");
            setTags((a.tags ?? []).filter((t): t is string => t != null));
            const keys = (a.galleryImageKeys ?? []).filter((k): k is string => k != null);
            setGalleryKeys(keys);

            // Resolve cover image: S3 key takes priority over URL
            if (a.coverImageKey) {
                try {
                    const { url } = await getUrl({ path: a.coverImageKey, options: { expiresIn: 3600 } });
                    setResolvedCoverUrl(url.toString());
                } catch { setResolvedCoverUrl(a.coverImageUrl ?? ""); }
            } else {
                setResolvedCoverUrl(a.coverImageUrl ?? "");
            }

            // Resolve gallery image URLs
            if (keys.length) {
                const resolved: Record<string, string> = {};
                await Promise.all(keys.map(async key => {
                    try {
                        const { url } = await getUrl({ path: key, options: { expiresIn: 3600 } });
                        resolved[key] = url.toString();
                    } catch { /* skip unresolvable key */ }
                }));
                setGalleryUrls(resolved);
            } else {
                setGalleryUrls({});
            }

            // Find sessions that pin this article
            const campaigns = campRes.data ?? [];
            const relevantCampaigns = campaigns.filter(c =>
                (c.worldIds ?? []).includes(worldId)
            );
            if (relevantCampaigns.length > 0) {
                const sessionPromises = relevantCampaigns.map(c =>
                    client.models.CampaignSession.list().then(r =>
                        (r.data ?? [])
                            .filter(s => s.campaignId === c.id && (s.articleIds ?? []).includes(a.id))
                            .map(s => ({ session: s, campaignName: c.name }))
                    )
                );
                const nested = await Promise.all(sessionPromises);
                setSessions(nested.flat());
            }
        }
        setLoading(false);
    }

    useEffect(() => { load(); }, [articleId]);

    const titleToId = useMemo(() => {
        const map = new Map<string, string>();
        for (const a of allArticles) map.set(a.title.toLowerCase(), a.id);
        return map;
    }, [allArticles]);

    const parentOptions = useMemo(() =>
        allArticles.filter(a => a.id !== articleId).map(a => a.title).sort(),
    [allArticles, articleId]);

    const { textareaRef: linkTextareaRef, handleKeyDown: handleLinkKeyDown, dialog: linkDialog } =
        useWikiLinkInsert({ content, setContent, articleTitles: parentOptions });

    const isDirty = useMemo(() => {
        if (!article || !editing) return false;
        const articleTags = (article.tags ?? []).filter((t): t is string => t != null);
        const articleGallery = (article.galleryImageKeys ?? []).filter((k): k is string => k != null);
        return (
            title !== article.title ||
            articleType !== (article.articleType ?? DEFAULT_ARTICLE_TYPE) ||
            content !== (article.content ?? "") ||
            excerpt !== (article.excerpt ?? "") ||
            coverImageUrl !== (article.coverImageUrl ?? "") ||
            coverImageKey !== (article.coverImageKey ?? "") ||
            status !== ((article.status as ArticleStatus | null) ?? "published") ||
            visibleToPlayers !== (article.visibleToPlayers ?? true) ||
            parentTitle !== (article.parentTitle ?? "") ||
            JSON.stringify(tags) !== JSON.stringify(articleTags) ||
            JSON.stringify(galleryKeys) !== JSON.stringify(articleGallery)
        );
    }, [article, editing, title, articleType, content, excerpt,
        coverImageUrl, coverImageKey, status, visibleToPlayers, parentTitle, tags, galleryKeys]);

    // Warn on browser-level exits (refresh, close tab, type a new URL) while dirty.
    useEffect(() => {
        function handler(e: BeforeUnloadEvent) {
            if (isDirty) { e.preventDefault(); e.returnValue = ""; }
        }
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [isDirty]);

    // Debounced autosave while editing.
    useEffect(() => {
        if (!editing || !autosaveEnabled || !isDirty) return;
        const timer = setTimeout(() => { silentSave(); }, 4000);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing, autosaveEnabled, isDirty, title, articleType, content,
        excerpt, coverImageUrl, coverImageKey, status, visibleToPlayers, parentTitle, tags, galleryKeys]);

    async function uploadCover(file: File) {
        setCoverUploading(true);
        const ext = file.name.split(".").pop() ?? "jpg";
        const key = `wiki-covers/${worldId}/${articleId}.${ext}`;
        try {
            await uploadData({ path: key, data: file, options: { contentType: file.type } }).result;
            const { url } = await getUrl({ path: key, options: { expiresIn: 3600 } });
            setCoverKey(key);
            setResolvedCoverUrl(url.toString());
            setCover("");
        } finally {
            setCoverUploading(false);
        }
    }
    const coverDrop = useFileDrop(files => { if (files[0]) uploadCover(files[0]); });

    async function uploadGalleryFiles(files: File[]) {
        setGalleryUploading(true);
        try {
            const newKeys: string[] = [];
            const newUrls: Record<string, string> = {};
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const ext = file.name.split(".").pop() ?? "jpg";
                const key = `wiki-gallery/${worldId}/${articleId}/${Date.now()}-${i}.${ext}`;
                try {
                    await uploadData({ path: key, data: file, options: { contentType: file.type } }).result;
                    const { url } = await getUrl({ path: key, options: { expiresIn: 3600 } });
                    newKeys.push(key);
                    newUrls[key] = url.toString();
                } catch { /* skip failed upload */ }
            }
            setGalleryKeys(prev => [...prev, ...newKeys]);
            setGalleryUrls(prev => ({ ...prev, ...newUrls }));
        } finally {
            setGalleryUploading(false);
        }
    }
    function removeGalleryImage(key: string) {
        setGalleryKeys(prev => prev.filter(k => k !== key));
    }
    const galleryDrop = useFileDrop(uploadGalleryFiles);
    function handleGalleryFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        if (files.length) uploadGalleryFiles(files);
        e.target.value = "";
    }

    function buildUpdatePayload() {
        return {
            title: title.trim(),
            articleType,
            content,
            excerpt: excerpt.trim() || undefined,
            coverImageUrl: coverImageUrl.trim() || undefined,
            coverImageKey: coverImageKey || undefined,
            status,
            visibleToPlayers,
            parentTitle: parentTitle.trim() || undefined,
            tags: tags.length > 0 ? tags : undefined,
            galleryImageKeys: galleryKeys.length > 0 ? galleryKeys : undefined,
        };
    }

    async function save() {
        if (!title.trim() || !article) return;
        setSaving(true);
        await snapshotRevision(article);
        await client.models.WikiArticle.update({ id: article.id, ...buildUpdatePayload() });
        setSaving(false);
        setEditing(false);
        load();
    }

    // Saves quietly without leaving edit mode or re-fetching (avoids cursor jumps).
    async function silentSave() {
        if (!title.trim() || !article) return;
        setAutosaving(true);
        await snapshotRevision(article);
        const payload = buildUpdatePayload();
        await client.models.WikiArticle.update({ id: article.id, ...payload });
        setArticle(prev => prev ? {
            ...prev,
            title: payload.title,
            articleType: payload.articleType,
            content: payload.content ?? null,
            excerpt: payload.excerpt ?? null,
            coverImageUrl: payload.coverImageUrl ?? null,
            coverImageKey: payload.coverImageKey ?? null,
            status: payload.status,
            visibleToPlayers: payload.visibleToPlayers,
            parentTitle: payload.parentTitle ?? null,
            tags: payload.tags ?? null,
            galleryImageKeys: payload.galleryImageKeys ?? null,
        } : prev);
        setAutosaving(false);
        setLastAutosaved(new Date());
    }

    async function deleteArticle() {
        if (!article) return;
        await client.models.WikiArticle.delete({ id: article.id });
        router.push(`/tabletop/worlds/${worldId}`);
    }

    function cancelEdit() {
        if (article) {
            setTitle(article.title);
            setArticleType(article.articleType ?? DEFAULT_ARTICLE_TYPE);
            setContent(article.content ?? "");
            setExcerpt(article.excerpt ?? "");
            setCover(article.coverImageUrl ?? "");
            setCoverKey(article.coverImageKey ?? "");
            setStatus((article.status as ArticleStatus | null) ?? "published");
            setVisibleToPlayers(article.visibleToPlayers ?? true);
            setParentTitle(article.parentTitle ?? "");
            setTags((article.tags ?? []).filter((t): t is string => t != null));
            setGalleryKeys((article.galleryImageKeys ?? []).filter((k): k is string => k != null));
        }
        setEditing(false);
        setEditTab(0);
        setTagInput("");
    }

    function requestCancelEdit() {
        if (isDirty) setDiscardAction({ type: "cancelEdit" });
        else cancelEdit();
    }

    function requestNav(href: string) {
        if (isDirty) setDiscardAction({ type: "nav", href });
        else router.push(href);
    }

    function confirmDiscard() {
        const action = discardAction;
        setDiscardAction(null);
        if (!action) return;
        if (action.type === "nav") router.push(action.href);
        else cancelEdit();
    }

    const childArticles = useMemo(() =>
        article ? allArticles.filter(a =>
            a.id !== article.id &&
            a.parentTitle?.toLowerCase() === article.title.toLowerCase()
        ) : [],
    [allArticles, article]);

    const backlinks = useMemo(() =>
        article ? allArticles.filter(a =>
            a.id !== article.id &&
            a.content?.includes(`[[${article.title}]]`)
        ) : [],
    [allArticles, article]);

    const viewGalleryUrls = useMemo(() =>
        ((article?.galleryImageKeys ?? []).filter((k): k is string => k != null))
            .map(k => galleryUrls[k]).filter((u): u is string => !!u),
    [article, galleryUrls]);

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );

    if (!article) return (
        <Box sx={{ textAlign: "center", pt: 12 }}>
            <Typography color="error">Article not found.</Typography>
            <Button component={Link} href={`/tabletop/worlds/${worldId}`} sx={{ mt: 2 }}>
                Back to World
            </Button>
        </Box>
    );

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button onClick={() => requestNav(`/tabletop/worlds/${worldId}`)}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back to World
                </Button>

                {editing ? (
                    /* ── Edit mode ── */
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <TextField label="Title" required fullWidth
                            value={title} onChange={e => setTitle(e.target.value)} />
                        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                            <FormControl sx={{ minWidth: 160 }}>
                                <InputLabel>Article Type</InputLabel>
                                <Select label="Article Type" value={articleType}
                                    onChange={e => setArticleType(e.target.value)}>
                                    {ARTICLE_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <FormControl sx={{ minWidth: 140 }}>
                                <InputLabel>Status</InputLabel>
                                <Select label="Status" value={status}
                                    onChange={e => setStatus(e.target.value as ArticleStatus)}>
                                    {STATUS_OPTIONS.map(s => (
                                        <MenuItem key={s} value={s}>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: STATUS_COLOR[s] }} />
                                                {STATUS_LABEL[s]}
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControlLabel sx={{ ml: 0.5 }}
                                control={<Switch checked={visibleToPlayers} onChange={e => setVisibleToPlayers(e.target.checked)} />}
                                label={<Typography variant="body2">Visible to players</Typography>} />
                        </Box>
                        <TextField label="Excerpt" fullWidth multiline minRows={2}
                            placeholder="Short one-paragraph summary shown in article lists."
                            value={excerpt} onChange={e => setExcerpt(e.target.value)} />

                        {/* Cover image — upload or URL */}
                        <Box>
                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.75 }}>
                                Cover Image
                            </Typography>
                            <Box {...coverDrop.dropHandlers}
                                sx={{
                                    display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap",
                                    p: 1.5, border: "2px dashed",
                                    borderColor: coverDrop.isDragging ? "primary.main" : "divider",
                                    borderRadius: 2,
                                    backgroundColor: coverDrop.isDragging ? "rgba(154,52,18,0.06)" : "transparent",
                                    transition: "border-color 0.15s, background-color 0.15s",
                                }}>
                                {resolvedCoverUrl && (
                                    <Box sx={{ position: "relative" }}>
                                        <Box component="img" src={resolvedCoverUrl} alt="Cover"
                                            sx={{ width: 80, height: 52, objectFit: "cover", borderRadius: 1, display: "block" }} />
                                        <IconButton size="small"
                                            onClick={() => { setCoverKey(""); setCover(""); setResolvedCoverUrl(""); }}
                                            sx={{ position: "absolute", top: -6, right: -6, p: 0.25,
                                                backgroundColor: "error.main", color: "#fff",
                                                "&:hover": { backgroundColor: "error.dark" }, width: 18, height: 18 }}>
                                            <X size={10} />
                                        </IconButton>
                                    </Box>
                                )}
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, flex: 1, minWidth: 200 }}>
                                    <Button size="small" variant="outlined" startIcon={coverUploading ? <CircularProgress size={12} /> : <Upload size={14} />}
                                        onClick={() => coverInputRef.current?.click()}
                                        disabled={coverUploading}
                                        sx={{ alignSelf: "flex-start", borderColor: "primary.main", color: "primary.main", fontSize: "0.75rem" }}>
                                        {coverUploading ? "Uploading…" : coverImageKey ? "Replace image" : "Upload image"}
                                    </Button>
                                    <input ref={coverInputRef} type="file" accept="image/*" hidden
                                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f); }} />
                                    <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.7rem" }}>
                                        or drag and drop an image
                                    </Typography>
                                    {!coverImageKey && (
                                        <TextField size="small" label="Or paste URL" fullWidth
                                            placeholder="https://…"
                                            value={coverImageUrl}
                                            onChange={e => { setCover(e.target.value); setResolvedCoverUrl(e.target.value); }}
                                            sx={{ "& input": { fontSize: "0.8rem" } }} />
                                    )}
                                    {coverImageKey && (
                                        <Typography variant="caption" sx={{ color: "text.disabled" }}>
                                            Uploaded image
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        </Box>

                        {/* Gallery — supplemental images */}
                        <Box>
                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.75 }}>
                                Gallery
                            </Typography>
                            <Box {...galleryDrop.dropHandlers}
                                sx={{
                                    display: "flex", flexWrap: "wrap", gap: 1.5, p: 1.5,
                                    border: "2px dashed",
                                    borderColor: galleryDrop.isDragging ? "primary.main" : "divider",
                                    borderRadius: 2,
                                    backgroundColor: galleryDrop.isDragging ? "rgba(154,52,18,0.06)" : "transparent",
                                    transition: "border-color 0.15s, background-color 0.15s",
                                }}>
                                {galleryKeys.map(key => (
                                    <Box key={key} sx={{ position: "relative" }}>
                                        {galleryUrls[key] ? (
                                            <Box component="img" src={galleryUrls[key]} alt=""
                                                sx={{ width: 72, height: 72, objectFit: "cover", borderRadius: 1, display: "block" }} />
                                        ) : (
                                            <Box sx={{ width: 72, height: 72, borderRadius: 1,
                                                backgroundColor: "rgba(0,0,0,0.06)", display: "flex",
                                                alignItems: "center", justifyContent: "center" }}>
                                                <CircularProgress size={16} />
                                            </Box>
                                        )}
                                        <IconButton size="small" onClick={() => removeGalleryImage(key)}
                                            sx={{ position: "absolute", top: -6, right: -6, p: 0.25,
                                                backgroundColor: "error.main", color: "#fff",
                                                "&:hover": { backgroundColor: "error.dark" }, width: 18, height: 18 }}>
                                            <X size={10} />
                                        </IconButton>
                                    </Box>
                                ))}
                                <Box onClick={() => galleryInputRef.current?.click()}
                                    sx={{
                                        width: 72, height: 72, display: "flex", flexDirection: "column",
                                        alignItems: "center", justifyContent: "center", gap: 0.5,
                                        border: "1px dashed", borderColor: "primary.light", borderRadius: 1,
                                        cursor: "pointer", color: "primary.main",
                                        "&:hover": { backgroundColor: "rgba(154,52,18,0.04)" },
                                    }}>
                                    {galleryUploading ? <CircularProgress size={16} /> : <ImagePlus size={18} />}
                                    <Typography sx={{ fontSize: "0.6rem" }}>Add</Typography>
                                </Box>
                                <input ref={galleryInputRef} type="file" accept="image/*" multiple hidden
                                    onChange={handleGalleryFileSelect} />
                            </Box>
                            <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.7rem", display: "block", mt: 0.5 }}>
                                Supplemental images — alternate forms, reference art, etc. Drag and drop or click Add.
                            </Typography>
                        </Box>

                        <Autocomplete
                            freeSolo
                            fullWidth
                            options={parentOptions}
                            inputValue={parentTitle}
                            onInputChange={(_, newValue) => setParentTitle(newValue)}
                            renderInput={params => (
                                <TextField {...params} label="Parent Article"
                                    placeholder="Search for an article…" />
                            )}
                        />

                        {/* Tags */}
                        <Box>
                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.75 }}>Tags</Typography>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
                                {tags.map(t => (
                                    <Chip key={t} label={t} size="small" onDelete={() => setTags(tags.filter(x => x !== t))} />
                                ))}
                            </Box>
                            <Box sx={{ display: "flex", gap: 1 }}>
                                <TextField size="small" placeholder="Add tag…" value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            const t = tagInput.trim();
                                            if (t && !tags.includes(t)) setTags([...tags, t]);
                                            setTagInput("");
                                        }
                                    }} />
                                <Button size="small" onClick={() => {
                                    const t = tagInput.trim();
                                    if (t && !tags.includes(t)) setTags([...tags, t]);
                                    setTagInput("");
                                }}>Add</Button>
                            </Box>
                        </Box>

                        {/* Content with Write/Preview tabs */}
                        <Box>
                            <Tabs value={editTab} onChange={(_, v) => setEditTab(v)}
                                sx={{ mb: 1, minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0 } }}>
                                <Tab label="Write" />
                                <Tab label="Preview" />
                            </Tabs>
                            {editTab === 0 ? (
                                <TextField label="Content" multiline minRows={20} fullWidth
                                    placeholder="Use [[Article Title]] to link, or select text and press Ctrl+K. Markdown supported: **bold**, # headings, - lists, > quotes, | tables."
                                    value={content} onChange={e => setContent(e.target.value)}
                                    inputRef={linkTextareaRef} onKeyDown={handleLinkKeyDown}
                                    sx={{ "& textarea": { fontFamily: "monospace", fontSize: "0.9rem" } }}
                                />
                            ) : (
                                <Box sx={{
                                    border: "1px solid", borderColor: "divider", borderRadius: 1,
                                    p: 2, minHeight: 400, backgroundColor: "background.paper",
                                }}>
                                    {content.trim() ? (
                                        <WikiContent content={content} worldId={worldId} titleToId={titleToId} />
                                    ) : (
                                        <Typography sx={{ color: "text.disabled", fontStyle: "italic" }}>
                                            Nothing to preview yet.
                                        </Typography>
                                    )}
                                </Box>
                            )}
                        </Box>

                        <Typography variant="caption" sx={{ color: "text.disabled" }}>
                            <strong>[[Article Title]]</strong> creates a wiki link, or select text and press{" "}
                            <strong>Ctrl+K</strong> to search for an article. Markdown formatting is supported.
                            Unresolved links appear in orange.
                        </Typography>
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
                                <Button startIcon={<X size={16} />} onClick={requestCancelEdit}>Cancel</Button>
                                <Button variant="contained" startIcon={<Save size={16} />}
                                    onClick={save} disabled={saving || !title.trim()}
                                    sx={{ backgroundColor: "primary.main" }}>
                                    {saving ? <CircularProgress size={18} /> : "Save"}
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                ) : (
                    /* ── View mode ── */
                    <>
                        {resolvedCoverUrl && (
                            <Box component="img" src={resolvedCoverUrl} alt={article.title}
                                sx={{ width: "100%", maxHeight: 280, objectFit: "cover",
                                      borderRadius: 2, mb: 3, display: "block" }} />
                        )}

                        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1 }}>
                            <Box sx={{ flex: 1 }}>
                                {article.parentTitle && (
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                                        <ChevronUp size={14} color="#92400e" />
                                        {titleToId.has(article.parentTitle.toLowerCase()) ? (
                                            <Link href={`/tabletop/worlds/${worldId}/wiki/${titleToId.get(article.parentTitle.toLowerCase())}`}
                                                style={{ color: "#92400e", fontSize: "0.8rem", textDecoration: "none" }}>
                                                {article.parentTitle}
                                            </Link>
                                        ) : (
                                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                                {article.parentTitle}
                                            </Typography>
                                        )}
                                    </Box>
                                )}
                                <Typography variant="h3" sx={{ fontWeight: 700, color: "primary.dark" }}>
                                    {article.title}
                                </Typography>
                                <Box sx={{ display: "flex", gap: 1, mt: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                                    {article.articleType && (
                                        <Chip label={article.articleType} size="small"
                                            sx={{ backgroundColor: ARTICLE_TYPE_COLORS[article.articleType] ?? "#555", color: "#fff" }} />
                                    )}
                                    {article.status && article.status !== "published" && (
                                        <Chip label={STATUS_LABEL[article.status as ArticleStatus] ?? article.status}
                                            size="small"
                                            sx={{ backgroundColor: STATUS_COLOR[article.status as ArticleStatus] ?? "#555",
                                                color: "#fff", fontSize: "0.6rem", height: 18 }} />
                                    )}
                                    {article.visibleToPlayers === false && (
                                        <Chip icon={<EyeOff size={11} />} label="GM Only" size="small"
                                            sx={{ backgroundColor: "#6a1b9a", color: "#fff", fontSize: "0.6rem", height: 18 }} />
                                    )}
                                    {(article.tags ?? []).map(tag => (
                                        <Chip key={tag} label={tag} size="small" variant="outlined"
                                            sx={{ fontSize: "0.65rem", height: 20 }} />
                                    ))}
                                </Box>
                            </Box>
                            <Box sx={{ display: "flex", gap: 0.5, ml: 2 }}>
                                <Tooltip title="Revision history">
                                    <IconButton onClick={() => setHistoryOpen(true)} size="small">
                                        <History size={18} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit article">
                                    <IconButton onClick={() => setEditing(true)} size="small">
                                        <Pencil size={18} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete article">
                                    <IconButton size="small" color="error" onClick={() => setConfirmDelete(true)}>
                                        <Trash2 size={18} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Box>

                        {article.excerpt && (
                            <Typography variant="body1" sx={{
                                color: "text.secondary", fontStyle: "italic",
                                borderLeft: "3px solid", borderColor: "primary.light",
                                pl: 2, mt: 1.5, mb: 0.5, lineHeight: 1.7,
                            }}>
                                {article.excerpt}
                            </Typography>
                        )}

                        <Divider sx={{ my: 3 }} />

                        {article.content ? (
                            <WikiContent content={article.content} worldId={worldId} titleToId={titleToId} />
                        ) : (
                            <Box sx={{ textAlign: "center", py: 8 }}>
                                <Typography sx={{ color: "text.secondary", mb: 2 }}>
                                    This article has no content yet.
                                </Typography>
                                <Button variant="outlined" startIcon={<Pencil size={16} />}
                                    onClick={() => setEditing(true)}
                                    sx={{ borderColor: "primary.main", color: "primary.main" }}>
                                    Add content
                                </Button>
                            </Box>
                        )}

                        {/* Gallery */}
                        {viewGalleryUrls.length > 0 && (
                            <Box sx={{ mt: 4 }}>
                                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                                    Gallery:
                                </Typography>
                                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                                    {viewGalleryUrls.map((url, i) => (
                                        <Box key={url} component="img" src={url} alt=""
                                            onClick={() => setLightboxIndex(i)}
                                            sx={{ width: 96, height: 96, objectFit: "cover", borderRadius: 1,
                                                cursor: "pointer", display: "block",
                                                "&:hover": { opacity: 0.85 } }} />
                                    ))}
                                </Box>
                            </Box>
                        )}

                        {/* Child articles */}
                        {childArticles.length > 0 && (
                            <Box sx={{ mt: 6 }}>
                                <Divider sx={{ mb: 2 }} />
                                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                                    Sub-articles:
                                </Typography>
                                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                    {childArticles.map(a => (
                                        <Chip key={a.id} label={a.title} size="small" clickable
                                            component={Link} href={`/tabletop/worlds/${worldId}/wiki/${a.id}`}
                                            sx={a.articleType ? {
                                                backgroundColor: ARTICLE_TYPE_COLORS[a.articleType] ?? undefined,
                                                color: "#fff",
                                            } : {}} />
                                    ))}
                                </Box>
                            </Box>
                        )}

                        {/* Backlinks */}
                        {backlinks.length > 0 && (
                            <Box sx={{ mt: childArticles.length > 0 ? 3 : 6 }}>
                                {childArticles.length === 0 && <Divider sx={{ mb: 2 }} />}
                                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                                    Linked from:
                                </Typography>
                                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                    {backlinks.map(a => (
                                        <Chip key={a.id} label={a.title} size="small" clickable
                                            component={Link} href={`/tabletop/worlds/${worldId}/wiki/${a.id}`} />
                                    ))}
                                </Box>
                            </Box>
                        )}

                        {/* Linked sessions */}
                        {sessions.length > 0 && (
                            <Box sx={{ mt: 3 }}>
                                <Divider sx={{ mb: 2 }} />
                                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                                    Referenced in sessions:
                                </Typography>
                                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                    {sessions.map(({ session, campaignName }) => (
                                        <Chip key={session.id}
                                            icon={<ScrollText size={12} />}
                                            label={`${campaignName} — ${session.title || `Session ${session.sessionNumber}`}`}
                                            size="small" clickable component={Link}
                                            href={`/tabletop/campaigns/${session.campaignId}/sessions/${session.id}`}
                                            sx={{ borderColor: "secondary.main" }}
                                            variant="outlined" />
                                    ))}
                                </Box>
                            </Box>
                        )}
                    </>
                )}

                <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
                    <DialogTitle>Delete "{article.title}"?</DialogTitle>
                    <DialogContent>
                        <Typography>This cannot be undone. Links to this article will become unresolved.</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={deleteArticle}>Delete</Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={!!discardAction} onClose={() => setDiscardAction(null)}>
                    <DialogTitle>Discard unsaved changes?</DialogTitle>
                    <DialogContent>
                        <Typography>You have unsaved edits to this article. Leaving now will discard them.</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDiscardAction(null)}>Keep editing</Button>
                        <Button color="error" variant="contained" onClick={confirmDiscard}>Discard</Button>
                    </DialogActions>
                </Dialog>

                <Lightbox images={viewGalleryUrls} index={lightboxIndex}
                    onClose={() => setLightboxIndex(null)} onIndexChange={setLightboxIndex} />

                <RevisionHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)}
                    article={article} onRestored={load} />

                {linkDialog}
            </Container>
        </Box>
    );
}
