import type { PaletteOptions } from "@mui/material/styles";

// Swapped in for the tabletop section's light parchment palette when GM
// Dashboard "Table Mode" is on. Only the palette changes — typography and
// component overrides (Cinzel headings, serif body, etc.) come from the
// ambient tabletop theme via createTheme(outerTheme, { palette: ... }), so
// every MUI control (TextField, Select, Button, Chip…) that reads colors
// from theme tokens picks these up automatically instead of staying tuned
// for a cream background.
export const TABLE_MODE_PALETTE: PaletteOptions = {
    mode: "dark",
    primary: {
        main:  "#e0a458",
        dark:  "#c97c3d",
        light: "#f6cb91",
        contrastText: "#1a1208",
    },
    secondary: {
        main: "#22d3ee",
    },
    background: {
        default: "#0f0f1a",
        paper:   "#1a1a2e",
    },
    text: {
        primary:   "#f3ead9",
        secondary: "#c2a682",
        disabled:  "#6b5d4d",
    },
    divider: "rgba(255,255,255,0.12)",
    error:   { main: "#f87171" },
    success: { main: "#4ade80" },
    warning: { main: "#fbbf24" },
};
