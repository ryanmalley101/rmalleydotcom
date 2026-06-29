"use client";

import { Box, Button, Container } from "@mui/material";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { collectAllTags, useGalleryData } from "../../_lib/useGalleryData";
import { GalleryView } from "../../_components/GalleryView";

export default function SubGalleryPage() {
    const { subGalleryId } = useParams<{ subGalleryId: string }>();
    const { photos, subGalleries, urls, loading, reload } = useGalleryData();

    const subGallery = subGalleries.find(g => g.id === subGalleryId);
    const galleryPhotos = photos.filter(p => p.subGalleryIds?.includes(subGalleryId));

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="lg">
                <Button component={Link} href="/personal/gallery/galleries" startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}>
                    Back to Sub-Galleries
                </Button>

                <GalleryView
                    icon={FolderOpen}
                    title={loading ? "" : subGallery?.name ?? "Sub-Gallery"}
                    subtitle={subGallery?.description ?? undefined}
                    photos={galleryPhotos}
                    allTags={collectAllTags(photos)}
                    subGalleries={subGalleries}
                    urls={urls}
                    loading={loading}
                    reload={reload}
                    defaultSubGalleryId={subGalleryId}
                    emptyMessage="No photos in this sub-gallery yet."
                />
            </Container>
        </Box>
    );
}
