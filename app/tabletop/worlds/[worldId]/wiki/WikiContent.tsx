"use client";

import { useMemo } from "react";
import { Box } from "@mui/material";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ── WikiContent — markdown + [[link]] rendering ───────────────────────────────
//
// Strategy: pre-process [[Title]] → [Title](wiki://Title), then let
// react-markdown handle the full markdown pass. The custom `a` component
// intercepts wiki:// hrefs and renders internal links / unresolved stubs.
//
// Shared by the article page and the GM dashboards' embedded article window.
// Pass `onNavigate` to keep resolved [[links]] in place (the embedded window
// swaps its own article) instead of routing to the full article page.

function preprocessLinks(content: string): string {
    return content.replace(/\[\[([^\]]+)\]\]/g, (_, title: string) =>
        `[${title}](wiki://${encodeURIComponent(title)})`
    );
}

const LINK_STYLE = { color: "#9a3412", fontWeight: 600, textDecoration: "underline" } as const;

export function WikiContent({ content, worldId, titleToId, onNavigate }: {
    content: string;
    worldId: string;
    titleToId: Map<string, string>;
    onNavigate?: (articleId: string) => void;
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
            "& img": { maxWidth: "100%" },
        }}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a({ href, children }) {
                        if (href?.startsWith("wiki://")) {
                            const title = decodeURIComponent(href.slice(7));
                            const articleId = titleToId.get(title.toLowerCase());
                            if (articleId && onNavigate) {
                                return (
                                    <a href={`/tabletop/worlds/${worldId}/wiki/${articleId}`} style={LINK_STYLE}
                                        onClick={e => {
                                            // Plain click stays in the window; modifier-click still opens the full page.
                                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                                            e.preventDefault();
                                            onNavigate(articleId);
                                        }}>
                                        {children}
                                    </a>
                                );
                            }
                            if (articleId) {
                                return (
                                    <Link href={`/tabletop/worlds/${worldId}/wiki/${articleId}`} style={LINK_STYLE}>
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
