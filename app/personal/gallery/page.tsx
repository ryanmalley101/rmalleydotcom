"use client";

import { Box, Button, Container } from "@mui/material";
import Link from "next/link";
import { ArrowLeft, FolderOpen, Images, SwatchBook } from "lucide-react";
import { suggestedTags, useGalleryData } from "./_lib/useGalleryData";
import { GalleryView } from "./_components/GalleryView";

export default function GalleryPage() {
    const { photos, subGalleries, urls, loading, reload } = useGalleryData();

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="lg">
                <Button component={Link} href="/personal" startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}>
                    Back
                </Button>

                <GalleryView
                    icon={Images}
                    title="Photo Gallery"
                    subtitle="Every upload, regardless of sub-gallery."
                    photos={photos}
                    allTags={suggestedTags(photos)}
                    subGalleries={subGalleries}
                    urls={urls}
                    loading={loading}
                    reload={reload}
                    emptyMessage="No photos yet."
                    headerActions={
                        <>
                            <Button component={Link} href="/personal/gallery/swipe" variant="outlined"
                                startIcon={<SwatchBook size={16} />}>
                                Swipe to Narrow
                            </Button>
                            <Button component={Link} href="/personal/gallery/galleries" variant="outlined"
                                startIcon={<FolderOpen size={16} />}>
                                Sub-Galleries
                            </Button>
                        </>
                    }
                />
            </Container>
        </Box>
    );
}
