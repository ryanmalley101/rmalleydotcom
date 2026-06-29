"use client";

import { useState, type ReactNode } from "react";
import {
    Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
    DialogTitle, Typography,
} from "@mui/material";
import { CheckSquare, Trash2, Upload, X, type LucideIcon } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import { remove } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import { PhotoGrid } from "./PhotoGrid";
import { PhotoLightbox } from "./PhotoLightbox";
import { UploadDialog } from "./UploadDialog";
import { ManagePhotoGalleriesDialog } from "./ManagePhotoGalleriesDialog";

const client = generateClient<Schema>();

type GalleryPhoto = Schema["GalleryPhoto"]["type"];
type SubGallery = Schema["SubGallery"]["type"];

const ACCENT = "#ec4899";

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

    const imageUrls = photos.map(p => urls[p.storageKey] ?? "");

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

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, mb: 4 }}>
                {selectionMode ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                        <Typography sx={{ color: "text.secondary", fontSize: "0.9rem" }}>
                            {selectedIds.size} selected
                        </Typography>
                        <Button size="small" onClick={() => setSelectedIds(new Set(photos.map(p => p.id)))}>
                            Select All
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
                            {photos.length} photo{photos.length === 1 ? "" : "s"}
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
            ) : (
                <PhotoGrid photos={photos} urls={urls} onPhotoClick={setLightboxIndex}
                    selectionMode={selectionMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
            )}

            <PhotoLightbox
                images={imageUrls}
                index={lightboxIndex}
                onClose={() => setLightboxIndex(null)}
                onIndexChange={setLightboxIndex}
                onManage={lightboxIndex !== null ? () => setManagingPhoto(photos[lightboxIndex]) : undefined}
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
