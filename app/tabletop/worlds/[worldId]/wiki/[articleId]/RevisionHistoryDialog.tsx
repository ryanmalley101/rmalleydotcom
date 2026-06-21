"use client";

import { useState, useEffect } from "react";
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, CircularProgress,
} from "@mui/material";
import { RotateCcw } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { snapshotRevision } from "@/lib/wikiRevisions";

const client = generateClient<Schema>();
type Revision = Schema["WikiArticleRevision"]["type"];
type Article = Schema["WikiArticle"]["type"];

interface RevisionHistoryDialogProps {
    open: boolean;
    onClose: () => void;
    article: Article;
    onRestored: () => void;
}

export function RevisionHistoryDialog({ open, onClose, article, onRestored }: RevisionHistoryDialogProps) {
    const [revisions, setRevisions] = useState<Revision[]>([]);
    const [loading, setLoading] = useState(true);
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [confirmId, setConfirmId] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setConfirmId(null);
        client.models.WikiArticleRevision.list({ filter: { articleId: { eq: article.id } } }).then(({ data }) => {
            const sorted = (data ?? []).sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));
            setRevisions(sorted);
            setLoading(false);
        });
    }, [open, article.id]);

    async function restore(rev: Revision) {
        setRestoringId(rev.id);
        // Force-snapshot the current state first so restoring is itself undoable.
        await snapshotRevision(article, true);
        await client.models.WikiArticle.update({
            id: article.id,
            title: rev.title ?? article.title,
            content: rev.content ?? "",
            excerpt: rev.excerpt ?? undefined,
        });
        setRestoringId(null);
        onRestored();
        onClose();
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Revision History</DialogTitle>
            <DialogContent>
                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                        <CircularProgress size={24} sx={{ color: "primary.main" }} />
                    </Box>
                ) : revisions.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "text.disabled" }}>
                        No earlier versions saved yet. A snapshot is kept automatically each time you save, at most once every 5 minutes.
                    </Typography>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                        {revisions.map(rev => (
                            <Box key={rev.id} sx={{ borderLeft: "3px solid", borderColor: "divider", pl: 1.5, py: 0.5 }}>
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                        {rev.savedAt ? new Date(rev.savedAt).toLocaleString() : "Unknown time"}
                                        {rev.title && rev.title !== article.title && ` — "${rev.title}"`}
                                    </Typography>
                                    {confirmId === rev.id ? (
                                        <Box sx={{ display: "flex", gap: 0.5 }}>
                                            <Button size="small" onClick={() => setConfirmId(null)} sx={{ fontSize: "0.65rem" }}>
                                                Cancel
                                            </Button>
                                            <Button size="small" color="error" variant="contained" onClick={() => restore(rev)}
                                                disabled={restoringId === rev.id} sx={{ fontSize: "0.65rem" }}>
                                                {restoringId === rev.id ? <CircularProgress size={12} /> : "Confirm restore"}
                                            </Button>
                                        </Box>
                                    ) : (
                                        <Button size="small" startIcon={<RotateCcw size={12} />} onClick={() => setConfirmId(rev.id)}
                                            sx={{ fontSize: "0.65rem" }}>
                                            Restore
                                        </Button>
                                    )}
                                </Box>
                                <Typography variant="body2" sx={{
                                    color: "text.primary", mt: 0.5,
                                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                                }}>
                                    {(rev.content ?? "").slice(0, 240) || <em>No content</em>}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
