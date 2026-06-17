"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { ArrowLeft, Trash2, Plus, X } from "lucide-react";
import Link from "next/link";

const client = generateClient<Schema>();

const CELL = 50;

const TOKEN_COLORS = [
    "#e53935", "#f4511e", "#fb8c00", "#fdd835",
    "#43a047", "#00acc1", "#1e88e5", "#8e24aa",
    "#d81b60", "#6d4c41", "#546e7a", "#ffffff",
];

interface VttToken {
    id: string;
    label: string;
    color: string;
    col: number;  // grid column (0-indexed)
    row: number;  // grid row (0-indexed)
    size: number; // in grid cells (1, 2, or 3)
}

interface DragState {
    tokenId: string;
    startMouseX: number;
    startMouseY: number;
    startCol: number;
    startRow: number;
    currentCol: number;
    currentRow: number;
}

function parseTokens(json: string | null | undefined): VttToken[] {
    if (!json) return [];
    try { return JSON.parse(json) as VttToken[]; }
    catch { return []; }
}

function generateId(): string {
    return Math.random().toString(36).slice(2, 10);
}

export default function VttBoardPage() {
    const { campaignId, boardId } = useParams<{ campaignId: string; boardId: string }>();
    const router = useRouter();

    const [boardName, setBoardName] = useState("");
    const [gridCols, setGridCols] = useState(30);
    const [gridRows, setGridRows] = useState(20);
    const [tokens, setTokens] = useState<VttToken[]>([]);
    const [loading, setLoading] = useState(true);
    const [drag, setDrag] = useState<DragState | null>(null);
    const [selected, setSelected] = useState<string | null>(null);

    // Add-token form state
    const [newLabel, setNewLabel] = useState("");
    const [newColor, setNewColor] = useState(TOKEN_COLORS[0]);
    const [newSize, setNewSize] = useState(1);

    const svgRef = useRef<SVGSVGElement>(null);
    const tokensRef = useRef<VttToken[]>([]);
    const dragRef = useRef<DragState | null>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep refs in sync
    tokensRef.current = tokens;
    dragRef.current = drag;

    // ── Initial load ──────────────────────────────────────────────────────────
    useEffect(() => {
        async function load() {
            const { data } = await client.models.VttBoard.get({ id: boardId });
            if (!data) { router.push(`/tabletop/campaigns/${campaignId}/vtt`); return; }
            setBoardName(data.name ?? "");
            setGridCols(data.gridCols ?? 30);
            setGridRows(data.gridRows ?? 20);
            setTokens(parseTokens(data.tokensJson));
            setLoading(false);
        }
        load();
    }, [boardId, campaignId, router]);

    // ── Real-time subscription ────────────────────────────────────────────────
    useEffect(() => {
        const sub = client.models.VttBoard.onUpdate().subscribe({
            next: (record) => {
                if (!record || record.id !== boardId) return;
                // Only update tokens if we are not currently dragging
                if (!dragRef.current) {
                    setTokens(parseTokens(record.tokensJson));
                }
            },
        });
        return () => sub.unsubscribe();
    }, [boardId]);

    // ── Persist tokens (debounced) ────────────────────────────────────────────
    const persist = useCallback((updatedTokens: VttToken[]) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            client.models.VttBoard.update({
                id: boardId,
                tokensJson: JSON.stringify(updatedTokens),
            });
        }, 300);
    }, [boardId]);

    // ── Drag helpers ──────────────────────────────────────────────────────────
    function svgCoordsFromEvent(e: MouseEvent): { col: number; row: number } {
        const svg = svgRef.current;
        if (!svg) return { col: 0, row: 0 };
        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        return {
            col: Math.max(0, Math.floor(x / CELL)),
            row: Math.max(0, Math.floor(y / CELL)),
        };
    }

    function onTokenMouseDown(e: React.MouseEvent, token: VttToken) {
        e.preventDefault();
        e.stopPropagation();
        setSelected(token.id);
        const state: DragState = {
            tokenId: token.id,
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            startCol: token.col,
            startRow: token.row,
            currentCol: token.col,
            currentRow: token.row,
        };
        setDrag(state);
        dragRef.current = state;
    }

    useEffect(() => {
        function onMouseMove(e: MouseEvent) {
            if (!dragRef.current) return;
            const { col, row } = svgCoordsFromEvent(e);
            const next = { ...dragRef.current, currentCol: col, currentRow: row };
            dragRef.current = next;
            setDrag({ ...next });
        }

        function onMouseUp(e: MouseEvent) {
            const d = dragRef.current;
            if (!d) return;
            const { col, row } = svgCoordsFromEvent(e);
            dragRef.current = null;
            setDrag(null);

            const updated = tokensRef.current.map(t =>
                t.id === d.tokenId ? { ...t, col, row } : t
            );
            setTokens(updated);
            persist(updated);
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        return () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [persist]);

    // ── Keyboard: Delete selected token ──────────────────────────────────────
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if ((e.key === "Delete" || e.key === "Backspace") && selected) {
                // Don't fire if user is typing in an input
                if (document.activeElement?.tagName === "INPUT") return;
                const updated = tokensRef.current.filter(t => t.id !== selected);
                setTokens(updated);
                setSelected(null);
                persist(updated);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selected, persist]);

    // ── Token CRUD ────────────────────────────────────────────────────────────
    function addToken() {
        if (!newLabel.trim()) return;
        const token: VttToken = {
            id: generateId(),
            label: newLabel.trim().slice(0, 4).toUpperCase(),
            color: newColor,
            col: 0,
            row: 0,
            size: newSize,
        };
        const updated = [...tokensRef.current, token];
        setTokens(updated);
        persist(updated);
        setNewLabel("");
    }

    function removeToken(id: string) {
        const updated = tokensRef.current.filter(t => t.id !== id);
        setTokens(updated);
        if (selected === id) setSelected(null);
        persist(updated);
    }

    // ── Render ────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                height: "100vh", backgroundColor: "#0f0f1a", color: "#c9a87c", fontSize: 18 }}>
                Loading board…
            </div>
        );
    }

    const svgW = gridCols * CELL;
    const svgH = gridRows * CELL;

    // Split tokens: non-dragged rendered first, dragged token last (on top)
    const draggedToken = drag ? tokens.find(t => t.id === drag.tokenId) : null;
    const baseTokens = drag ? tokens.filter(t => t.id !== drag.tokenId) : tokens;

    function renderToken(t: VttToken, isDragging: boolean) {
        const col = isDragging && drag ? drag.currentCol : t.col;
        const row = isDragging && drag ? drag.currentRow : t.row;
        const r = (t.size * CELL) / 2;
        const cx = col * CELL + r;
        const cy = row * CELL + r;
        const isSelected = t.id === selected && !isDragging;
        const fillAlpha = t.color === "#ffffff" ? "22" : "28";
        return (
            <g key={t.id} style={{ cursor: isDragging ? "grabbing" : "grab" }}
               onMouseDown={(e) => onTokenMouseDown(e, t)}>
                {isSelected && (
                    <circle cx={cx} cy={cy} r={r + 4}
                        fill="none" stroke="#ffffff" strokeWidth={2}
                        strokeDasharray="6 3" opacity={0.7} />
                )}
                <circle cx={cx} cy={cy} r={r - 4}
                    fill={t.color + fillAlpha}
                    stroke={t.color}
                    strokeWidth={4}
                    opacity={isDragging ? 0.85 : 1} />
                <text x={cx} y={cy + 1}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={r * 0.55} fontWeight={700}
                    fill={t.color === "#ffffff" ? "#aaa" : t.color}
                    style={{ pointerEvents: "none", userSelect: "none" }}>
                    {t.label}
                </text>
            </g>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100vh",
            backgroundColor: "#0f0f1a", color: "#e0d8cc", overflow: "hidden" }}>

            {/* Top bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                backgroundColor: "#1a1a2e", borderBottom: "1px solid #2a2a4a", flexShrink: 0 }}>
                <Link href={`/tabletop/campaigns/${campaignId}/vtt`}
                    style={{ color: "#c9a87c", display: "flex", alignItems: "center", gap: 6,
                        textDecoration: "none", fontSize: 14 }}>
                    <ArrowLeft size={16} /> Back
                </Link>
                <span style={{ color: "#3a3a5c", fontSize: 18 }}>|</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: "#c9a87c" }}>{boardName}</span>
                <span style={{ color: "#6b6b8a", fontSize: 13, marginLeft: 4 }}>
                    {gridCols}×{gridRows} · {tokens.length} token{tokens.length !== 1 ? "s" : ""}
                </span>
            </div>

            {/* Main area: grid + sidebar */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

                {/* Grid scroll area */}
                <div style={{ flex: 1, overflow: "auto", backgroundColor: "#0f0f1a" }}>
                    <svg ref={svgRef} width={svgW} height={svgH}
                        style={{ display: "block", cursor: drag ? "grabbing" : "default" }}
                        onMouseDown={(e) => {
                            if (e.target === svgRef.current) setSelected(null);
                        }}>

                        {/* White grid background */}
                        <rect width={svgW} height={svgH} fill="#ffffff" />

                        {/* Grid lines via pattern */}
                        <defs>
                            <pattern id="grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
                                <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`}
                                    fill="none" stroke="#cccccc" strokeWidth={0.5} />
                            </pattern>
                        </defs>
                        <rect width={svgW} height={svgH} fill="url(#grid)" />
                        {/* Border */}
                        <rect width={svgW} height={svgH} fill="none" stroke="#aaaaaa" strokeWidth={1} />

                        {/* Tokens (non-dragged first, dragged last) */}
                        {baseTokens.map(t => renderToken(t, false))}
                        {draggedToken && renderToken(draggedToken, true)}
                    </svg>
                </div>

                {/* Right sidebar */}
                <div style={{ width: 220, backgroundColor: "#1a1a2e", borderLeft: "1px solid #2a2a4a",
                    display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>

                    {/* Add token form */}
                    <div style={{ padding: 14, borderBottom: "1px solid #2a2a4a" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#c9a87c",
                            textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                            Add Token
                        </div>

                        <input
                            value={newLabel}
                            onChange={e => setNewLabel(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") addToken(); }}
                            placeholder="Label (e.g. Gob)"
                            maxLength={12}
                            style={{ width: "100%", padding: "6px 8px", marginBottom: 10,
                                backgroundColor: "#0f0f1a", border: "1px solid #3a3a5a",
                                borderRadius: 4, color: "#e0d8cc", fontSize: 13,
                                outline: "none", boxSizing: "border-box" }}
                        />

                        {/* Color swatches */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, marginBottom: 10 }}>
                            {TOKEN_COLORS.map(c => (
                                <div key={c} onClick={() => setNewColor(c)}
                                    style={{ width: 24, height: 24, borderRadius: "50%",
                                        backgroundColor: c,
                                        border: newColor === c ? "2px solid #fff" : "2px solid transparent",
                                        cursor: "pointer", boxSizing: "border-box" }} />
                            ))}
                        </div>

                        {/* Size selector */}
                        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                            {[1, 2, 3].map(s => (
                                <button key={s} onClick={() => setNewSize(s)}
                                    style={{ flex: 1, padding: "4px 0",
                                        backgroundColor: newSize === s ? "#c9a87c" : "#0f0f1a",
                                        color: newSize === s ? "#0f0f1a" : "#c9a87c",
                                        border: "1px solid #c9a87c", borderRadius: 4,
                                        cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                                    {s}×{s}
                                </button>
                            ))}
                        </div>

                        <button onClick={addToken} disabled={!newLabel.trim()}
                            style={{ width: "100%", padding: "7px 0",
                                backgroundColor: newLabel.trim() ? "#c9a87c" : "#3a3a5a",
                                color: newLabel.trim() ? "#0f0f1a" : "#6b6b8a",
                                border: "none", borderRadius: 4,
                                cursor: newLabel.trim() ? "pointer" : "default",
                                fontWeight: 700, fontSize: 13,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <Plus size={14} /> Add
                        </button>
                    </div>

                    {/* Token list */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
                        {tokens.length === 0 && (
                            <div style={{ color: "#6b6b8a", fontSize: 12, textAlign: "center",
                                padding: "20px 14px" }}>
                                No tokens yet.<br />Add one above.
                            </div>
                        )}
                        {tokens.map(t => (
                            <div key={t.id}
                                onClick={() => setSelected(t.id === selected ? null : t.id)}
                                style={{ display: "flex", alignItems: "center", gap: 8,
                                    padding: "5px 14px", cursor: "pointer",
                                    backgroundColor: t.id === selected ? "#2a2a4a" : "transparent" }}>
                                <div style={{ width: 14, height: 14, borderRadius: "50%",
                                    border: `3px solid ${t.color}`,
                                    backgroundColor: t.color + "28", flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, color: "#e0d8cc",
                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {t.label}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#6b6b8a" }}>
                                        {t.col},{t.row} · {t.size}×{t.size}
                                    </div>
                                </div>
                                <button onClick={e => { e.stopPropagation(); removeToken(t.id); }}
                                    style={{ background: "none", border: "none", cursor: "pointer",
                                        color: "#6b6b8a", padding: 2, display: "flex",
                                        alignItems: "center", flexShrink: 0 }}>
                                    <X size={13} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Hint */}
                    <div style={{ padding: "8px 14px", borderTop: "1px solid #2a2a4a",
                        fontSize: 11, color: "#4a4a6a", lineHeight: 1.5 }}>
                        Click to select · Del to remove<br />
                        Drag to move
                    </div>
                </div>
            </div>
        </div>
    );
}
