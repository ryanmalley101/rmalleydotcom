"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Box, Container, Typography, Button, TextField,
    MenuItem, Select, FormControl, InputLabel, CircularProgress, Divider, IconButton,
    Autocomplete, Switch, FormControlLabel,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, BookOpen, Upload, X, ImagePlus } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import { uploadData, getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import { useWikiLinkInsert } from "../useWikiLinkInsert";
import { useFileDrop } from "@/lib/useFileDrop";
import { ARTICLE_TYPES, DEFAULT_ARTICLE_TYPE } from "@/lib/wikiArticleTypes";

const client = generateClient<Schema>();

const STATUS_OPTIONS = ["published", "draft", "stub"] as const;
type ArticleStatus = typeof STATUS_OPTIONS[number];
const STATUS_COLOR: Record<ArticleStatus, string> = { published: "#2e7d32", draft: "#f57c00", stub: "#546e7a" };
const STATUS_LABEL: Record<ArticleStatus, string> = { published: "Published", draft: "Draft", stub: "Stub" };

export default function NewArticlePage() {
    const { worldId } = useParams<{ worldId: string }>();
    const router = useRouter();

    const [title, setTitle]             = useState("");
    const [articleType, setArticleType] = useState(DEFAULT_ARTICLE_TYPE);
    const [status, setStatus]           = useState<ArticleStatus>("published");
    const [visibleToPlayers, setVisibleToPlayers] = useState(true);
    const [excerpt, setExcerpt]         = useState("");
    const [coverImageUrl, setCover]     = useState("");
    const [coverPreview, setCoverPreview] = useState("");
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [parentTitle, setParentTitle] = useState("");
    const [content, setContent]         = useState("");
    const [saving, setSaving]           = useState(false);
    const [articleTitles, setArticleTitles] = useState<string[]>([]);
    const [galleryFiles, setGalleryFiles]       = useState<File[]>([]);
    const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        client.models.WikiArticle.list().then(({ data }) => {
            setArticleTitles((data ?? []).filter(a => a.worldId === worldId)
                .map(a => a.title).sort());
        });
    }, [worldId]);

    const { textareaRef: linkTextareaRef, handleKeyDown: handleLinkKeyDown, dialog: linkDialog } =
        useWikiLinkInsert({ content, setContent, articleTitles });

    function setCoverFile(file: File) {
        setPendingFile(file);
        setCoverPreview(URL.createObjectURL(file));
        setCover("");
    }
    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) setCoverFile(file);
    }
    const coverDrop = useFileDrop(files => { if (files[0]) setCoverFile(files[0]); });

    function addGalleryFiles(files: File[]) {
        setGalleryFiles(prev => [...prev, ...files]);
        setGalleryPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    }
    function handleGalleryFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        if (files.length) addGalleryFiles(files);
        e.target.value = "";
    }
    function removeGalleryFile(index: number) {
        setGalleryFiles(prev => prev.filter((_, i) => i !== index));
        setGalleryPreviews(prev => prev.filter((_, i) => i !== index));
    }
    const galleryDrop = useFileDrop(addGalleryFiles);

    async function save() {
        if (!title.trim()) return;
        setSaving(true);
        const { data } = await client.models.WikiArticle.create({
            worldId,
            title:         title.trim(),
            articleType,
            status,
            visibleToPlayers,
            excerpt:       excerpt.trim() || undefined,
            coverImageUrl: coverImageUrl.trim() || undefined,
            parentTitle:   parentTitle.trim() || undefined,
            content,
        });
        // Upload cover image if a file was selected
        if (data && pendingFile) {
            const ext = pendingFile.name.split(".").pop() ?? "jpg";
            const key = `wiki-covers/${worldId}/${data.id}.${ext}`;
            try {
                await uploadData({ path: key, data: pendingFile, options: { contentType: pendingFile.type } }).result;
                await client.models.WikiArticle.update({ id: data.id, coverImageKey: key, coverImageUrl: undefined });
            } catch { /* cover upload failed — article still created */ }
        }
        // Upload any staged gallery images
        if (data && galleryFiles.length) {
            const keys: string[] = [];
            for (let i = 0; i < galleryFiles.length; i++) {
                const file = galleryFiles[i];
                const ext = file.name.split(".").pop() ?? "jpg";
                const key = `wiki-gallery/${worldId}/${data.id}/${Date.now()}-${i}.${ext}`;
                try {
                    await uploadData({ path: key, data: file, options: { contentType: file.type } }).result;
                    keys.push(key);
                } catch { /* skip failed upload */ }
            }
            if (keys.length) await client.models.WikiArticle.update({ id: data.id, galleryImageKeys: keys });
        }
        setSaving(false);
        if (data) router.push(`/tabletop/worlds/${worldId}/wiki/${data.id}`);
    }

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/worlds/${worldId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back to World
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                    <BookOpen size={28} color="#8C5A3A" />
                    <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        New Article
                    </Typography>
                </Box>

                <Divider sx={{ mb: 4 }} />

                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <TextField
                        label="Title" required fullWidth
                        value={title} onChange={e => setTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) save(); }}
                    />

                    <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                        <FormControl sx={{ minWidth: 160 }}>
                            <InputLabel>Article Type</InputLabel>
                            <Select label="Article Type" value={articleType}
                                onChange={e => setArticleType(e.target.value)}>
                                {ARTICLE_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl sx={{ minWidth: 140 }}>
                            <InputLabel>Status</InputLabel>
                            <Select label="Status" value={status}
                                onChange={e => setStatus(e.target.value as ArticleStatus)}>
                                {STATUS_OPTIONS.map(s => (
                                    <MenuItem key={s} value={s}>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                            <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: STATUS_COLOR[s] }} />
                                            {STATUS_LABEL[s]}
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControlLabel sx={{ ml: 0.5 }}
                            control={<Switch checked={visibleToPlayers} onChange={e => setVisibleToPlayers(e.target.checked)} />}
                            label={<Typography variant="body2">Visible to players</Typography>} />
                    </Box>

                    <TextField label="Excerpt" fullWidth multiline minRows={2}
                        placeholder="Short one-paragraph summary shown in article lists."
                        value={excerpt} onChange={e => setExcerpt(e.target.value)} />

                    {/* Cover image */}
                    <Box>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.75 }}>
                            Cover Image
                        </Typography>
                        <Box {...coverDrop.dropHandlers}
                            sx={{
                                display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap",
                                p: 1.5, border: "2px dashed",
                                borderColor: coverDrop.isDragging ? "primary.main" : "divider",
                                borderRadius: 2,
                                backgroundColor: coverDrop.isDragging ? "rgba(154,52,18,0.06)" : "transparent",
                                transition: "border-color 0.15s, background-color 0.15s",
                            }}>
                            {coverPreview && (
                                <Box sx={{ position: "relative" }}>
                                    <Box component="img" src={coverPreview} alt="Cover preview"
                                        sx={{ width: 80, height: 52, objectFit: "cover", borderRadius: 1, display: "block" }} />
                                    <IconButton size="small"
                                        onClick={() => { setPendingFile(null); setCoverPreview(""); setCover(""); }}
                                        sx={{ position: "absolute", top: -6, right: -6, p: 0.25,
                                            backgroundColor: "error.main", color: "#fff",
                                            "&:hover": { backgroundColor: "error.dark" }, width: 18, height: 18 }}>
                                        <X size={10} />
                                    </IconButton>
                                </Box>
                            )}
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, flex: 1, minWidth: 200 }}>
                                <Button size="small" variant="outlined" startIcon={<Upload size={14} />}
                                    onClick={() => coverInputRef.current?.click()}
                                    sx={{ alignSelf: "flex-start", borderColor: "primary.main", color: "primary.main", fontSize: "0.75rem" }}>
                                    Upload image
                                </Button>
                                <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={handleFileSelect} />
                                <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.7rem" }}>
                                    or drag and drop an image
                                </Typography>
                                {!pendingFile && (
                                    <TextField size="small" label="Or paste URL" fullWidth
                                        placeholder="https://…"
                                        value={coverImageUrl}
                                        onChange={e => { setCover(e.target.value); setCoverPreview(e.target.value); }}
                                        sx={{ "& input": { fontSize: "0.8rem" } }} />
                                )}
                            </Box>
                        </Box>
                    </Box>

                    {/* Gallery — supplemental images */}
                    <Box>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.75 }}>
                            Gallery
                        </Typography>
                        <Box {...galleryDrop.dropHandlers}
                            sx={{
                                display: "flex", flexWrap: "wrap", gap: 1.5, p: 1.5,
                                border: "2px dashed",
                                borderColor: galleryDrop.isDragging ? "primary.main" : "divider",
                                borderRadius: 2,
                                backgroundColor: galleryDrop.isDragging ? "rgba(154,52,18,0.06)" : "transparent",
                                transition: "border-color 0.15s, background-color 0.15s",
                            }}>
                            {galleryPreviews.map((src, i) => (
                                <Box key={i} sx={{ position: "relative" }}>
                                    <Box component="img" src={src} alt=""
                                        sx={{ width: 72, height: 72, objectFit: "cover", borderRadius: 1, display: "block" }} />
                                    <IconButton size="small" onClick={() => removeGalleryFile(i)}
                                        sx={{ position: "absolute", top: -6, right: -6, p: 0.25,
                                            backgroundColor: "error.main", color: "#fff",
                                            "&:hover": { backgroundColor: "error.dark" }, width: 18, height: 18 }}>
                                        <X size={10} />
                                    </IconButton>
                                </Box>
                            ))}
                            <Box onClick={() => galleryInputRef.current?.click()}
                                sx={{
                                    width: 72, height: 72, display: "flex", flexDirection: "column",
                                    alignItems: "center", justifyContent: "center", gap: 0.5,
                                    border: "1px dashed", borderColor: "primary.light", borderRadius: 1,
                                    cursor: "pointer", color: "primary.main",
                                    "&:hover": { backgroundColor: "rgba(154,52,18,0.04)" },
                                }}>
                                <ImagePlus size={18} />
                                <Typography sx={{ fontSize: "0.6rem" }}>Add</Typography>
                            </Box>
                            <input ref={galleryInputRef} type="file" accept="image/*" multiple hidden
                                onChange={handleGalleryFileSelect} />
                        </Box>
                        <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.7rem", display: "block", mt: 0.5 }}>
                            Supplemental images — alternate forms, reference art, etc. Drag and drop or click Add.
                        </Typography>
                    </Box>

                    <Autocomplete
                        freeSolo
                        fullWidth
                        options={articleTitles}
                        inputValue={parentTitle}
                        onInputChange={(_, newValue) => setParentTitle(newValue)}
                        renderInput={params => (
                            <TextField {...params} label="Parent Article"
                                placeholder="Search for an article…" />
                        )}
                    />

                    <TextField
                        label="Content" multiline minRows={16} fullWidth
                        placeholder={"Write your article here. Use [[Article Title]] to link, or select text and press Ctrl+K."}
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        inputRef={linkTextareaRef} onKeyDown={handleLinkKeyDown}
                        sx={{ "& textarea": { fontFamily: "monospace", fontSize: "0.9rem" } }}
                    />

                    <Typography variant="caption" sx={{ color: "text.disabled" }}>
                        Tip: Write <strong>[[Article Title]]</strong> anywhere in your content to create a clickable link, or select text and press <strong>Ctrl+K</strong> to search for an article.
                    </Typography>

                    <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                        <Button component={Link} href={`/tabletop/worlds/${worldId}`}>Cancel</Button>
                        <Button variant="contained" onClick={save} disabled={saving || !title.trim()}
                            sx={{ backgroundColor: "primary.main" }}>
                            {saving ? <CircularProgress size={18} /> : "Create Article"}
                        </Button>
                    </Box>
                </Box>

                {linkDialog}
            </Container>
        </Box>
    );
}
