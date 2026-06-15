"use client";

import { useState, useRef } from "react";
import {
    Box, Container, Typography, Button, Paper, LinearProgress,
    FormControl, InputLabel, Select, MenuItem,
    FormControlLabel, Checkbox, Alert,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Download, CheckCircle, XCircle, SkipForward } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { convertOpen5eMonster, type Open5eV2Page } from "@/lib/open5eConverter";

const client = generateClient<Schema>();

// document__key values from api.open5e.com/v2/documents/
const SOURCES = [
    { key: "srd-2014",  label: "5e 2014 Rules (SRD)",              count: 325 },
    { key: "bfrd",      label: "Black Flag SRD",                    count: null },
    { key: "tob",       label: "Tome of Beasts",                    count: null },
    { key: "ccdx",      label: "Creature Codex",                    count: null },
    { key: "tob2",      label: "Tome of Beasts 2",                  count: null },
    { key: "tob3",      label: "Tome of Beasts 3",                  count: null },
    { key: "tob-2023",  label: "Tome of Beasts 2023",               count: null },
    { key: "a5e-mm",    label: "Level Up: Monstrous Menagerie",     count: null },
    { key: "all",       label: "All Sources (3541 monsters)",       count: 3541 },
];

type ImportState = "idle" | "fetching" | "importing" | "done" | "cancelled";

interface LogEntry {
    status: "ok" | "skip" | "error";
    name: string;
    publisher: string;
    message?: string;
}

const BATCH = 8;   // parallel creates per batch
const PAGE  = 100; // monsters per API page

const BASE = "https://api.open5e.com/v2/creatures/";

function pageUrl(source: string, page: number) {
    const params = new URLSearchParams({ limit: String(PAGE), page: String(page) });
    if (source !== "all") params.set("document__key", source);
    return `${BASE}?${params}`;
}

export default function ImportOpen5ePage() {
    const [source, setSource]             = useState("srd-2014");
    const [skipExisting, setSkipExisting] = useState(true);
    const [state, setState]               = useState<ImportState>("idle");
    const [total, setTotal]               = useState(0);
    const [progress, setProgress]         = useState(0);
    const [log, setLog]                   = useState<LogEntry[]>([]);
    const [counts, setCounts]             = useState({ ok: 0, skip: 0, error: 0 });
    const cancelRef = useRef(false);
    const logRef    = useRef<LogEntry[]>([]);
    const logBoxRef = useRef<HTMLDivElement>(null);

    function pushLog(entry: LogEntry) {
        logRef.current = [...logRef.current, entry];
        setLog([...logRef.current]);
        setCounts(c => ({ ...c, [entry.status]: c[entry.status] + 1 }));
        setTimeout(() => {
            if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
        }, 0);
    }

    async function runImport() {
        cancelRef.current = false;
        logRef.current = [];
        setLog([]);
        setCounts({ ok: 0, skip: 0, error: 0 });
        setProgress(0);
        setState("fetching");

        // ── Step 1: get total count ────────────────────────────────────────
        const countParams = new URLSearchParams({ limit: "1" });
        if (source !== "all") countParams.set("document__key", source);

        let totalCount: number;
        try {
            const res = await fetch(`${BASE}?${countParams}`);
            const first: Open5eV2Page = await res.json();
            totalCount = first.count;
            setTotal(totalCount);
        } catch {
            setState("idle");
            return;
        }

        // ── Step 2: load existing slugs for dedup ──────────────────────────
        const existingSlugs = new Set<string>();
        if (skipExisting) {
            try {
                const existing = await client.models.MonsterStatblock.list({ limit: 10000 });
                (existing.data ?? []).forEach(m => {
                    if (m.slug) existingSlugs.add(m.slug);
                    existingSlugs.add(`${m.name}|${m.publisher}`);
                });
            } catch { /* ignore — import everything */ }
        }

        setState("importing");
        const pages = Math.ceil(totalCount / PAGE);
        let done = 0;

        // ── Step 3: paginate and import ────────────────────────────────────
        for (let page = 1; page <= pages; page++) {
            if (cancelRef.current) { setState("cancelled"); return; }

            let creatures;
            try {
                const res = await fetch(pageUrl(source, page));
                const data: Open5eV2Page = await res.json();
                creatures = data.results ?? [];
            } catch {
                done += PAGE;
                setProgress(Math.min(done, totalCount));
                continue;
            }

            for (let i = 0; i < creatures.length; i += BATCH) {
                if (cancelRef.current) { setState("cancelled"); return; }

                const batch = creatures.slice(i, i + BATCH);
                await Promise.all(batch.map(async m => {
                    if (skipExisting &&
                        (existingSlugs.has(m.key) || existingSlugs.has(`${m.name}|${m.document.display_name ?? m.document.name}`))) {
                        pushLog({ status: "skip", name: m.name, publisher: m.document.display_name ?? m.document.name });
                        return;
                    }
                    try {
                        const input = convertOpen5eMonster(m);
                        await client.models.MonsterStatblock.create(input);
                        existingSlugs.add(m.key);
                        pushLog({ status: "ok", name: m.name, publisher: m.document.display_name ?? m.document.name });
                    } catch (e: any) {
                        pushLog({ status: "error", name: m.name,
                            publisher: m.document.display_name ?? m.document.name,
                            message: e?.message ?? "Unknown error" });
                    }
                }));

                done += batch.length;
                setProgress(Math.min(done, totalCount));
            }
        }

        setState("done");
    }

    const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
    const isRunning = state === "fetching" || state === "importing";

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 6 }}>
            <Container maxWidth="md">
                <Button component={Link} href="/create/monster" startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}>
                    Back to Monster Creator
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                    <Download size={28} color="#8C5A3A" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        Import from Open5e
                    </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    Import monsters from the Open5e API (v2) into your database. Imported monsters appear in
                    the Encounter Builder and Monster Statblock Editor (read-only — copy them to homebrew to edit).
                </Typography>

                {/* Config */}
                <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
                    <Typography variant="overline" sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2 }}>
                        Import Options
                    </Typography>

                    <Box sx={{ display: "flex", gap: 2, mt: 2, flexWrap: "wrap", alignItems: "flex-end" }}>
                        <FormControl size="small" sx={{ minWidth: 280 }}>
                            <InputLabel>Source</InputLabel>
                            <Select value={source} label="Source" onChange={e => setSource(e.target.value)}
                                disabled={isRunning}>
                                {SOURCES.map(s => (
                                    <MenuItem key={s.key} value={s.key}>
                                        {s.label}
                                        {s.count && (
                                            <Typography component="span" variant="caption" sx={{ ml: 1, color: "text.disabled" }}>
                                                (~{s.count.toLocaleString()})
                                            </Typography>
                                        )}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControlLabel
                            control={<Checkbox checked={skipExisting} onChange={e => setSkipExisting(e.target.checked)}
                                disabled={isRunning} />}
                            label={<Typography variant="body2">Skip already-imported monsters</Typography>}
                        />
                    </Box>

                    {source !== "srd-2014" && source !== "bfrd" && (
                        <Alert severity="info" sx={{ mt: 2, fontSize: "0.8rem" }}>
                            Non-SRD sources may be under third-party licenses. Use for personal campaigns only.
                        </Alert>
                    )}

                    <Box sx={{ mt: 3, display: "flex", gap: 1.5 }}>
                        <Button variant="contained" startIcon={<Download size={16} />}
                            onClick={runImport} disabled={isRunning}
                            sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" } }}>
                            {isRunning ? "Importing…" : "Start Import"}
                        </Button>
                        {isRunning && (
                            <Button variant="outlined" onClick={() => { cancelRef.current = true; }}
                                sx={{ color: "error.main", borderColor: "error.main" }}>
                                Cancel
                            </Button>
                        )}
                    </Box>
                </Paper>

                {/* Progress */}
                {state !== "idle" && (
                    <Paper elevation={1} sx={{ p: 3, mb: 2 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {state === "fetching"   ? "Fetching total count…" :
                                 state === "done"       ? "Import complete" :
                                 state === "cancelled"  ? "Cancelled" :
                                 `Importing… ${progress.toLocaleString()} / ${total.toLocaleString()}`}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                {pct}%
                            </Typography>
                        </Box>

                        <LinearProgress
                            variant={state === "fetching" ? "indeterminate" : "determinate"}
                            value={pct}
                            sx={{ height: 8, borderRadius: 4, mb: 2,
                                "& .MuiLinearProgress-bar": {
                                    backgroundColor:
                                        state === "done"      ? "#2e7d32" :
                                        state === "cancelled" ? "#f57c00" : "primary.main",
                                } }}
                        />

                        <Box sx={{ display: "flex", gap: 2 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                <CheckCircle size={14} color="#2e7d32" />
                                <Typography variant="body2">{counts.ok.toLocaleString()} imported</Typography>
                            </Box>
                            {counts.skip > 0 && (
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                    <SkipForward size={14} color="#546e7a" />
                                    <Typography variant="body2">{counts.skip.toLocaleString()} skipped</Typography>
                                </Box>
                            )}
                            {counts.error > 0 && (
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                    <XCircle size={14} color="#c62828" />
                                    <Typography variant="body2">{counts.error.toLocaleString()} errors</Typography>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                )}

                {/* Log */}
                {log.length > 0 && (
                    <Paper elevation={1} sx={{ p: 2 }}>
                        <Typography variant="overline"
                            sx={{ color: "text.secondary", fontSize: "0.65rem", letterSpacing: 2, mb: 1, display: "block" }}>
                            Import Log
                        </Typography>
                        <Box ref={logBoxRef}
                            sx={{ maxHeight: 400, overflowY: "auto", fontFamily: "monospace", fontSize: "0.75rem",
                                backgroundColor: "#1a1a1a", color: "#e0e0e0", borderRadius: 1, p: 1.5 }}>
                            {log.map((entry, i) => (
                                <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "baseline",
                                    color: entry.status === "ok"    ? "#81c784" :
                                           entry.status === "skip"  ? "#90a4ae" : "#ef9a9a" }}>
                                    <Typography component="span" sx={{ fontSize: "0.7rem", fontFamily: "monospace" }}>
                                        {entry.status === "ok" ? "✓" : entry.status === "skip" ? "–" : "✗"}
                                    </Typography>
                                    <Typography component="span" sx={{ fontSize: "0.7rem", fontFamily: "monospace" }}>
                                        {entry.name}
                                    </Typography>
                                    <Typography component="span" sx={{ fontSize: "0.65rem", color: "#757575", fontFamily: "monospace" }}>
                                        {entry.publisher}
                                    </Typography>
                                    {entry.message && (
                                        <Typography component="span" sx={{ fontSize: "0.65rem", color: "#ef9a9a", fontFamily: "monospace" }}>
                                            — {entry.message}
                                        </Typography>
                                    )}
                                </Box>
                            ))}
                        </Box>
                    </Paper>
                )}
            </Container>
        </Box>
    );
}
