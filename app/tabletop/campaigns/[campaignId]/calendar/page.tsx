"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
    Box, Button, CircularProgress, Container, IconButton, Tooltip, Typography,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { useCampaignRole } from "@/lib/useCampaignRole";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import {
    parseCalendarConfig, prevMonthSafe, nextMonthSafe,
    dayToDate, dateToDayNumber, formatDate,
} from "./_lib/calendarMath";
import { CalendarGrid } from "./_components/CalendarGrid";
import { DayNotePanel } from "./_components/DayNotePanel";
import { CalendarConfigDialog } from "./_components/CalendarConfigDialog";

const client = generateClient<Schema>();
type Campaign        = Schema["Campaign"]["type"];
type CampaignCalendar = Schema["CampaignCalendar"]["type"];
type DailyNote       = Schema["DailyNote"]["type"];

export default function CalendarPage() {
    const { campaignId } = useParams<{ campaignId: string }>();
    const { isGm: isGM, loading: roleLoading } = useCampaignRole(campaignId);

    const [campaign, setCampaign]         = useState<Campaign | null>(null);
    useDocumentTitle(campaign ? `${campaign.name} — Calendar` : null);
    const [calendarRecord, setCalendarRecord] = useState<CampaignCalendar | null>(null);
    const [notes, setNotes]               = useState<DailyNote[]>([]);
    const [loading, setLoading]           = useState(true);
    const [configOpen, setConfigOpen]     = useState(false);
    const [selectedDay, setSelectedDay]   = useState<number | null>(null);

    // View state — which month/year the grid is showing
    const [viewYear, setViewYear]   = useState(1);
    const [viewMonth, setViewMonth] = useState(0);

    // Core data-fetch logic, shared by the initial load (with spinner) and
    // background refreshes after note saves (no spinner — avoids the flash).
    const fetchData = useCallback(async (showSpinner: boolean) => {
        if (showSpinner) setLoading(true);
        // CampaignCalendar and DailyNote were added recently — guard against
        // the models not being available if the sandbox hasn't been redeployed.
        if (!client.models.CampaignCalendar || !client.models.DailyNote) {
            const campaignRes = await client.models.Campaign.get({ id: campaignId });
            setCampaign(campaignRes.data);
            if (showSpinner) setLoading(false);
            return;
        }
        const [campaignRes, calRes, notesRes] = await Promise.all([
            client.models.Campaign.get({ id: campaignId }),
            client.models.CampaignCalendar.list(),
            client.models.DailyNote.list(),
        ]);
        const camp = campaignRes.data;
        setCampaign(camp);

        const cal = (calRes.data ?? []).find(c => c.campaignId === campaignId) ?? null;
        setCalendarRecord(cal);

        const filteredNotes = (notesRes.data ?? []).filter(n => n.campaignId === campaignId);
        setNotes(filteredNotes);

        // Jump view to the current in-world day only on initial load
        if (showSpinner && cal?.currentDay) {
            const config = parseCalendarConfig(cal);
            const d = dayToDate(cal.currentDay, config);
            setViewYear(d.year);
            setViewMonth(d.monthIndex);
        }
        if (showSpinner) setLoading(false);
    }, [campaignId]);

    const load = useCallback(() => fetchData(true), [fetchData]);
    // Refreshes notes in the background without blanking the calendar grid.
    const silentReload = useCallback(() => fetchData(false), [fetchData]);

    useEffect(() => { load(); }, [load]);

    const config = useMemo(() => parseCalendarConfig(calendarRecord), [calendarRecord]);
    const monthCount = config.months.length;

    const notedDaySet = useMemo(() => new Set(notes.map(n => n.dayNumber)), [notes]);
    const noteMap = useMemo(() => {
        const m = new Map<number, DailyNote>();
        for (const n of notes) m.set(n.dayNumber, n);
        return m;
    }, [notes]);

    function goToPrevMonth() {
        const { year, monthIndex } = prevMonthSafe(viewYear, viewMonth, monthCount);
        setViewYear(year); setViewMonth(monthIndex);
    }
    function goToNextMonth() {
        const { year, monthIndex } = nextMonthSafe(viewYear, viewMonth, monthCount);
        setViewYear(year); setViewMonth(monthIndex);
    }
    function goToCurrentDay() {
        if (!calendarRecord?.currentDay) return;
        const d = dayToDate(calendarRecord.currentDay, config);
        setViewYear(d.year); setViewMonth(d.monthIndex);
        setSelectedDay(calendarRecord.currentDay);
    }

    async function advanceCurrentDay(dayNumber: number) {
        if (!calendarRecord || !isGM) return;
        await client.models.CampaignCalendar.update({ id: calendarRecord.id, currentDay: dayNumber });
        setCalendarRecord(prev => prev ? { ...prev, currentDay: dayNumber } : prev);
    }

    const worldIds = (campaign?.worldIds ?? []).filter((id): id is string => !!id);
    const pageLoading = loading || roleLoading;
    const monthName = config.months[viewMonth]?.name ?? `Month ${viewMonth + 1}`;

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 3, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                {/* Page header */}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, flexWrap: "wrap", gap: 2 }}>
                    <Box>
                        <Typography variant="h4" component="h1"
                            sx={{ fontFamily: "'Cinzel', serif", fontWeight: 700 }}>
                            Calendar
                        </Typography>
                        {campaign && (
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                {campaign.name}
                                {config.epochName && ` · ${config.epochName}`}
                            </Typography>
                        )}
                    </Box>
                    {isGM && (
                        <Tooltip title="Calendar settings">
                            <Button variant="outlined" size="small" startIcon={<Settings size={14} />}
                                onClick={() => setConfigOpen(true)}>
                                {calendarRecord ? "Edit Calendar" : "Configure Calendar"}
                            </Button>
                        </Tooltip>
                    )}
                </Box>

                {pageLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
                        <CircularProgress />
                    </Box>
                ) : !client.models.CampaignCalendar ? (
                    <Box sx={{ textAlign: "center", py: 10 }}>
                        <Typography sx={{ color: "text.secondary" }}>
                            Calendar feature needs a backend deploy — run <code>npx ampx sandbox</code> to activate it.
                        </Typography>
                    </Box>
                ) : !calendarRecord && !isGM ? (
                    <Box sx={{ textAlign: "center", py: 10 }}>
                        <Typography sx={{ color: "text.secondary" }}>
                            The GM hasn&apos;t configured the calendar yet.
                        </Typography>
                    </Box>
                ) : !calendarRecord && isGM ? (
                    <Box sx={{ textAlign: "center", py: 10 }}>
                        <Typography sx={{ color: "text.secondary", mb: 2 }}>
                            Set up your world&apos;s calendar — define months, days per week, and weekday names.
                        </Typography>
                        <Button variant="contained" onClick={() => setConfigOpen(true)}
                            sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" } }}>
                            Configure Calendar
                        </Button>
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {/* Calendar panel */}
                        <Box sx={{ flex: "1 1 300px", minWidth: 280 }}>
                            {/* Month navigation */}
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                                <IconButton size="small" onClick={goToPrevMonth}>
                                    <ChevronLeft size={18} />
                                </IconButton>
                                <Box sx={{ textAlign: "center" }}>
                                    <Typography sx={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: "1rem" }}>
                                        {monthName}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                        Year {viewYear}
                                    </Typography>
                                </Box>
                                <IconButton size="small" onClick={goToNextMonth}>
                                    <ChevronRight size={18} />
                                </IconButton>
                            </Box>
                            {calendarRecord?.currentDay && (
                                <Button size="small" sx={{ mb: 1, fontSize: "0.72rem" }} onClick={goToCurrentDay}>
                                    Go to current day
                                </Button>
                            )}
                            <CalendarGrid
                                year={viewYear}
                                monthIndex={viewMonth}
                                config={config}
                                notedDays={notedDaySet}
                                currentDay={calendarRecord?.currentDay}
                                selectedDay={selectedDay}
                                onSelectDay={day => setSelectedDay(prev => prev === day ? null : day)}
                            />

                            {selectedDay && (() => {
                                const d = dayToDate(selectedDay, config);
                                return (
                                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 1, textAlign: "center" }}>
                                        {formatDate(d, config, false)}
                                    </Typography>
                                );
                            })()}
                        </Box>

                        {/* Day note panel */}
                        {selectedDay != null ? (
                            <Box sx={{ flex: "1 1 260px" }}>
                                <DayNotePanel
                                    dayNumber={selectedDay}
                                    config={config}
                                    campaignId={campaignId}
                                    worldIds={worldIds}
                                    note={noteMap.get(selectedDay) ?? null}
                                    isGM={isGM}
                                    currentDay={calendarRecord?.currentDay}
                                    onClose={() => setSelectedDay(null)}
                                    onNoteChanged={silentReload}
                                    onAdvanceToday={isGM ? advanceCurrentDay : undefined}
                                />
                            </Box>
                        ) : (
                            <Box sx={{ flex: "1 1 260px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Typography sx={{ color: "text.disabled", fontSize: "0.82rem" }}>
                                    Click a day to view or add notes.
                                </Typography>
                            </Box>
                        )}
                    </Box>
                )}

                <CalendarConfigDialog
                    open={configOpen}
                    existing={calendarRecord}
                    campaignId={campaignId}
                    onClose={() => setConfigOpen(false)}
                    onSaved={load}
                />
            </Container>
        </Box>
    );
}
