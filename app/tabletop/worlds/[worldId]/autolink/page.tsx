"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
    Box, Container, Typography, Button, LinearProgress,
    Divider, Chip, Checkbox, Table, TableHead, TableRow,
    TableCell, TableBody, CircularProgress, Alert, Paper,
    TableContainer,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Link2, CheckSquare, Square } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type Article = Schema["WikiArticle"]["type"];

// ── Auto-link algorithm ───────────────────────────────────────────────────────
// Splits content on existing [[...]] blocks so they're never double-processed.
// Titles are sorted longest-first so "Ash Peak" matches before "Ash".

function autoLink(
    content: string,
    titles: string[],
    selfTitle: string,
): { newContent: string; count: number; matched: string[] } {
    const eligible = titles
        .filter(t => t.toLowerCase() !== selfTitle.toLowerCase() && t.length >= 2)
        .sort((a, b) => b.length - a.length);

    if (!eligible.length || !content) return { newContent: content, count: 0, matched: [] };

    const canonicalMap = new Map(eligible.map(t => [t.toLowerCase(), t]));
    const pattern = eligible
        .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
    const regex = new RegExp(`\\b(${pattern})\\b`, "gi");

    let count = 0;
    const matchedSet = new Set<string>();

    // Only process segments that are NOT already inside [[...]]
    const segments = content.split(/(\[\[[^\]]+\]\])/g);
    const processed = segments.map((seg, i) => {
        if (i % 2 === 1) return seg; // already a [[link]]
        return seg.replace(regex, match => {
            const canonical = canonicalMap.get(match.toLowerCase()) ?? match;
            count++;
            matchedSet.add(canonical);
            return `[[${canonical}]]`;
        });
    });

    return { newContent: processed.join(""), count, matched: Array.from(matchedSet) };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArticleResult {
    article: Article;
    newContent: string;
    count: number;
    matched: string[];
    selected: boolean;
}

type Phase = "idle" | "scanning" | "preview" | "applying" | "done";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AutoLinkPage() {
    const { worldId } = useParams<{ worldId: string }>();

    const [phase, setPhase]         = useState<Phase>("idle");
    const [results, setResults]     = useState<ArticleResult[]>([]);
    const [progress, setProgress]   = useState(0);
    const [doneCount, setDoneCount] = useState(0);
    const [errors, setErrors]       = useState<string[]>([]);

    async function scan() {
        setPhase("scanning");
        const res = await client.models.WikiArticle.list();
        const all = (res.data ?? []).filter(a => a.worldId === worldId);
        const titles = all.map(a => a.title);

        const found: ArticleResult[] = [];
        for (const article of all) {
            if (!article.content?.trim()) continue;
            const { newContent, count, matched } = autoLink(article.content, titles, article.title);
            if (count > 0) found.push({ article, newContent, count, matched, selected: true });
        }

        setResults(found);
        setPhase("preview");
    }

    function toggleAll(val: boolean) {
        setResults(r => r.map(x => ({ ...x, selected: val })));
    }

    function toggleOne(id: string) {
        setResults(r => r.map(x => x.article.id === id ? { ...x, selected: !x.selected } : x));
    }

    async function apply() {
        const toApply = results.filter(r => r.selected);
        setPhase("applying");
        setProgress(0);
        setDoneCount(0);
        setErrors([]);

        for (let i = 0; i < toApply.length; i++) {
            const r = toApply[i];
            try {
                await client.models.WikiArticle.update({ id: r.article.id, content: r.newContent });
            } catch {
                setErrors(e => [...e, r.article.title]);
            }
            setDoneCount(i + 1);
            setProgress(Math.round(((i + 1) / toApply.length) * 100));
        }

        setPhase("done");
    }

    const selectedCount = results.filter(r => r.selected).length;
    const totalLinks    = results.filter(r => r.selected).reduce((s, r) => s + r.count, 0);

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/worlds/${worldId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back to World
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                    <Link2 size={28} color="#8C5A3A" />
                    <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        Auto-Link Articles
                    </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 3, ml: 6 }}>
                    Scans every article for unlinked mentions of other article titles and wraps them in{" "}
                    <code>{"[[links]]"}</code>. Already-linked text and self-references are left alone.
                </Typography>

                <Divider sx={{ mb: 4 }} />

                {/* ── Idle ── */}
                {phase === "idle" && (
                    <Box sx={{ textAlign: "center", py: 6 }}>
                        <Typography sx={{ color: "text.secondary", mb: 3 }}>
                            Click Scan to preview which articles would be updated before making any changes.
                        </Typography>
                        <Button variant="contained" size="large" startIcon={<Link2 size={18} />}
                            onClick={scan} sx={{ backgroundColor: "primary.main" }}>
                            Scan Articles
                        </Button>
                    </Box>
                )}

                {/* ── Scanning ── */}
                {phase === "scanning" && (
                    <Box sx={{ textAlign: "center", py: 6 }}>
                        <CircularProgress sx={{ color: "primary.main", mb: 2 }} />
                        <Typography sx={{ color: "text.secondary" }}>Scanning articles…</Typography>
                    </Box>
                )}

                {/* ── Preview ── */}
                {phase === "preview" && (
                    results.length === 0 ? (
                        <Alert severity="info" sx={{ mb: 3 }}>
                            No unlinked mentions found — all article titles are either already linked or
                            don't appear in other articles' content.
                        </Alert>
                    ) : (
                        <>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                                <Typography variant="h6" sx={{ color: "primary.dark" }}>
                                    {results.length} articles · {selectedCount} selected · {totalLinks} links to add
                                </Typography>
                                <Box sx={{ display: "flex", gap: 1 }}>
                                    <Button size="small" startIcon={<CheckSquare size={14} />}
                                        onClick={() => toggleAll(true)}>All</Button>
                                    <Button size="small" startIcon={<Square size={14} />}
                                        onClick={() => toggleAll(false)}>None</Button>
                                    <Button variant="contained" onClick={apply}
                                        disabled={selectedCount === 0}
                                        sx={{ backgroundColor: "primary.main" }}>
                                        Apply {selectedCount} articles
                                    </Button>
                                </Box>
                            </Box>

                            <TableContainer component={Paper} sx={{ border: 1, borderColor: "divider", borderRadius: 2 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell padding="checkbox" />
                                            <TableCell sx={{ fontWeight: 700 }}>Article</TableCell>
                                            <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>Links</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>Titles found</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {results.map(r => (
                                            <TableRow key={r.article.id}
                                                sx={{
                                                    opacity: r.selected ? 1 : 0.45,
                                                    "&:hover": { backgroundColor: "rgba(154,52,18,0.04)" },
                                                }}>
                                                <TableCell padding="checkbox">
                                                    <Checkbox size="small" checked={r.selected}
                                                        onChange={() => toggleOne(r.article.id)} />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                        {r.article.title}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ textAlign: "right" }}>
                                                    <Chip label={`+${r.count}`} size="small"
                                                        sx={{ backgroundColor: "primary.main", color: "#fff", fontSize: "0.7rem" }} />
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                                                        {r.matched.map(m => (
                                                            <Chip key={m} label={m} size="small" variant="outlined"
                                                                sx={{ fontSize: "0.65rem", height: 18 }} />
                                                        ))}
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </>
                    )
                )}

                {/* ── Applying ── */}
                {phase === "applying" && (
                    <Box sx={{ textAlign: "center", py: 6 }}>
                        <CircularProgress sx={{ color: "primary.main", mb: 3 }} size={48} />
                        <Typography variant="h6" sx={{ color: "primary.dark", mb: 2 }}>
                            Updating articles… {doneCount} / {results.filter(r => r.selected).length}
                        </Typography>
                        <LinearProgress variant="determinate" value={progress}
                            sx={{ height: 8, borderRadius: 4, mb: 1,
                                  "& .MuiLinearProgress-bar": { backgroundColor: "primary.main" } }} />
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                            {progress}% complete
                        </Typography>
                    </Box>
                )}

                {/* ── Done ── */}
                {phase === "done" && (
                    <Box sx={{ textAlign: "center", py: 6 }}>
                        <Typography variant="h5" sx={{ color: "primary.dark", fontWeight: 700, mb: 1 }}>
                            Done!
                        </Typography>
                        <Typography sx={{ color: "text.secondary", mb: 3 }}>
                            {doneCount - errors.length} articles updated.
                            {errors.length > 0 && ` ${errors.length} failed.`}
                        </Typography>
                        {errors.length > 0 && (
                            <Alert severity="warning" sx={{ mb: 3, textAlign: "left" }}>
                                <strong>Failed to update:</strong>
                                <ul style={{ margin: "4px 0 0 0", paddingLeft: 20 }}>
                                    {errors.map(t => <li key={t}>{t}</li>)}
                                </ul>
                            </Alert>
                        )}
                        <Button variant="contained" component={Link}
                            href={`/tabletop/worlds/${worldId}`}
                            sx={{ backgroundColor: "primary.main" }}>
                            Back to Wiki
                        </Button>
                    </Box>
                )}
            </Container>
        </Box>
    );
}
