"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
    Box, Button, Card, CardContent, Chip, CircularProgress, Container,
    Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, FormControlLabel, IconButton, Switch, TextField, Tooltip, Typography,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, BookOpen, Copy, Eye, EyeOff, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import { getUrl, remove, uploadData } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import { useCampaignRole } from "@/lib/useCampaignRole";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useFileDrop } from "@/lib/useFileDrop";
import { MarkdownContent } from "@/lib/MarkdownContent";

const client = generateClient<Schema>();
type Handout = Schema["Handout"]["type"];

interface HandoutForm {
    title: string;
    content: string;
    isPublic: boolean;
}
const EMPTY_FORM: HandoutForm = { title: "", content: "", isPublic: false };

function ImageGallery({ imageKeys, token, isEditing, onRemove }: {
    imageKeys: string[];
    token: string;
    isEditing: boolean;
    onRemove: (key: string) => void;
}) {
    const [urls, setUrls] = useState<Record<string, string>>({});

    useEffect(() => {
        const unresolved = imageKeys.filter(k => k && !urls[k]);
        if (!unresolved.length) return;
        Promise.all(unresolved.map(async key => {
            try {
                const { url } = await getUrl({ path: key, options: { expiresIn: 3600 } });
                return [key, url.toString()] as const;
            } catch { return null; }
        })).then(results => {
            const map: Record<string, string> = {};
            for (const r of results) { if (r) map[r[0]] = r[1]; }
            setUrls(prev => ({ ...prev, ...map }));
        });
    }, [imageKeys]); // eslint-disable-line react-hooks/exhaustive-deps

    if (imageKeys.length === 0) return null;
    return (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
            {imageKeys.map(key => (
                <Box key={key} sx={{ position: "relative", width: 90, height: 90, borderRadius: 1.5, overflow: "hidden",
                    border: "1px solid", borderColor: "divider", "&:hover .rmv": { opacity: isEditing ? 1 : 0 } }}>
                    {urls[key] ? (
                        <Box component="img" src={urls[key]} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <CircularProgress size={16} />
                    </Box>}
                    {isEditing && (
                        <IconButton size="small" className="rmv" onClick={() => onRemove(key)}
                            sx={{ position: "absolute", top: 2, right: 2, opacity: 0, transition: "opacity 0.15s",
                                backgroundColor: "rgba(0,0,0,0.55)", color: "#fff", p: 0.5,
                                "&:hover": { backgroundColor: "rgba(220,38,38,0.8)" } }}>
                            <Trash2 size={12} />
                        </IconButton>
                    )}
                </Box>
            ))}
        </Box>
    );
}

export default function HandoutsPage() {
    const { campaignId } = useParams<{ campaignId: string }>();
    const { isGm: isGM, loading: roleLoading } = useCampaignRole(campaignId);
    useDocumentTitle("Handouts");

    const [handouts, setHandouts] = useState<Handout[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Handout | null>(null);
    const [form, setForm] = useState<HandoutForm>(EMPTY_FORM);
    const [editingImages, setEditingImages] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Handout | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        if (!client.models.Handout) { setLoading(false); return; }
        setLoading(true);
        const { data } = await client.models.Handout.list();
        setHandouts((data ?? []).filter(h => h.campaignId === campaignId));
        setLoading(false);
    }, [campaignId]);

    useEffect(() => { load(); }, [load]);

    function openCreate() {
        setEditing(null);
        setForm(EMPTY_FORM);
        setEditingImages([]);
        setDialogOpen(true);
    }

    function openEdit(h: Handout) {
        setEditing(h);
        setForm({ title: h.title, content: h.content ?? "", isPublic: h.isPublic ?? false });
        setEditingImages((h.imageKeys ?? []).filter((k): k is string => !!k));
        setDialogOpen(true);
    }

    async function uploadImages(files: File[]) {
        const token = editing?.publicToken ?? crypto.randomUUID();
        setUploading(true);
        const newKeys: string[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const ext = file.name.split(".").pop() ?? "jpg";
            const key = `handouts/${token}/${Date.now()}-${i}.${ext}`;
            try {
                await uploadData({ path: key, data: file, options: { contentType: file.type } }).result;
                newKeys.push(key);
            } catch { /* skip */ }
        }
        setEditingImages(prev => [...prev, ...newKeys]);
        setUploading(false);
    }

    const fileDrop = useFileDrop(uploadImages);

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        if (files.length) uploadImages(files);
        e.target.value = "";
    }

    async function save() {
        if (!form.title.trim()) return;
        setSaving(true);
        try {
            const publicToken = editing?.publicToken ?? (form.isPublic ? crypto.randomUUID() : undefined);

            const payload = {
                campaignId,
                title: form.title.trim(),
                content: form.content || undefined,
                imageKeys: editingImages,
                publicToken,
                isPublic: form.isPublic,
            };

            let saved: Handout | null = null;
            if (editing) {
                const { data } = await client.models.Handout.update({ id: editing.id, ...payload });
                saved = data;
            } else {
                const { data } = await client.models.Handout.create(payload);
                saved = data;
            }

            // If published, write content.json to S3 for the public route
            if (form.isPublic && publicToken && saved) {
                const contentJson = JSON.stringify({
                    title: form.title.trim(),
                    content: form.content || "",
                    imageKeys: editingImages,
                });
                await uploadData({
                    path: `handouts/${publicToken}/content.json`,
                    data: contentJson,
                    options: { contentType: "application/json" },
                }).result;
            }

            // If unpublished and previously had a public token, remove the S3 content
            if (!form.isPublic && editing?.publicToken) {
                try { await remove({ path: `handouts/${editing.publicToken}/content.json` }); } catch {}
            }

            load();
            setDialogOpen(false);
        } finally {
            setSaving(false);
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        if (deleteTarget.publicToken) {
            try { await remove({ path: `handouts/${deleteTarget.publicToken}/content.json` }); } catch {}
        }
        await client.models.Handout.delete({ id: deleteTarget.id });
        setDeleteTarget(null);
        load();
    }

    async function copyLink(h: Handout) {
        if (!h.publicToken) return;
        await navigator.clipboard.writeText(`${window.location.origin}/handout/${h.publicToken}`);
        setCopiedId(h.id);
        setTimeout(() => setCopiedId(null), 2000);
    }

    const pageLoading = loading || roleLoading;

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <BookOpen size={32} color="#8C5A3A" />
                        <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>
                            Handouts
                        </Typography>
                    </Box>
                    {isGM && (
                        <Button variant="contained" startIcon={<Plus size={16} />} onClick={openCreate}
                            sx={{ backgroundColor: "primary.main" }}>
                            New Handout
                        </Button>
                    )}
                </Box>
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 4 }}>
                    Share maps, notes, and images with players — published handouts get a public link that anyone can view without logging in.
                </Typography>

                {pageLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
                ) : !client.models.Handout ? (
                    <Typography sx={{ color: "text.secondary", textAlign: "center", py: 8 }}>
                        Handouts feature needs a backend deploy.
                    </Typography>
                ) : handouts.length === 0 ? (
                    <Box sx={{ textAlign: "center", py: 8 }}>
                        <Typography sx={{ color: "text.secondary", mb: 2 }}>No handouts yet.</Typography>
                        {isGM && (
                            <Button variant="outlined" startIcon={<Plus size={16} />} onClick={openCreate}
                                sx={{ borderColor: "primary.main", color: "primary.main" }}>
                                Create First Handout
                            </Button>
                        )}
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {handouts.map(h => (
                            <Card key={h.id} sx={{ borderLeft: "4px solid", borderColor: h.isPublic ? "success.main" : "divider" }}>
                                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                                        <Box sx={{ flex: 1 }}>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                                                <Typography sx={{ fontWeight: 700, color: "primary.dark" }}>{h.title}</Typography>
                                                {h.isPublic ? (
                                                    <Chip label="Published" size="small" color="success"
                                                        sx={{ height: 18, fontSize: "0.62rem" }} />
                                                ) : (
                                                    <Chip label="Draft" size="small"
                                                        sx={{ height: 18, fontSize: "0.62rem" }} />
                                                )}
                                            </Box>
                                            {h.content && (
                                                <Box sx={{ maxHeight: 80, overflow: "hidden", position: "relative" }}>
                                                    <MarkdownContent dim sx={{ fontSize: "0.82rem" }}>
                                                        {h.content.slice(0, 200) + (h.content.length > 200 ? "…" : "")}
                                                    </MarkdownContent>
                                                </Box>
                                            )}
                                            <ImageGallery
                                                imageKeys={(h.imageKeys ?? []).filter((k): k is string => !!k)}
                                                token={h.publicToken ?? ""}
                                                isEditing={false}
                                                onRemove={() => {}}
                                            />
                                        </Box>
                                        <Box sx={{ display: "flex", flexShrink: 0, gap: 0.5 }}>
                                            {h.isPublic && h.publicToken && (
                                                <Tooltip title={copiedId === h.id ? "Copied!" : "Copy public link"}>
                                                    <IconButton size="small" onClick={() => copyLink(h)}>
                                                        <Copy size={14} />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {isGM && (
                                                <>
                                                    <Tooltip title="Edit">
                                                        <IconButton size="small" onClick={() => openEdit(h)}>
                                                            <Pencil size={14} />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Delete">
                                                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(h)}>
                                                            <Trash2 size={14} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </>
                                            )}
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        ))}
                    </Box>
                )}

                {/* Create / Edit dialog */}
                <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
                    <DialogTitle>{editing ? "Edit Handout" : "New Handout"}</DialogTitle>
                    <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
                        <TextField label="Title" required fullWidth autoFocus
                            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                        <TextField label="Content (Markdown)" fullWidth multiline rows={5}
                            placeholder="Write your handout text here. **Bold**, *italic*, lists, headers all work."
                            value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />

                        <Divider />
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>Images</Typography>
                        <Box {...fileDrop.dropHandlers} onClick={() => imageInputRef.current?.click()}
                            sx={{
                                border: "2px dashed", borderRadius: 1.5, p: 2, textAlign: "center",
                                borderColor: fileDrop.isDragging ? "primary.main" : "divider",
                                cursor: "pointer", transition: "border-color 0.15s",
                                "&:hover": { borderColor: "primary.light" },
                            }}>
                            <ImagePlus size={22} color="#92400e" style={{ marginBottom: 4 }} />
                            <Typography sx={{ fontSize: "0.8rem", color: "text.secondary" }}>
                                Drag & drop images or click to browse
                            </Typography>
                            {uploading && <CircularProgress size={16} sx={{ mt: 1 }} />}
                            <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={handleFileSelect} />
                        </Box>
                        {editingImages.length > 0 && (
                            <ImageGallery
                                imageKeys={editingImages}
                                token={editing?.publicToken ?? ""}
                                isEditing
                                onRemove={key => setEditingImages(prev => prev.filter(k => k !== key))}
                            />
                        )}

                        <Divider />
                        <FormControlLabel
                            control={<Switch checked={form.isPublic}
                                onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} />}
                            label={
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    {form.isPublic ? <Eye size={14} /> : <EyeOff size={14} />}
                                    <Typography sx={{ fontSize: "0.88rem" }}>
                                        {form.isPublic ? "Published — anyone with the link can view" : "Draft — not publicly visible"}
                                    </Typography>
                                </Box>
                            }
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button variant="contained" onClick={save} disabled={saving || !form.title.trim()}
                            sx={{ backgroundColor: "primary.main" }}>
                            {saving ? <CircularProgress size={18} /> : editing ? "Save" : "Create"}
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
                    <DialogTitle>Delete handout?</DialogTitle>
                    <DialogContent>
                        <Typography>
                            This permanently deletes &quot;{deleteTarget?.title}&quot;.
                            {deleteTarget?.isPublic && " The public link will stop working."}
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={confirmDelete}>Delete</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
