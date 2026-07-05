"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import {
    Box, Container, Typography, Button, Chip, Divider,
    CircularProgress, TextField, Dialog, DialogTitle,
    DialogContent, DialogActions, Card, CardActionArea, CardContent,
    IconButton, Tooltip, Tabs, Tab, Alert, LinearProgress,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Plus, BookOpen, ScrollText, Trash2, Globe, Upload, Link2, AlertTriangle, Map as MapIcon, Wand2, EyeOff } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import { uploadData, getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import { hasBBCode, convertBBCodeToMarkdown } from "@/lib/bbcodeConverter";
import { ARTICLE_TYPE_COLORS } from "@/lib/wikiArticleTypes";

const client = generateClient<Schema>();
type World    = Schema["DnDWorld"]["type"];
type Article  = Schema["WikiArticle"]["type"];
type Campaign = Schema["Campaign"]["type"];
type WorldMap = Schema["WorldMap"]["type"];

const STATUS_COLOR: Record<string, string> = { draft: "#f57c00", stub: "#546e7a" };
const STATUS_LABEL: Record<string, string> = { draft: "Draft", stub: "Stub" };

// Extract all [[Title]] references from content
function extractLinks(content: string | null | undefined): string[] {
    if (!content) return [];
    const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
    return Array.from(matches, m => m[1]);
}

export default function WorldPage() {
    const { worldId } = useParams<{ worldId: string }>();
    const router = useRouter();

    const [world, setWorld]         = useState<World | null>(null);
    useDocumentTitle(world?.name ?? null);
    const [articles, setArticles]   = useState<Article[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [maps, setMaps]           = useState<WorldMap[]>([]);
    const [mapThumbs, setMapThumbs] = useState<Record<string, string>>({});
    const [articleThumbs, setArticleThumbs] = useState<Record<string, string>>({});
    const [tab, setTab]             = useState(0);
    const [loading, setLoading]     = useState(true);
    const [catFilter, setCatFilter] = useState("All");
    const [search, setSearch]       = useState("");
    const [deleteId, setDeleteId]   = useState<string | null>(null);

    // BBCode cleanup state
    const [fixDialog, setFixDialog]   = useState(false);
    const [fixing, setFixing]         = useState(false);
    const [fixProgress, setFixProgress] = useState({ done: 0, total: 0 });

    // Map upload state
    const [mapName, setMapName]         = useState("");
    const [mapUploading, setMapUploading] = useState(false);
    const [mapUploadProgress, setMapUploadProgress] = useState(0);
    const [newMapDialog, setNewMapDialog] = useState(false);
    const [pendingFile, setPendingFile]   = useState<File | null>(null);
    const [deleteMapId, setDeleteMapId]   = useState<string | null>(null);
    const mapFileRef = useRef<HTMLInputElement>(null);

    async function load() {
        const [wRes, aRes, cRes, mRes] = await Promise.all([
            client.models.DnDWorld.get({ id: worldId }),
            client.models.WikiArticle.list(),
            client.models.Campaign.list(),
            client.models.WorldMap.list(),
        ]);
        setWorld(wRes.data);
        setArticles((aRes.data ?? []).filter(a => a.worldId === worldId)
            .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")));
        setCampaigns((cRes.data ?? []).filter(c => (c.worldIds ?? []).includes(worldId)));
        const worldMaps = (mRes.data ?? []).filter(m => m.worldId === worldId);
        setMaps(worldMaps);

        // Load thumbnails for each map
        const thumbs: Record<string, string> = {};
        await Promise.all(worldMaps.map(async m => {
            try {
                const { url } = await getUrl({ path: m.imageKey, options: { expiresIn: 900 } });
                thumbs[m.id] = url.toString();
            } catch { /* ignore */ }
        }));
        setMapThumbs(thumbs);

        // Resolve S3 cover images for articles that use coverImageKey
        const worldArticles = (aRes.data ?? []).filter(a => a.worldId === worldId);
        const artThumbs: Record<string, string> = {};
        await Promise.all(worldArticles.filter(a => a.coverImageKey).map(async a => {
            try {
                const { url } = await getUrl({ path: a.coverImageKey!, options: { expiresIn: 900 } });
                artThumbs[a.id] = url.toString();
            } catch { /* ignore */ }
        }));
        setArticleThumbs(artThumbs);
        setLoading(false);
    }

    useEffect(() => { load(); }, [worldId]);

    async function deleteArticle() {
        if (!deleteId) return;
        await client.models.WikiArticle.delete({ id: deleteId });
        setDeleteId(null);
        load();
    }

    function handleMapFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingFile(file);
        setMapName(file.name.replace(/\.[^.]+$/, ""));
        setNewMapDialog(true);
    }

    async function uploadMap() {
        if (!pendingFile || !mapName.trim()) return;
        setMapUploading(true);
        setMapUploadProgress(0);
        const ext = pendingFile.name.split(".").pop() ?? "jpg";
        const key = `maps/${worldId}/${Date.now()}.${ext}`;
        try {
            await uploadData({
                path: key,
                data: pendingFile,
                options: {
                    contentType: pendingFile.type,
                    onProgress: ({ transferredBytes, totalBytes }) => {
                        if (totalBytes) setMapUploadProgress(Math.round((transferredBytes / totalBytes) * 100));
                    },
                },
            }).result;
            await client.models.WorldMap.create({ worldId, name: mapName.trim(), imageKey: key });
        } finally {
            setMapUploading(false);
            setNewMapDialog(false);
            setPendingFile(null);
            setMapName("");
            if (mapFileRef.current) mapFileRef.current.value = "";
            load();
        }
    }

    async function deleteMap() {
        if (!deleteMapId) return;
        await client.models.WorldMap.delete({ id: deleteMapId });
        setDeleteMapId(null);
        load();
    }

    // ── Filter chips: articleType + tags, deduped ──
    const filterOptions = useMemo(() => ["All", ...Array.from(new Set(
        articles.flatMap(a => [
            a.articleType,
            ...(a.tags ?? []),
        ].filter(Boolean) as string[])
    )).sort()], [articles]);

    // ── Filtered article list (full-text search) ──
    const filtered = useMemo(() => articles.filter(a => {
        if (catFilter !== "All") {
            const inType = a.articleType === catFilter;
            const inTags = (a.tags ?? []).includes(catFilter);
            if (!inType && !inTags) return false;
        }
        if (search) {
            const q = search.toLowerCase();
            const inTitle   = a.title.toLowerCase().includes(q);
            const inExcerpt = a.excerpt?.toLowerCase().includes(q) ?? false;
            const inContent = a.content?.toLowerCase().includes(q) ?? false;
            if (!inTitle && !inExcerpt && !inContent) return false;
        }
        return true;
    }), [articles, catFilter, search]);

    // ── Articles still containing raw BBCode (e.g. imported before the converter existed) ──
    const bbcodeArticles = useMemo(
        () => articles.filter(a => a.content && hasBBCode(a.content)),
        [articles]
    );

    async function fixFormatting() {
        setFixing(true);
        setFixProgress({ done: 0, total: bbcodeArticles.length });
        for (let i = 0; i < bbcodeArticles.length; i++) {
            const a = bbcodeArticles[i];
            try {
                await client.models.WikiArticle.update({
                    id: a.id,
                    content: convertBBCodeToMarkdown(a.content!.replace(/\r\n/g, "\n").trim()),
                });
            } catch { /* skip and continue */ }
            setFixProgress({ done: i + 1, total: bbcodeArticles.length });
        }
        setFixing(false);
        setFixDialog(false);
        load();
    }

    // ── Broken links ──
    const titleToId = useMemo(() => {
        const map = new Map<string, string>();
        for (const a of articles) map.set(a.title.toLowerCase(), a.id);
        return map;
    }, [articles]);

    const brokenLinks = useMemo(() => {
        const results: { article: Article; link: string }[] = [];
        const seen = new Set<string>();
        for (const article of articles) {
            for (const link of extractLinks(article.content)) {
                if (!titleToId.has(link.toLowerCase())) {
                    const key = `${article.id}::${link.toLowerCase()}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        results.push({ article, link });
                    }
                }
            }
        }
        return results;
    }, [articles, titleToId]);

    // Group broken links by unresolved title for a compact view
    const brokenByTarget = useMemo(() => {
        const map = new Map<string, Article[]>();
        for (const { article, link } of brokenLinks) {
            const key = link.toLowerCase();
            if (!map.has(key)) map.set(key, []);
            if (!map.get(key)!.find(a => a.id === article.id))
                map.get(key)!.push(article);
        }
        return Array.from(map.entries()).map(([k, arts]) => ({
            link: brokenLinks.find(b => b.link.toLowerCase() === k)!.link,
            articles: arts,
        })).sort((a, b) => a.link.localeCompare(b.link));
    }, [brokenLinks]);

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );

    if (!world) return (
        <Box sx={{ textAlign: "center", pt: 12 }}>
            <Typography color="error">World not found.</Typography>
        </Box>
    );

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href="/tabletop/worlds" startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}>
                    My Worlds
                </Button>

                {/* Header */}
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1 }}>
                    <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <Globe size={28} color="#8C5A3A" />
                            <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                                {world.name}
                            </Typography>
                        </Box>
                        {world.genre && (
                            <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 1, ml: 6 }}>
                                {world.genre}
                            </Typography>
                        )}
                    </Box>
                </Box>
                {world.description && (
                    <Typography variant="body1" sx={{ color: "text.secondary", mb: 4, ml: 6 }}>
                        {world.description}
                    </Typography>
                )}

                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
                    <Tab label={`Wiki (${articles.length})`} icon={<BookOpen size={16} />} iconPosition="start" />
                    <Tab label={`Campaigns (${campaigns.length})`} icon={<ScrollText size={16} />} iconPosition="start" />
                    <Tab label={`Maps (${maps.length})`} icon={<MapIcon size={16} />} iconPosition="start" />
                    <Tab
                        label={`Broken Links${brokenByTarget.length > 0 ? ` (${brokenByTarget.length})` : ""}`}
                        icon={<AlertTriangle size={16} />} iconPosition="start"
                        sx={brokenByTarget.length > 0 ? { color: "warning.main" } : {}}
                    />
                </Tabs>

                {/* ── Wiki tab ── */}
                {tab === 0 && (
                    <>
                        <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
                            <TextField
                                size="small" placeholder="Search titles, content, excerpts…" value={search}
                                onChange={e => setSearch(e.target.value)}
                                sx={{ flex: 1, minWidth: 200 }}
                            />
                            <Button variant="outlined" startIcon={<Upload size={16} />}
                                component={Link} href={`/tabletop/worlds/${worldId}/import`}
                                sx={{ borderColor: "primary.main", color: "primary.main", whiteSpace: "nowrap" }}>
                                Import
                            </Button>
                            {bbcodeArticles.length > 0 && (
                                <Button variant="outlined" color="warning" startIcon={<Wand2 size={16} />}
                                    onClick={() => setFixDialog(true)}
                                    sx={{ whiteSpace: "nowrap" }}>
                                    Fix Formatting ({bbcodeArticles.length})
                                </Button>
                            )}
                            <Button variant="outlined" startIcon={<Link2 size={16} />}
                                component={Link} href={`/tabletop/worlds/${worldId}/autolink`}
                                sx={{ borderColor: "primary.main", color: "primary.main", whiteSpace: "nowrap" }}>
                                Auto-link
                            </Button>
                            <Button variant="contained" startIcon={<Plus size={16} />}
                                component={Link} href={`/tabletop/worlds/${worldId}/wiki/new`}
                                sx={{ backgroundColor: "primary.main", whiteSpace: "nowrap" }}>
                                New Article
                            </Button>
                        </Box>

                        {/* Filter chips — types, categories, and tags all unified */}
                        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
                            {filterOptions.map(opt => (
                                <Chip key={opt} label={opt} size="small"
                                    variant={catFilter === opt ? "filled" : "outlined"}
                                    onClick={() => setCatFilter(opt)}
                                    sx={catFilter === opt ? { backgroundColor: "primary.main", color: "#fff" } : {}}
                                />
                            ))}
                        </Box>

                        {filtered.length === 0 ? (
                            <Box sx={{ textAlign: "center", py: 8 }}>
                                <BookOpen size={40} color="#c9a87c" style={{ marginBottom: 12 }} />
                                <Typography sx={{ color: "text.secondary" }}>
                                    {articles.length === 0
                                        ? "No articles yet. Create your first wiki entry."
                                        : "No articles match your search."}
                                </Typography>
                            </Box>
                        ) : (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                                {filtered.map(a => (
                                    <Card key={a.id} sx={{ borderLeft: "3px solid", borderColor: "primary.light" }}>
                                        <Box sx={{ display: "flex", alignItems: "stretch" }}>
                                            {(articleThumbs[a.id] || a.coverImageUrl) && (
                                                <Box component="img" src={articleThumbs[a.id] || a.coverImageUrl!} alt=""
                                                    sx={{ width: 56, objectFit: "cover", flexShrink: 0 }} />
                                            )}
                                            <CardActionArea component={Link}
                                                href={`/tabletop/worlds/${worldId}/wiki/${a.id}`} sx={{ flex: 1 }}>
                                                <CardContent sx={{ py: 1.5 }}>
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                                        <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.dark", fontSize: "1rem" }}>
                                                            {a.title}
                                                        </Typography>
                                                        {a.articleType && (
                                                            <Chip label={a.articleType} size="small"
                                                                sx={{ height: 18, fontSize: "0.65rem",
                                                                      backgroundColor: ARTICLE_TYPE_COLORS[a.articleType] ?? undefined,
                                                                      color: ARTICLE_TYPE_COLORS[a.articleType] ? "#fff" : undefined }} />
                                                        )}
                                                        {a.status && a.status !== "published" && (
                                                            <Chip label={STATUS_LABEL[a.status] ?? a.status} size="small"
                                                                sx={{ height: 18, fontSize: "0.6rem",
                                                                    backgroundColor: STATUS_COLOR[a.status] ?? "#555", color: "#fff" }} />
                                                        )}
                                                        {a.visibleToPlayers === false && (
                                                            <Chip icon={<EyeOff size={11} />} label="GM Only" size="small"
                                                                sx={{ height: 18, fontSize: "0.6rem", backgroundColor: "#6a1b9a", color: "#fff" }} />
                                                        )}
                                                        {(a.tags ?? []).slice(0, 3).map(tag => (
                                                            <Chip key={tag} label={tag} size="small" variant="outlined"
                                                                sx={{ height: 18, fontSize: "0.6rem" }} />
                                                        ))}
                                                    </Box>
                                                    {(a.excerpt || a.content) && (
                                                        <Typography variant="caption" sx={{
                                                            color: "text.secondary", display: "block", mt: 0.25,
                                                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                        }}>
                                                            {a.excerpt || a.content?.slice(0, 120)}
                                                        </Typography>
                                                    )}
                                                </CardContent>
                                            </CardActionArea>
                                            <Box sx={{ display: "flex", alignItems: "center", pr: 1 }}>
                                                <Tooltip title="Delete">
                                                    <IconButton size="small" color="error" onClick={() => setDeleteId(a.id)}>
                                                        <Trash2 size={14} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </Box>
                                    </Card>
                                ))}
                            </Box>
                        )}
                    </>
                )}

                {/* ── Campaigns tab ── */}
                {tab === 1 && (
                    <>
                        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                            Campaigns linked to this world. Link campaigns from the{" "}
                            <Link href="/tabletop/campaigns" style={{ color: "inherit" }}>Campaigns</Link> page.
                        </Typography>
                        {campaigns.length === 0 ? (
                            <Box sx={{ textAlign: "center", py: 8 }}>
                                <ScrollText size={40} color="#c9a87c" style={{ marginBottom: 12 }} />
                                <Typography sx={{ color: "text.secondary", mb: 2 }}>
                                    No campaigns linked to this world yet.
                                </Typography>
                                <Button variant="outlined" component={Link} href="/tabletop/campaigns"
                                    sx={{ borderColor: "primary.main", color: "primary.main" }}>
                                    Go to Campaigns
                                </Button>
                            </Box>
                        ) : (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                                {campaigns.map(c => (
                                    <Card key={c.id} sx={{ borderLeft: "3px solid", borderColor: "secondary.main" }}>
                                        <CardActionArea component={Link} href={`/tabletop/campaigns/${c.id}`}>
                                            <CardContent>
                                                <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.dark" }}>
                                                    {c.name}
                                                </Typography>
                                                {c.status && <Chip label={c.status} size="small" sx={{ mr: 1 }} />}
                                                {c.description && (
                                                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                                                        {c.description}
                                                    </Typography>
                                                )}
                                            </CardContent>
                                        </CardActionArea>
                                    </Card>
                                ))}
                            </Box>
                        )}
                    </>
                )}

                {/* ── Maps tab ── */}
                {tab === 2 && (
                    <>
                        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
                            <Button variant="contained" startIcon={<Upload size={16} />}
                                onClick={() => mapFileRef.current?.click()}
                                sx={{ backgroundColor: "primary.main" }}>
                                Upload Map
                            </Button>
                            <input ref={mapFileRef} type="file" accept="image/*" hidden
                                onChange={handleMapFileSelect} />
                        </Box>

                        {maps.length === 0 ? (
                            <Box sx={{ textAlign: "center", py: 8 }}>
                                <MapIcon size={40} color="#c9a87c" style={{ marginBottom: 12 }} />
                                <Typography sx={{ color: "text.secondary", mb: 2 }}>
                                    No maps yet. Upload an image to create your first world map.
                                </Typography>
                            </Box>
                        ) : (
                            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 2 }}>
                                {maps.map(m => (
                                    <Card key={m.id} sx={{ position: "relative", overflow: "hidden" }}>
                                        <CardActionArea component={Link}
                                            href={`/tabletop/worlds/${worldId}/maps/${m.id}`}>
                                            {mapThumbs[m.id] ? (
                                                <Box component="img" src={mapThumbs[m.id]} alt={m.name}
                                                    sx={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                                            ) : (
                                                <Box sx={{ width: "100%", height: 160, backgroundColor: "rgba(0,0,0,0.08)",
                                                           display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                    <MapIcon size={32} color="#c9a87c" />
                                                </Box>
                                            )}
                                            <CardContent sx={{ py: 1.5 }}>
                                                <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.dark", fontSize: "0.95rem" }}>
                                                    {m.name}
                                                </Typography>
                                                {m.pinsJson && (
                                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                                        {(JSON.parse(m.pinsJson) as unknown[]).length} pins
                                                    </Typography>
                                                )}
                                            </CardContent>
                                        </CardActionArea>
                                        <Tooltip title="Delete map">
                                            <IconButton size="small" color="error"
                                                onClick={() => setDeleteMapId(m.id)}
                                                sx={{ position: "absolute", top: 6, right: 6,
                                                      backgroundColor: "rgba(0,0,0,0.5)",
                                                      "&:hover": { backgroundColor: "rgba(180,0,0,0.7)" } }}>
                                                <Trash2 size={14} color="#fff" />
                                            </IconButton>
                                        </Tooltip>
                                    </Card>
                                ))}
                            </Box>
                        )}

                        {/* New map dialog */}
                        <Dialog open={newMapDialog} onClose={() => !mapUploading && setNewMapDialog(false)} maxWidth="xs" fullWidth>
                            <DialogTitle>New Map</DialogTitle>
                            <DialogContent sx={{ pt: 1 }}>
                                <TextField label="Map name" fullWidth autoFocus size="small"
                                    value={mapName} onChange={e => setMapName(e.target.value)}
                                    sx={{ mt: 1 }} />
                                {pendingFile && (
                                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1 }}>
                                        File: {pendingFile.name} ({Math.round(pendingFile.size / 1024)} KB)
                                    </Typography>
                                )}
                                {mapUploading && (
                                    <Box sx={{ mt: 2 }}>
                                        <LinearProgress variant="determinate" value={mapUploadProgress}
                                            sx={{ height: 6, borderRadius: 3,
                                                  "& .MuiLinearProgress-bar": { backgroundColor: "primary.main" } }} />
                                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                            Uploading… {mapUploadProgress}%
                                        </Typography>
                                    </Box>
                                )}
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setNewMapDialog(false)} disabled={mapUploading}>Cancel</Button>
                                <Button variant="contained" onClick={uploadMap}
                                    disabled={mapUploading || !mapName.trim()}
                                    sx={{ backgroundColor: "primary.main" }}>
                                    {mapUploading ? <CircularProgress size={18} /> : "Upload"}
                                </Button>
                            </DialogActions>
                        </Dialog>

                        {/* Delete map confirmation */}
                        <Dialog open={!!deleteMapId} onClose={() => setDeleteMapId(null)}>
                            <DialogTitle>Delete map?</DialogTitle>
                            <DialogContent>
                                <Typography>The image and all pins will be removed. This cannot be undone.</Typography>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setDeleteMapId(null)}>Cancel</Button>
                                <Button color="error" variant="contained" onClick={deleteMap}>Delete</Button>
                            </DialogActions>
                        </Dialog>
                    </>
                )}

                {/* ── Broken Links tab ── */}
                {tab === 3 && (
                    <>
                        {brokenByTarget.length === 0 ? (
                            <Alert severity="success">
                                No broken links — every <code>{"[[reference]]"}</code> in this wiki resolves to an existing article.
                            </Alert>
                        ) : (
                            <>
                                <Alert severity="warning" sx={{ mb: 3 }}>
                                    {brokenByTarget.length} unresolved reference{brokenByTarget.length !== 1 ? "s" : ""} found.
                                    Create the missing articles or correct the link text.
                                </Alert>
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    {brokenByTarget.map(({ link, articles: arts }) => (
                                        <Box key={link} sx={{
                                            border: "1px solid", borderColor: "warning.light",
                                            borderRadius: 1.5, p: 2,
                                            backgroundColor: "rgba(245,158,11,0.04)",
                                        }}>
                                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                                                <Typography sx={{ fontWeight: 700, color: "#ea580c", fontFamily: "monospace" }}>
                                                    [[{link}]]
                                                </Typography>
                                                <Button size="small" variant="outlined" component={Link}
                                                    href={`/tabletop/worlds/${worldId}/wiki/new`}
                                                    sx={{ borderColor: "primary.main", color: "primary.main", fontSize: "0.7rem" }}>
                                                    Create article
                                                </Button>
                                            </Box>
                                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
                                                Referenced in:
                                            </Typography>
                                            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                                                {arts.map(a => (
                                                    <Chip key={a.id} label={a.title} size="small" clickable
                                                        component={Link}
                                                        href={`/tabletop/worlds/${worldId}/wiki/${a.id}`}
                                                        sx={{ fontSize: "0.65rem" }} />
                                                ))}
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            </>
                        )}
                    </>
                )}

                {/* Fix formatting confirmation / progress */}
                <Dialog open={fixDialog} onClose={() => !fixing && setFixDialog(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>Fix Formatting?</DialogTitle>
                    <DialogContent>
                        {!fixing ? (
                            <Typography>
                                {bbcodeArticles.length} article{bbcodeArticles.length !== 1 ? "s" : ""} still
                                {" "}contain{bbcodeArticles.length === 1 ? "s" : ""} raw BBCode tags (e.g. <code>[p]</code>, <code>[b]</code>)
                                from an older import. This will convert them to Markdown in place.
                            </Typography>
                        ) : (
                            <Box sx={{ pt: 1 }}>
                                <Typography sx={{ mb: 1.5 }}>
                                    Fixing… {fixProgress.done} / {fixProgress.total}
                                </Typography>
                                <LinearProgress
                                    variant="determinate"
                                    value={fixProgress.total ? (fixProgress.done / fixProgress.total) * 100 : 0}
                                    sx={{ height: 6, borderRadius: 3,
                                          "& .MuiLinearProgress-bar": { backgroundColor: "primary.main" } }}
                                />
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setFixDialog(false)} disabled={fixing}>Cancel</Button>
                        <Button variant="contained" onClick={fixFormatting} disabled={fixing}
                            sx={{ backgroundColor: "primary.main" }}>
                            {fixing ? <CircularProgress size={18} /> : "Fix Now"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete article confirmation */}
                <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
                    <DialogTitle>Delete Article?</DialogTitle>
                    <DialogContent>
                        <Typography>This cannot be undone.</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={deleteArticle}>Delete</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
