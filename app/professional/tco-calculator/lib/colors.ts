// Starting colors for the two chart/accordion lines; the user can change
// either freely. Deliberately neutral: two hues of similar lightness and
// saturation (sky blue and reddish purple from the Okabe-Ito colorblind-safe
// palette), so neither slot reads as more prominent or "better" by default.
// An earlier pair intentionally made slot A (usually the incumbent) duller
// than slot B. Both also stay clear of the results summary's computed
// teal/gray (cheaper/pricier) and the chart's amber crossover marker.
export const SOLUTION_A_COLOR = "#56b4e9";
export const SOLUTION_B_COLOR = "#cc79a7";

// Quick-pick swatches offered in the color pickers, in addition to full custom hex entry.
export const COLOR_SWATCHES = [
  "#56b4e9", "#cc79a7", "#10b981", "#f59e0b",
  "#ef4444", "#eab308", "#64748b", "#94a3b8",
];

// Bright enough to stay readable as secondary/dimmed text against this route's
// near-black background; Mantine's and Chart.js's own "dimmed" defaults are too dark here.
export const TEXT_MUTED = "#b7c0cc";

export const fmtUsd = (n: number) => "$" + Math.round(n).toLocaleString();
export const fmtUsdK = (n: number) => "$" + (n / 1000).toLocaleString() + "k";
