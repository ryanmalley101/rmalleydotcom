"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    Box, Button, Chip, CircularProgress, Divider, IconButton,
    TextField, Tooltip, Typography,
} from "@mui/material";
import { BookOpen, CalendarCheck, Trash2, X } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { MarkdownContent } from "@/lib/MarkdownContent";
import { WikiSearchPin } from "../../_dashboard-shared/WikiSearchPin";
import { type CalendarConfig, dayToDate, formatDate } from "../_lib/calendarMath";

const client = generateClient<Schema>();
type DailyNote = Schema["DailyNote"]["type"];

interface DayNotePanelProps {
    dayNumber: number;
    config: CalendarConfig;
    campaignId: string;
    worldIds: string[];
    note: DailyNote | null;
    isGM: boolean;
    currentDay?: number | null;
    onClose: () => void;
    onNoteChanged: () => void;
    onAdvanceToday?: (dayNumber: number) => void;
}

export function DayNotePanel({
    dayNumber, config, campaignId, worldIds, note, isGM,
    currentDay, onClose, onNoteChanged, onAdvanceToday,
}: DayNotePanelProps) {
    const [title, setTitle]   = useState("");
    const [notes, setNotes]   = useState("");
    const [articleIds, setArticleIds] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setTitle(note?.title ?? "");
        setNotes(note?.notes ?? "");
        setArticleIds((note?.articleIds ?? []).filter((id): id is string => !!id));
    }, [note, dayNumber]);

    const persist = useCallback(async (t: string, n: string, ids: string[]) => {
        setSaving(true);
        try {
            const payload = {
                campaignId, dayNumber,
                title: t.trim() || undefined,
                notes: n || undefined,
                articleIds: ids,
            };
            if (note) {
                await client.models.DailyNote.update({ id: note.id, ...payload });
            } else if (t.trim() || n || ids.length > 0) {
                await client.models.DailyNote.create(payload);
            }
            onNoteChanged();
        } finally {
            setSaving(false);
        }
    }, [note, campaignId, dayNumber, onNoteChanged]);

    function scheduleAutosave(t: string, n: string, ids: string[]) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => persist(t, n, ids), 800);
    }

    function handleTitleChange(v: string) {
        setTitle(v);
        scheduleAutosave(v, notes, articleIds);
    }
    function handleNotesChange(v: string) {
        setNotes(v);
        scheduleAutosave(title, v, articleIds);
    }
    function toggleArticle(id: string) {
        setArticleIds(prev => {
            const next = prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id];
            scheduleAutosave(title, notes, next);
            return next;
        });
    }

    async function deleteNote() {
        if (!note) return;
        setDeleting(true);
        await client.models.DailyNote.delete({ id: note.id });
        setDeleting(false);
        onNoteChanged();
        onClose();
    }

    const displayDate = dayToDate(dayNumber, config);
    const isToday = dayNumber === currentDay;

    return (
        <Box sx={{
            border: "1px solid rgba(201,168,124,0.3)",
            borderRadius: 2,
            p: 2,
            backgroundColor: "rgba(201,168,124,0.05)",
            display: "flex", flexDirection: "column", gap: 1.5,
        }}>
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                <Box>
                    <Typography sx={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: "0.95rem" }}>
                        {formatDate(displayDate, config, false)}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
                        <Chip label={`Day ${dayNumber}`} size="small"
                            sx={{ height: 18, fontSize: "0.62rem", backgroundColor: "rgba(201,168,124,0.2)" }} />
                        {isToday && (
                            <Chip label="Today" size="small" color="warning"
                                sx={{ height: 18, fontSize: "0.62rem" }} />
                        )}
                        {saving && <CircularProgress size={10} />}
                    </Box>
                </Box>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                    {isGM && !isToday && onAdvanceToday && (
                        <Tooltip title="Set as campaign's current day">
                            <IconButton size="small" onClick={() => onAdvanceToday(dayNumber)}>
                                <CalendarCheck size={14} />
                            </IconButton>
                        </Tooltip>
                    )}
                    <IconButton size="small" onClick={onClose}>
                        <X size={14} />
                    </IconButton>
                </Box>
            </Box>

            {isGM ? (
                <>
                    <TextField size="small" fullWidth placeholder="Title (optional)"
                        value={title} onChange={e => handleTitleChange(e.target.value)} />
                    <TextField multiline fullWidth minRows={4} placeholder="What happened today…"
                        value={notes} onChange={e => handleNotesChange(e.target.value)}
                        sx={{ "& .MuiInputBase-root": { fontFamily: "Georgia, serif", fontSize: "0.88rem" } }} />

                    {worldIds.length > 0 && (
                        <>
                            <Divider />
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: -0.5 }}>
                                <BookOpen size={13} color="#92400e" />
                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                    Linked Articles
                                </Typography>
                            </Box>
                            <WikiSearchPin
                                worldIds={worldIds}
                                pinnedIds={articleIds}
                                onTogglePin={toggleArticle}
                            />
                        </>
                    )}

                    {note && (
                        <Button size="small" color="error" startIcon={<Trash2 size={13} />}
                            onClick={deleteNote} disabled={deleting} sx={{ alignSelf: "flex-start" }}>
                            {deleting ? "Deleting…" : "Delete note"}
                        </Button>
                    )}
                </>
            ) : (
                // Read-only player view
                <>
                    {note?.title && (
                        <Typography sx={{ fontWeight: 600 }}>{note.title}</Typography>
                    )}
                    {note?.notes ? (
                        <MarkdownContent>{note.notes}</MarkdownContent>
                    ) : (
                        <Typography variant="body2" sx={{ color: "text.disabled", fontStyle: "italic" }}>
                            No notes for this day.
                        </Typography>
                    )}
                </>
            )}
        </Box>
    );
}
