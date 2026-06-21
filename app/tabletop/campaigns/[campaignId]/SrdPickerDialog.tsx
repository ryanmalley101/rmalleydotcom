"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Box, Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Typography, CircularProgress, InputAdornment,
} from "@mui/material";
import { Search } from "lucide-react";

interface SrdPickerDialogProps<T> {
    open: boolean;
    onClose: () => void;
    title: string;
    placeholder?: string;
    load: () => Promise<T[]>;
    getId: (item: T) => string;
    getName: (item: T) => string;
    getMeta?: (item: T) => string;
    getDescription?: (item: T) => string;
    filter: (items: T[], query: string) => T[];
    onSelect: (item: T) => void;
}

export function SrdPickerDialog<T>({
    open, onClose, title, placeholder, load,
    getId, getName, getMeta, getDescription, filter, onSelect,
}: SrdPickerDialogProps<T>) {
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState("");

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        load().then(data => { setItems(data); setLoading(false); });
    }, [open, load]);

    useEffect(() => { if (!open) setQuery(""); }, [open]);

    const results = useMemo(() => filter(items, query), [items, query, filter]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <TextField
                    size="small" autoFocus fullWidth value={query}
                    placeholder={placeholder ?? "Search the SRD…"}
                    onChange={e => setQuery(e.target.value)}
                    InputProps={{ startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment> }}
                />
                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : (
                    <Box sx={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0.5 }}>
                        {results.map(item => (
                            <Box key={getId(item)} onClick={() => onSelect(item)}
                                sx={{ px: 1.5, py: 1, borderRadius: 1, cursor: "pointer",
                                    border: "1px solid", borderColor: "divider",
                                    "&:hover": { backgroundColor: "action.hover", borderColor: "primary.main" } }}>
                                <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>
                                        {getName(item)}
                                    </Typography>
                                    {getMeta && (
                                        <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                                            {getMeta(item)}
                                        </Typography>
                                    )}
                                </Box>
                                {getDescription && getDescription(item) && (
                                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block",
                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {getDescription(item)}
                                    </Typography>
                                )}
                            </Box>
                        ))}
                        {results.length === 0 && (
                            <Typography variant="body2" sx={{ color: "text.disabled", textAlign: "center", py: 3 }}>
                                No matches found
                            </Typography>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
