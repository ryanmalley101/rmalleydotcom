// Deliberately generic hues (blue/violet) rather than any real vendor's brand
// colors, and neither reads as "the good one" the way green/red would.
// These are just the starting defaults; the wizard lets the user change them.
export const SOLUTION_A_COLOR = "#3b82f6";
export const SOLUTION_B_COLOR = "#a855f7";

// Quick-pick swatches offered in the color pickers, in addition to full custom hex entry.
export const COLOR_SWATCHES = [
  "#3b82f6", "#a855f7", "#0d9488", "#f59e0b",
  "#ef4444", "#10b981", "#eab308", "#64748b",
];

// Bright enough to stay readable as secondary/dimmed text against this route's
// near-black background; Mantine's and Chart.js's own "dimmed" defaults are too dark here.
export const TEXT_MUTED = "#b7c0cc";

export const fmtUsd = (n: number) => "$" + Math.round(n).toLocaleString();
export const fmtUsdK = (n: number) => "$" + (n / 1000).toLocaleString() + "k";
