"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import {
    ActionIcon, Alert, Anchor, Badge, Box, Button, Center,
    Group, Loader, Modal, Progress, SimpleGrid, Stack,
    Tabs, Text, TextInput, ThemeIcon, Title, Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Link from "next/link";
import {
    AlertTriangle, ArrowLeft, BookOpen, EyeOff,
    Globe, Link2, Map as MapIcon, Plus, ScrollText, Trash2, Upload, Wand2,
} from "lucide-react";
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

const T = {
    pageBg: "#1a0d05", cardBg: "#261508", cardHover: "#321b0c",
    border: "rgba(210,140,70,0.22)", borderHot: "rgba(239,107,26,0.55)",
    divider: "rgba(210,140,70,0.18)", cream: "#f0ddb5", amber: "#d4aa72",
    dimmed: "#a67c4a", accent: "#ef6b1a", heading: "#e8c060",
    deepBorder: "rgba(239,107,26,0.3)",
};

function extractLinks(content: string | null | undefined): string[] {
    if (!content) return [];
    return Array.from(content.matchAll(/\[\[([^\]]+)\]\]/g), m => m[1]);
}

// Clickable article card
function ArticleRow({ a, worldId, onDelete }: { a: Article; worldId: string; thumb?: string; onDelete: () => void }) {
    const thumb = useRef<string | undefined>();
    const [thumbUrl, setThumbUrl] = useState<string | undefined>();

    useEffect(() => {
        if (a.coverImageKey && !thumb.current) {
            getUrl({ path: a.coverImageKey, options: { expiresIn: 900 } })
                .then(({ url }) => { thumb.current = url.toString(); setThumbUrl(url.toString()); })
                .catch(() => {});
        }
    }, [a.coverImageKey]);

    const coverUrl = thumbUrl || a.coverImageUrl || undefined;

    return (
        <Box style={{
            background: T.cardBg, border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${T.accent}`, borderRadius: 6,
            display: "flex", overflow: "hidden",
        }}>
            {coverUrl && (
                <Box component="img" src={coverUrl} alt=""
                    style={{ width: 56, objectFit: "cover", flexShrink: 0 }} />
            )}
            <Anchor component={Link} href={`/tabletop/worlds/${worldId}/wiki/${a.id}`}
                underline="never" style={{ flex: 1, minWidth: 0 }}>
                <Box p="sm">
                    <Group gap={6} wrap="wrap" mb={2}>
                        <Text fw={600} size="sm" style={{ color: T.cream }}>{a.title}</Text>
                        {a.articleType && (
                            <Badge size="xs"
                                style={{
                                    background: ARTICLE_TYPE_COLORS[a.articleType] ?? T.accent,
                                    color: "#fff", border: "none", fontSize: "0.6rem",
                                }}>
                                {a.articleType}
                            </Badge>
                        )}
                        {a.status && a.status !== "published" && (
                            <Badge size="xs"
                                style={{ background: STATUS_COLOR[a.status] ?? "#555", color: "#fff", border: "none" }}>
                                {STATUS_LABEL[a.status] ?? a.status}
                            </Badge>
                        )}
                        {a.visibleToPlayers === false && (
                            <Badge size="xs" leftSection={<EyeOff size={9} />}
                                style={{ background: "#6a1b9a", color: "#fff", border: "none" }}>
                                GM Only
                            </Badge>
                        )}
                        {(a.tags ?? []).slice(0, 3).map(tag => (
                            <Badge key={tag} size="xs" variant="outline"
                                style={{ borderColor: T.border, color: T.dimmed, fontSize: "0.6rem" }}>
                                {tag}
                            </Badge>
                        ))}
                    </Group>
                    {(a.excerpt || a.content) && (
                        <Text size="xs" lineClamp={1} style={{ color: T.dimmed }}>
                            {a.excerpt || a.content?.slice(0, 120)}
                        </Text>
                    )}
                </Box>
            </Anchor>
            <Group align="center" pr="xs">
                <Tooltip label="Delete">
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={onDelete}>
                        <Trash2 size={14} />
                    </ActionIcon>
                </Tooltip>
            </Group>
        </Box>
    );
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
    const [loading, setLoading]     = useState(true);
    const [catFilter, setCatFilter] = useState("All");
    const [search, setSearch]       = useState("");
    const [deleteId, setDeleteId]   = useState<string | null>(null);

    const [fixDialog, { open: openFix, close: closeFix }]       = useDisclosure(false);
    const [newMapDialog, { open: openNewMap, close: closeNewMap }] = useDisclosure(false);
    const [fixing, setFixing]           = useState(false);
    const [fixProgress, setFixProgress] = useState({ done: 0, total: 0 });
    const [mapName, setMapName]         = useState("");
    const [mapUploading, setMapUploading]   = useState(false);
    const [mapUploadProgress, setMapUploadProgress] = useState(0);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [deleteMapId, setDeleteMapId] = useState<string | null>(null);
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

        const thumbs: Record<string, string> = {};
        await Promise.all(worldMaps.map(async m => {
            try {
                const { url } = await getUrl({ path: m.imageKey, options: { expiresIn: 900 } });
                thumbs[m.id] = url.toString();
            } catch { /* ignore */ }
        }));
        setMapThumbs(thumbs);
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
        openNewMap();
    }

    async function uploadMap() {
        if (!pendingFile || !mapName.trim()) return;
        setMapUploading(true);
        setMapUploadProgress(0);
        const ext = pendingFile.name.split(".").pop() ?? "jpg";
        const key = `maps/${worldId}/${Date.now()}.${ext}`;
        try {
            await uploadData({
                path: key, data: pendingFile,
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
            closeNewMap();
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

    const filterOptions = useMemo(() => ["All", ...Array.from(new Set(
        articles.flatMap(a => [a.articleType, ...(a.tags ?? [])].filter(Boolean) as string[])
    )).sort()], [articles]);

    const filtered = useMemo(() => articles.filter(a => {
        if (catFilter !== "All") {
            if (a.articleType !== catFilter && !(a.tags ?? []).includes(catFilter)) return false;
        }
        if (search) {
            const q = search.toLowerCase();
            if (!a.title.toLowerCase().includes(q) &&
                !a.excerpt?.toLowerCase().includes(q) &&
                !a.content?.toLowerCase().includes(q)) return false;
        }
        return true;
    }), [articles, catFilter, search]);

    const bbcodeArticles = useMemo(() => articles.filter(a => a.content && hasBBCode(a.content)), [articles]);

    async function fixFormatting() {
        setFixing(true);
        setFixProgress({ done: 0, total: bbcodeArticles.length });
        for (let i = 0; i < bbcodeArticles.length; i++) {
            try {
                await client.models.WikiArticle.update({
                    id: bbcodeArticles[i].id,
                    content: convertBBCodeToMarkdown(bbcodeArticles[i].content!.replace(/\r\n/g, "\n").trim()),
                });
            } catch { /* skip */ }
            setFixProgress({ done: i + 1, total: bbcodeArticles.length });
        }
        setFixing(false);
        closeFix();
        load();
    }

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
                    if (!seen.has(key)) { seen.add(key); results.push({ article, link }); }
                }
            }
        }
        return results;
    }, [articles, titleToId]);

    const brokenByTarget = useMemo(() => {
        const map = new Map<string, Article[]>();
        for (const { article, link } of brokenLinks) {
            const key = link.toLowerCase();
            if (!map.has(key)) map.set(key, []);
            if (!map.get(key)!.find(a => a.id === article.id)) map.get(key)!.push(article);
        }
        return Array.from(map.entries()).map(([k, arts]) => ({
            link: brokenLinks.find(b => b.link.toLowerCase() === k)!.link, articles: arts,
        })).sort((a, b) => a.link.localeCompare(b.link));
    }, [brokenLinks]);

    if (loading) return (
        <Center mih="100vh" style={{ background: T.pageBg }}>
            <Loader style={{ color: T.accent }} />
        </Center>
    );

    if (!world) return (
        <Center mih="100vh" style={{ background: T.pageBg }}>
            <Text c="red">World not found.</Text>
        </Center>
    );

    return (
        <Box mih="100vh" py="xl" style={{ background: T.pageBg }}>
            <Box maw={768} mx="auto" px="md">
                <Button component={Link} href="/tabletop/worlds" variant="subtle" size="sm" mb="xl"
                    leftSection={<ArrowLeft size={14} />} style={{ color: T.accent }}>
                    My Worlds
                </Button>

                <Group gap="sm" mb={4} align="flex-start" justify="space-between">
                    <Box>
                        <Group gap="sm">
                            <ThemeIcon size="lg" radius="sm" style={{ background: `${T.accent}22`, color: T.accent }}>
                                <Globe size={20} />
                            </ThemeIcon>
                            <Title order={2} style={{ color: T.heading }}>{world.name}</Title>
                        </Group>
                        {world.genre && (
                            <Text size="xs" tt="uppercase" style={{ letterSpacing: 1, color: T.dimmed, marginLeft: 44 }}>
                                {world.genre}
                            </Text>
                        )}
                    </Box>
                </Group>
                {world.description && (
                    <Text size="sm" style={{ color: T.amber, marginLeft: 44 }} mb="lg">{world.description}</Text>
                )}

                <Tabs defaultValue="wiki"
                    styles={{
                        tab: { color: T.dimmed, "&[dataActive]": { color: T.accent, borderColor: T.accent } },
                        root: { "--tabs-color": T.accent },
                    }}>
                    <Tabs.List mb="lg" style={{ borderColor: T.divider }}>
                        <Tabs.Tab value="wiki" leftSection={<BookOpen size={14} />}>
                            Wiki ({articles.length})
                        </Tabs.Tab>
                        <Tabs.Tab value="campaigns" leftSection={<ScrollText size={14} />}>
                            Campaigns ({campaigns.length})
                        </Tabs.Tab>
                        <Tabs.Tab value="maps" leftSection={<MapIcon size={14} />}>
                            Maps ({maps.length})
                        </Tabs.Tab>
                        <Tabs.Tab value="broken"
                            leftSection={<AlertTriangle size={14} style={{ color: brokenByTarget.length > 0 ? "#f59e0b" : undefined }} />}
                            style={{ color: brokenByTarget.length > 0 ? "#f59e0b" : undefined }}>
                            Broken Links{brokenByTarget.length > 0 ? ` (${brokenByTarget.length})` : ""}
                        </Tabs.Tab>
                    </Tabs.List>

                    {/* ── Wiki tab ── */}
                    <Tabs.Panel value="wiki">
                        <Group gap="sm" mb="sm" wrap="wrap">
                            <TextInput
                                placeholder="Search titles, content, excerpts…"
                                value={search} onChange={e => setSearch(e.target.value)}
                                style={{ flex: 1, minWidth: 200 }}
                                styles={{ input: { background: T.cardBg, borderColor: T.border, color: T.cream } }}
                            />
                            <Button component={Link} href={`/tabletop/worlds/${worldId}/import`}
                                variant="outline" size="sm" leftSection={<Upload size={14} />}
                                style={{ borderColor: T.border, color: T.amber }}>
                                Import
                            </Button>
                            {bbcodeArticles.length > 0 && (
                                <Button variant="outline" size="sm" color="orange"
                                    leftSection={<Wand2 size={14} />} onClick={openFix}>
                                    Fix Formatting ({bbcodeArticles.length})
                                </Button>
                            )}
                            <Button component={Link} href={`/tabletop/worlds/${worldId}/autolink`}
                                variant="outline" size="sm" leftSection={<Link2 size={14} />}
                                style={{ borderColor: T.border, color: T.amber }}>
                                Auto-link
                            </Button>
                            <Button component={Link} href={`/tabletop/worlds/${worldId}/wiki/new`}
                                size="sm" leftSection={<Plus size={14} />}
                                style={{ background: T.accent, color: T.pageBg }}>
                                New Article
                            </Button>
                        </Group>

                        <Group gap={6} mb="md" wrap="wrap">
                            {filterOptions.map(opt => (
                                <Badge key={opt} size="sm"
                                    onClick={() => setCatFilter(opt)}
                                    style={{
                                        cursor: "pointer",
                                        background: catFilter === opt ? T.accent : T.cardBg,
                                        color: catFilter === opt ? T.pageBg : T.amber,
                                        border: `1px solid ${catFilter === opt ? T.accent : T.border}`,
                                    }}>
                                    {opt}
                                </Badge>
                            ))}
                        </Group>

                        {filtered.length === 0 ? (
                            <Center py={64}>
                                <Stack align="center" gap="xs">
                                    <BookOpen size={40} style={{ color: T.dimmed }} />
                                    <Text style={{ color: T.dimmed }}>
                                        {articles.length === 0 ? "No articles yet. Create your first wiki entry." : "No articles match your search."}
                                    </Text>
                                </Stack>
                            </Center>
                        ) : (
                            <Stack gap="xs">
                                {filtered.map(a => (
                                    <ArticleRow key={a.id} a={a} worldId={worldId}
                                        onDelete={() => setDeleteId(a.id)} />
                                ))}
                            </Stack>
                        )}
                    </Tabs.Panel>

                    {/* ── Campaigns tab ── */}
                    <Tabs.Panel value="campaigns">
                        <Text size="sm" style={{ color: T.dimmed }} mb="md">
                            Campaigns linked to this world. Link campaigns from the{" "}
                            <Anchor component={Link} href="/tabletop/campaigns" style={{ color: T.accent }}>
                                Campaigns
                            </Anchor>{" "}page.
                        </Text>
                        {campaigns.length === 0 ? (
                            <Center py={64}>
                                <Stack align="center" gap="xs">
                                    <ScrollText size={40} style={{ color: T.dimmed }} />
                                    <Text style={{ color: T.dimmed }} mb="sm">No campaigns linked yet.</Text>
                                    <Button component={Link} href="/tabletop/campaigns" variant="outline"
                                        style={{ borderColor: T.border, color: T.amber }}>
                                        Go to Campaigns
                                    </Button>
                                </Stack>
                            </Center>
                        ) : (
                            <Stack gap="sm">
                                {campaigns.map(c => (
                                    <Anchor key={c.id} component={Link} href={`/tabletop/campaigns/${c.id}`} underline="never">
                                        <Box style={{
                                            background: T.cardBg, border: `1px solid ${T.border}`,
                                            borderLeft: `3px solid #d97706`, borderRadius: 6, padding: "0.75rem 1rem",
                                        }}>
                                            <Group gap="sm" mb={c.description ? 4 : 0}>
                                                <Text fw={600} style={{ color: T.cream }}>{c.name}</Text>
                                                {c.status && (
                                                    <Badge size="xs" style={{ background: T.cardBg, border: `1px solid ${T.border}`, color: T.dimmed }}>
                                                        {c.status}
                                                    </Badge>
                                                )}
                                            </Group>
                                            {c.description && <Text size="xs" style={{ color: T.dimmed }}>{c.description}</Text>}
                                        </Box>
                                    </Anchor>
                                ))}
                            </Stack>
                        )}
                    </Tabs.Panel>

                    {/* ── Maps tab ── */}
                    <Tabs.Panel value="maps">
                        <Group justify="flex-end" mb="md">
                            <Button size="sm" leftSection={<Upload size={14} />}
                                onClick={() => mapFileRef.current?.click()}
                                style={{ background: T.accent, color: T.pageBg }}>
                                Upload Map
                            </Button>
                            <input ref={mapFileRef} type="file" accept="image/*" hidden onChange={handleMapFileSelect} />
                        </Group>

                        {maps.length === 0 ? (
                            <Center py={64}>
                                <Stack align="center" gap="xs">
                                    <MapIcon size={40} style={{ color: T.dimmed }} />
                                    <Text style={{ color: T.dimmed }}>No maps yet. Upload an image to get started.</Text>
                                </Stack>
                            </Center>
                        ) : (
                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                                {maps.map(m => (
                                    <Box key={m.id} style={{ position: "relative" }}>
                                        <Anchor component={Link}
                                            href={`/tabletop/worlds/${worldId}/maps/${m.id}`} underline="never">
                                            <Box style={{
                                                background: T.cardBg, border: `1px solid ${T.border}`,
                                                borderRadius: 8, overflow: "hidden",
                                            }}>
                                                {mapThumbs[m.id] ? (
                                                    <Box component="img" src={mapThumbs[m.id]} alt={m.name}
                                                        style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                                                ) : (
                                                    <Center style={{ width: "100%", height: 160, background: T.cardBg }}>
                                                        <MapIcon size={32} style={{ color: T.dimmed }} />
                                                    </Center>
                                                )}
                                                <Box p="sm">
                                                    <Text fw={600} size="sm" style={{ color: T.cream }}>{m.name}</Text>
                                                    {m.pinsJson && (
                                                        <Text size="xs" style={{ color: T.dimmed }}>
                                                            {(JSON.parse(m.pinsJson) as unknown[]).length} pins
                                                        </Text>
                                                    )}
                                                </Box>
                                            </Box>
                                        </Anchor>
                                        <Tooltip label="Delete map">
                                            <ActionIcon size="sm" color="red" variant="filled"
                                                style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)" }}
                                                onClick={() => setDeleteMapId(m.id)}>
                                                <Trash2 size={13} />
                                            </ActionIcon>
                                        </Tooltip>
                                    </Box>
                                ))}
                            </SimpleGrid>
                        )}
                    </Tabs.Panel>

                    {/* ── Broken Links tab ── */}
                    <Tabs.Panel value="broken">
                        {brokenByTarget.length === 0 ? (
                            <Alert color="green" mt="md">
                                No broken links — every <code>{"[[reference]]"}</code> resolves to an existing article.
                            </Alert>
                        ) : (
                            <>
                                <Alert color="yellow" mt="md" mb="lg">
                                    {brokenByTarget.length} unresolved reference{brokenByTarget.length !== 1 ? "s" : ""} found.
                                    Create the missing articles or correct the link text.
                                </Alert>
                                <Stack gap="md">
                                    {brokenByTarget.map(({ link, articles: arts }) => (
                                        <Box key={link} style={{
                                            border: `1px solid rgba(245,158,11,0.4)`, borderRadius: 6, padding: "0.875rem",
                                            background: "rgba(245,158,11,0.04)",
                                        }}>
                                            <Group justify="space-between" mb={8}>
                                                <Text fw={700} style={{ color: "#ea580c", fontFamily: "monospace" }}>
                                                    [[{link}]]
                                                </Text>
                                                <Button component={Link}
                                                    href={`/tabletop/worlds/${worldId}/wiki/new`}
                                                    size="xs" variant="outline"
                                                    style={{ borderColor: T.border, color: T.amber }}>
                                                    Create article
                                                </Button>
                                            </Group>
                                            <Text size="xs" style={{ color: T.dimmed }} mb={6}>Referenced in:</Text>
                                            <Group gap={6} wrap="wrap">
                                                {arts.map(a => (
                                                    <Badge key={a.id} component={Link}
                                                        href={`/tabletop/worlds/${worldId}/wiki/${a.id}`}
                                                        size="sm" style={{ cursor: "pointer",
                                                            background: T.cardBg, border: `1px solid ${T.border}`, color: T.amber }}>
                                                        {a.title}
                                                    </Badge>
                                                ))}
                                            </Group>
                                        </Box>
                                    ))}
                                </Stack>
                            </>
                        )}
                    </Tabs.Panel>
                </Tabs>
            </Box>

            {/* ── Dialogs ── */}
            <Modal opened={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Article?"
                styles={{ content: { background: T.cardBg, border: `1px solid ${T.border}` },
                          header: { background: T.cardBg }, title: { color: T.cream } }}>
                <Text style={{ color: T.amber }} mb="lg">This cannot be undone.</Text>
                <Group justify="flex-end" gap="sm">
                    <Button variant="subtle" style={{ color: T.dimmed }} onClick={() => setDeleteId(null)}>Cancel</Button>
                    <Button color="red" onClick={deleteArticle}>Delete</Button>
                </Group>
            </Modal>

            <Modal opened={!!deleteMapId} onClose={() => setDeleteMapId(null)} title="Delete map?"
                styles={{ content: { background: T.cardBg, border: `1px solid ${T.border}` },
                          header: { background: T.cardBg }, title: { color: T.cream } }}>
                <Text style={{ color: T.amber }} mb="lg">The image and all pins will be removed.</Text>
                <Group justify="flex-end" gap="sm">
                    <Button variant="subtle" style={{ color: T.dimmed }} onClick={() => setDeleteMapId(null)}>Cancel</Button>
                    <Button color="red" onClick={deleteMap}>Delete</Button>
                </Group>
            </Modal>

            <Modal opened={newMapDialog} onClose={() => !mapUploading && closeNewMap()} title="New Map"
                styles={{ content: { background: T.cardBg, border: `1px solid ${T.border}` },
                          header: { background: T.cardBg }, title: { color: T.cream } }}>
                <TextInput label="Map name" autoFocus value={mapName} onChange={e => setMapName(e.target.value)} mb="sm"
                    styles={{ input: { background: T.pageBg, borderColor: T.border, color: T.cream },
                              label: { color: T.amber } }} />
                {pendingFile && (
                    <Text size="xs" style={{ color: T.dimmed }} mb="sm">
                        {pendingFile.name} ({Math.round(pendingFile.size / 1024)} KB)
                    </Text>
                )}
                {mapUploading && (
                    <Box mb="sm">
                        <Progress value={mapUploadProgress} size="sm" mb={4}
                            style={{ "--progress-color": T.accent } as React.CSSProperties} />
                        <Text size="xs" style={{ color: T.dimmed }}>Uploading… {mapUploadProgress}%</Text>
                    </Box>
                )}
                <Group justify="flex-end" gap="sm" mt="md">
                    <Button variant="subtle" style={{ color: T.dimmed }}
                        onClick={closeNewMap} disabled={mapUploading}>Cancel</Button>
                    <Button onClick={uploadMap} disabled={mapUploading || !mapName.trim()}
                        style={{ background: T.accent, color: T.pageBg }}>
                        {mapUploading ? "Uploading…" : "Upload"}
                    </Button>
                </Group>
            </Modal>

            <Modal opened={fixDialog} onClose={() => !fixing && closeFix()} title="Fix Formatting?"
                styles={{ content: { background: T.cardBg, border: `1px solid ${T.border}` },
                          header: { background: T.cardBg }, title: { color: T.cream } }}>
                {!fixing ? (
                    <Text style={{ color: T.amber }} mb="lg">
                        {bbcodeArticles.length} article{bbcodeArticles.length !== 1 ? "s" : ""} contain raw BBCode
                        tags from an older import. This will convert them to Markdown in place.
                    </Text>
                ) : (
                    <Box pt="xs" mb="lg">
                        <Text style={{ color: T.amber }} mb="sm">
                            Fixing… {fixProgress.done} / {fixProgress.total}
                        </Text>
                        <Progress
                            value={fixProgress.total ? (fixProgress.done / fixProgress.total) * 100 : 0}
                            size="sm" style={{ "--progress-color": T.accent } as React.CSSProperties} />
                    </Box>
                )}
                <Group justify="flex-end" gap="sm">
                    <Button variant="subtle" style={{ color: T.dimmed }} onClick={closeFix} disabled={fixing}>Cancel</Button>
                    <Button onClick={fixFormatting} disabled={fixing}
                        style={{ background: T.accent, color: T.pageBg }}>
                        {fixing ? "Fixing…" : "Fix Now"}
                    </Button>
                </Group>
            </Modal>
        </Box>
    );
}
