"use client";

import { useState, type ReactNode } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { Upload, type LucideIcon } from "lucide-react";
import type { Schema } from "@/amplify/data/resource";
import { PhotoGrid } from "./PhotoGrid";
import { PhotoLightbox } from "./PhotoLightbox";
import { UploadDialog } from "./UploadDialog";
import { ManagePhotoGalleriesDialog } from "./ManagePhotoGalleriesDialog";

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

    const imageUrls = photos.map(p => urls[p.storageKey] ?? "");

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

            <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                {photos.length} photo{photos.length === 1 ? "" : "s"}
            </Typography>

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
                <PhotoGrid photos={photos} urls={urls} onPhotoClick={setLightboxIndex} />
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
        </>
    );
}
