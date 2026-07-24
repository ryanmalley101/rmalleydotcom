"use client";

import { useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Dialog, IconButton, Tooltip, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight, ImagePlus, Trash2, X } from "lucide-react";
import { uploadData, getUrl } from "aws-amplify/storage";
import { useFileDrop } from "@/lib/useFileDrop";

// Generic image-attachment component. Handles upload, thumbnail grid, full-size
// preview, and removal. S3 objects are not hard-deleted on remove — the key is
// just dropped from the array passed to onKeysChange, consistent with the wiki
// gallery pattern elsewhere in this app.

interface NoteImagesProps {
    imageKeys: string[];           // current S3 keys stored on the record
    storagePath: string;           // prefix for new uploads, e.g. "session-notes/abc123"
    onKeysChange: (keys: string[]) => void; // called with updated array after upload or remove
    readonly?: boolean;            // hides upload controls when true
}

export function NoteImages({ imageKeys, storagePath, onKeysChange, readonly = false }: NoteImagesProps) {
    const [urls, setUrls]             = useState<Record<string, string>>({});
    const [uploading, setUploading]   = useState(false);
    const [lightboxKey, setLightboxKey] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Resolve signed URLs for any key that doesn't have one yet.
    useEffect(() => {
        const unresolved = imageKeys.filter(k => k && !urls[k]);
        if (!unresolved.length) return;
        Promise.all(unresolved.map(async key => {
            try {
                const { url } = await getUrl({ path: key, options: { expiresIn: 3600 } });
                return [key, url.toString()] as const;
            } catch { return null; }
        })).then(results => {
            const newUrls: Record<string, string> = {};
            for (const r of results) { if (r) newUrls[r[0]] = r[1]; }
            setUrls(prev => ({ ...prev, ...newUrls }));
        });
    }, [imageKeys]); // eslint-disable-line react-hooks/exhaustive-deps

    async function uploadFiles(files: File[]) {
        setUploading(true);
        const newKeys: string[] = [];
        const newUrls: Record<string, string> = {};
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const ext = file.name.split(".").pop() ?? "jpg";
            const key = `${storagePath}/${Date.now()}-${i}.${ext}`;
            try {
                await uploadData({ path: key, data: file, options: { contentType: file.type } }).result;
                const { url } = await getUrl({ path: key, options: { expiresIn: 3600 } });
                newKeys.push(key);
                newUrls[key] = url.toString();
            } catch { /* skip failed */ }
        }
        setUrls(prev => ({ ...prev, ...newUrls }));
        onKeysChange([...imageKeys, ...newKeys]);
        setUploading(false);
    }

    const fileDrop = useFileDrop(uploadFiles);

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        if (files.length) uploadFiles(files);
        e.target.value = "";
    }

    function removeKey(key: string) {
        onKeysChange(imageKeys.filter(k => k !== key));
        setLightboxKey(null);
    }

    const validKeys = imageKeys.filter(Boolean);
    const lightboxIndex = lightboxKey ? validKeys.indexOf(lightboxKey) : -1;

    return (
        <>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
                {/* Existing image thumbnails */}
                {validKeys.map(key => (
                    <Box key={key} sx={{
                        position: "relative", width: 88, height: 88,
                        borderRadius: 1.5, overflow: "hidden",
                        border: "1px solid", borderColor: "divider",
                        cursor: "pointer", flexShrink: 0,
                        "&:hover .img-del": { opacity: 1 },
                    }}
                        onClick={() => setLightboxKey(key)}>
                        {urls[key] ? (
                            <Box component="img" src={urls[key]} alt=""
                                sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        ) : (
                            <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <CircularProgress size={16} />
                            </Box>
                        )}
                        {!readonly && (
                            <Tooltip title="Remove">
                                <IconButton size="small" className="img-del"
                                    onClick={e => { e.stopPropagation(); removeKey(key); }}
                                    sx={{
                                        position: "absolute", top: 2, right: 2,
                                        opacity: 0, transition: "opacity 0.15s",
                                        backgroundColor: "rgba(0,0,0,0.55)",
                                        color: "#fff", p: 0.5,
                                        "&:hover": { backgroundColor: "rgba(220,38,38,0.8)" },
                                    }}>
                                    <Trash2 size={12} />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                ))}

                {/* Upload cell */}
                {!readonly && (
                    <Box {...fileDrop.dropHandlers}
                        onClick={() => inputRef.current?.click()}
                        sx={{
                            width: 88, height: 88, flexShrink: 0,
                            borderRadius: 1.5, border: "1.5px dashed",
                            borderColor: fileDrop.isDragging ? "primary.main" : "divider",
                            backgroundColor: fileDrop.isDragging ? "rgba(146,64,14,0.06)" : "transparent",
                            display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            gap: 0.5, cursor: "pointer",
                            transition: "border-color 0.15s, background-color 0.15s",
                            color: "text.disabled",
                            "&:hover": { borderColor: "primary.light", color: "primary.main" },
                        }}>
                        {uploading ? <CircularProgress size={18} /> : <ImagePlus size={18} />}
                        <Typography sx={{ fontSize: "0.6rem" }}>
                            {uploading ? "Uploading…" : "Add image"}
                        </Typography>
                        <input ref={inputRef} type="file" accept="image/*" multiple hidden
                            onChange={handleFileSelect} />
                    </Box>
                )}
            </Box>

            {/* Full-size lightbox */}
            <Dialog open={lightboxKey !== null} onClose={() => setLightboxKey(null)}
                maxWidth="lg"
                PaperProps={{ sx: { backgroundColor: "rgba(0,0,0,0.9)", boxShadow: "none", m: 1 } }}>
                <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IconButton onClick={() => setLightboxKey(null)}
                        sx={{ position: "absolute", top: 6, right: 6, color: "#fff",
                            backgroundColor: "rgba(0,0,0,0.4)", zIndex: 1,
                            "&:hover": { backgroundColor: "rgba(0,0,0,0.7)" } }}>
                        <X size={18} />
                    </IconButton>
                    {validKeys.length > 1 && (
                        <IconButton onClick={() => {
                            const i = (lightboxIndex - 1 + validKeys.length) % validKeys.length;
                            setLightboxKey(validKeys[i]);
                        }} sx={{ position: "absolute", left: 6, color: "#fff",
                            backgroundColor: "rgba(0,0,0,0.4)",
                            "&:hover": { backgroundColor: "rgba(0,0,0,0.7)" } }}>
                            <ChevronLeft size={22} />
                        </IconButton>
                    )}
                    {lightboxKey && urls[lightboxKey] && (
                        <Box component="img" src={urls[lightboxKey]} alt=""
                            sx={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", display: "block" }} />
                    )}
                    {validKeys.length > 1 && (
                        <IconButton onClick={() => {
                            const i = (lightboxIndex + 1) % validKeys.length;
                            setLightboxKey(validKeys[i]);
                        }} sx={{ position: "absolute", right: 6, color: "#fff",
                            backgroundColor: "rgba(0,0,0,0.4)",
                            "&:hover": { backgroundColor: "rgba(0,0,0,0.7)" } }}>
                            <ChevronRight size={22} />
                        </IconButton>
                    )}
                    {!readonly && lightboxKey && (
                        <Tooltip title="Remove attachment">
                            <IconButton onClick={() => removeKey(lightboxKey)}
                                sx={{ position: "absolute", top: 6, right: 48, color: "#fff",
                                    backgroundColor: "rgba(0,0,0,0.4)",
                                    "&:hover": { backgroundColor: "rgba(220,38,38,0.7)" } }}>
                                <Trash2 size={16} />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            </Dialog>
        </>
    );
}
