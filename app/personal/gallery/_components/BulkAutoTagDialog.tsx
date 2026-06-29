"use client";

import { useRef, useState } from "react";
import {
    Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    LinearProgress, Typography,
} from "@mui/material";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import type { GalleryPhoto } from "../_lib/useGalleryData";

const client = generateClient<Schema>();
const CONCURRENCY = 3;

interface BulkAutoTagDialogProps {
    open: boolean;
    photos: GalleryPhoto[]; // full gallery list; only untagged ones are targeted
    onClose: () => void;
    onDone: () => void;
}

type Status = "running" | "done" | "error";

export function BulkAutoTagDialog({ open, photos, onClose, onDone }: BulkAutoTagDialogProps) {
    const [running, setRunning] = useState(false);
    const [statuses, setStatuses] = useState<Record<string, Status>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const cancelledRef = useRef(false);

    const targets = photos.filter(p => (p.tags ?? []).filter(Boolean).length === 0);
    const total = targets.length;
    const completed = Object.keys(statuses).length;
    const errorCount = Object.values(statuses).filter(s => s === "error").length;
    const started = completed > 0 || running;
    const distinctErrors = Array.from(new Set(Object.values(errors)));

    async function start() {
        setRunning(true);
        cancelledRef.current = false;
        setStatuses({});
        setErrors({});

        let cursor = 0;
        async function worker() {
            while (cursor < targets.length) {
                if (cancelledRef.current) return;
                const photo = targets[cursor++];
                setStatuses(prev => ({ ...prev, [photo.id]: "running" }));
                try {
                    const { data: suggested, errors: gqlErrors } = await client.queries.suggestPhotoTags({ storageKey: photo.storageKey });
                    if (gqlErrors?.length) {
                        setErrors(prev => ({ ...prev, [photo.id]: gqlErrors[0].message }));
                        setStatuses(prev => ({ ...prev, [photo.id]: "error" }));
                        continue;
                    }
                    const valid = (suggested ?? []).filter((t): t is string => !!t);
                    await client.models.GalleryPhoto.update({ id: photo.id, tags: valid });
                    setStatuses(prev => ({ ...prev, [photo.id]: "done" }));
                } catch (e) {
                    setErrors(prev => ({ ...prev, [photo.id]: e instanceof Error ? e.message : "Failed to tag this photo." }));
                    setStatuses(prev => ({ ...prev, [photo.id]: "error" }));
                }
            }
        }

        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
        setRunning(false);
        onDone();
    }

    function handleClose() {
        cancelledRef.current = true;
        setRunning(false);
        onClose();
    }

    return (
        <Dialog open={open} onClose={running ? undefined : handleClose} fullWidth maxWidth="xs">
            <DialogTitle>Bulk Auto-tag</DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
                {!started ? (
                    <Typography sx={{ color: "text.secondary" }}>
                        {total === 0
                            ? "Every photo already has tags."
                            : `${total} untagged photo${total === 1 ? "" : "s"} will be sent to Claude for tagging, ${Math.min(CONCURRENCY, total)} at a time. Already-tagged photos are left alone.`}
                    </Typography>
                ) : (
                    <Box>
                        <LinearProgress variant="determinate" value={total ? (completed / total) * 100 : 100} />
                        <Typography sx={{ color: "text.secondary", fontSize: "0.85rem", mt: 1 }}>
                            {completed} / {total} processed{errorCount > 0 ? ` · ${errorCount} failed` : ""}
                            {!running && completed === total ? " · done" : ""}
                        </Typography>
                        {distinctErrors.length > 0 && (
                            <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
                                {distinctErrors.map((msg, i) => (
                                    <Typography key={i} sx={{ color: "error.main", fontSize: "0.75rem" }}>
                                        {msg}
                                    </Typography>
                                ))}
                            </Box>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{running ? "Cancel" : "Close"}</Button>
                {!started && total > 0 && (
                    <Button variant="contained" onClick={start}>Start</Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
