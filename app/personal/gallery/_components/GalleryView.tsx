"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
    Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogTitle, FormControl, IconButton, MenuItem, Pagination,
    Select, TextField, Tooltip, Typography,
} from "@mui/material";
import { CheckSquare, Shuffle, Trash2, Upload, X, type LucideIcon } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import { remove } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import { collectAllTags } from "../_lib/useGalleryData";
import { PhotoGrid } from "./PhotoGrid";
import { PhotoLightbox } from "./PhotoLightbox";
import { UploadDialog } from "./UploadDialog";
import { ManagePhotoGalleriesDialog } from "./ManagePhotoGalleriesDialog";

const client = generateClient<Schema>();

type SortMode = "newest" | "oldest" | "shuffle";

type GalleryPhoto = Schema["GalleryPhoto"]["type"];
type SubGallery = Schema["SubGallery"]["type"];

const ACCENT = "#ec4899";
const PAGE_SIZE = 100;

interface GalleryViewProps {
    icon: LucideIcon;
    title: string;
    subtitle?: string;
    photos: GalleryPhoto[];
    allTags: string[]; // every tag used across the whole gallery (not just `photos`), for autocomplete suggestions
    subGalleries: SubGallery[];
    urls: Record<string, string>;
    loading: boolean;
    reload: () => void;
    defaultSubGalleryId?: string;
    emptyMessage: string;
    headerActions?: ReactNode;
}

// Shared by the master gallery and every sub-gallery page: grid + lightbox +
// upload + per-photo gallery-assignment management. Callers just supply the
// (already filtered) photo list and a couple of header strings.
export function GalleryView({
    icon: Icon, title, subtitle, photos, allTags, subGalleries, urls, loading, reload,
    defaultSubGalleryId, emptyMessage, headerActions,
}: GalleryViewProps) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [managingPhoto, setManagingPhoto] = useState<GalleryPhoto | null>(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [page, setPage] = useState(1);
    const [activeTags, setActiveTags] = useState<string[]>([]);
    const [sortMode, setSortMode] = useState<SortMode>("newest");
    const [shuffleSeed, setShuffleSeed] = useState(0);

    const usedTags = collectAllTags(photos);
    const filteredPhotos = activeTags.length === 0
        ? photos
        : photos.filter(p => activeTags.every(t => (p.tags ?? []).includes(t)));

    // photos arrives newest-first already; "oldest" just reverses that, and
    // "shuffle" re-randomizes only when the underlying set or the seed
    // changes (clicking "Shuffle again"), not on every render.
    const sortedPhotos = useMemo(() => {
        if (sortMode === "oldest") return [...filteredPhotos].reverse();
        if (sortMode === "shuffle") {
            const arr = [...filteredPhotos];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }
        return filteredPhotos;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredPhotos, sortMode, shuffleSeed]);

    const pageCount = Math.max(1, Math.ceil(sortedPhotos.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount);
    const pagedPhotos = sortedPhotos.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    const imageUrls = pagedPhotos.map(p => urls[p.storageKey] ?? "");

    function changeTagFilter(tags: string[]) {
        setActiveTags(tags);
        setPage(1);
    }

    function changeSortMode(mode: SortMode) {
        setSortMode(mode);
        setPage(1);
    }

    function exitSelectionMode() {
        setSelectionMode(false);
        setSelectedIds(new Set());
    }

    function toggleSelect(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    async function bulkDelete() {
        setBulkDeleting(true);
        try {
            const targets = photos.filter(p => selectedIds.has(p.id));
            await Promise.all(targets.map(async photo => {
                try {
                    await remove({ path: photo.storageKey });
                    await client.models.GalleryPhoto.delete({ id: photo.id });
                } catch { /* skip failures, continue deleting the rest */ }
            }));
            setConfirmingBulkDelete(false);
            exitSelectionMode();
            reload();
        } finally {
            setBulkDeleting(false);
        }
    }

    return (
        <>
            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1, flexWrap: "wrap", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Icon size={32} color={ACCENT} />
                    <Box>
                        <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "text.primary" }}>
                            {title}
                        </Typography>
                        {subtitle && (
                            <Typography sx={{ color: "text.secondary", fontSize: "0.9rem", mt: 0.5 }}>
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                </Box>
                <Box sx={{ display: "flex", gap: 1.5 }}>
                    {headerActions}
                    <Button variant="contained" startIcon={<Upload size={16} />} onClick={() => setUploadOpen(true)}
                        sx={{ backgroundColor: ACCENT, "&:hover": { backgroundColor: "#db2777" } }}>
                        Upload
                    </Button>
                </Box>
            </Box>

            {(usedTags.length > 0 || photos.length > 0) && (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, mb: 2 }}>
                    {usedTags.length > 0 ? (
                        <Autocomplete
                            multiple size="small"
                            options={usedTags}
                            value={activeTags}
                            onChange={(_, v) => changeTagFilter(v)}
                            renderTags={(value, getTagProps) =>
                                value.map((option, index) => (
                                    <Chip label={option} size="small" {...getTagProps({ index })} />
                                ))
                            }
                            renderInput={params => <TextField {...params} placeholder="Filter by tag…" />}
                            sx={{ minWidth: 220, flex: "1 1 220px" }}
                        />
                    ) : <Box />}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <Select value={sortMode} onChange={e => changeSortMode(e.target.value as SortMode)}>
                                <MenuItem value="newest">Newest first</MenuItem>
                                <MenuItem value="oldest">Oldest first</MenuItem>
                                <MenuItem value="shuffle">Shuffle</MenuItem>
                            </Select>
                        </FormControl>
                        {sortMode === "shuffle" && (
                            <Tooltip title="Shuffle again">
                                <IconButton size="small" onClick={() => setShuffleSeed(s => s + 1)}>
                                    <Shuffle size={16} />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                </Box>
            )}

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, mb: 4 }}>
                {selectionMode ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                        <Typography sx={{ color: "text.secondary", fontSize: "0.9rem" }}>
                            {selectedIds.size} selected
                        </Typography>
                        <Button size="small" onClick={() => setSelectedIds(prev => {
                            const next = new Set(prev);
                            pagedPhotos.forEach(p => next.add(p.id));
                            return next;
                        })}>
                            {pageCount > 1 ? "Select Page" : "Select All"}
                        </Button>
                        <Button size="small" onClick={() => setSelectedIds(new Set())} disabled={selectedIds.size === 0}>
                            Clear
                        </Button>
                        <Button size="small" color="error" variant="contained" disabled={selectedIds.size === 0}
                            startIcon={<Trash2 size={14} />}
                            onClick={() => setConfirmingBulkDelete(true)}>
                            Delete Selected
                        </Button>
                        <Button size="small" startIcon={<X size={14} />} onClick={exitSelectionMode}>
                            Done
                        </Button>
                    </Box>
                ) : (
                    <>
                        <Typography variant="body1" sx={{ color: "text.secondary" }}>
                            {activeTags.length > 0
                                ? `${sortedPhotos.length} of ${photos.length} photo${photos.length === 1 ? "" : "s"}`
                                : `${photos.length} photo${photos.length === 1 ? "" : "s"}`}
                            {pageCount > 1 ? ` · page ${safePage} of ${pageCount}` : ""}
                        </Typography>
                        {photos.length > 0 && (
                            <Button size="small" startIcon={<CheckSquare size={14} />} onClick={() => setSelectionMode(true)}>
                                Select
                            </Button>
                        )}
                    </>
                )}
            </Box>

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                    <CircularProgress sx={{ color: ACCENT }} />
                </Box>
            ) : photos.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 10 }}>
                    <Icon size={48} color="#6b7280" style={{ marginBottom: 12 }} />
                    <Typography sx={{ color: "text.secondary", mb: 2 }}>{emptyMessage}</Typography>
                    <Button variant="outlined" onClick={() => setUploadOpen(true)}
                        sx={{ borderColor: ACCENT, color: ACCENT }}>
                        Upload photos
                    </Button>
                </Box>
            ) : sortedPhotos.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 10 }}>
                    <Icon size={48} color="#6b7280" style={{ marginBottom: 12 }} />
                    <Typography sx={{ color: "text.secondary", mb: 2 }}>
                        No photos match the selected tags.
                    </Typography>
                    <Button variant="outlined" onClick={() => changeTagFilter([])}
                        sx={{ borderColor: ACCENT, color: ACCENT }}>
                        Clear filters
                    </Button>
                </Box>
            ) : (
                <>
                    <PhotoGrid photos={pagedPhotos} urls={urls} onPhotoClick={setLightboxIndex}
                        selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
                    {pageCount > 1 && (
                        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
                            <Pagination count={pageCount} page={safePage}
                                onChange={(_, p) => { setPage(p); setLightboxIndex(null); }}
                                color="standard" />
                        </Box>
                    )}
                </>
            )}

            <PhotoLightbox
                images={imageUrls}
                index={lightboxIndex}
                onClose={() => setLightboxIndex(null)}
                onIndexChange={setLightboxIndex}
                onManage={lightboxIndex !== null ? () => setManagingPhoto(pagedPhotos[lightboxIndex]) : undefined}
            />

            <UploadDialog
                open={uploadOpen}
                onClose={() => setUploadOpen(false)}
                subGalleries={subGalleries}
                defaultSubGalleryId={defaultSubGalleryId}
                onDone={reload}
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

            <Dialog open={confirmingBulkDelete} onClose={() => setConfirmingBulkDelete(false)}>
                <DialogTitle>Delete {selectedIds.size} photo{selectedIds.size === 1 ? "" : "s"}?</DialogTitle>
                <DialogContent>
                    <Typography>
                        This permanently deletes the selected photos and their files. This can&apos;t be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmingBulkDelete(false)}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={bulkDelete} disabled={bulkDeleting}>
                        {bulkDeleting ? "Deleting…" : "Delete"}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
