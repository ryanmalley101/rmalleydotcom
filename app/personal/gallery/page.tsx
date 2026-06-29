"use client";

import { useState } from "react";
import { Box, Button, Container } from "@mui/material";
import Link from "next/link";
import { ArrowLeft, FolderOpen, Images, Sparkles, SwatchBook } from "lucide-react";
import { suggestedTags, useGalleryData } from "./_lib/useGalleryData";
import { GalleryView } from "./_components/GalleryView";
import { BulkAutoTagDialog } from "./_components/BulkAutoTagDialog";

export default function GalleryPage() {
    const { photos, subGalleries, urls, loading, reload } = useGalleryData();
    const [bulkTagOpen, setBulkTagOpen] = useState(false);

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
                            <Button variant="outlined" startIcon={<Sparkles size={16} />}
                                onClick={() => setBulkTagOpen(true)}>
                                Bulk Auto-tag
                            </Button>
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

                <BulkAutoTagDialog
                    open={bulkTagOpen}
                    photos={photos}
                    onClose={() => setBulkTagOpen(false)}
                    onDone={reload}
                />
            </Container>
        </Box>
    );
}
