"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Box, Container, Typography, Button, LinearProgress,
    Divider, Chip, Checkbox, Table, TableHead, TableRow,
    TableCell, TableBody, Alert, IconButton, Tooltip,
    CircularProgress,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Upload, CheckSquare, Square, AlertTriangle, Image as ImageIcon } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

// ── Field mapping ─────────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
    settlement:   "Location",
    location:     "Location",
    landmark:     "Location",
    person:       "Person",
    organization: "Organization",
    article:      "Lore",
};

const WA_BOILERPLATE_KEYWORDS = ["world anvil", "worldanvil", "read me first"];

// ── BBCode → Markdown converter ───────────────────────────────────────────────

function hasBBCode(text: string): boolean {
    return /\[\/?(?:p|b|i|u|s|h[1-6]|ul|ol|li|br|hr|url|img|color|size|quote|sidebar|table|tr|th|td|row|col|section|container|block|code|pre)\b/i.test(text);
}

function convertBBCodeToMarkdown(text: string): string {
    let s = text;

    // Block headings
    s = s.replace(/\[h1\]([\s\S]*?)\[\/h1\]/gi, (_, c) => `\n# ${c.trim()}\n`);
    s = s.replace(/\[h2\]([\s\S]*?)\[\/h2\]/gi, (_, c) => `\n## ${c.trim()}\n`);
    s = s.replace(/\[h3\]([\s\S]*?)\[\/h3\]/gi, (_, c) => `\n### ${c.trim()}\n`);
    s = s.replace(/\[h4\]([\s\S]*?)\[\/h4\]/gi, (_, c) => `\n#### ${c.trim()}\n`);
    s = s.replace(/\[h5\]([\s\S]*?)\[\/h5\]/gi, (_, c) => `\n##### ${c.trim()}\n`);
    s = s.replace(/\[h6\]([\s\S]*?)\[\/h6\]/gi, (_, c) => `\n###### ${c.trim()}\n`);

    // Lists — items first, then strip wrappers
    s = s.replace(/\[li\]([\s\S]*?)\[\/li\]/gi, (_, c) => `- ${c.trim()}\n`);
    s = s.replace(/\[ul\]([\s\S]*?)\[\/ul\]/gi, (_, c) => `\n${c.trim()}\n`);
    s = s.replace(/\[ol\]([\s\S]*?)\[\/ol\]/gi, (_, c) => `\n${c.trim()}\n`);

    // Paragraphs — empty ones become nothing
    s = s.replace(/\[p\]([\s\S]*?)\[\/p\]/gi, (_, c) => {
        const inner = c.trim();
        return inner ? `${inner}\n\n` : "";
    });

    // Dividers and breaks
    s = s.replace(/\[hr\]/gi, "\n\n---\n\n");
    s = s.replace(/\[br\]/gi, "\n");

    // Blockquotes / sidebars
    s = s.replace(/\[(?:quote|sidebar)\]([\s\S]*?)\[\/(?:quote|sidebar)\]/gi, (_, c) =>
        c.trim().split("\n").map((l: string) => `> ${l}`).join("\n") + "\n\n"
    );

    // Tables (basic — th row becomes header)
    s = s.replace(/\[table\]([\s\S]*?)\[\/table\]/gi, (_, tableContent) => {
        const rowPattern = /\[tr\]([\s\S]*?)\[\/tr\]/gi;
        const rows: string[][] = [];
        let hasHeader = false;
        let rm;
        while ((rm = rowPattern.exec(tableContent)) !== null) {
            const cells: string[] = [];
            const thPat = /\[th\]([\s\S]*?)\[\/th\]/gi;
            let tm;
            while ((tm = thPat.exec(rm[1])) !== null) { cells.push(tm[1].trim()); hasHeader = true; }
            const tdPat = /\[td\]([\s\S]*?)\[\/td\]/gi;
            while ((tm = tdPat.exec(rm[1])) !== null) { cells.push(tm[1].trim()); }
            if (cells.length) rows.push(cells);
        }
        if (!rows.length) return "";
        const header = hasHeader ? rows[0] : rows[0].map((_, i) => `Column ${i + 1}`);
        const data   = hasHeader ? rows.slice(1) : rows;
        const sep    = header.map(() => "---");
        return [
            `\n| ${header.join(" | ")} |`,
            `| ${sep.join(" | ")} |`,
            ...data.map(r => `| ${r.join(" | ")} |`),
        ].join("\n") + "\n\n";
    });

    // Inline formatting
    s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/gi,    "**$1**");
    s = s.replace(/\[i\]([\s\S]*?)\[\/i\]/gi,    "*$1*");
    s = s.replace(/\[s\]([\s\S]*?)\[\/s\]/gi,    "~~$1~~");
    s = s.replace(/\[u\]([\s\S]*?)\[\/u\]/gi,    "$1");
    s = s.replace(/\[sup\]([\s\S]*?)\[\/sup\]/gi, "$1");
    s = s.replace(/\[sub\]([\s\S]*?)\[\/sub\]/gi, "$1");
    s = s.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, "`$1`");
    s = s.replace(/\[pre\]([\s\S]*?)\[\/pre\]/gi,  "```\n$1\n```");

    // Colors / sizes / fonts — strip tags, keep inner text
    s = s.replace(/\[color=[^\]]*\]([\s\S]*?)\[\/color\]/gi, "$1");
    s = s.replace(/\[size=[^\]]*\]([\s\S]*?)\[\/size\]/gi,   "$1");
    s = s.replace(/\[font=[^\]]*\]([\s\S]*?)\[\/font\]/gi,   "$1");

    // Links and images
    s = s.replace(/\[url=([^\]]*)\]([\s\S]*?)\[\/url\]/gi, "[$2]($1)");
    s = s.replace(/\[url\]([\s\S]*?)\[\/url\]/gi,          "$1");
    s = s.replace(/\[img[^\]]*\]([\s\S]*?)\[\/img\]/gi,    "![]($1)");

    // Layout wrappers — strip, keep content
    s = s.replace(/\[row\]([\s\S]*?)\[\/row\]/gi,                     "$1");
    s = s.replace(/\[col(?:=[^\]]*)?\]([\s\S]*?)\[\/col\]/gi,         "$1\n");
    s = s.replace(/\[section(?::[^\]]*)?\]([\s\S]*?)\[\/section\]/gi, "$1");
    s = s.replace(/\[container(?::[^\]]*)?\]([\s\S]*?)\[\/container\]/gi, "$1");
    s = s.replace(/\[block(?::[^\]]*)?\]([\s\S]*?)\[\/block\]/gi,     "$1");

    // WorldAnvil entity mentions: [type:id|Display Name] → Display Name
    s = s.replace(/\[[a-z]+:[^\|]*\|([^\]]*)\]/gi, "$1");
    // Remaining [tag:attr] openers with no closing pair
    s = s.replace(/\[[a-z]+:[^\]]*\]/gi, "");
    // Any leftover [/tag] or [tag]
    s = s.replace(/\[\/[a-z0-9]+\]/gi, "");
    s = s.replace(/\[[a-z0-9]+\]/gi,   "");

    // Collapse 3+ blank lines → 2
    s = s.replace(/\n{3,}/g, "\n\n");

    return s.trim();
}

function maybeConvert(raw: string): string {
    const s = raw.replace(/\r\n/g, "\n").trim();
    return hasBBCode(s) ? convertBBCodeToMarkdown(s) : s;
}

function isBoilerplate(title: string): boolean {
    const lower = title.toLowerCase();
    return WA_BOILERPLATE_KEYWORDS.some(kw => lower.includes(kw));
}

function isDefaultCover(url: string | undefined | null): boolean {
    if (!url) return true;
    return (
        url.includes("WorldCover_Default") ||
        url.includes("prodromos-client/images") ||
        url.includes("wa-cdn") === false      // not on the user CDN
    );
}

// ── Parsed article shape ──────────────────────────────────────────────────────

interface ParsedArticle {
    waId:         string;
    title:        string;
    content:      string;
    excerpt:      string | null;
    templateType: string;
    articleType:  string;
    category:     string;
    tags:         string[];
    coverImageUrl: string | null;
    parentTitle:  string | null;
    wordcount:    number;
    isBoilerplate: boolean;
    fileName:     string;
}

function parseBatchArticle(raw: Record<string, unknown>, fileName: string): ParsedArticle | null {
    if (!raw.title) return null;
    const title = raw.title as string;
    const content = maybeConvert((raw.content as string) || "");
    const words = content ? content.split(/\s+/).length : 0;
    const articleType = (raw.articleType as string) || "Lore";
    const templateType = articleType.toLowerCase();

    return {
        waId:          `batch-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
        title,
        content,
        excerpt:       (raw.excerpt as string | null) || null,
        templateType,
        articleType,
        category:      (raw.category as string) || CATEGORY_MAP[templateType] || "Lore",
        tags:          Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
        coverImageUrl: (raw.coverImageUrl as string | null) || null,
        parentTitle:   (raw.parentTitle as string | null) || null,
        wordcount:     words,
        isBoilerplate: false,
        fileName,
    };
}

function parseWAFile(raw: Record<string, unknown>, fileName: string): ParsedArticle | null {
    if (!raw.title || !raw.id) return null;

    const cover    = raw.cover    as { url?: string; id?: number } | null;
    const portrait = raw.portrait as { url?: string }             | null;

    // Prefer cover; fall back to portrait; skip WA default covers (id === -1)
    const coverUrl =
        cover && cover.id !== -1 && !isDefaultCover(cover.url)
            ? cover.url ?? null
            : portrait?.url ?? null;

    const templateType = ((raw.templateType as string) || "article").toLowerCase();
    const tagsStr      = (raw.tags as string) || "";
    const articleParent = raw.articleParent as { title?: string } | null;

    return {
        waId:          raw.id as string,
        title:         raw.title as string,
        content:       maybeConvert((raw.content as string) || ""),
        excerpt:       (raw.excerpt as string | null) || null,
        templateType,
        articleType:   templateType.charAt(0).toUpperCase() + templateType.slice(1),
        category:      CATEGORY_MAP[templateType] ?? "Lore",
        tags:          tagsStr ? tagsStr.split(",").map(t => t.trim()).filter(Boolean) : [],
        coverImageUrl: coverUrl ?? null,
        parentTitle:   articleParent?.title ?? null,
        wordcount:     (raw.wordcount as number) || 0,
        isBoilerplate: isBoilerplate(raw.title as string),
        fileName,
    };
}

// ── Component ─────────────────────────────────────────────────────────────────

type Phase = "upload" | "preview" | "importing" | "done";

export default function ImportPage() {
    const { worldId } = useParams<{ worldId: string }>();
    const router      = useRouter();

    const [phase,     setPhase]     = useState<Phase>("upload");
    const [articles,  setArticles]  = useState<ParsedArticle[]>([]);
    const [selected,  setSelected]  = useState<Record<string, boolean>>({});
    const [progress,  setProgress]  = useState(0);
    const [total,     setTotal]     = useState(0);
    const [doneCount, setDoneCount] = useState(0);
    const [errors,    setErrors]    = useState<string[]>([]);

    // ── File parsing ────────────────────────────────────────────────────────

    const handleFiles = useCallback(async (files: FileList) => {
        const parsed: ParsedArticle[] = [];

        for (const file of Array.from(files)) {
            if (!file.name.endsWith(".json")) continue;
            try {
                const text = await file.text();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const json = JSON.parse(text) as any;

                if (Array.isArray(json)) {
                    // Bare array of batch articles
                    for (const item of json) {
                        const a = parseBatchArticle(item as Record<string, unknown>, file.name);
                        if (a) parsed.push(a);
                    }
                } else if (json.format === "wiki-batch" && Array.isArray(json.articles)) {
                    // Wrapped batch format { format, version, articles }
                    for (const item of json.articles) {
                        const a = parseBatchArticle(item as Record<string, unknown>, file.name);
                        if (a) parsed.push(a);
                    }
                } else {
                    // WorldAnvil single-article format
                    const a = parseWAFile(json as Record<string, unknown>, file.name);
                    if (a) parsed.push(a);
                }
            } catch {
                // skip malformed files
            }
        }

        if (!parsed.length) return;

        // Dedup: group by title, mark lower-wordcount duplicates
        const byTitle = new Map<string, ParsedArticle[]>();
        for (const a of parsed) {
            const key = a.title.toLowerCase();
            if (!byTitle.has(key)) byTitle.set(key, []);
            byTitle.get(key)!.push(a);
        }

        // Sort each group: highest wordcount first
        byTitle.forEach(group => group.sort((a, b) => b.wordcount - a.wordcount));

        const flat = Array.from(byTitle.values()).flat();

        // Default selection: check highest-wordcount, uncheck duplicates and boilerplate
        const sel: Record<string, boolean> = {};
        const seenTitle = new Set<string>();
        for (const a of flat) {
            const key = a.title.toLowerCase();
            const isDupe = seenTitle.has(key);
            sel[a.waId] = !a.isBoilerplate && !isDupe;
            seenTitle.add(key);
        }

        setArticles(flat);
        setSelected(sel);
        setPhase("preview");
    }, []);

    function toggleAll(check: boolean) {
        setSelected(Object.fromEntries(articles.map(a => [a.waId, check])));
    }

    function toggle(waId: string) {
        setSelected(s => ({ ...s, [waId]: !s[waId] }));
    }

    // ── Import ──────────────────────────────────────────────────────────────

    async function runImport() {
        const toImport = articles.filter(a => selected[a.waId]);
        setTotal(toImport.length);
        setDoneCount(0);
        setProgress(0);
        setErrors([]);
        setPhase("importing");

        for (let i = 0; i < toImport.length; i++) {
            const a = toImport[i];
            try {
                await client.models.WikiArticle.create({
                    worldId,
                    title:         a.title,
                    content:       a.content || undefined,
                    excerpt:       a.excerpt || undefined,
                    articleType:   a.articleType,
                    category:      a.category,
                    tags:          a.tags.length ? a.tags : undefined,
                    coverImageUrl: a.coverImageUrl || undefined,
                    parentTitle:   a.parentTitle || undefined,
                });
            } catch {
                setErrors(e => [...e, a.title]);
            }
            setDoneCount(i + 1);
            setProgress(Math.round(((i + 1) / toImport.length) * 100));
        }

        setPhase("done");
    }

    // ── Type color ──────────────────────────────────────────────────────────

    const typeColor: Record<string, string> = {
        Settlement: "#0e7490", Location: "#92400e", Landmark: "#7e22ce",
        Person: "#1d4ed8", Organization: "#15803d", Lore: "#374151",
    };

    const selectedCount = Object.values(selected).filter(Boolean).length;
    const dupeCount     = articles.filter(a => !selected[a.waId] && !a.isBoilerplate && a.wordcount > 0).length;

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="lg">
                <Button component={Link} href={`/tabletop/worlds/${worldId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back to World
                </Button>

                <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark", mb: 1 }}>
                    Import from WorldAnvil
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 4 }}>
                    Import from a <strong>WorldAnvil export</strong> (select all JSON files from the <code>articles/</code> folder)
                    or upload a <strong>wiki batch file</strong> (a single <code>.json</code> file with a <code>"format": "wiki-batch"</code> header and an <code>articles</code> array).
                    Both formats can be mixed in one upload.
                </Typography>

                <Divider sx={{ mb: 4 }} />

                {/* ── Upload phase ── */}
                {phase === "upload" && (
                    <Box
                        component="label"
                        sx={{
                            display: "flex", flexDirection: "column", alignItems: "center",
                            justifyContent: "center", gap: 2, border: "2px dashed",
                            borderColor: "primary.light", borderRadius: 3, p: 8,
                            cursor: "pointer", backgroundColor: "background.paper",
                            "&:hover": { borderColor: "primary.main", backgroundColor: "rgba(154,52,18,0.04)" },
                        }}
                    >
                        <Upload size={40} color="#9a3412" />
                        <Typography variant="h6" sx={{ color: "primary.dark" }}>
                            Select article JSON files
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center" }}>
                            <strong>WorldAnvil:</strong> open your export folder (<code>articles/</code>), select all files (Ctrl+A)<br />
                            <strong>Batch file:</strong> select a single <code>wiki-batch.json</code> file<br />
                            Both can be mixed in the same upload
                        </Typography>
                        <input
                            type="file" multiple accept=".json" hidden
                            onChange={e => e.target.files && handleFiles(e.target.files)}
                        />
                    </Box>
                )}

                {/* ── Preview phase ── */}
                {phase === "preview" && (
                    <>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                <Typography variant="h6" sx={{ color: "primary.dark" }}>
                                    {articles.length} articles found · {selectedCount} selected
                                </Typography>
                                {dupeCount > 0 && (
                                    <Chip icon={<AlertTriangle size={12} />} label={`${dupeCount} duplicates unchecked`}
                                        size="small" color="warning" variant="outlined" />
                                )}
                            </Box>
                            <Box sx={{ display: "flex", gap: 1 }}>
                                <Button size="small" startIcon={<CheckSquare size={14} />} onClick={() => toggleAll(true)}>
                                    All
                                </Button>
                                <Button size="small" startIcon={<Square size={14} />} onClick={() => toggleAll(false)}>
                                    None
                                </Button>
                                <Button variant="contained" onClick={runImport}
                                    disabled={selectedCount === 0}
                                    sx={{ backgroundColor: "primary.main" }}>
                                    Import {selectedCount} articles
                                </Button>
                            </Box>
                        </Box>

                        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell padding="checkbox" />
                                        <TableCell sx={{ fontWeight: 700 }}>Title</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Excerpt / Preview</TableCell>
                                        <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>Words</TableCell>
                                        <TableCell sx={{ fontWeight: 700, textAlign: "center" }}>Cover</TableCell>
                                        <TableCell sx={{ fontWeight: 700 }}>Parent</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {articles.map(a => {
                                        const isChecked = !!selected[a.waId];
                                        const preview = a.excerpt || a.content.slice(0, 100) || "—";
                                        return (
                                            <TableRow
                                                key={a.waId}
                                                sx={{
                                                    opacity: isChecked ? 1 : 0.45,
                                                    backgroundColor: a.isBoilerplate ? "rgba(0,0,0,0.03)" : "inherit",
                                                    "&:hover": { backgroundColor: "rgba(154,52,18,0.04)" },
                                                }}
                                            >
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        size="small" checked={isChecked}
                                                        onChange={() => toggle(a.waId)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                            {a.title}
                                                        </Typography>
                                                        {a.isBoilerplate && (
                                                            <Chip label="WA template" size="small"
                                                                sx={{ fontSize: "0.6rem", height: 16 }} />
                                                        )}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={a.articleType} size="small"
                                                        sx={{
                                                            backgroundColor: typeColor[a.articleType] ?? "#555",
                                                            color: "#fff", fontSize: "0.65rem", height: 18,
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ maxWidth: 300 }}>
                                                    <Typography variant="caption" sx={{
                                                        color: "text.secondary", display: "block",
                                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                    }}>
                                                        {preview}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ textAlign: "right" }}>
                                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                                        {a.wordcount}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ textAlign: "center" }}>
                                                    {a.coverImageUrl && (
                                                        <Tooltip title={a.coverImageUrl}>
                                                            <Box component="span">
                                                                <ImageIcon size={14} color="#9a3412" />
                                                            </Box>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {a.parentTitle && (
                                                        <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                                                            {a.parentTitle}
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </Box>
                    </>
                )}

                {/* ── Importing phase ── */}
                {phase === "importing" && (
                    <Box sx={{ textAlign: "center", py: 6 }}>
                        <CircularProgress sx={{ color: "primary.main", mb: 3 }} size={48} />
                        <Typography variant="h6" sx={{ color: "primary.dark", mb: 2 }}>
                            Importing articles… {doneCount} / {total}
                        </Typography>
                        <LinearProgress
                            variant="determinate" value={progress}
                            sx={{ height: 8, borderRadius: 4, mb: 1,
                                  "& .MuiLinearProgress-bar": { backgroundColor: "primary.main" } }}
                        />
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {progress}% complete
                        </Typography>
                    </Box>
                )}

                {/* ── Done phase ── */}
                {phase === "done" && (
                    <Box sx={{ textAlign: "center", py: 6 }}>
                        <Typography variant="h5" sx={{ color: "primary.dark", fontWeight: 700, mb: 1 }}>
                            Import complete
                        </Typography>
                        <Typography sx={{ color: "text.secondary", mb: 2 }}>
                            {doneCount - errors.length} articles imported successfully.
                            {errors.length > 0 && ` ${errors.length} failed.`}
                        </Typography>
                        {errors.length > 0 && (
                            <Alert severity="warning" sx={{ mb: 3, textAlign: "left" }}>
                                <strong>Failed to import:</strong>
                                <ul style={{ margin: "4px 0 0 0", paddingLeft: 20 }}>
                                    {errors.map(t => <li key={t}>{t}</li>)}
                                </ul>
                            </Alert>
                        )}
                        <Button variant="contained" component={Link}
                            href={`/tabletop/worlds/${worldId}`}
                            sx={{ backgroundColor: "primary.main" }}>
                            Go to Wiki
                        </Button>
                    </Box>
                )}
            </Container>
        </Box>
    );
}
