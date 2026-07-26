// These are just the starting defaults for the two chart/accordion lines —
// the wizard lets the user change them freely, and neither the charts nor
// the accordion badges attach any meaning to which is which (unlike the
// results summary's teal/gray, which is computed from which solution is
// actually cheaper, not from these).
export const SOLUTION_A_COLOR = "#ffffff";
export const SOLUTION_B_COLOR = "#10b981";

// Quick-pick swatches offered in the color pickers, in addition to full custom hex entry.
export const COLOR_SWATCHES = [
  "#ffffff", "#10b981", "#3b82f6", "#a855f7",
  "#f59e0b", "#ef4444", "#eab308", "#64748b",
];

// Bright enough to stay readable as secondary/dimmed text against this route's
// near-black background; Mantine's and Chart.js's own "dimmed" defaults are too dark here.
export const TEXT_MUTED = "#b7c0cc";

export const fmtUsd = (n: number) => "$" + Math.round(n).toLocaleString();
export const fmtUsdK = (n: number) => "$" + (n / 1000).toLocaleString() + "k";
