"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";

interface UseWikiLinkInsertArgs {
    content: string;
    setContent: (value: string) => void;
    articleTitles: string[];
}

// Ctrl/Cmd+K while editing a content textarea: opens an article search dialog
// and wraps the current selection (or inserts at the cursor) as a [[Title]] link.
export function useWikiLinkInsert({ content, setContent, articleTitles }: UseWikiLinkInsertArgs) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const rangeRef = useRef({ start: 0, end: 0 });
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");

    function handleKeyDown(e: KeyboardEvent<HTMLElement>) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            const el = textareaRef.current;
            const start = el?.selectionStart ?? 0;
            const end = el?.selectionEnd ?? 0;
            rangeRef.current = { start, end };
            setQuery(content.slice(start, end));
            setOpen(true);
            return;
        }
        // Tab normally moves focus to the next element (e.g. the Cancel
        // button) instead of typing — intercept it so it inserts an actual
        // tab character, like a regular text editor.
        if (e.key === "Tab") {
            e.preventDefault();
            const el = textareaRef.current;
            const start = el?.selectionStart ?? 0;
            const end = el?.selectionEnd ?? 0;
            setContent(content.slice(0, start) + "\t" + content.slice(end));
            const pos = start + 1;
            setTimeout(() => {
                const ta = textareaRef.current;
                if (ta) { ta.focus(); ta.setSelectionRange(pos, pos); }
            }, 0);
        }
    }

    function insertLink(title: string) {
        const t = title.trim();
        if (!t) return;
        const { start, end } = rangeRef.current;
        const linkText = `[[${t}]]`;
        setContent(content.slice(0, start) + linkText + content.slice(end));
        setOpen(false);
        const pos = start + linkText.length;
        setTimeout(() => {
            const el = textareaRef.current;
            if (el) { el.focus(); el.setSelectionRange(pos, pos); }
        }, 0);
    }

    const dialog = (
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle>Link to Article</DialogTitle>
            <DialogContent sx={{ pt: "8px !important" }}>
                <Autocomplete
                    freeSolo
                    options={articleTitles}
                    inputValue={query}
                    onInputChange={(_, v) => setQuery(v)}
                    onChange={(_, v) => { if (v) insertLink(v); }}
                    renderInput={params => (
                        <TextField {...params} autoFocus label="Article title"
                            placeholder="Search for an article…" />
                    )}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="contained" onClick={() => insertLink(query)} disabled={!query.trim()}>
                    Insert Link
                </Button>
            </DialogActions>
        </Dialog>
    );

    return { textareaRef, handleKeyDown, dialog };
}
