"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Box, Button, Chip, CircularProgress, Container, FormControl, InputLabel,
    MenuItem, Select, TextField, Typography,
} from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Save, SwatchBook } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { collectAllTags, useGalleryData, type GalleryPhoto } from "../_lib/useGalleryData";
import { SwipeCard } from "../_components/SwipeCard";
import { PhotoGrid } from "../_components/PhotoGrid";
import { PhotoLightbox } from "../_components/PhotoLightbox";
import { ManagePhotoGalleriesDialog } from "../_components/ManagePhotoGalleriesDialog";

const client = generateClient<Schema>();
const ACCENT = "#ec4899";

type Phase = "select" | "swiping" | "results";

export default function SwipePage() {
    const router = useRouter();
    const { photos, subGalleries, urls, loading, reload } = useGalleryData();

    const [phase, setPhase] = useState<Phase>("select");
    const [sourceId, setSourceId] = useState("master");
    const [pool, setPool] = useState<GalleryPhoto[]>([]);
    const [roundIndex, setRoundIndex] = useState(0);
    const [liked, setLiked] = useState<GalleryPhoto[]>([]);
    const [roundNumber, setRoundNumber] = useState(1);

    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [managingPhoto, setManagingPhoto] = useState<GalleryPhoto | null>(null);
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [saveName, setSaveName] = useState("");
    const [saving, setSaving] = useState(false);

    // Keep the liked set in sync with reloads (tag edits / deletes) made
    // from the results screen's manage dialog.
    useEffect(() => {
        if (phase !== "results") return;
        setLiked(prev => prev
            .map(p => photos.find(np => np.id === p.id))
            .filter((p): p is GalleryPhoto => !!p));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photos, phase]);

    function poolForSource(id: string) {
        return id === "master" ? photos : photos.filter(p => p.subGalleryIds?.includes(id));
    }

    function startSwiping(initialPool: GalleryPhoto[]) {
        setPool(initialPool);
        setRoundIndex(0);
        setLiked([]);
        setPhase("swiping");
    }

    function handleStart() {
        const initial = poolForSource(sourceId);
        if (!initial.length) return;
        setRoundNumber(1);
        startSwiping(initial);
    }

    function decide(yes: boolean) {
        const current = pool[roundIndex];
        if (yes) setLiked(prev => [...prev, current]);
        const next = roundIndex + 1;
        if (next >= pool.length) {
            setPhase("results");
        } else {
            setRoundIndex(next);
        }
    }

    useEffect(() => {
        if (phase !== "swiping") return;
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "ArrowLeft") decide(false);
            else if (e.key === "ArrowRight") decide(true);
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, roundIndex, pool, liked]);

    function swipeAgainOnLiked() {
        setRoundNumber(prev => prev + 1);
        startSwiping(liked);
    }

    function startOver() {
        setPhase("select");
        setPool([]);
        setLiked([]);
        setRoundIndex(0);
        setRoundNumber(1);
        setShowSaveForm(false);
        setSaveName("");
    }

    async function saveAsSubGallery() {
        if (!saveName.trim() || !liked.length) return;
        setSaving(true);
        try {
            const { data: created } = await client.models.SubGallery.create({ name: saveName.trim() });
            if (created) {
                await Promise.all(liked.map(p => {
                    const ids = new Set((p.subGalleryIds ?? []).filter((id): id is string => !!id));
                    ids.add(created.id);
                    return client.models.GalleryPhoto.update({ id: p.id, subGalleryIds: Array.from(ids) });
                }));
                router.push(`/personal/gallery/galleries/${created.id}`);
            }
        } finally {
            setSaving(false);
        }
    }

    const tagCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const photo of liked) {
            for (const tag of photo.tags ?? []) {
                if (!tag) continue;
                counts.set(tag, (counts.get(tag) ?? 0) + 1);
            }
        }
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    }, [liked]);

    const allTags = collectAllTags(photos);
    const imageUrls = liked.map(p => urls[p.storageKey] ?? "");
    const current = pool[roundIndex];

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href="/personal/gallery" startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}>
                    Back to Gallery
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                    <SwatchBook size={32} color={ACCENT} />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "text.primary" }}>
                        Swipe to Narrow
                    </Typography>
                </Box>

                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                        <CircularProgress sx={{ color: ACCENT }} />
                    </Box>
                ) : phase === "select" ? (
                    <Box sx={{ mt: 4, display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 420 }}>
                        <Typography sx={{ color: "text.secondary" }}>
                            Pick a starting set of photos. You&apos;ll go through them one at a time —
                            keep the ones you like, and narrow down as many rounds as you want.
                        </Typography>
                        <FormControl fullWidth>
                            <InputLabel>Source</InputLabel>
                            <Select label="Source" value={sourceId} onChange={e => setSourceId(e.target.value)}>
                                <MenuItem value="master">Master Gallery ({photos.length})</MenuItem>
                                {subGalleries.map(g => (
                                    <MenuItem key={g.id} value={g.id}>
                                        {g.name} ({poolForSource(g.id).length})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button variant="contained" onClick={handleStart}
                            disabled={poolForSource(sourceId).length === 0}
                            sx={{ backgroundColor: ACCENT, "&:hover": { backgroundColor: "#db2777" } }}>
                            Start Swiping
                        </Button>
                    </Box>
                ) : phase === "swiping" && current ? (
                    <Box sx={{ mt: 3 }}>
                        <Typography sx={{ color: "text.disabled", fontSize: "0.78rem", mb: 2 }}>
                            Round {roundNumber}
                        </Typography>
                        <SwipeCard
                            photo={current}
                            url={urls[current.storageKey] ?? ""}
                            position={roundIndex + 1}
                            total={pool.length}
                            onYes={() => decide(true)}
                            onNo={() => decide(false)}
                        />
                        <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 3 }}>
                            <Button size="small" onClick={() => setPhase("results")}>Finish Early</Button>
                            <Button size="small" color="inherit" onClick={startOver}>Exit</Button>
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{ mt: 3 }}>
                        <Typography sx={{ color: "text.secondary", mb: 1 }}>
                            Round {roundNumber}: kept {liked.length} of {pool.length}
                        </Typography>

                        {tagCounts.length > 0 && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 1 }}>
                                    Tags among what you liked
                                </Typography>
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                                    {tagCounts.map(([tag, count]) => (
                                        <Chip key={tag} label={`${tag} (${count})`} size="small" />
                                    ))}
                                </Box>
                            </Box>
                        )}

                        {liked.length === 0 ? (
                            <Typography sx={{ color: "text.secondary", py: 4 }}>
                                You didn&apos;t keep anything this round.
                            </Typography>
                        ) : (
                            <PhotoGrid photos={liked} urls={urls} onPhotoClick={setLightboxIndex} />
                        )}

                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 3 }}>
                            <Button variant="contained" disabled={liked.length === 0} onClick={swipeAgainOnLiked}
                                sx={{ backgroundColor: ACCENT, "&:hover": { backgroundColor: "#db2777" } }}>
                                Swipe Again on These
                            </Button>
                            <Button variant="outlined" disabled={liked.length === 0}
                                startIcon={<Save size={16} />}
                                onClick={() => setShowSaveForm(v => !v)}
                                sx={{ borderColor: ACCENT, color: ACCENT }}>
                                Save as Sub-Gallery
                            </Button>
                            <Button startIcon={<RotateCcw size={16} />} onClick={startOver}>
                                Start Over
                            </Button>
                        </Box>

                        {showSaveForm && (
                            <Box sx={{ display: "flex", gap: 1, mt: 2, maxWidth: 420 }}>
                                <TextField size="small" fullWidth autoFocus placeholder="Sub-gallery name"
                                    value={saveName} onChange={e => setSaveName(e.target.value)} />
                                <Button variant="contained" disabled={saving || !saveName.trim()}
                                    onClick={saveAsSubGallery}
                                    sx={{ backgroundColor: ACCENT, "&:hover": { backgroundColor: "#db2777" } }}>
                                    {saving ? "Saving…" : "Save"}
                                </Button>
                            </Box>
                        )}

                        <PhotoLightbox
                            images={imageUrls}
                            index={lightboxIndex}
                            onClose={() => setLightboxIndex(null)}
                            onIndexChange={setLightboxIndex}
                            onManage={lightboxIndex !== null ? () => setManagingPhoto(liked[lightboxIndex]) : undefined}
                        />
                        <ManagePhotoGalleriesDialog
                            open={!!managingPhoto}
                            photo={managingPhoto}
                            subGalleries={subGalleries}
                            allTags={allTags}
                            onClose={() => setManagingPhoto(null)}
                            onSaved={reload}
                            onDeleted={() => { setManagingPhoto(null); setLightboxIndex(null); reload(); }}
                        />
                    </Box>
                )}
            </Container>
        </Box>
    );
}
