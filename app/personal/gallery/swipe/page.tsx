"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Box, Button, Checkbox, Chip, CircularProgress, Container, FormControl,
    FormControlLabel, InputLabel, MenuItem, Select, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, RotateCcw, Save, SwatchBook, Undo2 } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import { remove } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import { suggestedTags, useGalleryData, type GalleryPhoto } from "../_lib/useGalleryData";
import { SwipeCard } from "../_components/SwipeCard";
import { PhotoGrid } from "../_components/PhotoGrid";
import { PhotoLightbox } from "../_components/PhotoLightbox";
import { ManagePhotoGalleriesDialog } from "../_components/ManagePhotoGalleriesDialog";

const client = generateClient<Schema>();
const ACCENT = "#ec4899";

type Phase = "select" | "swiping" | "results";

export default function SwipePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { photos, subGalleries, urls, loading, reload } = useGalleryData();

    const [phase, setPhase] = useState<Phase>("select");
    const [sourceId, setSourceId] = useState(() => searchParams.get("source") ?? "master");
    const [includeUntagged, setIncludeUntagged] = useState(false);
    const [pool, setPool] = useState<GalleryPhoto[]>([]);
    const [roundIndex, setRoundIndex] = useState(0);
    const [liked, setLiked] = useState<GalleryPhoto[]>([]);
    const [disliked, setDisliked] = useState<GalleryPhoto[]>([]);
    const [roundNumber, setRoundNumber] = useState(1);
    const [history, setHistory] = useState<{ index: number; liked: boolean }[]>([]);
    const [resultTab, setResultTab] = useState(0);

    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [managingPhoto, setManagingPhoto] = useState<GalleryPhoto | null>(null);
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [saveName, setSaveName] = useState("");
    const [saving, setSaving] = useState(false);
    const [deletingCurrent, setDeletingCurrent] = useState(false);
    const [tagsVisible, setTagsVisible] = useState(false);

    // Keep the liked set in sync with reloads (tag edits / deletes) made
    // from the results screen's manage dialog.
    useEffect(() => {
        if (phase !== "results") return;
        const stillExists = (p: GalleryPhoto) => photos.find(np => np.id === p.id);
        setLiked(prev => prev.map(stillExists).filter((p): p is GalleryPhoto => !!p));
        setDisliked(prev => prev.map(stillExists).filter((p): p is GalleryPhoto => !!p));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photos, phase]);

    function poolForSource(id: string) {
        const base = id === "master" ? photos : photos.filter(p => p.subGalleryIds?.includes(id));
        if (includeUntagged) return base;
        return base.filter(p => (p.tags ?? []).filter(Boolean).length > 0);
    }

    // photos arrives newest-first (and "liked" follows whatever order it was
    // accumulated in) — shuffle on every round so swipe order isn't just
    // upload order, for the initial start and every "Swipe Again" alike.
    function shuffled(arr: GalleryPhoto[]): GalleryPhoto[] {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function startSwiping(initialPool: GalleryPhoto[]) {
        setPool(shuffled(initialPool));
        setRoundIndex(0);
        setLiked([]);
        setDisliked([]);
        setHistory([]);
        setResultTab(0);
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
        else setDisliked(prev => [...prev, current]);
        setHistory(prev => [...prev, { index: roundIndex, liked: yes }]);
        const next = roundIndex + 1;
        if (next >= pool.length) {
            setPhase("results");
        } else {
            setRoundIndex(next);
        }
    }

    // Steps back one decision — covers the fat-finger case (mis-tap/mis-key
    // during fast swiping), including undoing the swipe that just ended the
    // round, which is why this also works from the results screen.
    function undo() {
        if (history.length === 0) return;
        const last = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1));
        if (last.liked) setLiked(prev => prev.slice(0, -1));
        else setDisliked(prev => prev.slice(0, -1));
        setRoundIndex(last.index);
        setPhase("swiping");
    }

    // Preloads the next photo's image while the current one is on screen, so
    // advancing to it doesn't pop in / flicker while the browser fetches it.
    useEffect(() => {
        if (phase !== "swiping") return;
        const next = pool[roundIndex + 1];
        const nextUrl = next ? urls[next.storageKey] : undefined;
        if (!nextUrl) return;
        const img = new window.Image();
        img.src = nextUrl;
    }, [phase, roundIndex, pool, urls]);

    // Deletes the photo currently on screen — for the obvious-junk case where
    // swiping no isn't enough, you just want it gone. Removes it from the
    // pool in place so the next photo slides into the same index, and syncs
    // the master gallery so it doesn't reappear in a later round/session.
    async function deleteCurrent() {
        const photo = pool[roundIndex];
        if (!photo) return;
        setDeletingCurrent(true);
        try {
            await remove({ path: photo.storageKey });
            await client.models.GalleryPhoto.delete({ id: photo.id });
            const newPool = pool.filter((_, i) => i !== roundIndex);
            setPool(newPool);
            if (roundIndex >= newPool.length) {
                setPhase("results");
            }
            reload();
        } finally {
            setDeletingCurrent(false);
        }
    }

    useEffect(() => {
        if (phase !== "swiping") return;
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "ArrowLeft") decide(false);
            else if (e.key === "ArrowRight") decide(true);
            else if (e.key === "Backspace") { e.preventDefault(); undo(); }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, roundIndex, pool, liked, history]);

    function swipeAgainOnLiked() {
        setRoundNumber(prev => prev + 1);
        startSwiping(liked);
    }

    function startOver() {
        setPhase("select");
        setPool([]);
        setLiked([]);
        setDisliked([]);
        setRoundIndex(0);
        setRoundNumber(1);
        setResultTab(0);
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

    function buildCounts(photos: GalleryPhoto[]) {
        const m = new Map<string, number>();
        for (const p of photos)
            for (const t of p.tags ?? [])
                if (t) m.set(t, (m.get(t) ?? 0) + 1);
        return m;
    }

    const likedCounts = useMemo(() => buildCounts(liked), [liked]);
    const dislikedCounts = useMemo(() => buildCounts(disliked), [disliked]);

    // tag rows for each of the three summary views
    const favoriteTags = useMemo(() =>
        Array.from(likedCounts.entries()).sort((a, b) => b[1] - a[1]),
        [likedCounts]
    );
    const leastFavoriteTags = useMemo(() =>
        Array.from(dislikedCounts.entries()).sort((a, b) => b[1] - a[1]),
        [dislikedCounts]
    );
    const netTags = useMemo(() => {
        const allTagNames = new Set(Array.from(likedCounts.keys()).concat(Array.from(dislikedCounts.keys())));
        return Array.from(allTagNames)
            .map(tag => [tag, (likedCounts.get(tag) ?? 0) - (dislikedCounts.get(tag) ?? 0)] as [string, number])
            .filter(([, net]) => net !== 0)
            .sort((a, b) => b[1] - a[1]);
    }, [likedCounts, dislikedCounts]);

    const maxAbsNet = netTags.length > 0 ? Math.max(...netTags.map(([, n]) => Math.abs(n))) : 1;
    const allTags = suggestedTags(photos);
    const current = pool[roundIndex];

    // Lightbox source changes with the active results tab — tab 0 browses
    // liked photos, tab 1 browses disliked photos, tab 2 has no grid.
    const lightboxPhotos = resultTab === 1 ? disliked : liked;
    const lightboxImageUrls = lightboxPhotos.map(p => urls[p.storageKey] ?? "");

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
                                <MenuItem value="master">Master Gallery ({poolForSource("master").length})</MenuItem>
                                {subGalleries.map(g => (
                                    <MenuItem key={g.id} value={g.id}>
                                        {g.name} ({poolForSource(g.id).length})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControlLabel
                            control={<Checkbox checked={includeUntagged}
                                onChange={e => setIncludeUntagged(e.target.checked)} />}
                            label={
                                <Typography sx={{ fontSize: "0.88rem", color: "text.secondary" }}>
                                    Include untagged photos
                                </Typography>
                            }
                        />
                        <Button variant="contained" onClick={handleStart}
                            disabled={poolForSource(sourceId).length === 0}
                            sx={{ backgroundColor: ACCENT, "&:hover": { backgroundColor: "#db2777" } }}>
                            Start Swiping
                        </Button>
                    </Box>
                ) : phase === "swiping" && current ? (
                    <Box sx={{ mt: 3 }}>
                        <Typography sx={{ color: "text.disabled", fontSize: "0.78rem", mb: 2 }}>
                            Round {roundNumber} · {liked.length} liked so far
                        </Typography>
                        <SwipeCard
                            key={current.id}
                            photo={current}
                            url={urls[current.storageKey] ?? ""}
                            position={roundIndex + 1}
                            total={pool.length}
                            onYes={() => decide(true)}
                            onNo={() => decide(false)}
                            onDelete={deleteCurrent}
                            deleting={deletingCurrent}
                            tagsVisible={tagsVisible}
                            onToggleTags={() => setTagsVisible(v => !v)}
                        />
                        <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 3 }}>
                            <Button size="small" startIcon={<Undo2 size={14} />} onClick={undo} disabled={history.length === 0}>
                                Undo
                            </Button>
                            <Button size="small" onClick={() => setPhase("results")}>Finish Early</Button>
                            <Button size="small" color="inherit" onClick={startOver}>Exit</Button>
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{ mt: 3 }}>
                        <Typography sx={{ color: "text.secondary", mb: 2 }}>
                            Round {roundNumber}: kept {liked.length} of {pool.length} · passed {disliked.length}
                        </Typography>

                        <Tabs value={resultTab} onChange={(_, v) => { setResultTab(v); setLightboxIndex(null); }} sx={{ mb: 2 }}
                            TabIndicatorProps={{ sx: { backgroundColor: ACCENT } }}>
                            <Tab label="Favorite Tags" sx={{ "&.Mui-selected": { color: ACCENT } }} />
                            <Tab label="Least Favorite Tags" sx={{ "&.Mui-selected": { color: ACCENT } }} />
                            <Tab label="Specifics" sx={{ "&.Mui-selected": { color: ACCENT } }} />
                        </Tabs>

                        {resultTab === 0 && (
                            <>
                                {favoriteTags.length > 0 ? (
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 3 }}>
                                        {favoriteTags.map(([tag, count]) => (
                                            <Chip key={tag} label={`${tag} (${count})`} size="small" />
                                        ))}
                                    </Box>
                                ) : (
                                    <Typography sx={{ color: "text.secondary", mb: 3 }}>No tags to summarize yet.</Typography>
                                )}
                                {liked.length === 0 ? (
                                    <Typography sx={{ color: "text.secondary", py: 4 }}>
                                        You didn&apos;t keep anything this round.
                                    </Typography>
                                ) : (
                                    <PhotoGrid photos={liked} urls={urls} onPhotoClick={setLightboxIndex} />
                                )}
                            </>
                        )}

                        {resultTab === 1 && (
                            <>
                                {leastFavoriteTags.length > 0 ? (
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 3 }}>
                                        {leastFavoriteTags.map(([tag, count]) => (
                                            <Chip key={tag} label={`${tag} (${count})`} size="small"
                                                sx={{ backgroundColor: "rgba(248,113,113,0.12)", color: "#f87171" }} />
                                        ))}
                                    </Box>
                                ) : (
                                    <Typography sx={{ color: "text.secondary", mb: 3 }}>No tags to summarize yet.</Typography>
                                )}
                                {disliked.length === 0 ? (
                                    <Typography sx={{ color: "text.secondary", py: 4 }}>
                                        You didn&apos;t pass on anything this round.
                                    </Typography>
                                ) : (
                                    <PhotoGrid photos={disliked} urls={urls} onPhotoClick={setLightboxIndex} />
                                )}
                            </>
                        )}

                        {resultTab === 2 && (
                            netTags.length === 0 ? (
                                <Typography sx={{ color: "text.secondary", py: 4 }}>
                                    Swipe through some tagged photos to see net scores.
                                </Typography>
                            ) : (
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, maxWidth: 420 }}>
                                    {netTags.map(([tag, net]) => (
                                        <Box key={tag} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                            <Typography sx={{
                                                flex: 1, fontSize: "0.85rem",
                                                color: net > 0 ? "text.primary" : "text.secondary",
                                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                            }}>
                                                {tag}
                                            </Typography>
                                            <Box sx={{
                                                flex: 1, height: 14, borderRadius: 1,
                                                backgroundColor: "rgba(255,255,255,0.04)",
                                                position: "relative",
                                            }}>
                                                <Box sx={{
                                                    position: "absolute",
                                                    top: 0, height: "100%", borderRadius: 1,
                                                    left: net >= 0 ? "50%" : `${50 + (net / maxAbsNet) * 50}%`,
                                                    width: `${(Math.abs(net) / maxAbsNet) * 50}%`,
                                                    backgroundColor: net > 0 ? "#4ade80" : "#f87171",
                                                }} />
                                                <Box sx={{
                                                    position: "absolute", top: 0, left: "50%",
                                                    height: "100%", width: 1, backgroundColor: "divider",
                                                }} />
                                            </Box>
                                            <Typography sx={{
                                                width: 32, textAlign: "right", fontSize: "0.78rem", fontWeight: 600,
                                                color: net > 0 ? "#4ade80" : "#f87171",
                                            }}>
                                                {net > 0 ? `+${net}` : net}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            )
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
                            <Button startIcon={<Undo2 size={16} />} onClick={undo} disabled={history.length === 0}>
                                Undo Last Swipe
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
                            images={lightboxImageUrls}
                            index={lightboxIndex}
                            onClose={() => setLightboxIndex(null)}
                            onIndexChange={setLightboxIndex}
                            onManage={lightboxIndex !== null ? () => setManagingPhoto(lightboxPhotos[lightboxIndex]) : undefined}
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
