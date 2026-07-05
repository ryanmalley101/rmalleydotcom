// Pure calendar math — no React, no Amplify. All conversions between
// absolute day numbers (1-indexed) and the world's display dates live here.
// Assumptions: no leap years, all years have identical structure, months
// always appear in the same order.

export interface CalendarMonth {
    name: string;
    days: number;
}

export interface CalendarConfig {
    months: CalendarMonth[];         // ordered list of months
    weekdayNames: string[];           // length = days per week
    epochName?: string;              // optional era label
}

export interface DisplayDate {
    year: number;
    monthIndex: number;   // 0-indexed
    dayOfMonth: number;   // 1-indexed
    weekdayIndex: number; // 0-indexed
    yearDay: number;      // 1-indexed day within the year
}

// Sensible defaults so the calendar is usable before the GM configures it.
export const DEFAULT_CONFIG: CalendarConfig = {
    months: [
        { name: "Hammer",    days: 30 }, { name: "Alturiak",  days: 30 },
        { name: "Ches",      days: 30 }, { name: "Tarsakh",   days: 30 },
        { name: "Mirtul",    days: 30 }, { name: "Kythorn",   days: 30 },
        { name: "Flamerule", days: 30 }, { name: "Eleasis",   days: 30 },
        { name: "Eleint",    days: 30 }, { name: "Marpenoth", days: 30 },
        { name: "Uktar",     days: 30 }, { name: "Nightal",   days: 30 },
    ],
    weekdayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

export function parseCalendarConfig(record: {
    monthsJson?: string | null;
    weekdayNamesJson?: string | null;
    epochName?: string | null;
} | null | undefined): CalendarConfig {
    if (!record) return DEFAULT_CONFIG;
    try {
        const months: CalendarMonth[] = record.monthsJson ? JSON.parse(record.monthsJson) : DEFAULT_CONFIG.months;
        const weekdayNames: string[] = record.weekdayNamesJson ? JSON.parse(record.weekdayNamesJson) : DEFAULT_CONFIG.weekdayNames;
        return {
            months: months.length > 0 ? months : DEFAULT_CONFIG.months,
            weekdayNames: weekdayNames.length > 0 ? weekdayNames : DEFAULT_CONFIG.weekdayNames,
            epochName: record.epochName ?? undefined,
        };
    } catch {
        return DEFAULT_CONFIG;
    }
}

export function daysPerYear(config: CalendarConfig): number {
    return config.months.reduce((sum, m) => sum + m.days, 0);
}

/** Absolute day number (1-indexed) → human-readable date components. */
export function dayToDate(dayNumber: number, config: CalendarConfig): DisplayDate {
    const dpw = config.weekdayNames.length;
    const dpy = daysPerYear(config);
    const zero = Math.max(0, dayNumber - 1); // 0-indexed

    const year = Math.floor(zero / dpy) + 1;
    let dayOfYear = zero % dpy; // 0-indexed within year

    let monthIndex = 0;
    for (let i = 0; i < config.months.length; i++) {
        if (dayOfYear < config.months[i].days) {
            monthIndex = i;
            break;
        }
        dayOfYear -= config.months[i].days;
        if (i === config.months.length - 1) monthIndex = i; // clamp to last month
    }

    return {
        year,
        monthIndex,
        dayOfMonth: dayOfYear + 1,
        weekdayIndex: zero % dpw,
        yearDay: (zero % dpy) + 1,
    };
}

/** Human-readable date components → absolute day number (1-indexed). */
export function dateToDayNumber(
    year: number,
    monthIndex: number,
    dayOfMonth: number,
    config: CalendarConfig,
): number {
    const dpy = daysPerYear(config);
    const daysInPrevYears = (year - 1) * dpy;
    const daysInPrevMonths = config.months
        .slice(0, monthIndex)
        .reduce((sum, m) => sum + m.days, 0);
    return daysInPrevYears + daysInPrevMonths + dayOfMonth;
}

/** Returns the first and last day numbers of a month, plus its day count. */
export function monthRange(
    year: number,
    monthIndex: number,
    config: CalendarConfig,
): { start: number; end: number; daysInMonth: number } {
    const start = dateToDayNumber(year, monthIndex, 1, config);
    const daysInMonth = config.months[monthIndex]?.days ?? 0;
    return { start, end: start + daysInMonth - 1, daysInMonth };
}

/** 0-indexed weekday of the first day of a month — for aligning the grid. */
export function monthStartWeekday(year: number, monthIndex: number, config: CalendarConfig): number {
    const { start } = monthRange(year, monthIndex, config);
    return dayToDate(start, config).weekdayIndex;
}

/** Navigate to the previous month, wrapping year if needed. */
export function prevMonth(year: number, monthIndex: number): { year: number; monthIndex: number } {
    if (monthIndex === 0) return { year: year - 1, monthIndex: 0 };
    return { year, monthIndex: monthIndex - 1 };
}

// Safe — caller must pass monthCount
export function prevMonthSafe(
    year: number, monthIndex: number, monthCount: number,
): { year: number; monthIndex: number } {
    if (monthIndex === 0) return { year: year - 1, monthIndex: monthCount - 1 };
    return { year, monthIndex: monthIndex - 1 };
}

export function nextMonthSafe(
    year: number, monthIndex: number, monthCount: number,
): { year: number; monthIndex: number } {
    if (monthIndex === monthCount - 1) return { year: year + 1, monthIndex: 0 };
    return { year, monthIndex: monthIndex + 1 };
}

/** Format a display date as a human-readable string, e.g. "Harvestide 15, Year 3 · Moonday" */
export function formatDate(date: DisplayDate, config: CalendarConfig, short = false): string {
    const monthName = config.months[date.monthIndex]?.name ?? `Month ${date.monthIndex + 1}`;
    const weekdayName = config.weekdayNames[date.weekdayIndex] ?? `Day ${date.weekdayIndex + 1}`;
    const era = config.epochName ? `, ${config.epochName}` : "";
    if (short) return `${monthName} ${date.dayOfMonth}, Year ${date.year}`;
    return `${monthName} ${date.dayOfMonth}, Year ${date.year}${era} · ${weekdayName}`;
}
