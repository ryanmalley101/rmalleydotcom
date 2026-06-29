"use client";

import { useState } from "react";
import {
    Box, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent,
    DialogTitle, IconButton, Tooltip, Typography,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, FolderOpen, Plus, Trash2 } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { useGalleryData } from "../_lib/useGalleryData";
import { SubGalleryFormDialog } from "../_components/SubGalleryFormDialog";

const client = generateClient<Schema>();
const ACCENT = "#ec4899";

export default function SubGalleriesPage() {
    const { photos, subGalleries, urls, loading, reload } = useGalleryData();
    const [formOpen, setFormOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    function coverUrlFor(galleryId: string) {
        const photo = photos.find(p => p.subGalleryIds?.includes(galleryId) && urls[p.storageKey]);
        return photo ? urls[photo.storageKey] : null;
    }
    function countFor(galleryId: string) {
        return photos.filter(p => p.subGalleryIds?.includes(galleryId)).length;
    }

    async function confirmDelete() {
        if (!deleteId) return;
        await client.models.SubGallery.delete({ id: deleteId });
        setDeleteId(null);
        reload();
    }

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="lg">
                <Button component={Link} href="/personal/gallery" startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}>
                    Back to Gallery
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <FolderOpen size={32} color={ACCENT} />
                        <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "text.primary" }}>
                            Sub-Galleries
                        </Typography>
                    </Box>
                    <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => setFormOpen(true)}
                        sx={{ backgroundColor: ACCENT, "&:hover": { backgroundColor: "#db2777" } }}>
                        New Sub-Gallery
                    </Button>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    Group photos from the master gallery into named collections.
                </Typography>

                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                        <CircularProgress sx={{ color: ACCENT }} />
                    </Box>
                ) : subGalleries.length === 0 ? (
                    <Typography sx={{ color: "text.secondary", py: 6, textAlign: "center" }}>
                        No sub-galleries yet. Create one to start organizing photos.
                    </Typography>
                ) : (
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2.5 }}>
                        {subGalleries.map(g => {
                            const cover = coverUrlFor(g.id);
                            return (
                                <Box key={g.id} sx={{
                                    backgroundColor: "background.paper",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                    borderRadius: 2, overflow: "hidden",
                                    transition: "box-shadow 0.15s",
                                    "&:hover": { boxShadow: `0 8px 24px ${ACCENT}26` },
                                }}>
                                    <Box component={Link} href={`/personal/gallery/galleries/${g.id}`}
                                        sx={{ display: "block", textDecoration: "none" }}>
                                        <Box sx={{
                                            aspectRatio: "16/9", backgroundColor: "rgba(0,0,0,0.2)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                        }}>
                                            {cover ? (
                                                <Box component="img" src={cover} alt=""
                                                    sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            ) : (
                                                <FolderOpen size={32} color="#6b7280" />
                                            )}
                                        </Box>
                                        <Box sx={{ p: 2 }}>
                                            <Typography sx={{ fontWeight: 700, color: "text.primary" }}>
                                                {g.name}
                                            </Typography>
                                            {g.description && (
                                                <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", mt: 0.5 }}>
                                                    {g.description}
                                                </Typography>
                                            )}
                                            <Typography sx={{ fontSize: "0.72rem", color: "text.disabled", mt: 1 }}>
                                                {countFor(g.id)} photo{countFor(g.id) === 1 ? "" : "s"}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Box sx={{ display: "flex", justifyContent: "flex-end", px: 1, pb: 1 }}>
                                        <Tooltip title="Delete sub-gallery">
                                            <IconButton size="small" color="error" onClick={() => setDeleteId(g.id)}>
                                                <Trash2 size={14} />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                )}

                <SubGalleryFormDialog open={formOpen} editing={null} onClose={() => setFormOpen(false)}
                    onSaved={reload} />

                <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
                    <DialogTitle>Delete Sub-Gallery?</DialogTitle>
                    <DialogContent>
                        <Typography>This removes the sub-gallery. Photos in it stay in the master gallery.</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={confirmDelete}>Delete</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
