"use client";

// The search page shared by the SRD references (/tabletop/cypher,
// /tabletop/srd). Each SRD's data is cleaned and merged ahead of time into a
// search index by its own script in scripts/, searched by lib/srdSearch.ts
// and filtered by lib/srdFacets.ts; what differs per SRD (categories, colors,
// filters, wording) comes in through SrdBrowserConfig.

import { createContext, useContext, useState, useEffect, useMemo, useRef, useDeferredValue } from "react";
import { useSearchParams } from "next/navigation";
import {
    Box, Container, Button, Typography, TextField, Chip, Link as MuiLink, IconButton, Tooltip,
    Collapse, CircularProgress, Skeleton, InputAdornment, Divider,
    Table, TableBody, TableCell, TableHead, TableRow,
} from "@mui/material";
import { Search, ArrowLeft, ChevronDown, ChevronUp, ChevronRight, BookOpen, Link2, Check } from "lucide-react";
import Link from "next/link";
import type { SrdEntry } from "@/lib/srdIndex";
import { highlightPattern, prepareDocs, searchSrdIndex, snippet, type SearchHit } from "@/lib/srdSearch";
import {
    groupByFacet, matchesFacets, searchStateFromParams, searchStateToParams,
    summarizeFacets, toggleFacet, type FacetSelection, type FacetSummary, type SrdFacetConfig,
} from "@/lib/srdFacets";

export interface SrdBrowserConfig {
    title: string;
    intro: string;
    placeholder: string;
    indexPath: string;
    iconColor: string;
    // Per category (every one in facets.categories).
    colors: Record<string, string>;
    blurbs: Record<string, string>;
    facets: SrdFacetConfig;
    // Display names for facet keys that need one, e.g. { Book: "Source book" }.
    facetLabels?: Record<string, string>;
    // Shown below the results, e.g. a license attribution.
    footer?: string;
}

const ConfigContext = createContext<SrdBrowserConfig | null>(null);
const useConfig = () => useContext(ConfigContext)!;

const PAGE_SIZE = 20;

// ── Text rendering ───────────────────────────────────────────────────────────

// `pattern` (from highlightPattern) marks the query words where they start a word.
function highlight(text: string, pattern: RegExp | null): React.ReactNode {
    if (!pattern) return text;
    const nodes: React.ReactNode[] = [];
    let last = 0;
    for (const m of Array.from(text.matchAll(pattern))) {
        if (m.index! > last) nodes.push(text.slice(last, m.index));
        nodes.push(
            <mark key={m.index} style={{ backgroundColor: "#fde68a", borderRadius: 2, padding: "0 1px", fontWeight: 700 }}>
                {m[0]}
            </mark>
        );
        last = m.index! + m[0].length;
    }
    if (!nodes.length) return text;
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
}

// Renders [[Name]] as a link when the entry's `links` resolves it, else as plain text.
function withLinks(
    text: string, pattern: RegExp | null, links: Record<string, string> | undefined, onNavigate: (id: string) => void,
): React.ReactNode {
    const parts = text.split(/\[\[(.+?)\]\]/g);
    if (parts.length === 1) return highlight(text, pattern);
    return parts.map((part, i) => {
        if (i % 2 === 0) return <span key={i}>{highlight(part, pattern)}</span>;
        const target = links?.[part];
        if (!target) return <span key={i}>{highlight(part, pattern)}</span>;
        return (
            <MuiLink
                key={i}
                component="button"
                type="button"
                onClick={() => onNavigate(target)}
                sx={{ font: "inherit", verticalAlign: "baseline", fontWeight: 600 }}
            >
                {highlight(part, pattern)}
            </MuiLink>
        );
    });
}

// *italic* spans; asterisks used any other way (multiplication, a lone "*") stay as they are.
const ITALIC = /(?<![*\w])\*(?![\s*])([^*\n]+?)(?<![\s*])\*(?![*\w])/g;

function inline(
    text: string, pattern: RegExp | null, links: Record<string, string> | undefined, onNavigate: (id: string) => void,
): React.ReactNode {
    const parts = text.split(ITALIC);
    if (parts.length === 1) return withLinks(text, pattern, links, onNavigate);
    return parts.map((part, i) => i % 2 === 1
        ? <em key={i}>{withLinks(part, pattern, links, onNavigate)}</em>
        : <span key={i}>{withLinks(part, pattern, links, onNavigate)}</span>);
}

const isTableBlock = (para: string) => {
    const lines = para.split("\n").filter((l) => l.trim());
    return lines.length > 1 && lines.every((l) => /^\s*\|.*\|\s*$/.test(l));
};
const tableCells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
const isSeparatorRow = (cells: string[]) => cells.every((c) => /^:?-{3,}:?$/.test(c));

// A markdown pipe table; the row before a |---| separator is the header,
// left out when it's blank (some SRD tables are just a grid of terms).
function SrdTable({ para, pattern, links, onNavigate }: {
    para: string;
    pattern: RegExp | null;
    links?: Record<string, string>;
    onNavigate: (id: string) => void;
}) {
    const rows = para.split("\n").filter((l) => l.trim()).map(tableCells);
    const sepAt = rows.findIndex(isSeparatorRow);
    const header = sepAt === 1 && rows[0].some(Boolean) ? rows[0] : null;
    const body = rows.filter((r, i) => !isSeparatorRow(r) && !(sepAt === 1 && i === 0));
    const cell = (c: string) => c.split(/\*\*(.*?)\*\*/g).map((part, j) => j % 2 === 1
        ? <strong key={j}>{inline(part, pattern, links, onNavigate)}</strong>
        : <span key={j}>{inline(part, pattern, links, onNavigate)}</span>);
    return (
        <Box sx={{ overflowX: "auto", mb: 1.25 }}>
            <Table size="small" sx={{ width: "auto", "& td, & th": { py: 0.5, px: 1.25, fontSize: "0.8125rem" } }}>
                {header && (
                    <TableHead>
                        <TableRow>{header.map((c, j) => <TableCell key={j} sx={{ fontWeight: 700 }}>{cell(c)}</TableCell>)}</TableRow>
                    </TableHead>
                )}
                <TableBody>
                    {body.map((r, i) => (
                        <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{cell(c)}</TableCell>)}</TableRow>
                    ))}
                </TableBody>
            </Table>
        </Box>
    );
}

function DescText({ text, pattern, links, onNavigate }: {
    text: string;
    pattern: RegExp | null;
    links?: Record<string, string>;
    onNavigate: (id: string) => void;
}) {
    return (
        <Box>
            {text.split("\n\n").map((para, i) => isTableBlock(para) ? (
                <SrdTable key={i} para={para} pattern={pattern} links={links} onNavigate={onNavigate} />
            ) : (
                <Typography key={i} variant="body2" sx={{ mb: 0.75, lineHeight: 1.65, whiteSpace: "pre-line" }}>
                    {para.split(/\*\*(.*?)\*\*/g).map((part, j) =>
                        j % 2 === 1
                            ? <strong key={j}>{inline(part, pattern, links, onNavigate)}</strong>
                            : <span key={j}>{inline(part, pattern, links, onNavigate)}</span>
                    )}
                </Typography>
            ))}
        </Box>
    );
}

// ── Result cards & lists ─────────────────────────────────────────────────────

function CopyLinkButton({ entry }: { entry: SrdEntry }) {
    const config = useConfig();
    const [copied, setCopied] = useState(false);
    const copy = () => {
        const params = searchStateToParams(
            { query: entry.name, category: entry.category, facets: {}, focusId: entry.id }, config.facets,
        );
        navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}?${params}`).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
    };
    return (
        <Tooltip title={copied ? "Copied" : "Copy link to this entry"}>
            <IconButton size="small" onClick={copy} aria-label="Copy link to this entry" sx={{ color: "text.secondary" }}>
                {copied ? <Check size={16} /> : <Link2 size={16} />}
            </IconButton>
        </Tooltip>
    );
}

interface CardContext {
    pattern: RegExp | null;
    focusId: string | null;
    onNavigate: (id: string) => void;
}

function ResultCard({ hit, pattern, focused, onNavigate }: {
    hit: SearchHit;
    pattern: RegExp | null;
    focused: boolean;
    onNavigate: (id: string) => void;
}) {
    const { entry } = hit;
    const config = useConfig();
    const [expanded, setExpanded] = useState(focused);
    const [wasFocused, setWasFocused] = useState(focused);
    const [variantIdx, setVariantIdx] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    const color = config.colors[entry.category];
    const shown = entry.variants?.[variantIdx] ?? entry;
    // An entry that only mentions the query in its text shows where, so it's
    // clear why it turned up.
    const excerpt = useMemo(
        () => (hit.tier === "text" ? snippet(shown.description, pattern) : null),
        [hit.tier, shown.description, pattern],
    );

    // Arriving here via a [[link]] or a shared URL opens the card and brings it into view.
    if (focused !== wasFocused) {
        setWasFocused(focused);
        if (focused) setExpanded(true);
    }
    useEffect(() => {
        if (focused) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [focused]);

    return (
        <Box
            ref={ref}
            sx={{
                borderLeft: `4px solid ${color}`,
                borderRadius: "4px 8px 8px 4px",
                backgroundColor: "background.paper",
                boxShadow: 1,
                overflow: "hidden",
                mb: 1.5,
            }}
        >
            <Box
                sx={{ p: 2, cursor: "pointer", "&:hover": { backgroundColor: "action.hover" } }}
                onClick={() => setExpanded((e) => !e)}
            >
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, justifyContent: "space-between" }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem", color: "text.primary" }}>
                                {highlight(entry.name, pattern)}
                            </Typography>
                            <Chip
                                label={entry.category}
                                size="small"
                                sx={{
                                    backgroundColor: color,
                                    color: "#fff",
                                    fontWeight: 600,
                                    fontSize: "0.7rem",
                                    height: 20,
                                    "& .MuiChip-label": { px: 1 },
                                }}
                            />
                            {entry.variants && (
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    {entry.variants.length} versions
                                </Typography>
                            )}
                        </Box>
                        <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                            {shown.meta}
                        </Typography>
                        {excerpt && !expanded && (
                            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.75, fontStyle: "italic" }}>
                                {highlight(excerpt, pattern)}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ color: "text.secondary", flexShrink: 0, mt: 0.25 }}>
                        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </Box>
                </Box>
            </Box>
            <Collapse in={expanded} unmountOnExit>
                <Divider />
                <Box sx={{ p: 2, pt: 1.5, backgroundColor: "background.default" }}>
                    {entry.variants && (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
                            {entry.variants.map((v, i) => (
                                <Chip
                                    key={v.label}
                                    label={v.label}
                                    size="small"
                                    onClick={() => setVariantIdx(i)}
                                    variant={i === variantIdx ? "filled" : "outlined"}
                                    color={i === variantIdx ? "primary" : "default"}
                                />
                            ))}
                        </Box>
                    )}
                    <DescText text={shown.description} pattern={pattern} links={entry.links} onNavigate={onNavigate} />
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mt: 1 }}>
                        <Typography variant="caption" sx={{ color: "text.disabled" }}>
                            {shown.source}
                        </Typography>
                        <CopyLinkButton entry={entry} />
                    </Box>
                </Box>
            </Collapse>
        </Box>
    );
}

// Shows the first PAGE_SIZE hits, then more on request.
function ResultList({ hits, ctx }: { hits: SearchHit[]; ctx: CardContext }) {
    // Keep a shared/linked entry visible even if it's past the first page.
    const focusAt = ctx.focusId ? hits.findIndex((h) => h.entry.id === ctx.focusId) : -1;
    const [limit, setLimit] = useState(Math.max(PAGE_SIZE, focusAt + 1));
    const remaining = hits.length - limit;
    return (
        <>
            {hits.slice(0, limit).map((hit) => (
                <ResultCard
                    key={hit.entry.id}
                    hit={hit}
                    pattern={ctx.pattern}
                    focused={hit.entry.id === ctx.focusId}
                    onNavigate={ctx.onNavigate}
                />
            ))}
            {remaining > 0 && (
                <Button size="small" onClick={() => setLimit((l) => l + PAGE_SIZE * 2)} sx={{ mb: 1 }}>
                    Show {Math.min(remaining, PAGE_SIZE * 2)} more of {remaining}
                </Button>
            )}
        </>
    );
}

function Section({ title, count, color, defaultOpen, children }: {
    title: string;
    count: number;
    color?: string;
    defaultOpen: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <Box sx={{ mb: 1.5 }}>
            <Box
                component="button"
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                sx={{
                    display: "flex", alignItems: "center", gap: 1, width: "100%", textAlign: "left",
                    border: 0, background: "none", cursor: "pointer", py: 1, px: 0, color: "text.primary", font: "inherit",
                }}
            >
                {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                {color && <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />}
                <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>{count}</Typography>
            </Box>
            <Collapse in={open} unmountOnExit>
                <Box sx={{ pt: 0.5 }}>{children}</Box>
            </Collapse>
        </Box>
    );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <Typography variant="overline" component="h2" sx={{ display: "block", color: "text.secondary", fontWeight: 700, mt: 3, mb: 1 }}>
            {children}
        </Typography>
    );
}

// ── Filters & landing ────────────────────────────────────────────────────────

const VISIBLE_FACET_VALUES = 10;

function FacetRow({ facet, onToggle }: { facet: FacetSummary; onToggle: (value: string) => void }) {
    const config = useConfig();
    const [showAll, setShowAll] = useState(false);
    const visible = showAll ? facet.values : facet.values.slice(0, VISIBLE_FACET_VALUES);
    const hidden = facet.values.length - visible.length;
    return (
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, mb: 1 }}>
            <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600, minWidth: 90 }}>
                {config.facetLabels?.[facet.key] ?? facet.key}
            </Typography>
            {visible.map((v) => (
                <Chip
                    key={v.value}
                    size="small"
                    label={`${v.value} · ${v.count}`}
                    onClick={() => onToggle(v.value)}
                    variant={v.selected ? "filled" : "outlined"}
                    color={v.selected ? "primary" : "default"}
                />
            ))}
            {hidden > 0 && (
                <Button size="small" onClick={() => setShowAll(true)} sx={{ minWidth: 0 }}>+{hidden} more</Button>
            )}
        </Box>
    );
}

function FacetBar({ facets, selection, onToggle, onClear }: {
    facets: FacetSummary[];
    selection: FacetSelection;
    onToggle: (key: string, value: string) => void;
    onClear: () => void;
}) {
    if (!facets.length) return null;
    return (
        <Box sx={{ mb: 3, p: 1.5, borderRadius: 1, backgroundColor: "background.paper", boxShadow: 1 }}>
            {facets.map((f) => (
                <FacetRow key={f.key} facet={f} onToggle={(value) => onToggle(f.key, value)} />
            ))}
            {Object.keys(selection).length > 0 && (
                <Button size="small" onClick={onClear}>Clear filters</Button>
            )}
        </Box>
    );
}

function CategoryLanding({ counts, onPick }: { counts: Map<string, number>; onPick: (c: string) => void }) {
    const config = useConfig();
    return (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 1.5 }}>
            {config.facets.categories.map((cat) => (
                <Box
                    key={cat}
                    component="button"
                    type="button"
                    onClick={() => onPick(cat)}
                    sx={{
                        textAlign: "left", cursor: "pointer", font: "inherit", color: "text.primary",
                        border: 0, borderLeft: `4px solid ${config.colors[cat]}`, borderRadius: "4px 8px 8px 4px",
                        backgroundColor: "background.paper", boxShadow: 1, p: 1.5,
                        "&:hover": { backgroundColor: "action.hover" },
                    }}
                >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1 }}>
                        <Typography sx={{ fontWeight: 600 }}>{cat}</Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            {(counts.get(cat) ?? 0).toLocaleString()}
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                        {config.blurbs[cat]}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

function countByCategory(entries: SrdEntry[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    return counts;
}

// Text-only hits grouped by category, most relevant category first.
function groupByCategory(hits: SearchHit[]): Array<{ category: string; hits: SearchHit[] }> {
    const groups = new Map<string, SearchHit[]>();
    for (const hit of hits) {
        if (!groups.has(hit.entry.category)) groups.set(hit.entry.category, []);
        groups.get(hit.entry.category)!.push(hit);
    }
    return Array.from(groups, ([category, hits]) => ({ category, hits }));
}

export default function SrdBrowser({ config }: { config: SrdBrowserConfig }) {
    const searchParams = useSearchParams();
    const [initial] = useState(() => searchStateFromParams(new URLSearchParams(searchParams.toString()), config.facets));
    const [entries, setEntries] = useState<SrdEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [query, setQuery] = useState(initial.query);
    const [category, setCategory] = useState(initial.category);
    const [facets, setFacets] = useState<FacetSelection>(initial.facets);
    const [focusId, setFocusId] = useState<string | null>(initial.focusId);
    // Results follow a deferred copy of the query, so typing never waits on them.
    const deferredQuery = useDeferredValue(query);
    const q = deferredQuery.trim();

    useEffect(() => {
        fetch(config.indexPath)
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((data: SrdEntry[]) => setEntries(data))
            .catch(() => setLoadFailed(true))
            .finally(() => setLoading(false));
    }, [config.indexPath]);

    // Keep the URL shareable: it always reflects the current search.
    useEffect(() => {
        const params = searchStateToParams({ query: q, category, facets, focusId }, config.facets).toString();
        const url = params ? `${window.location.pathname}?${params}` : window.location.pathname;
        if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", url);
    }, [q, category, facets, focusId, config.facets]);

    const docs = useMemo(() => prepareDocs(entries), [entries]);
    const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

    const pickCategory = (cat: string) => {
        setCategory(cat);
        setFacets({});
        setFocusId(null);
    };

    const navigate = (id: string) => {
        const target = byId.get(id);
        if (!target) return;
        setQuery(target.name);
        setCategory(target.category);
        setFacets({});
        setFocusId(id);
    };

    // Searched across every category, so the category chips can show counts.
    const everything = useMemo(() => (q ? searchSrdIndex(docs, q) : null), [docs, q]);
    const categoryCounts = useMemo(
        () => countByCategory(everything ? everything.hits.map((h) => h.entry) : entries),
        [everything, entries],
    );
    const inCategory = useMemo<SearchHit[]>(() => {
        if (everything) return category === "All" ? everything.hits : everything.hits.filter((h) => h.entry.category === category);
        return category === "All" ? [] : searchSrdIndex(docs, "", category).hits;
    }, [everything, docs, category]);
    const facetSummary = useMemo(
        () => (category === "All" ? [] : summarizeFacets(inCategory, facets, config.facets)),
        [inCategory, facets, category, config.facets],
    );
    const results = useMemo(() => inCategory.filter((h) => matchesFacets(h.entry, facets)), [inCategory, facets]);
    const pattern = useMemo(() => highlightPattern(everything?.terms ?? []), [everything]);

    const ctx: CardContext = { pattern, focusId, onNavigate: navigate };
    const stale = query !== deferredQuery;
    // Lists reset (collapsed state, "show more") whenever the search changes.
    const resultsKey = JSON.stringify([q, category, facets]);

    const renderResults = () => {
        if (!q && category === "All") return <CategoryLanding counts={categoryCounts} onPick={pickCategory} />;

        if (!q) {
            const groupKey = config.facets.browseGrouping?.[category];
            if (!groupKey) return <ResultList hits={results} ctx={ctx} />;
            const groups = groupByFacet(results, groupKey, config.facets, facets[groupKey]);
            return groups.map((g) => (
                <Section key={g.label} title={g.label} count={g.items.length} defaultOpen={groups.length <= 6}>
                    <ResultList hits={g.items} ctx={ctx} />
                </Section>
            ));
        }

        if (!results.length) {
            const elsewhere = everything?.hits.length ?? 0;
            return (
                <Box sx={{ textAlign: "center", py: 8 }}>
                    <Typography sx={{ color: "text.secondary" }}>
                        No results{category !== "All" ? ` in ${category}` : ""}
                        {Object.keys(facets).length ? " with these filters" : ""}.
                    </Typography>
                    {category !== "All" && elsewhere > 0 && (
                        <Button onClick={() => pickCategory("All")} sx={{ mt: 1 }}>
                            Show {elsewhere} {elsewhere === 1 ? "match" : "matches"} in all categories
                        </Button>
                    )}
                </Box>
            );
        }

        const best = results.filter((h) => h.tier !== "text");
        const mentioned = results.filter((h) => h.tier === "text");
        const mentionGroups = groupByCategory(mentioned);
        return (
            <>
                {best.length > 0 && (
                    <>
                        <SectionHeading>
                            {everything?.similar ? "No exact matches — similar names" : `Best matches · ${best.length}`}
                        </SectionHeading>
                        <ResultList hits={best} ctx={ctx} />
                    </>
                )}
                {mentioned.length > 0 && (
                    <>
                        <SectionHeading>Mentioned in · {mentioned.length}</SectionHeading>
                        {mentionGroups.map((g, i) => (
                            <Section
                                key={g.category}
                                title={g.category}
                                count={g.hits.length}
                                color={config.colors[g.category]}
                                defaultOpen={category !== "All" || (!best.length && i === 0)}
                            >
                                <ResultList hits={g.hits} ctx={ctx} />
                            </Section>
                        ))}
                    </>
                )}
            </>
        );
    };

    return (
        <ConfigContext.Provider value={config}>
            <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
                <Container maxWidth="md">
                    <Button
                        component={Link}
                        href="/tabletop"
                        startIcon={<ArrowLeft size={16} />}
                        sx={{ mb: 4, color: "primary.main" }}
                    >
                        Back
                    </Button>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                        <BookOpen size={32} color={config.iconColor} />
                        <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                            {config.title}
                        </Typography>
                    </Box>
                    <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                        {config.intro}
                        {!loading && !loadFailed && ` ${entries.length.toLocaleString()} entries indexed.`}
                    </Typography>

                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder={config.placeholder}
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setFocusId(null); }}
                        disabled={loading}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        {loading
                                            ? <CircularProgress size={18} />
                                            : <Search size={18} />}
                                    </InputAdornment>
                                ),
                            },
                        }}
                        sx={{ mb: 2 }}
                    />

                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                        {["All", ...config.facets.categories].map((cat) => {
                            const count = cat === "All"
                                ? Array.from(categoryCounts.values()).reduce((a, b) => a + b, 0)
                                : categoryCounts.get(cat) ?? 0;
                            const selected = category === cat;
                            return (
                                <Chip
                                    key={cat}
                                    label={!loading && (q || cat === "All") ? `${cat} · ${count.toLocaleString()}` : cat}
                                    onClick={() => pickCategory(cat)}
                                    variant={selected ? "filled" : "outlined"}
                                    sx={{
                                        opacity: q && !count && !selected ? 0.45 : 1,
                                        ...(selected && cat !== "All" ? {
                                            backgroundColor: config.colors[cat],
                                            color: "#fff",
                                            "&:hover": { backgroundColor: config.colors[cat] },
                                        } : {}),
                                    }}
                                />
                            );
                        })}
                    </Box>

                    <FacetBar
                        facets={facetSummary}
                        selection={facets}
                        onToggle={(key, value) => { setFacets((f) => toggleFacet(f, key, value)); setFocusId(null); }}
                        onClear={() => setFacets({})}
                    />
                    {!facetSummary.length && <Box sx={{ mb: 2 }} />}

                    {loading ? (
                        [1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} variant="rectangular" height={72} sx={{ borderRadius: 1, mb: 1.5 }} />
                        ))
                    ) : loadFailed ? (
                        <Typography sx={{ color: "error.main", textAlign: "center", py: 8 }}>
                            Couldn&apos;t load the SRD index. Try reloading the page.
                        </Typography>
                    ) : (
                        <Box key={resultsKey} sx={{ opacity: stale ? 0.6 : 1, transition: "opacity 0.15s" }}>
                            {renderResults()}
                        </Box>
                    )}

                    {config.footer && (
                        <Typography variant="caption" component="p" sx={{ color: "text.disabled", mt: 6 }}>
                            {config.footer}
                        </Typography>
                    )}
                </Container>
            </Box>
        </ConfigContext.Provider>
    );
}
