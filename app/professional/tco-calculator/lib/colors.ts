// Just the starting defaults for the two chart/accordion lines — the wizard
// lets the user change them freely on either side, this isn't computed or
// tied to any field. A deliberate, mild exception to "these don't carry
// meaning" (unlike the results summary's teal/gray, which IS computed, from
// which solution actually costs less): slot A defaults to a muted, calmer
// slate rather than a bright white, and slot B to a more vivid purple. This
// is a deliberate, requested finger on the scale, not neutral — it works
// here specifically because slot A already defaults to the incumbent and
// slot B to the challenger in the primary "Cloud/Hybrid vs. On-Prem" shape
// (see defaultIncumbentFor in page.tsx), so a slightly-less-eye-catching
// default for A and a livelier one for B quietly favors the tool's actual
// primary audience's pitch without hardcoding a vendor or forcing it — a
// user comparing two on-prem or two cloud solutions, where slot A isn't
// meaningfully "the incumbent," still gets a plain color difference, not a
// value judgment, and can repaint either side however they like regardless.
export const SOLUTION_A_COLOR = "#94a3b8";
export const SOLUTION_B_COLOR = "#a855f7";

// Quick-pick swatches offered in the color pickers, in addition to full custom hex entry.
export const COLOR_SWATCHES = [
  "#94a3b8", "#a855f7", "#3b82f6", "#10b981",
  "#f59e0b", "#ef4444", "#eab308", "#64748b",
];

// Bright enough to stay readable as secondary/dimmed text against this route's
// near-black background; Mantine's and Chart.js's own "dimmed" defaults are too dark here.
export const TEXT_MUTED = "#b7c0cc";

export const fmtUsd = (n: number) => "$" + Math.round(n).toLocaleString();
export const fmtUsdK = (n: number) => "$" + (n / 1000).toLocaleString() + "k";
