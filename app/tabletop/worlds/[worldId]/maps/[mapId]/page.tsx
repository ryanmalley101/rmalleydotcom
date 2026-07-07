"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import {
    Box, Typography, Button, CircularProgress, IconButton,
    Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Chip, InputAdornment,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Pencil, Trash2, Save, X, MapPin as MapPinIcon, Search, Eye, EyeOff } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import { getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type Article        = Schema["WikiArticle"]["type"];
type WorldMap       = Schema["WorldMap"]["type"];
type CSession       = Schema["CampaignSession"]["type"];
type CNpc           = Schema["NPC"]["type"];
type CTimelineEvent = Schema["TimelineEvent"]["type"];

interface ArticleCampaignData {
    sessions: Pick<CSession, "id" | "sessionNumber" | "title">[];
    npcs:     Pick<CNpc, "id" | "articleId">[];
    events:   Pick<CTimelineEvent, "id" | "title" | "inWorldDate" | "realDate">[];
}

// ── Pin type ──────────────────────────────────────────────────────────────────

interface MapPin {
    id: string;
    x: number;         // % from left
    y: number;         // % from top
    label: string;
    articleId?: string;
    articleTitle?: string;
    color: string;
}

const PIN_COLORS = [
    { label: "Red",    value: "#dc2626" },
    { label: "Amber",  value: "#d97706" },
    { label: "Green",  value: "#16a34a" },
    { label: "Blue",   value: "#2563eb" },
    { label: "Purple", value: "#7c3aed" },
    { label: "Teal",   value: "#0e7490" },
    { label: "White",  value: "#f8fafc" },
];

function newPin(x: number, y: number): MapPin {
    return { id: crypto.randomUUID(), x, y, label: "", color: "#dc2626" };
}

// ── Pin marker SVG ────────────────────────────────────────────────────────────

function PinMarker({ color, size = 28 }: { color: string; size?: number }) {
    return (
        <svg width={size} height={size * 1.4} viewBox="0 0 28 40" fill="none"
            style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.45))", display: "block" }}>
            <path d="M14 2C8.477 2 4 6.477 4 12c0 7.5 10 24 10 24s10-16.5 10-24c0-5.523-4.477-10-10-10z"
                fill={color} stroke="white" strokeWidth="2" />
            <circle cx="14" cy="12" r="4" fill="white" fillOpacity="0.6" />
        </svg>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MapPage() {
    const { worldId, mapId } = useParams<{ worldId: string; mapId: string }>();
    const searchParams = useSearchParams();
    const campaignId = searchParams.get("campaign");

    const [map, setMap]           = useState<WorldMap | null>(null);
    useDocumentTitle(map?.name ?? null);
    const [imageUrl, setImageUrl] = useState<string>("");
    const [pins, setPins]         = useState<MapPin[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);
    const [editMode, setEditMode] = useState(false);

    // Pin being edited in the dialog
    const [editPin, setEditPin]   = useState<MapPin | null>(null);
    const [editLabel, setEditLabel]    = useState("");
    const [editColor, setEditColor]    = useState(PIN_COLORS[0].value);
    const [editArticleId, setEditAId]  = useState("");
    const [articleSearch, setASearch]  = useState("");

    // Drag state
    const dragging     = useRef<{ pinId: string; startX: number; startY: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);

    // Campaign context (populated when ?campaign= is in the URL)
    const [articleCampaignIndex, setArticleCampaignIndex] = useState<Map<string, ArticleCampaignData>>(new Map());

    // ── Load ────────────────────────────────────────────────────────────────

    async function load() {
        const [mapRes, artRes] = await Promise.all([
            client.models.WorldMap.get({ id: mapId }),
            client.models.WikiArticle.list(),
        ]);
        const m = mapRes.data;
        setMap(m);
        if (m) {
            setPins(m.pinsJson ? JSON.parse(m.pinsJson) as MapPin[] : []);
            try {
                const { url } = await getUrl({
                    path: m.imageKey,
                    options: { expiresIn: 3600 },
                });
                setImageUrl(url.toString());
            } catch {
                // imageKey stored in old format — try legacy key path
                setImageUrl("");
            }
        }
        setArticles((artRes.data ?? []).filter(a => a.worldId === worldId)
            .sort((a, b) => a.title.localeCompare(b.title)));
        setLoading(false);
    }

    useEffect(() => { load(); }, [mapId]);

    // When ?campaign= is present, fetch sessions/NPCs/events and build
    // an index from article ID → connected campaign items.
    useEffect(() => {
        if (!campaignId) return;
        Promise.all([
            client.models.CampaignSession.list(),
            client.models.NPC.list(),
            client.models.TimelineEvent.list(),
        ]).then(([sessRes, npcRes, evtRes]) => {
            const sessions = (sessRes.data ?? []).filter(s => s.campaignId === campaignId);
            const npcs     = (npcRes.data  ?? []).filter(n => n.campaignId === campaignId);
            const events   = (evtRes.data  ?? []).filter(e => e.campaignId === campaignId && client.models.TimelineEvent);

            const index = new Map<string, ArticleCampaignData>();
            const ensure = (id: string) => {
                if (!index.has(id)) index.set(id, { sessions: [], npcs: [], events: [] });
                return index.get(id)!;
            };
            sessions.forEach(s => (s.articleIds ?? []).filter(Boolean).forEach(id => ensure(id!).sessions.push(s)));
            npcs.forEach(n => { if (n.articleId) ensure(n.articleId).npcs.push(n); });
            events.forEach(e => (e.articleIds ?? []).filter(Boolean).forEach(id => ensure(id!).events.push(e)));
            setArticleCampaignIndex(index);
        });
    }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Persist pins ────────────────────────────────────────────────────────

    const savePins = useCallback(async (next: MapPin[]) => {
        if (!map) return;
        setSaving(true);
        await client.models.WorldMap.update({ id: map.id, pinsJson: JSON.stringify(next) });
        setSaving(false);
    }, [map]);

    // ── Map click → place pin ───────────────────────────────────────────────

    function handleMapClick(e: React.MouseEvent<HTMLDivElement>) {
        if (!editMode || !containerRef.current || draggingId) return;
        // Ignore clicks that originated on a pin
        if ((e.target as HTMLElement).closest("[data-pin]")) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width)  * 100;
        const y = ((e.clientY - rect.top)  / rect.height) * 100;
        const pin = newPin(
            Math.max(0, Math.min(100, x)),
            Math.max(0, Math.min(100, y)),
        );
        const next = [...pins, pin];
        setPins(next);
        savePins(next);
        openEdit(pin);
    }

    // ── Drag ────────────────────────────────────────────────────────────────

    function onPinPointerDown(e: React.PointerEvent, pinId: string) {
        if (!editMode) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = { pinId, startX: e.clientX, startY: e.clientY };
        setDraggingId(pinId);
    }

    function onContainerPointerMove(e: React.PointerEvent) {
        if (!dragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width)  * 100));
        const y = Math.max(0, Math.min(100, ((e.clientY - rect.top)  / rect.height) * 100));
        setPins(prev => prev.map(p => p.id === dragging.current!.pinId ? { ...p, x, y } : p));
    }

    function onContainerPointerUp() {
        if (!dragging.current) return;
        const movedId = dragging.current.pinId;
        dragging.current = null;
        setDraggingId(null);
        // Persist the final position
        setPins(prev => {
            savePins(prev);
            return prev;
        });
        // Re-open edit dialog if the pin barely moved (it was a click, not a drag)
        // We rely on the click handler for that — no extra work needed here.
        void movedId;
    }

    // ── Pin edit dialog ─────────────────────────────────────────────────────

    function openEdit(pin: MapPin) {
        setEditPin(pin);
        setEditLabel(pin.label);
        setEditColor(pin.color);
        setEditAId(pin.articleId ?? "");
        setASearch("");
    }

    function closeEdit() { setEditPin(null); }

    async function commitEdit() {
        if (!editPin) return;
        const linked = articles.find(a => a.id === editArticleId);
        const next = pins.map(p => p.id === editPin.id
            ? { ...p, label: editLabel, color: editColor,
                  articleId: linked?.id, articleTitle: linked?.title }
            : p
        );
        setPins(next);
        await savePins(next);
        closeEdit();
    }

    async function deletePin(pinId: string) {
        const next = pins.filter(p => p.id !== pinId);
        setPins(next);
        await savePins(next);
        closeEdit();
    }

    const filteredArticles = useMemo(() => {
        if (!articleSearch) return articles.slice(0, 30);
        const q = articleSearch.toLowerCase();
        return articles.filter(a => a.title.toLowerCase().includes(q)).slice(0, 30);
    }, [articles, articleSearch]);

    // ── Render ──────────────────────────────────────────────────────────────

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );
    if (!map) return (
        <Box sx={{ textAlign: "center", pt: 12 }}>
            <Typography color="error">Map not found.</Typography>
            <Button component={Link} href={`/tabletop/worlds/${worldId}`} sx={{ mt: 2 }}>Back</Button>
        </Box>
    );

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "#111", display: "flex", flexDirection: "column" }}>
            {/* ── Toolbar ── */}
            <Box sx={{
                display: "flex", alignItems: "center", gap: 1.5,
                px: 2, py: 1, backgroundColor: "rgba(0,0,0,0.7)",
                backdropFilter: "blur(4px)", zIndex: 10,
                borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}>
                {campaignId ? (
                    <Button component={Link}
                        href={`/tabletop/campaigns/${campaignId}`}
                        startIcon={<ArrowLeft size={15} />}
                        sx={{ color: "rgba(255,255,255,0.8)", minWidth: 0, px: 1 }}>
                        Campaign
                    </Button>
                ) : (
                    <Button component={Link} href={`/tabletop/worlds/${worldId}`}
                        startIcon={<ArrowLeft size={15} />}
                        sx={{ color: "rgba(255,255,255,0.8)", minWidth: 0, px: 1 }}>
                        World
                    </Button>
                )}
                <Typography sx={{ color: "rgba(255,255,255,0.9)", fontWeight: 600, flex: 1 }}>
                    {map.name}
                </Typography>
                {saving && <CircularProgress size={16} sx={{ color: "rgba(255,255,255,0.5)" }} />}
                <Tooltip title={editMode ? "Switch to view mode" : "Switch to edit mode"}>
                    <Button
                        size="small"
                        variant={editMode ? "contained" : "outlined"}
                        startIcon={editMode ? <EyeOff size={14} /> : <Eye size={14} />}
                        onClick={() => setEditMode(v => !v)}
                        sx={{
                            borderColor: "rgba(255,255,255,0.4)",
                            color: editMode ? undefined : "rgba(255,255,255,0.8)",
                            backgroundColor: editMode ? "#9a3412" : undefined,
                            "&:hover": { backgroundColor: editMode ? "#7c2d12" : "rgba(255,255,255,0.08)" },
                        }}>
                        {editMode ? "Editing" : "View"}
                    </Button>
                </Tooltip>
                {editMode && (
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", ml: 1 }}>
                        Click map to place pin · Drag to move
                    </Typography>
                )}
            </Box>

            {/* ── Map canvas ── */}
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", p: 2 }}>
                {imageUrl ? (
                    <Box
                        ref={containerRef}
                        onClick={handleMapClick}
                        onPointerMove={onContainerPointerMove}
                        onPointerUp={onContainerPointerUp}
                        sx={{
                            position: "relative",
                            display: "inline-block",
                            cursor: editMode ? "crosshair" : "default",
                            userSelect: "none",
                            lineHeight: 0,
                            boxShadow: "0 8px 40px rgba(0,0,0,0.8)",
                        }}
                    >
                        {/* Map image */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl} alt={map.name}
                            style={{ maxWidth: "100%", maxHeight: "calc(100vh - 100px)", display: "block" }}
                            draggable={false}
                        />

                        {/* Pin overlay */}
                        {pins.map(pin => (
                            <Box
                                key={pin.id}
                                data-pin="true"
                                onPointerDown={e => onPinPointerDown(e, pin.id)}
                                onClick={e => {
                                    e.stopPropagation();
                                    if (editMode && draggingId === null) openEdit(pin);
                                }}
                                sx={{
                                    position: "absolute",
                                    left: `${pin.x}%`,
                                    top: `${pin.y}%`,
                                    transform: "translate(-50%, -100%)",
                                    cursor: editMode ? "grab" : "pointer",
                                    zIndex: draggingId === pin.id ? 100 : 10,
                                    transition: draggingId === pin.id ? "none" : "transform 0.05s",
                                    "&:hover .pin-label": { opacity: 1, transform: "translateY(0)" },
                                    "&:hover": { zIndex: 50 },
                                }}
                            >
                                <PinMarker color={pin.color}
                                    size={draggingId === pin.id ? 34 : 28} />

                                {/* Label + article link */}
                                {(pin.label || pin.articleTitle) && (
                                    <Box className="pin-label" sx={{
                                        position: "absolute",
                                        top: "100%",
                                        left: "50%",
                                        transform: "translateX(-50%) translateY(-4px)",
                                        opacity: 0,
                                        transition: "opacity 0.15s, transform 0.15s",
                                        backgroundColor: "rgba(0,0,0,0.82)",
                                        color: "#fff",
                                        borderRadius: 1,
                                        px: 1, py: 0.5,
                                        fontSize: "0.72rem",
                                        fontWeight: 600,
                                        whiteSpace: "nowrap",
                                        pointerEvents: "none",
                                        mt: 0.5,
                                    }}>
                                        {pin.label || pin.articleTitle}
                                        {pin.articleTitle && pin.label && pin.label !== pin.articleTitle && (
                                            <Box component="span" sx={{ color: "rgba(255,255,255,0.55)", ml: 0.5 }}>
                                                → {pin.articleTitle}
                                            </Box>
                                        )}
                                    </Box>
                                )}

                                {/* View mode: click navigates to article */}
                                {!editMode && pin.articleId && (
                                    <Box component={Link}
                                        href={`/tabletop/worlds/${worldId}/wiki/${pin.articleId}`}
                                        sx={{ position: "absolute", inset: 0 }}
                                    />
                                )}
                            </Box>
                        ))}
                    </Box>
                ) : (
                    <Typography sx={{ color: "rgba(255,255,255,0.4)" }}>
                        Image unavailable. Re-upload the map to restore it.
                    </Typography>
                )}
            </Box>

            {/* ── Pin count badge ── */}
            {pins.length > 0 && (
                <Box sx={{
                    position: "fixed", bottom: 16, right: 16,
                    backgroundColor: "rgba(0,0,0,0.7)",
                    color: "rgba(255,255,255,0.7)",
                    borderRadius: 4, px: 1.5, py: 0.5,
                    fontSize: "0.75rem", pointerEvents: "none",
                }}>
                    <MapPinIcon size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    {pins.length} pin{pins.length !== 1 ? "s" : ""}
                </Box>
            )}

            {/* ── Pin edit dialog ── */}
            <Dialog open={!!editPin} onClose={closeEdit} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ pb: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Typography variant="h6">Edit Pin</Typography>
                        <IconButton size="small" onClick={() => editPin && deletePin(editPin.id)} color="error">
                            <Trash2 size={16} />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
                    <TextField label="Label" fullWidth size="small" autoFocus
                        value={editLabel} onChange={e => setEditLabel(e.target.value)} />

                    {/* Color picker */}
                    <Box>
                        <Typography variant="caption" sx={{ color: "text.secondary", mb: 0.5, display: "block" }}>
                            Color
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1 }}>
                            {PIN_COLORS.map(c => (
                                <Box key={c.value} onClick={() => setEditColor(c.value)} sx={{
                                    width: 28, height: 28, borderRadius: "50%",
                                    backgroundColor: c.value,
                                    border: editColor === c.value
                                        ? "3px solid" : "2px solid",
                                    borderColor: editColor === c.value
                                        ? "primary.main" : "divider",
                                    cursor: "pointer",
                                    boxSizing: "border-box",
                                }} />
                            ))}
                        </Box>
                    </Box>

                    {/* Article link */}
                    <Box>
                        <Typography variant="caption" sx={{ color: "text.secondary", mb: 0.5, display: "block" }}>
                            Link to article
                        </Typography>
                        {editArticleId && (
                            <Chip
                                label={articles.find(a => a.id === editArticleId)?.title ?? editArticleId}
                                size="small" onDelete={() => setEditAId("")}
                                sx={{ mb: 1, backgroundColor: "primary.main", color: "#fff" }}
                            />
                        )}
                        <TextField size="small" fullWidth placeholder="Search articles…"
                            value={articleSearch} onChange={e => setASearch(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start"><Search size={14} /></InputAdornment>
                                ),
                            }}
                        />
                        <Box sx={{ maxHeight: 180, overflow: "auto", mt: 0.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                            {filteredArticles.map(a => (
                                <Box key={a.id} onClick={() => { setEditAId(a.id); setASearch(""); }}
                                    sx={{
                                        px: 1.5, py: 0.75, cursor: "pointer", fontSize: "0.85rem",
                                        backgroundColor: editArticleId === a.id ? "rgba(154,52,18,0.1)" : "transparent",
                                        "&:hover": { backgroundColor: "rgba(154,52,18,0.06)" },
                                        display: "flex", alignItems: "center", gap: 1,
                                    }}>
                                    {a.title}
                                    {a.articleType && (
                                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                            {a.articleType}
                                        </Typography>
                                    )}
                                </Box>
                            ))}
                            {filteredArticles.length === 0 && (
                                <Typography sx={{ px: 1.5, py: 1, color: "text.secondary", fontSize: "0.8rem" }}>
                                    No articles found
                                </Typography>
                            )}
                        </Box>
                    </Box>
                    {/* Campaign connections — shown when viewing from a campaign context */}
                    {campaignId && editPin?.articleId && (() => {
                        const connected = articleCampaignIndex.get(editPin.articleId);
                        if (!connected) return null;
                        const total = connected.sessions.length + connected.npcs.length + connected.events.length;
                        if (total === 0) return null;
                        return (
                            <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1.5, mt: 0.5 }}>
                                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, display: "block", mb: 0.75 }}>
                                    Campaign connections
                                </Typography>
                                {connected.sessions.map(s => (
                                    <Box key={s.id} component={Link}
                                        href={`/tabletop/campaigns/${campaignId}/sessions/${s.id}`}
                                        sx={{ display: "block", fontSize: "0.78rem", color: "primary.main", textDecoration: "none",
                                            mb: 0.25, "&:hover": { textDecoration: "underline" } }}>
                                        📅 Session #{s.sessionNumber ?? "?"}: {s.title || "Untitled Session"}
                                    </Box>
                                ))}
                                {connected.npcs.map(n => (
                                    <Box key={n.id} sx={{ fontSize: "0.78rem", color: "text.secondary", mb: 0.25 }}>
                                        👤 NPC tracked in this campaign
                                    </Box>
                                ))}
                                {connected.events.map(e => (
                                    <Box key={e.id} component={Link}
                                        href={`/tabletop/campaigns/${campaignId}/timeline`}
                                        sx={{ display: "block", fontSize: "0.78rem", color: "primary.main", textDecoration: "none",
                                            mb: 0.25, "&:hover": { textDecoration: "underline" } }}>
                                        📜 {e.inWorldDate ?? e.realDate ?? ""} {e.title}
                                    </Box>
                                ))}
                            </Box>
                        );
                    })()}
                </DialogContent>
                <DialogActions>
                    <Button startIcon={<X size={14} />} onClick={closeEdit}>Cancel</Button>
                    <Button variant="contained" startIcon={<Save size={14} />}
                        onClick={commitEdit} sx={{ backgroundColor: "primary.main" }}>
                        Save Pin
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
