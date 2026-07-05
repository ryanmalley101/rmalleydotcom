"use client";

import { useEffect, useState } from "react";
import {
    Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
    DialogTitle, Divider, IconButton, TextField, Typography,
} from "@mui/material";
import { Plus, Trash2 } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { DEFAULT_CONFIG, type CalendarMonth } from "../_lib/calendarMath";

const client = generateClient<Schema>();
type CampaignCalendar = Schema["CampaignCalendar"]["type"];

interface CalendarConfigDialogProps {
    open: boolean;
    existing: CampaignCalendar | null;
    campaignId: string;
    onClose: () => void;
    onSaved: () => void;
}

export function CalendarConfigDialog({
    open, existing, campaignId, onClose, onSaved,
}: CalendarConfigDialogProps) {
    const [months, setMonths]           = useState<CalendarMonth[]>([]);
    const [weekdays, setWeekdays]       = useState<string[]>([]);
    const [epochName, setEpochName]     = useState("");
    const [currentDay, setCurrentDay]   = useState<string>("");
    const [saving, setSaving]           = useState(false);

    useEffect(() => {
        if (!open) return;
        if (existing) {
            try { setMonths(existing.monthsJson ? JSON.parse(existing.monthsJson) : DEFAULT_CONFIG.months); } catch { setMonths(DEFAULT_CONFIG.months); }
            try { setWeekdays(existing.weekdayNamesJson ? JSON.parse(existing.weekdayNamesJson) : DEFAULT_CONFIG.weekdayNames); } catch { setWeekdays(DEFAULT_CONFIG.weekdayNames); }
            setEpochName(existing.epochName ?? "");
            setCurrentDay(existing.currentDay != null ? String(existing.currentDay) : "");
        } else {
            setMonths(DEFAULT_CONFIG.months.map(m => ({ ...m })));
            setWeekdays([...DEFAULT_CONFIG.weekdayNames]);
            setEpochName("");
            setCurrentDay("1");
        }
    }, [open, existing]);

    function updateMonth(i: number, field: "name" | "days", value: string) {
        setMonths(prev => prev.map((m, idx) =>
            idx === i ? { ...m, [field]: field === "days" ? (parseInt(value) || 1) : value } : m
        ));
    }
    function addMonth() { setMonths(prev => [...prev, { name: `Month ${prev.length + 1}`, days: 30 }]); }
    function removeMonth(i: number) { setMonths(prev => prev.filter((_, idx) => idx !== i)); }

    function setWeekdayCount(n: number) {
        setWeekdays(prev => {
            if (n <= 0) return [];
            const next = [...prev];
            while (next.length < n) next.push(`Day ${next.length + 1}`);
            return next.slice(0, n);
        });
    }
    function updateWeekday(i: number, value: string) {
        setWeekdays(prev => prev.map((d, idx) => idx === i ? value : d));
    }

    async function save() {
        if (months.length === 0 || weekdays.length === 0) return;
        setSaving(true);
        try {
            const payload = {
                campaignId,
                monthsJson: JSON.stringify(months),
                weekdayNamesJson: JSON.stringify(weekdays),
                epochName: epochName.trim() || undefined,
                currentDay: currentDay ? (parseInt(currentDay) || 1) : undefined,
            };
            if (existing) {
                await client.models.CampaignCalendar.update({ id: existing.id, ...payload });
            } else {
                await client.models.CampaignCalendar.create(payload);
            }
            onSaved();
            onClose();
        } finally {
            setSaving(false);
        }
    }

    const canSave = months.length > 0 && weekdays.length > 0;

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
            <DialogTitle sx={{ fontFamily: "'Cinzel', serif" }}>
                {existing ? "Edit Calendar" : "Configure Calendar"}
            </DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: "16px !important" }}>
                <Box sx={{ display: "flex", gap: 2 }}>
                    <TextField label="Epoch / Era Name" fullWidth
                        placeholder="e.g. Year of Rising"
                        value={epochName} onChange={e => setEpochName(e.target.value)} />
                    <TextField label="Current Day" type="number" sx={{ width: 140 }}
                        placeholder="1"
                        value={currentDay} onChange={e => setCurrentDay(e.target.value)}
                        inputProps={{ min: 1 }} />
                </Box>

                <Divider />

                {/* Days per week */}
                <Box>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                        <Typography variant="subtitle2">Days per week</Typography>
                        <TextField size="small" type="number" sx={{ width: 80 }}
                            value={weekdays.length}
                            onChange={e => setWeekdayCount(Math.max(1, Math.min(14, parseInt(e.target.value) || 1)))}
                            inputProps={{ min: 1, max: 14 }} />
                    </Box>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {weekdays.map((d, i) => (
                            <TextField key={i} size="small" label={`Day ${i + 1}`} sx={{ width: 120 }}
                                value={d} onChange={e => updateWeekday(i, e.target.value)} />
                        ))}
                    </Box>
                </Box>

                <Divider />

                {/* Months */}
                <Box>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                        <Typography variant="subtitle2">Months ({months.length})</Typography>
                        <Button size="small" startIcon={<Plus size={14} />} onClick={addMonth}>
                            Add Month
                        </Button>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, maxHeight: 280, overflowY: "auto" }}>
                        {months.map((m, i) => (
                            <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                <TextField size="small" label={`Month ${i + 1} name`} sx={{ flex: 1 }}
                                    value={m.name} onChange={e => updateMonth(i, "name", e.target.value)} />
                                <TextField size="small" label="Days" type="number" sx={{ width: 80 }}
                                    value={m.days} onChange={e => updateMonth(i, "days", e.target.value)}
                                    inputProps={{ min: 1, max: 999 }} />
                                <IconButton size="small" color="error" onClick={() => removeMonth(i)}>
                                    <Trash2 size={14} />
                                </IconButton>
                            </Box>
                        ))}
                    </Box>
                    {months.length > 0 && (
                        <Typography variant="caption" sx={{ color: "text.disabled", mt: 0.5, display: "block" }}>
                            {months.reduce((s, m) => s + m.days, 0)} days per year
                        </Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={save} disabled={saving || !canSave}
                    sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" } }}>
                    {saving ? <CircularProgress size={18} /> : existing ? "Save" : "Create Calendar"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
