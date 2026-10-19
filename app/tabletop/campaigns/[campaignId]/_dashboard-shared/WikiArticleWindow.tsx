"use client";

import { useState, useEffect, useMemo } from "react";
import { Box, Typography, IconButton, Chip, Divider, Tooltip } from "@mui/material";
import { ArrowLeft, ExternalLink, Pin, EyeOff, ChevronUp } from "lucide-react";
import { getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import { ARTICLE_TYPE_COLORS } from "@/lib/wikiArticleTypes";
import { FloatingWindow } from "./FloatingWindow";
import { WikiContent } from "../../../worlds/[worldId]/wiki/WikiContent";
import { Lightbox } from "../../../worlds/[worldId]/wiki/Lightbox";

type WikiArticle = Schema["WikiArticle"]["type"];

interface WikiArticleWindowProps {
    article: WikiArticle;
    // Every article the caller has loaded — used to resolve [[links]], the
    // parent breadcrumb and sub-articles without another fetch.
    articles: WikiArticle[];
    isPinned: boolean;
    canGoBack: boolean;
    onNavigate: (articleId: string) => void;
    onBack: () => void;
    onTogglePin: () => void;
    onClose: () => void;
}

const WIDTH = 600;
// Above the app bar/drawers (1100/1200) but below MUI modals (1300), so the
// gallery Lightbox still opens on top of this window.
const Z_INDEX = 1250;

async function resolveImage(key: string): Promise<string | null> {
    try {
        const { url } = await getUrl({ path: key, options: { expiresIn: 3600 } });
        return url.toString();
    } catch { return null; }
}

// A read-only rendering of a wiki article in a draggable window over the
// dashboard, so the GM can read an article mid-session without leaving the
// page. [[links]] navigate within the window; the header has a link to the
// full article page for editing.
export function WikiArticleWindow({
    article, articles, isPinned, canGoBack, onNavigate, onBack, onTogglePin, onClose,
}: WikiArticleWindowProps) {
    const [pos, setPos] = useState(() => ({
        x: typeof window === "undefined" ? 16 : Math.max(16, window.innerWidth - WIDTH - 32),
        y: 80,
    }));
    // Resolved S3 URLs, tagged with the article they belong to so a stale
    // result never shows on the next article while its own images load.
    const [images, setImages] = useState<{ articleId: string; cover: string; gallery: string[] } | null>(null);
    const [lightbox, setLightbox] = useState<{ articleId: string; index: number } | null>(null);
    const current = images?.articleId === article.id ? images : null;
    const coverUrl = current?.cover ?? (article.coverImageKey ? "" : article.coverImageUrl ?? "");
    const galleryUrls = useMemo(() => current?.gallery ?? [], [current]);
    const lightboxIndex = lightbox?.articleId === article.id ? lightbox.index : null;
    const setLightboxIndex = (index: number | null) => setLightbox(index === null ? null : { articleId: article.id, index });

    const worldArticles = useMemo(() => articles.filter(a => a.worldId === article.worldId), [articles, article.worldId]);
    const titleToId = useMemo(() => {
        const map = new Map<string, string>();
        for (const a of worldArticles) map.set(a.title.toLowerCase(), a.id);
        return map;
    }, [worldArticles]);
    const childArticles = useMemo(() => worldArticles.filter(a =>
        a.id !== article.id && a.parentTitle?.toLowerCase() === article.title.toLowerCase()
    ), [worldArticles, article]);
    const parentId = article.parentTitle ? titleToId.get(article.parentTitle.toLowerCase()) : undefined;

    // Resolve S3 images for whichever article is showing (cover key takes
    // priority over a plain URL, same as the article page).
    useEffect(() => {
        let cancelled = false;
        const keys = (article.galleryImageKeys ?? []).filter((k): k is string => k != null);
        Promise.all([
            article.coverImageKey ? resolveImage(article.coverImageKey) : Promise.resolve(null),
            Promise.all(keys.map(resolveImage)),
        ]).then(([cover, gallery]) => {
            if (cancelled) return;
            setImages({
                articleId: article.id,
                cover: cover ?? article.coverImageUrl ?? "",
                gallery: gallery.filter((u): u is string => !!u),
            });
        });
        return () => { cancelled = true; };
    }, [article.id, article.coverImageKey, article.coverImageUrl, article.galleryImageKeys]);

    const fullPageHref = `/tabletop/worlds/${article.worldId}/wiki/${article.id}`;

    return (
        <>
            <FloatingWindow title={article.title} x={pos.x} y={pos.y} z={Z_INDEX}
                width={Math.min(WIDTH, typeof window === "undefined" ? WIDTH : window.innerWidth - 32)} resizable
                onMove={(x, y) => setPos({ x, y })} onFocus={() => {}} onClose={onClose}
                actions={
                    <>
                        <Tooltip title="Back">
                            <span>
                                <IconButton size="small" onClick={onBack} disabled={!canGoBack}
                                    sx={{ "&.Mui-disabled": { opacity: 0.35 } }}>
                                    <ArrowLeft size={14} />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title={isPinned ? "Unpin" : "Pin"}>
                            <IconButton size="small" onClick={onTogglePin} sx={{ opacity: isPinned ? 1 : 0.6 }}>
                                <Pin size={14} fill={isPinned ? "currentColor" : "none"} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Open full article in a new tab">
                            <IconButton size="small" component="a" href={fullPageHref} target="_blank" rel="noopener noreferrer">
                                <ExternalLink size={14} />
                            </IconButton>
                        </Tooltip>
                    </>
                }>
                <Box sx={{ p: 1.5 }}>
                    {coverUrl && (
                        <Box component="img" src={coverUrl} alt={article.title}
                            sx={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 1.5, mb: 2, display: "block" }} />
                    )}

                    {article.parentTitle && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                            <ChevronUp size={13} />
                            {parentId ? (
                                <Typography variant="caption" onClick={() => onNavigate(parentId)}
                                    sx={{ color: "primary.main", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
                                    {article.parentTitle}
                                </Typography>
                            ) : (
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>{article.parentTitle}</Typography>
                            )}
                        </Box>
                    )}

                    <Typography variant="h5" sx={{ fontWeight: 700, color: "primary.dark" }}>{article.title}</Typography>
                    <Box sx={{ display: "flex", gap: 0.75, mt: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                        {article.articleType && (
                            <Chip label={article.articleType} size="small"
                                sx={{ backgroundColor: ARTICLE_TYPE_COLORS[article.articleType] ?? "#555", color: "#fff", height: 20 }} />
                        )}
                        {article.visibleToPlayers === false && (
                            <Chip icon={<EyeOff size={11} />} label="GM Only" size="small"
                                sx={{ backgroundColor: "#6a1b9a", color: "#fff", fontSize: "0.6rem", height: 18 }} />
                        )}
                        {(article.tags ?? []).map(tag => (
                            <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ fontSize: "0.65rem", height: 20 }} />
                        ))}
                    </Box>

                    {article.excerpt && (
                        <Typography variant="body2" sx={{
                            color: "text.secondary", fontStyle: "italic",
                            borderLeft: "3px solid", borderColor: "primary.light",
                            pl: 1.5, mt: 1.5, lineHeight: 1.7,
                        }}>
                            {article.excerpt}
                        </Typography>
                    )}

                    <Divider sx={{ my: 2 }} />

                    {article.content ? (
                        <Box sx={{ fontSize: "0.92rem" }}>
                            <WikiContent content={article.content} worldId={article.worldId}
                                titleToId={titleToId} onNavigate={onNavigate} />
                        </Box>
                    ) : (
                        <Typography variant="body2" sx={{ color: "text.disabled", textAlign: "center", py: 3 }}>
                            This article has no content yet.
                        </Typography>
                    )}

                    {galleryUrls.length > 0 && (
                        <Box sx={{ mt: 3 }}>
                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>Gallery:</Typography>
                            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                {galleryUrls.map((url, i) => (
                                    <Box key={url} component="img" src={url} alt="" onClick={() => setLightboxIndex(i)}
                                        sx={{ width: 72, height: 72, objectFit: "cover", borderRadius: 1, cursor: "pointer",
                                            display: "block", "&:hover": { opacity: 0.85 } }} />
                                ))}
                            </Box>
                        </Box>
                    )}

                    {childArticles.length > 0 && (
                        <Box sx={{ mt: 3 }}>
                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>Sub-articles:</Typography>
                            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                                {childArticles.map(a => (
                                    <Chip key={a.id} label={a.title} size="small" clickable onClick={() => onNavigate(a.id)}
                                        sx={a.articleType ? { backgroundColor: ARTICLE_TYPE_COLORS[a.articleType] ?? undefined, color: "#fff" } : {}} />
                                ))}
                            </Box>
                        </Box>
                    )}
                </Box>
            </FloatingWindow>

            <Lightbox images={galleryUrls} index={lightboxIndex}
                onClose={() => setLightboxIndex(null)} onIndexChange={setLightboxIndex} />
        </>
    );
}
