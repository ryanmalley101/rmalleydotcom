"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Stage, Layer, Rect, Line, Image as KonvaImage, Group, Circle, Text, Transformer } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
    Box, CircularProgress, IconButton, Tooltip, TextField, Drawer, Typography, Button,
    Autocomplete, Divider, MenuItem, Select, FormControl, InputLabel,
    ToggleButtonGroup, ToggleButton, Switch, FormControlLabel, Chip, Popover,
} from "@mui/material";
import {
    ArrowLeft, Settings, ZoomIn, ZoomOut, Plus, Trash2, Unlink, ArrowUpToLine, Image as ImageIcon, MessageSquare,
    MousePointer2, Eye, EyeOff, Pencil, Square, Circle as CircleIcon, Minus, Eraser, Ruler, Triangle, Slash,
    Maximize2, Magnet, BookUser, Music,
} from "lucide-react";
import Link from "next/link";
import { generateClient } from "aws-amplify/data";
import { uploadData, getUrl } from "aws-amplify/storage";
import { getCurrentUser } from "aws-amplify/auth";
import type { Schema } from "@/amplify/data/resource";
import { useFileDrop } from "@/lib/useFileDrop";
import { useCampaignRole } from "@/lib/useCampaignRole";
import { CONDITION_COLOR, CONDITION_NAMES } from "@/lib/dndConditions";
import { getCharacterStatus } from "@/lib/characterStatus";
import { PartyCard as DndPartyCard } from "../../dnd-dashboard/PartyCard";
import { PartyCard as CypherPartyCard } from "../../gm-dashboard/PartyCard";
import { ChatPanel } from "../../_dashboard-shared/ChatPanel";
import { FloatingWindow } from "../../_dashboard-shared/FloatingWindow";
import { SessionAudioPlayer } from "../../_dashboard-shared/SessionAudioPlayer";
import type { DamageTrack } from "@/lib/cypherRules";

const DND_SYSTEMS = ["D&D 5e", "D&D 5.5e (2024)"];
const SHEET_SYSTEMS = [...DND_SYSTEMS, "Cypher System"];

const client = generateClient<Schema>();
type VttBoard = Schema["VttBoard"]["type"];
type VttToken = Schema["VttToken"]["type"];
type PlayerCharacter = Schema["PlayerCharacter"]["type"];

// VTT overhaul Phase 2 — tokens. Character linking is scoped to
// PlayerCharacter only for now: NPC/Companion/MonsterStatblock linking is a
// deliberate near-term follow-up, not an oversight (see the note above
// linkCharacter() below for why).
//
// Per-token ownership (VttToken.ownerId) is still unenforced at the auth
// layer. Phase 5 added a real GM-identity mechanism (useCampaignRole, based
// on Campaign.gmUserId / CampaignMember.userId) that Phase 2 was missing,
// and it's now used below to gate fog/drawing tools and fog visibility —
// but VttToken's server-side authorization rule itself is deliberately NOT
// touched here. Tightening it to allow.ownerDefinedIn('ownerId') is a
// change that, if the identity-claim format assumption is wrong, fails
// silently as broken token writes for everyone — that needs its own
// isolated change with live multi-account testing, not bundling into an
// already-large pass. Left as allow.authenticated().

const DEFAULT_CELL = 50;
const MIN_SCALE = 0.2;
const MAX_SCALE = 4;

const TOKEN_COLORS = [
    "#e53935", "#f4511e", "#fb8c00", "#fdd835",
    "#43a047", "#00acc1", "#1e88e5", "#8e24aa",
    "#d81b60", "#6d4c41", "#546e7a", "#ffffff",
];

const SIZE_PRESETS = [
    { label: "Small (1×1)", cells: 1 },
    { label: "Medium (2×2)", cells: 2 },
    { label: "Large (3×3)", cells: 3 },
];

const DRAW_COLORS = ["#ff5252", "#ffeb3b", "#4caf50", "#2196f3", "#ffffff", "#000000"];
const FEET_PER_SQUARE = 5; // D&D 5e convention — not yet configurable per-campaign

type Tool =
    | "select"
    | "fog-reveal" | "fog-hide"
    | "draw-pen" | "draw-rect" | "draw-circle" | "draw-line"
    | "measure"
    | "aoe-circle" | "aoe-cone" | "aoe-line" | "aoe-square";

interface DrawingShape {
    id: string;
    type: "pen" | "rect" | "circle" | "line";
    points: number[];
    color: string;
    strokeWidth: number;
}

interface AoeTemplate {
    id: string;
    type: "circle" | "cone" | "line" | "square";
    x: number; y: number;
    x2: number; y2: number;
    color: string;
}

export default function VttBoardPage() {
    const { campaignId, boardId } = useParams<{ campaignId: string; boardId: string }>();
    const router = useRouter();
    const { isGm, userId: currentUserId } = useCampaignRole(campaignId);

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const [board, setBoard] = useState<VttBoard | null>(null);
    const [loading, setLoading] = useState(true);
    const [mapUrl, setMapUrl] = useState("");
    const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);
    const [uploading, setUploading] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [offsetXInput, setOffsetXInput] = useState("0");
    const [offsetYInput, setOffsetYInput] = useState("0");

    const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
    const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
    const [stageScale, setStageScale] = useState(1);

    // ── Chat ──────────────────────────────────────────────────────────────────
    const [chatOpen, setChatOpen] = useState(false);
    const [authorName, setAuthorName] = useState("GM");
    useEffect(() => {
        getCurrentUser().then(u => setAuthorName(u.signInDetails?.loginId ?? u.username)).catch(() => {});
    }, []);
    const [musicAnchor, setMusicAnchor] = useState<HTMLElement | null>(null);

    // ── Tokens ────────────────────────────────────────────────────────────────
    const [tokens, setTokens] = useState<VttToken[]>([]);
    const [tokenImageEls, setTokenImageEls] = useState<Record<string, HTMLImageElement>>({});
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [newLabel, setNewLabel] = useState("");
    const [newColor, setNewColor] = useState(TOKEN_COLORS[0]);
    const [newSizeCells, setNewSizeCells] = useState(1);
    const [snapToGrid, setSnapToGrid] = useState(true);

    // ── Linked characters (for the link picker + live HP/condition overlay) ──
    const [characters, setCharacters] = useState<PlayerCharacter[]>([]);

    // ── Floating character sheet windows — D&D and Cypher (see
    // SHEET_SYSTEMS); they read/write through the same `characters` state
    // and PlayerCharacter.onUpdate subscription the token HP overlay
    // already uses, so a sheet edit and a token's HP bar never disagree.
    const [openSheets, setOpenSheets] = useState<{ characterId: string; x: number; y: number; z: number }[]>([]);
    const nextZRef = useRef(1);

    function openSheet(characterId: string) {
        setOpenSheets(prev => {
            const z = nextZRef.current++;
            if (prev.some(s => s.characterId === characterId)) {
                return prev.map(s => s.characterId === characterId ? { ...s, z } : s);
            }
            const offset = prev.length * 28;
            return [...prev, { characterId, x: 120 + offset, y: 100 + offset, z }];
        });
    }
    function closeSheet(characterId: string) {
        setOpenSheets(prev => prev.filter(s => s.characterId !== characterId));
    }
    function focusSheet(characterId: string) {
        const z = nextZRef.current++;
        setOpenSheets(prev => prev.map(s => s.characterId === characterId ? { ...s, z } : s));
    }
    function moveSheet(characterId: string, x: number, y: number) {
        setOpenSheets(prev => prev.map(s => s.characterId === characterId ? { ...s, x, y } : s));
    }
    async function updateCharacter(pcId: string, patch: Partial<PlayerCharacter>) {
        setCharacters(prev => prev.map(c => c.id === pcId ? { ...c, ...patch } : c));
        await client.models.PlayerCharacter.update({ id: pcId, ...patch });
    }

    // Mirrors gm-dashboard/page.tsx's awardXp/adjustPcPool exactly — the
    // Cypher PartyCard expects these two handlers, not a generic patch.
    async function awardXp(pcId: string, amount: number) {
        const pc = characters.find(c => c.id === pcId);
        if (!pc) return;
        const newXp = (pc.xp ?? 0) + amount;
        setCharacters(prev => prev.map(c => c.id === pcId ? { ...c, xp: newXp } : c));
        await client.models.PlayerCharacter.update({ id: pcId, xp: newXp });
    }
    async function adjustPool(pcId: string, pool: "might" | "speed" | "intellect", delta: number) {
        const pc = characters.find(c => c.id === pcId);
        if (!pc) return;
        let snap: Record<string, unknown> = {};
        try { snap = pc.systemDataJson ? JSON.parse(pc.systemDataJson) : {}; } catch { /* start fresh */ }
        const currentKey = `current${pool.charAt(0).toUpperCase()}${pool.slice(1)}`;
        const maxKey = `${pool}Pool`;
        const current = Number(snap[currentKey] ?? 10);
        const max = Number(snap[maxKey] ?? 10);
        const raw = current + delta;
        const next = Math.max(0, Math.min(max, raw));
        const merged: Record<string, unknown> = { ...snap, [currentKey]: next };
        if (delta < 0 && raw < 0) {
            const order: DamageTrack[] = ["hale", "impaired", "debilitated"];
            const idx = order.indexOf((snap.damageTrack as DamageTrack) ?? "hale");
            if (idx < order.length - 1) merged.damageTrack = order[idx + 1];
        }
        const systemDataJson = JSON.stringify(merged);
        setCharacters(prev => prev.map(c => c.id === pcId ? { ...c, systemDataJson } : c));
        await client.models.PlayerCharacter.update({ id: pcId, systemDataJson });
    }

    // ── GM tools: fog, drawing, measurement, AoE templates ───────────────────
    // Fog visibility is role-aware (dimmed for the GM, opaque for players —
    // see the fogEnabled Layer below); drawings still render the same for
    // everyone since GM-only annotations vs. player-visible ones isn't a
    // distinction this app makes yet.
    const [tool, setTool] = useState<Tool>("select");
    const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
    const [drawings, setDrawings] = useState<DrawingShape[]>([]);
    const [drawPreview, setDrawPreview] = useState<DrawingShape | null>(null);
    const [revealedCells, setRevealedCells] = useState<Set<string>>(new Set());
    const [measureLine, setMeasureLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
    const [aoeTemplates, setAoeTemplates] = useState<AoeTemplate[]>([]);
    const [aoePreview, setAoePreview] = useState<AoeTemplate | null>(null);
    const isPaintingRef = useRef(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fog and drawing are GM-only tools — if role resolves to non-GM after
    // the fact (or a player had a GM-only tool selected from a stale state),
    // fall back to select rather than leaving an inaccessible tool active.
    useEffect(() => {
        if (!isGm && (tool.startsWith("fog-") || tool.startsWith("draw-"))) setTool("select");
    }, [isGm, tool]);

    const containerRef = useRef<HTMLDivElement>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const tokenNodeRefs = useRef<Record<string, Konva.Group>>({});
    const tokenFileInputRef = useRef<HTMLInputElement>(null);

    async function load() {
        const { data } = await client.models.VttBoard.get({ id: boardId });
        if (!data) { router.push(`/tabletop/campaigns/${campaignId}/vtt`); return; }
        setBoard(data);
        setOffsetXInput(String(data.gridOffsetX ?? 0));
        setOffsetYInput(String(data.gridOffsetY ?? 0));
        try { setDrawings(JSON.parse(data.drawingsJson ?? "[]")); } catch { setDrawings([]); }
        try { setRevealedCells(new Set(JSON.parse(data.fogJson ?? "[]"))); } catch { setRevealedCells(new Set()); }
        if (data.mapImageKey) {
            try {
                const { url } = await getUrl({ path: data.mapImageKey, options: { expiresIn: 3600 } });
                setMapUrl(url.toString());
            } catch { /* board still works without a map */ }
        }
        setLoading(false);
    }

    useEffect(() => { load(); }, [boardId, campaignId]);

    // ── Token list + live sync (manual list + subscribe, not observeQuery —
    // see CLAUDE.md's note on why observeQuery() isn't used in this project) ──
    useEffect(() => {
        let cancelled = false;
        const filter = { boardId: { eq: boardId } };

        client.models.VttToken.list({ filter }).then(({ data }) => {
            if (!cancelled) setTokens(data ?? []);
        });

        const onCreate = client.models.VttToken.onCreate().subscribe({
            next: (item) => {
                if (!item || item.boardId !== boardId) return;
                setTokens(prev => prev.some(t => t.id === item.id) ? prev : [...prev, item]);
            },
            error: (err) => console.error("[VTT] token onCreate subscription error", err),
        });
        const onUpdate = client.models.VttToken.onUpdate().subscribe({
            next: (item) => {
                if (!item || item.boardId !== boardId) return;
                setTokens(prev => prev.map(t => t.id === item.id ? { ...t, ...item } : t));
            },
            error: (err) => console.error("[VTT] token onUpdate subscription error", err),
        });
        const onDelete = client.models.VttToken.onDelete().subscribe({
            next: (item) => {
                if (!item) return;
                setTokens(prev => prev.filter(t => t.id !== item.id));
                setSelectedId(prev => prev === item.id ? null : prev);
            },
            error: (err) => console.error("[VTT] token onDelete subscription error", err),
        });

        return () => { cancelled = true; onCreate.unsubscribe(); onUpdate.unsubscribe(); onDelete.unsubscribe(); };
    }, [boardId]);

    // ── Campaign characters, for the link picker + live HP overlay ───────────
    useEffect(() => {
        let cancelled = false;
        const filter = { campaignId: { eq: campaignId } };

        client.models.PlayerCharacter.list({ filter }).then(({ data }) => {
            if (!cancelled) setCharacters(data ?? []);
        });

        const onUpdate = client.models.PlayerCharacter.onUpdate().subscribe({
            next: (item) => {
                if (!item || item.campaignId !== campaignId) return;
                setCharacters(prev => prev.map(c => c.id === item.id ? { ...c, ...item } : c));
            },
            error: (err) => console.error("[VTT] character onUpdate subscription error", err),
        });

        return () => { cancelled = true; onUpdate.unsubscribe(); };
    }, [campaignId]);

    const charactersById = useMemo(() => new Map(characters.map(c => [c.id, c])), [characters]);

    // Resize the stage to fill its container.
    useEffect(() => {
        function resize() {
            if (!containerRef.current) return;
            setStageSize({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
        }
        resize();
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, []);

    // Konva's <Image> needs an actual HTMLImageElement, not just a URL string.
    useEffect(() => {
        if (!mapUrl) { setMapImage(null); return; }
        const img = new window.Image();
        img.onload = () => setMapImage(img);
        img.src = mapUrl;
    }, [mapUrl]);

    // Resolve + cache token art the same way (only for keys we don't have yet).
    useEffect(() => {
        const keys = tokens.map(t => t.imageKey).filter((k): k is string => !!k);
        const missing = Array.from(new Set(keys)).filter(k => !tokenImageEls[k]);
        if (missing.length === 0) return;
        (async () => {
            const updates: Record<string, HTMLImageElement> = {};
            await Promise.all(missing.map(async key => {
                try {
                    const { url } = await getUrl({ path: key, options: { expiresIn: 3600 } });
                    await new Promise<void>((resolve) => {
                        const img = new window.Image();
                        img.onload = () => { updates[key] = img; resolve(); };
                        img.onerror = () => resolve();
                        img.src = url.toString();
                    });
                } catch { /* skip — token falls back to a colored circle */ }
            }));
            if (Object.keys(updates).length) setTokenImageEls(prev => ({ ...prev, ...updates }));
        })();
    }, [tokens, tokenImageEls]);

    // Bind the Transformer to whichever token is currently selected.
    useEffect(() => {
        const tr = transformerRef.current;
        if (!tr) return;
        const node = selectedId ? tokenNodeRefs.current[selectedId] : null;
        tr.nodes(node ? [node] : []);
        tr.getLayer()?.batchDraw();
    }, [selectedId, tokens]);

    async function uploadMap(file: File) {
        if (!board) return;
        setUploading(true);
        const ext = file.name.split(".").pop() ?? "jpg";
        const key = `vtt-maps/${boardId}.${ext}`;
        try {
            await uploadData({ path: key, data: file, options: { contentType: file.type } }).result;
            const { url } = await getUrl({ path: key, options: { expiresIn: 3600 } });
            const resolvedUrl = url.toString();

            const dims = await new Promise<{ w: number; h: number }>((resolve) => {
                const img = new window.Image();
                img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
                img.src = resolvedUrl;
            });

            await client.models.VttBoard.update({
                id: boardId, mapImageKey: key, mapWidthPx: dims.w, mapHeightPx: dims.h,
            });
            setMapUrl(resolvedUrl);
            setBoard(prev => prev ? { ...prev, mapImageKey: key, mapWidthPx: dims.w, mapHeightPx: dims.h } : prev);
        } catch (err) {
            console.error("[VTT] map upload failed", err);
        } finally {
            setUploading(false);
        }
    }

    const mapDrop = useFileDrop(files => { if (files[0]) uploadMap(files[0]); });

    async function saveOffsets() {
        const x = parseFloat(offsetXInput) || 0;
        const y = parseFloat(offsetYInput) || 0;
        await client.models.VttBoard.update({ id: boardId, gridOffsetX: x, gridOffsetY: y });
        setBoard(prev => prev ? { ...prev, gridOffsetX: x, gridOffsetY: y } : prev);
    }

    // ── Pan & zoom ────────────────────────────────────────────────────────────
    function handleWheel(e: KonvaEventObject<WheelEvent>) {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        const pointer = stage?.getPointerPosition();
        if (!stage || !pointer) return;

        const oldScale = stageScale;
        const scaleBy = 1.05;
        const next = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));

        const mousePointTo = { x: (pointer.x - stagePos.x) / oldScale, y: (pointer.y - stagePos.y) / oldScale };
        setStageScale(clamped);
        setStagePos({ x: pointer.x - mousePointTo.x * clamped, y: pointer.y - mousePointTo.y * clamped });
    }

    function zoomBy(factor: number) {
        const center = { x: stageSize.width / 2, y: stageSize.height / 2 };
        const oldScale = stageScale;
        const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, oldScale * factor));
        const mousePointTo = { x: (center.x - stagePos.x) / oldScale, y: (center.y - stagePos.y) / oldScale };
        setStageScale(clamped);
        setStagePos({ x: center.x - mousePointTo.x * clamped, y: center.y - mousePointTo.y * clamped });
    }

    // ── Grid geometry ─────────────────────────────────────────────────────────
    const cols = board?.gridCols ?? 30;
    const rows = board?.gridRows ?? 20;
    const mapW = board?.mapWidthPx ?? cols * DEFAULT_CELL;
    const mapH = board?.mapHeightPx ?? rows * DEFAULT_CELL;
    const cellW = mapW / cols;
    const cellH = mapH / rows;
    const offsetX = board?.gridOffsetX ?? 0;
    const offsetY = board?.gridOffsetY ?? 0;

    function fitToScreen() {
        if (!mapW || !mapH || !stageSize.width || !stageSize.height) return;
        const padding = 40;
        const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE,
            Math.min((stageSize.width - padding) / mapW, (stageSize.height - padding) / mapH)));
        setStageScale(scale);
        setStagePos({
            x: (stageSize.width - mapW * scale) / 2,
            y: (stageSize.height - mapH * scale) / 2,
        });
    }

    function snapValue(v: number, cell: number, offset: number) {
        return offset + Math.round((v - offset) / cell) * cell;
    }

    const gridLines = [];
    for (let c = 0; c <= cols; c++) {
        const x = offsetX + c * cellW;
        gridLines.push(<Line key={`v${c}`} points={[x, offsetY, x, offsetY + rows * cellH]} stroke="#ffffff" strokeWidth={1} opacity={0.35} />);
    }
    for (let r = 0; r <= rows; r++) {
        const y = offsetY + r * cellH;
        gridLines.push(<Line key={`h${r}`} points={[offsetX, y, offsetX + cols * cellW, y]} stroke="#ffffff" strokeWidth={1} opacity={0.35} />);
    }

    const cellSize = (cellW + cellH) / 2;
    function pxToFeet(px: number) { return Math.round((px / cellSize) * FEET_PER_SQUARE); }

    // Debounced so a drag gesture (many cell-paints or many pen points) doesn't
    // fire an update per mousemove — the value to save is computed and passed
    // in at call time, so the debounce timing itself can't go stale.
    function scheduleSave(fields: Partial<Pick<VttBoard, "fogJson" | "drawingsJson">>) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            client.models.VttBoard.update({ id: boardId, ...fields });
        }, 600);
    }

    function toggleFogEnabled(_: unknown, checked: boolean) {
        client.models.VttBoard.update({ id: boardId, fogEnabled: checked });
        setBoard(prev => prev ? { ...prev, fogEnabled: checked } : prev);
    }

    // Fog and drawings are visible the same way to every viewer right now —
    // there's no GM-vs-player distinction anywhere in the VTT yet (see the
    // ownerId note above the VttToken model for the underlying reason: this
    // app has no link from a Cognito identity to "is this person the GM of
    // this campaign" that the client can check). Real per-role fog hiding is
    // a Phase 5 concern, not solved here.
    function paintCell(px: number, py: number, reveal: boolean) {
        const col = Math.floor((px - offsetX) / cellW);
        const row = Math.floor((py - offsetY) / cellH);
        if (col < 0 || row < 0 || col >= cols || row >= rows) return;
        const key = `${col},${row}`;
        setRevealedCells(prev => {
            if (reveal === prev.has(key)) return prev;
            const next = new Set(prev);
            if (reveal) next.add(key); else next.delete(key);
            scheduleSave({ fogJson: JSON.stringify(Array.from(next)) });
            return next;
        });
    }

    function clearDrawings() {
        setDrawings([]);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        client.models.VttBoard.update({ id: boardId, drawingsJson: "[]" });
    }

    function getRelPointer(stage: Konva.Stage | null | undefined) {
        return stage ? stage.getRelativePointerPosition() : null;
    }

    function handleStageMouseDown(e: KonvaEventObject<MouseEvent>) {
        if (tool === "select") {
            if (e.target === e.target.getStage()) setSelectedId(null);
            return;
        }
        const pos = getRelPointer(e.target.getStage());
        if (!pos) return;
        isPaintingRef.current = true;

        if (tool === "fog-reveal" || tool === "fog-hide") {
            paintCell(pos.x, pos.y, tool === "fog-reveal");
        } else if (tool === "draw-pen") {
            setDrawPreview({ id: "preview", type: "pen", points: [pos.x, pos.y], color: drawColor, strokeWidth: 3 });
        } else if (tool === "draw-rect" || tool === "draw-circle" || tool === "draw-line") {
            const type = tool === "draw-rect" ? "rect" : tool === "draw-circle" ? "circle" : "line";
            setDrawPreview({ id: "preview", type, points: [pos.x, pos.y, pos.x, pos.y], color: drawColor, strokeWidth: 3 });
        } else if (tool === "measure") {
            setMeasureLine({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
        } else if (tool.startsWith("aoe-")) {
            const aoeType = tool.replace("aoe-", "") as AoeTemplate["type"];
            setAoePreview({ id: "preview", type: aoeType, x: pos.x, y: pos.y, x2: pos.x, y2: pos.y, color: drawColor });
        }
    }

    function handleStageMouseMove(e: KonvaEventObject<MouseEvent>) {
        if (!isPaintingRef.current) return;
        const pos = getRelPointer(e.target.getStage());
        if (!pos) return;

        if (tool === "fog-reveal" || tool === "fog-hide") {
            paintCell(pos.x, pos.y, tool === "fog-reveal");
        } else if (tool === "draw-pen") {
            setDrawPreview(prev => prev ? { ...prev, points: [...prev.points, pos.x, pos.y] } : prev);
        } else if (tool === "draw-rect" || tool === "draw-circle" || tool === "draw-line") {
            setDrawPreview(prev => prev ? { ...prev, points: [prev.points[0], prev.points[1], pos.x, pos.y] } : prev);
        } else if (tool === "measure") {
            setMeasureLine(prev => prev ? { ...prev, x2: pos.x, y2: pos.y } : prev);
        } else if (tool.startsWith("aoe-")) {
            setAoePreview(prev => prev ? { ...prev, x2: pos.x, y2: pos.y } : prev);
        }
    }

    function handleStageMouseUp() {
        if (!isPaintingRef.current) return;
        isPaintingRef.current = false;

        if (tool === "draw-pen" || tool === "draw-rect" || tool === "draw-circle" || tool === "draw-line") {
            setDrawPreview(prev => {
                if (prev && prev.points.length >= 4) {
                    const shape: DrawingShape = { ...prev, id: crypto.randomUUID() };
                    setDrawings(prevDrawings => {
                        const next = [...prevDrawings, shape];
                        scheduleSave({ drawingsJson: JSON.stringify(next) });
                        return next;
                    });
                }
                return null;
            });
        } else if (tool === "measure") {
            setMeasureLine(null);
        } else if (tool.startsWith("aoe-")) {
            setAoePreview(prev => {
                if (prev) setAoeTemplates(prevTemplates => [...prevTemplates, { ...prev, id: crypto.randomUUID() }]);
                return null;
            });
        }
    }

    // Safety net — if the mouse is released outside the canvas, the Stage's
    // own onMouseUp never fires, which would otherwise leave a gesture stuck.
    useEffect(() => {
        window.addEventListener("mouseup", handleStageMouseUp);
        return () => window.removeEventListener("mouseup", handleStageMouseUp);
    }, [tool, drawPreview, aoePreview]);

    function renderShape(d: DrawingShape) {
        if (d.type === "pen" || d.type === "line") {
            return <Line key={d.id} points={d.points} stroke={d.color} strokeWidth={d.strokeWidth}
                lineCap="round" lineJoin="round" tension={d.type === "pen" ? 0.3 : 0} listening={false} />;
        }
        const [x1, y1, x2, y2] = d.points;
        if (d.type === "rect") {
            return <Rect key={d.id} x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)}
                stroke={d.color} strokeWidth={d.strokeWidth} listening={false} />;
        }
        return <Circle key={d.id} x={x1} y={y1} radius={Math.hypot(x2 - x1, y2 - y1)} stroke={d.color} strokeWidth={d.strokeWidth} listening={false} />;
    }

    function renderAoe(t: AoeTemplate, label: string) {
        const dx = t.x2 - t.x, dy = t.y2 - t.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const angle = Math.atan2(dy, dx);
        const feet = pxToFeet(dist);
        const fillColor = t.color + "33";
        const labelNode = (lx: number, ly: number) => (
            <Text x={lx - 30} y={ly - 8} width={60} align="center" text={`${feet} ft`} fontSize={12} fontStyle="bold"
                fill={t.color} listening={false} />
        );

        if (t.type === "circle") {
            return <Group key={label} listening={false}>
                <Circle x={t.x} y={t.y} radius={dist} fill={fillColor} stroke={t.color} strokeWidth={2} />
                {labelNode(t.x, t.y)}
            </Group>;
        }
        if (t.type === "square") {
            return <Group key={label} listening={false}>
                <Rect x={t.x - dist} y={t.y - dist} width={dist * 2} height={dist * 2} fill={fillColor} stroke={t.color} strokeWidth={2} />
                {labelNode(t.x, t.y)}
            </Group>;
        }
        if (t.type === "line") {
            return <Group key={label} listening={false}>
                <Line points={[t.x, t.y, t.x2, t.y2]} stroke={t.color} strokeWidth={Math.max(6, cellW * 0.4)} opacity={0.45} lineCap="round" />
                {labelNode((t.x + t.x2) / 2, (t.y + t.y2) / 2)}
            </Group>;
        }
        // Cone: isosceles triangle whose width at the far edge equals its length (D&D 5e convention).
        const halfAngle = Math.atan(0.5);
        const p1 = { x: t.x + dist * Math.cos(angle - halfAngle), y: t.y + dist * Math.sin(angle - halfAngle) };
        const p2 = { x: t.x + dist * Math.cos(angle + halfAngle), y: t.y + dist * Math.sin(angle + halfAngle) };
        return <Group key={label} listening={false}>
            <Line points={[t.x, t.y, p1.x, p1.y, p2.x, p2.y]} closed fill={fillColor} stroke={t.color} strokeWidth={2} />
            {labelNode(t.x + dx / 2, t.y + dy / 2)}
        </Group>;
    }

    const sortedTokens = useMemo(() => [...tokens].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), [tokens]);

    // Linked tokens mirror their PlayerCharacter's conditions (set from the
    // GM dashboard); unlinked tokens (monsters, generic markers) have nowhere
    // else to track conditions, so they keep their own conditionsJson —
    // editable from this page's own sidebar (see the selected-token panel).
    function tokenConditions(t: VttToken, linked: PlayerCharacter | undefined): string[] {
        const raw = linked ? linked.conditionsJson : t.conditionsJson;
        try { return raw ? JSON.parse(raw) : []; } catch { return []; }
    }

    function setTokenConditions(tokenId: string, conditions: string[]) {
        const conditionsJson = JSON.stringify(conditions);
        setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, conditionsJson } : t));
        client.models.VttToken.update({ id: tokenId, conditionsJson });
    }
    const selectedToken = selectedId ? tokens.find(t => t.id === selectedId) ?? null : null;
    const linkedCharacter = selectedToken?.linkedEntityType === "playerCharacter" && selectedToken.linkedEntityId
        ? charactersById.get(selectedToken.linkedEntityId) ?? null
        : null;
    const linkedStatus = linkedCharacter ? getCharacterStatus(linkedCharacter) : null;

    // ── Token CRUD ────────────────────────────────────────────────────────────
    async function addToken() {
        if (!newLabel.trim()) return;
        const size = newSizeCells * Math.min(cellW, cellH);
        const { data } = await client.models.VttToken.create({
            boardId,
            x: offsetX + 10, y: offsetY + 10,
            width: size, height: size,
            rotation: 0,
            label: newLabel.trim().slice(0, 16),
            color: newColor,
            sortOrder: tokens.length,
            visibleToPlayers: true,
        });
        if (data) setTokens(prev => prev.some(t => t.id === data.id) ? prev : [...prev, data]);
        setNewLabel("");
        setAddOpen(false);
    }

    function persistTransform(id: string, attrs: Partial<Pick<VttToken, "x" | "y" | "width" | "height" | "rotation">>) {
        setTokens(prev => prev.map(t => t.id === id ? { ...t, ...attrs } : t));
        client.models.VttToken.update({ id, ...attrs });
    }

    async function deleteToken(id: string) {
        setTokens(prev => prev.filter(t => t.id !== id));
        if (selectedId === id) setSelectedId(null);
        await client.models.VttToken.delete({ id });
    }

    function bringToFront(id: string) {
        const maxSort = tokens.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), 0);
        const next = maxSort + 1;
        setTokens(prev => prev.map(t => t.id === id ? { ...t, sortOrder: next } : t));
        client.models.VttToken.update({ id, sortOrder: next });
    }

    async function uploadTokenImage(tokenId: string, file: File) {
        const ext = file.name.split(".").pop() ?? "png";
        const key = `vtt-tokens/${tokenId}.${ext}`;
        try {
            await uploadData({ path: key, data: file, options: { contentType: file.type } }).result;
            setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, imageKey: key } : t));
            await client.models.VttToken.update({ id: tokenId, imageKey: key });
        } catch (err) {
            console.error("[VTT] token image upload failed", err);
        }
    }

    // Character linking is PlayerCharacter-only for now. NPC linking would
    // need to resolve through the NPC -> WikiArticle join (see lib/npcLinks.ts)
    // rather than a simple list, and Companion/MonsterStatblock aren't
    // campaign-session state the same way — each is a real follow-up, not
    // dropped by accident.
    function linkCharacter(tokenId: string, character: PlayerCharacter | null) {
        const patch = character
            ? { linkedEntityId: character.id, linkedEntityType: "playerCharacter" }
            : { linkedEntityId: null, linkedEntityType: null };
        setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, ...patch } : t));
        client.models.VttToken.update({ id: tokenId, ...patch });
    }

    // ── Keyboard: Delete selected token, Escape back to Select ───────────────
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if ((document.activeElement as HTMLElement | null)?.tagName === "INPUT") return;
            if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
                deleteToken(selectedId);
            } else if (e.key === "Escape") {
                setTool("select");
                setSelectedId(null);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selectedId]);

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
                <CircularProgress sx={{ color: "primary.main" }} />
            </Box>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#0f0f1a" }}>
            {/* Top bar */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1,
                backgroundColor: "#1a1a2e", borderBottom: "1px solid #2a2a4a", flexShrink: 0 }}>
                <IconButton component={Link} href={`/tabletop/campaigns/${campaignId}/vtt`} size="small" sx={{ color: "#c9a87c" }}>
                    <ArrowLeft size={18} />
                </IconButton>
                <Typography sx={{ color: "#c9a87c", fontWeight: 700 }}>{board?.name}</Typography>
                <Typography variant="caption" sx={{ color: "#6b6b8a" }}>
                    {cols} × {rows} grid · {tokens.length} token{tokens.length !== 1 ? "s" : ""}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Button size="small" startIcon={<Plus size={14} />} onClick={() => setAddOpen(true)}
                    sx={{ color: "#c9a87c", borderColor: "#c9a87c" }} variant="outlined">
                    Add Token
                </Button>
                <Tooltip title="Zoom out">
                    <IconButton size="small" onClick={() => zoomBy(0.8)} sx={{ color: "#c9a87c" }}><ZoomOut size={16} /></IconButton>
                </Tooltip>
                <Tooltip title="Zoom in">
                    <IconButton size="small" onClick={() => zoomBy(1.25)} sx={{ color: "#c9a87c" }}><ZoomIn size={16} /></IconButton>
                </Tooltip>
                <Tooltip title="Fit to screen">
                    <IconButton size="small" onClick={fitToScreen} sx={{ color: "#c9a87c" }}><Maximize2 size={16} /></IconButton>
                </Tooltip>
                <Tooltip title="Board settings">
                    <IconButton size="small" onClick={() => setSettingsOpen(true)} sx={{ color: "#c9a87c" }}><Settings size={16} /></IconButton>
                </Tooltip>
                <Tooltip title="Chat">
                    <IconButton size="small" onClick={() => setChatOpen(true)} sx={{ color: "#c9a87c" }}><MessageSquare size={16} /></IconButton>
                </Tooltip>
                <Tooltip title="Session music">
                    <IconButton size="small" onClick={e => setMusicAnchor(e.currentTarget)} sx={{ color: "#c9a87c" }}><Music size={16} /></IconButton>
                </Tooltip>
            </Box>

            {/* GM tools toolbar */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 0.5,
                backgroundColor: "#16162a", borderBottom: "1px solid #2a2a4a", flexShrink: 0, overflowX: "auto" }}>
                {(() => {
                    const groupSx = {
                        "& .MuiToggleButton-root": { color: "#9a9ab8", borderColor: "#2a2a4a", px: 1, py: 0.5 },
                        "& .Mui-selected": { color: "#fff !important", backgroundColor: "#3a3a6a !important" },
                    };
                    return (
                        <>
                            <ToggleButtonGroup size="small" value={tool} exclusive onChange={(_, v) => v && setTool(v)} sx={groupSx}>
                                <ToggleButton value="select"><Tooltip title="Select / Move"><MousePointer2 size={14} /></Tooltip></ToggleButton>
                            </ToggleButtonGroup>
                            <Tooltip title="Snap token movement to grid">
                                <IconButton size="small" onClick={() => setSnapToGrid(s => !s)}
                                    sx={{ color: snapToGrid ? "#fff" : "#6b6b8a", backgroundColor: snapToGrid ? "#3a3a6a" : "transparent" }}>
                                    <Magnet size={14} />
                                </IconButton>
                            </Tooltip>

                            {isGm && (
                                <>
                                    <Divider orientation="vertical" flexItem sx={{ borderColor: "#2a2a4a" }} />

                                    <ToggleButtonGroup size="small" value={tool} exclusive onChange={(_, v) => v && setTool(v)} sx={groupSx}>
                                        <ToggleButton value="fog-reveal"><Tooltip title="Reveal fog"><Eye size={14} /></Tooltip></ToggleButton>
                                        <ToggleButton value="fog-hide"><Tooltip title="Hide (add fog)"><EyeOff size={14} /></Tooltip></ToggleButton>
                                    </ToggleButtonGroup>
                                    <FormControlLabel sx={{ mr: 0 }}
                                        control={<Switch size="small" checked={!!board?.fogEnabled} onChange={toggleFogEnabled} />}
                                        label={<Typography variant="caption" sx={{ color: "#9a9ab8" }}>Fog</Typography>} />

                                    <Divider orientation="vertical" flexItem sx={{ borderColor: "#2a2a4a" }} />

                                    <ToggleButtonGroup size="small" value={tool} exclusive onChange={(_, v) => v && setTool(v)} sx={groupSx}>
                                        <ToggleButton value="draw-pen"><Tooltip title="Pen"><Pencil size={14} /></Tooltip></ToggleButton>
                                        <ToggleButton value="draw-rect"><Tooltip title="Rectangle"><Square size={14} /></Tooltip></ToggleButton>
                                        <ToggleButton value="draw-circle"><Tooltip title="Circle"><CircleIcon size={14} /></Tooltip></ToggleButton>
                                        <ToggleButton value="draw-line"><Tooltip title="Line"><Minus size={14} /></Tooltip></ToggleButton>
                                    </ToggleButtonGroup>
                                    <Box sx={{ display: "flex", gap: 0.4 }}>
                                        {DRAW_COLORS.map(c => (
                                            <Box key={c} onClick={() => setDrawColor(c)} sx={{ width: 18, height: 18, borderRadius: "50%",
                                                backgroundColor: c, cursor: "pointer", border: drawColor === c ? "2px solid #fff" : "2px solid transparent" }} />
                                        ))}
                                    </Box>
                                    <Tooltip title="Clear drawings">
                                        <IconButton size="small" onClick={clearDrawings} sx={{ color: "#9a9ab8" }}><Eraser size={14} /></IconButton>
                                    </Tooltip>
                                </>
                            )}

                            <Divider orientation="vertical" flexItem sx={{ borderColor: "#2a2a4a" }} />

                            <ToggleButtonGroup size="small" value={tool} exclusive onChange={(_, v) => v && setTool(v)} sx={groupSx}>
                                <ToggleButton value="measure"><Tooltip title="Measure"><Ruler size={14} /></Tooltip></ToggleButton>
                            </ToggleButtonGroup>

                            <Divider orientation="vertical" flexItem sx={{ borderColor: "#2a2a4a" }} />

                            <ToggleButtonGroup size="small" value={tool} exclusive onChange={(_, v) => v && setTool(v)} sx={groupSx}>
                                <ToggleButton value="aoe-circle"><Tooltip title="Circle AoE"><CircleIcon size={14} /></Tooltip></ToggleButton>
                                <ToggleButton value="aoe-cone"><Tooltip title="Cone AoE"><Triangle size={14} /></Tooltip></ToggleButton>
                                <ToggleButton value="aoe-line"><Tooltip title="Line AoE"><Slash size={14} /></Tooltip></ToggleButton>
                                <ToggleButton value="aoe-square"><Tooltip title="Square AoE"><Square size={14} /></Tooltip></ToggleButton>
                            </ToggleButtonGroup>
                            {aoeTemplates.length > 0 && (
                                <Tooltip title="Clear templates">
                                    <IconButton size="small" onClick={() => setAoeTemplates([])} sx={{ color: "#9a9ab8" }}><Eraser size={14} /></IconButton>
                                </Tooltip>
                            )}
                        </>
                    );
                })()}
            </Box>

            <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {/* Canvas */}
                <Box ref={containerRef} {...mapDrop.dropHandlers} sx={{ flex: 1, position: "relative", overflow: "hidden",
                    outline: mapDrop.isDragging ? "3px dashed #c9a87c" : "none", outlineOffset: -3 }}>
                    {mounted && (
                        <Stage width={stageSize.width} height={stageSize.height}
                            scaleX={stageScale} scaleY={stageScale}
                            x={stagePos.x} y={stagePos.y}
                            draggable={tool === "select"}
                            onDragEnd={(e: KonvaEventObject<DragEvent>) => {
                                if (e.target.getStage() === e.target) setStagePos({ x: e.target.x(), y: e.target.y() });
                            }}
                            onWheel={handleWheel}
                            onMouseDown={handleStageMouseDown}
                            onMouseMove={handleStageMouseMove}
                            onMouseUp={handleStageMouseUp}>
                            <Layer listening={false}>
                                {mapImage ? (
                                    <KonvaImage image={mapImage} width={mapW} height={mapH} x={0} y={0} />
                                ) : (
                                    <Rect x={0} y={0} width={mapW} height={mapH} fill={board?.backgroundColor || "#2a2a3a"} />
                                )}
                            </Layer>
                            <Layer listening={false}>{gridLines}</Layer>
                            <Layer listening={false}>
                                {drawings.map(renderShape)}
                                {drawPreview && renderShape(drawPreview)}
                            </Layer>
                            <Layer>
                                {sortedTokens.map(t => {
                                    const linked = t.linkedEntityType === "playerCharacter" && t.linkedEntityId
                                        ? charactersById.get(t.linkedEntityId) : undefined;
                                    const status = linked ? getCharacterStatus(linked) : null;
                                    const resources = status?.resources ?? [];
                                    // A linked character's own status labels (e.g. D&D conditions)
                                    // take priority; if the system doesn't track any (Cypher, today)
                                    // fall back to the token's own conditionsJson, same as unlinked tokens.
                                    const statusLabels = status?.statusLabels.length ? status.statusLabels : tokenConditions(t, undefined);
                                    const img = t.imageKey ? tokenImageEls[t.imageKey] : undefined;
                                    const w = t.width, h = t.height;
                                    return (
                                        <Group key={t.id}
                                            ref={(node) => { if (node) tokenNodeRefs.current[t.id] = node; }}
                                            x={t.x} y={t.y} width={w} height={h} rotation={t.rotation ?? 0}
                                            draggable={tool === "select"}
                                            onClick={() => { if (tool === "select") setSelectedId(t.id); }}
                                            onTap={() => { if (tool === "select") setSelectedId(t.id); }}
                                            onDragEnd={(e) => {
                                                let x = e.target.x(), y = e.target.y();
                                                if (snapToGrid) {
                                                    const cx = snapValue(x + w / 2, cellW, offsetX + cellW / 2);
                                                    const cy = snapValue(y + h / 2, cellH, offsetY + cellH / 2);
                                                    x = cx - w / 2; y = cy - h / 2;
                                                    e.target.position({ x, y });
                                                }
                                                persistTransform(t.id, { x, y });
                                            }}
                                            onTransformEnd={(e) => {
                                                const node = e.target;
                                                const scaleX = node.scaleX(), scaleY = node.scaleY();
                                                const newW = Math.max(10, w * scaleX);
                                                const newH = Math.max(10, h * scaleY);
                                                node.scaleX(1); node.scaleY(1);
                                                persistTransform(t.id, { x: node.x(), y: node.y(), width: newW, height: newH, rotation: node.rotation() });
                                            }}>
                                            {img ? (
                                                <KonvaImage image={img} width={w} height={h} />
                                            ) : (
                                                <>
                                                    <Circle x={w / 2} y={h / 2} radius={Math.min(w, h) / 2 - 2}
                                                        fill={(t.color ?? "#1e88e5") + "44"} stroke={t.color ?? "#1e88e5"} strokeWidth={3} />
                                                    <Text text={t.label ?? ""} x={0} y={h / 2 - 8} width={w} align="center"
                                                        fontSize={Math.max(10, Math.min(w, h) * 0.18)} fontStyle="bold"
                                                        fill={t.color ?? "#1e88e5"} listening={false} />
                                                </>
                                            )}
                                            {resources.map((r, i) => {
                                                const pct = r.max > 0 ? Math.max(0, Math.min(1, r.current / r.max)) : 0;
                                                const y = -10 - (resources.length - 1 - i) * 6;
                                                return (
                                                    <Group key={r.label}>
                                                        <Rect x={0} y={y} width={w} height={5} fill="#000000" opacity={0.5} listening={false} />
                                                        <Rect x={0} y={y} width={w * pct} height={5}
                                                            fill={pct > 0.5 ? "#4caf50" : pct > 0.25 ? "#ff9800" : "#f44336"} listening={false} />
                                                    </Group>
                                                );
                                            })}
                                            {statusLabels.map((c, i) => (
                                                <Circle key={c} x={6 + i * 11} y={resources.length ? -10 - resources.length * 6 - 4 : -8} radius={4}
                                                    fill={CONDITION_COLOR[c] ?? "#607d8b"} stroke="#000" strokeWidth={1} listening={false} />
                                            ))}
                                        </Group>
                                    );
                                })}
                                <Transformer ref={transformerRef} rotateEnabled keepRatio={false} />
                            </Layer>
                            {board?.fogEnabled && (
                                <Layer listening={false}>
                                    {Array.from({ length: rows }).map((_, r) =>
                                        Array.from({ length: cols }).map((_, c) => {
                                            const key = `${c},${r}`;
                                            if (revealedCells.has(key)) return null;
                                            return (
                                                <Rect key={key} x={offsetX + c * cellW} y={offsetY + r * cellH}
                                                    width={cellW} height={cellH} fill="#000000" opacity={isGm ? 0.45 : 0.95} />
                                            );
                                        })
                                    )}
                                </Layer>
                            )}
                            <Layer listening={false}>
                                {aoeTemplates.map((t, i) => renderAoe(t, `aoe-${i}`))}
                                {aoePreview && renderAoe(aoePreview, "aoe-preview")}
                            </Layer>
                            {measureLine && (
                                <Layer listening={false}>
                                    <Line points={[measureLine.x1, measureLine.y1, measureLine.x2, measureLine.y2]}
                                        stroke="#ffeb3b" strokeWidth={2} dash={[8, 4]} />
                                    <Circle x={measureLine.x1} y={measureLine.y1} radius={4} fill="#ffeb3b" />
                                    <Circle x={measureLine.x2} y={measureLine.y2} radius={4} fill="#ffeb3b" />
                                    <Text x={(measureLine.x1 + measureLine.x2) / 2 - 30} y={(measureLine.y1 + measureLine.y2) / 2 - 20}
                                        width={60} align="center"
                                        text={`${pxToFeet(Math.hypot(measureLine.x2 - measureLine.x1, measureLine.y2 - measureLine.y1))} ft`}
                                        fontSize={14} fontStyle="bold" fill="#ffeb3b" />
                                </Layer>
                            )}
                        </Stage>
                    )}
                    {!mapImage && (
                        <Box sx={{ position: "absolute", bottom: 16, left: 16, backgroundColor: "rgba(26,26,46,0.9)",
                            borderRadius: 1, px: 1.5, py: 1 }}>
                            <Typography variant="caption" sx={{ color: "#c9a87c" }}>
                                {uploading ? "Uploading map…" : "Drag and drop a map image anywhere on the canvas"}
                            </Typography>
                        </Box>
                    )}
                </Box>

                {/* Right sidebar — selected token controls */}
                {selectedToken && (
                    <Box sx={{ width: 260, backgroundColor: "#1a1a2e", borderLeft: "1px solid #2a2a4a",
                        p: 2, overflowY: "auto", flexShrink: 0 }}>
                        <Typography variant="overline" sx={{ color: "#6b6b8a", letterSpacing: 1 }}>Selected Token</Typography>
                        <TextField key={selectedToken.id} size="small" fullWidth defaultValue={selectedToken.label ?? ""}
                            placeholder="Label" sx={{ mt: 1, mb: 1.5,
                                "& .MuiInputBase-input": { color: "#e0d8cc" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#3a3a5a" } }}
                            onBlur={e => {
                                const label = e.target.value.trim().slice(0, 16);
                                setTokens(prev => prev.map(t => t.id === selectedToken.id ? { ...t, label } : t));
                                client.models.VttToken.update({ id: selectedToken.id, label });
                            }}
                        />

                        <input ref={tokenFileInputRef} type="file" accept="image/*" hidden
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadTokenImage(selectedToken.id, f); e.target.value = ""; }} />
                        <Button size="small" fullWidth variant="outlined" startIcon={<ImageIcon size={14} />}
                            onClick={() => tokenFileInputRef.current?.click()}
                            sx={{ mb: 1.5, color: "#c9a87c", borderColor: "#3a3a5a" }}>
                            {selectedToken.imageKey ? "Replace Art" : "Upload Art"}
                        </Button>

                        <Autocomplete
                            size="small"
                            options={characters}
                            getOptionLabel={c => c.characterName}
                            value={linkedCharacter}
                            onChange={(_, value) => linkCharacter(selectedToken.id, value)}
                            renderInput={params => (
                                <TextField {...params} label="Linked character" placeholder="Search…"
                                    sx={{ "& .MuiInputBase-input": { color: "#e0d8cc" }, "& .MuiInputLabel-root": { color: "#6b6b8a" },
                                        "& .MuiOutlinedInput-notchedOutline": { borderColor: "#3a3a5a" } }} />
                            )}
                            sx={{ mb: 1.5 }}
                        />
                        {linkedCharacter && SHEET_SYSTEMS.includes(linkedCharacter.system ?? "") && (
                            <Button size="small" fullWidth variant="outlined" startIcon={<BookUser size={14} />}
                                onClick={() => openSheet(linkedCharacter.id)}
                                sx={{ mb: 1.5, color: "#c9a87c", borderColor: "#3a3a5a" }}>
                                Open Character Sheet
                            </Button>
                        )}
                        {linkedCharacter && (
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                                <Typography variant="caption" sx={{ color: "#6b6b8a" }}>
                                    {linkedStatus?.resources.map(r => `${r.label} ${r.current}/${r.max}`).join(" · ") || "No tracked resources"}
                                </Typography>
                                <Tooltip title="Unlink">
                                    <IconButton size="small" onClick={() => linkCharacter(selectedToken.id, null)} sx={{ color: "#6b6b8a" }}>
                                        <Unlink size={14} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        )}

                        {/* Conditions — only editable here when unlinked; a linked
                            token's conditions come from its PlayerCharacter, set on
                            the GM dashboard, so this page would just be a second,
                            easily-desynced place to edit the same data. */}
                        {!linkedStatus?.statusLabels.length && (() => {
                            const tokenConds = tokenConditions(selectedToken, undefined);
                            return (
                                <Box sx={{ mb: 1.5 }}>
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 0.75 }}>
                                        {tokenConds.map(c => (
                                            <Chip key={c} label={c} size="small"
                                                onDelete={() => setTokenConditions(selectedToken.id, tokenConds.filter(x => x !== c))}
                                                sx={{ backgroundColor: CONDITION_COLOR[c] ?? "#607d8b", color: "#fff", fontSize: "0.62rem", height: 20 }} />
                                        ))}
                                    </Box>
                                    <Autocomplete size="small" options={CONDITION_NAMES.filter(n => !tokenConds.includes(n))}
                                        onChange={(_, v) => { if (v) setTokenConditions(selectedToken.id, [...tokenConds, v]); }}
                                        value={null} blurOnSelect clearOnBlur
                                        renderInput={params => (
                                            <TextField {...params} placeholder="Add condition…" variant="standard"
                                                sx={{ "& input": { fontSize: "0.75rem", color: "#e0d8cc" } }} />
                                        )} />
                                </Box>
                            );
                        })()}

                        <Divider sx={{ my: 1.5, borderColor: "#2a2a4a" }} />

                        <Box sx={{ display: "flex", gap: 1 }}>
                            <Button size="small" fullWidth variant="outlined" startIcon={<ArrowUpToLine size={14} />}
                                onClick={() => bringToFront(selectedToken.id)} sx={{ color: "#c9a87c", borderColor: "#3a3a5a" }}>
                                Front
                            </Button>
                            <Button size="small" fullWidth variant="outlined" color="error" startIcon={<Trash2 size={14} />}
                                onClick={() => deleteToken(selectedToken.id)}>
                                Delete
                            </Button>
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Add-token drawer */}
            <Drawer anchor="right" open={addOpen} onClose={() => setAddOpen(false)}>
                <Box sx={{ width: 280, p: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Add Token</Typography>
                    <TextField label="Label" size="small" fullWidth sx={{ mb: 2 }}
                        value={newLabel} onChange={e => setNewLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") addToken(); }} autoFocus />
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 0.5, mb: 2 }}>
                        {TOKEN_COLORS.map(c => (
                            <Box key={c} onClick={() => setNewColor(c)} sx={{ width: 28, height: 28, borderRadius: "50%",
                                backgroundColor: c, cursor: "pointer", border: newColor === c ? "2px solid #333" : "2px solid transparent" }} />
                        ))}
                    </Box>
                    <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Size</InputLabel>
                        <Select label="Size" value={newSizeCells} onChange={e => setNewSizeCells(Number(e.target.value))}>
                            {SIZE_PRESETS.map(s => <MenuItem key={s.cells} value={s.cells}>{s.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button variant="contained" fullWidth onClick={addToken} disabled={!newLabel.trim()}>Add</Button>
                </Box>
            </Drawer>

            {/* Settings drawer */}
            <Drawer anchor="right" open={settingsOpen} onClose={() => setSettingsOpen(false)}>
                <Box sx={{ width: 280, p: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>Board Settings</Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
                        Fine-tune grid alignment if an uploaded map doesn't line up with the grid by default.
                    </Typography>
                    <TextField label="Grid offset X (px)" type="number" size="small" fullWidth sx={{ mb: 2 }}
                        value={offsetXInput} onChange={e => setOffsetXInput(e.target.value)} />
                    <TextField label="Grid offset Y (px)" type="number" size="small" fullWidth sx={{ mb: 2 }}
                        value={offsetYInput} onChange={e => setOffsetYInput(e.target.value)} />
                    <Button variant="contained" fullWidth onClick={saveOffsets}>Save</Button>
                </Box>
            </Drawer>

            {/* Chat drawer */}
            <Drawer anchor="right" open={chatOpen} onClose={() => setChatOpen(false)}>
                <Box sx={{ width: 340, height: "100%" }}>
                    <ChatPanel campaignId={campaignId} authorName={authorName} currentUserId={currentUserId} />
                </Box>
            </Drawer>

            {/* Session music */}
            <Popover open={!!musicAnchor} anchorEl={musicAnchor} onClose={() => setMusicAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                <SessionAudioPlayer campaignId={campaignId} displayName={authorName} controlsEnabled={isGm} />
            </Popover>

            {/* Floating character sheets — D&D and Cypher; reuses each
                dashboard's own PartyCard rather than a third re-implementation. */}
            {openSheets.map(s => {
                const pc = charactersById.get(s.characterId);
                if (!pc) return null;
                return (
                    <FloatingWindow key={s.characterId} title={pc.characterName} x={s.x} y={s.y} z={s.z}
                        onMove={(x, y) => moveSheet(s.characterId, x, y)}
                        onFocus={() => focusSheet(s.characterId)}
                        onClose={() => closeSheet(s.characterId)}>
                        {pc.system === "Cypher System" ? (
                            <CypherPartyCard pc={pc} isSpotlight={false} onAwardXp={awardXp} onAdjustPool={adjustPool} />
                        ) : (
                            <DndPartyCard pc={pc} isSpotlight={false} onUpdate={updateCharacter} />
                        )}
                    </FloatingWindow>
                );
            })}
        </Box>
    );
}
