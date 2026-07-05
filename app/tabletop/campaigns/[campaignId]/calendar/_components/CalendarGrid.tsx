"use client";

import { useMemo } from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import {
    type CalendarConfig,
    dayToDate,
    monthRange,
    monthStartWeekday,
} from "../_lib/calendarMath";

interface CalendarGridProps {
    year: number;
    monthIndex: number;
    config: CalendarConfig;
    notedDays: Set<number>;   // day numbers that have at least one note
    currentDay?: number | null; // absolute day to highlight as "today"
    selectedDay?: number | null;
    onSelectDay: (dayNumber: number) => void;
}

export function CalendarGrid({
    year, monthIndex, config, notedDays, currentDay, selectedDay, onSelectDay,
}: CalendarGridProps) {
    const dpw = config.weekdayNames.length;
    const { start, daysInMonth } = monthRange(year, monthIndex, config);
    const startWeekday = monthStartWeekday(year, monthIndex, config);

    // Build a flat array of cells: nulls for leading blank cells, then day numbers.
    const cells = useMemo(() => {
        const arr: (number | null)[] = Array(startWeekday).fill(null);
        for (let d = 0; d < daysInMonth; d++) arr.push(start + d);
        // Pad to complete the last row.
        while (arr.length % dpw !== 0) arr.push(null);
        return arr;
    }, [start, daysInMonth, startWeekday, dpw]);

    if (dpw === 0) return null;

    return (
        <Box>
            {/* Weekday headers */}
            <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${dpw}, 1fr)`, mb: 0.5 }}>
                {config.weekdayNames.map((name, i) => (
                    <Typography key={i} variant="caption" sx={{
                        textAlign: "center", fontWeight: 600, color: "text.secondary",
                        fontSize: "0.68rem", letterSpacing: "0.04em",
                        py: 0.5, textTransform: "uppercase",
                    }}>
                        {name.slice(0, 3)}
                    </Typography>
                ))}
            </Box>

            {/* Day cells */}
            <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${dpw}, 1fr)`, gap: "2px" }}>
                {cells.map((dayNum, idx) => {
                    if (dayNum === null) {
                        return <Box key={`blank-${idx}`} sx={{ aspectRatio: "1", borderRadius: 1 }} />;
                    }
                    const { dayOfMonth } = dayToDate(dayNum, config);
                    const hasNote = notedDays.has(dayNum);
                    const isToday = dayNum === currentDay;
                    const isSelected = dayNum === selectedDay;

                    return (
                        <Tooltip key={dayNum} title={hasNote ? "Has notes" : ""} arrow>
                            <Box onClick={() => onSelectDay(dayNum)} sx={{
                                aspectRatio: "1",
                                display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center",
                                borderRadius: 1.5,
                                cursor: "pointer",
                                position: "relative",
                                backgroundColor: isSelected
                                    ? "rgba(146,64,14,0.18)"
                                    : isToday
                                    ? "rgba(217,119,6,0.12)"
                                    : "transparent",
                                border: "1.5px solid",
                                borderColor: isSelected
                                    ? "primary.main"
                                    : isToday
                                    ? "secondary.main"
                                    : "rgba(201,168,124,0.2)",
                                transition: "background-color 0.12s, border-color 0.12s",
                                "&:hover": {
                                    backgroundColor: "rgba(201,168,124,0.15)",
                                    borderColor: "rgba(201,168,124,0.5)",
                                },
                            }}>
                                <Typography sx={{
                                    fontSize: "0.78rem",
                                    fontWeight: isToday || isSelected ? 700 : 400,
                                    color: isSelected ? "primary.main" : isToday ? "secondary.main" : "text.primary",
                                    lineHeight: 1,
                                }}>
                                    {dayOfMonth}
                                </Typography>
                                {/* Note dot */}
                                {hasNote && (
                                    <Box sx={{
                                        width: 4, height: 4, borderRadius: "50%",
                                        backgroundColor: isSelected ? "primary.main" : "secondary.main",
                                        mt: 0.4,
                                    }} />
                                )}
                            </Box>
                        </Tooltip>
                    );
                })}
            </Box>
        </Box>
    );
}
