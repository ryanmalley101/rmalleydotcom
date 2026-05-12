"use client";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

// Hardware section — PCB green circuit-board aesthetic
const hardwareTheme = createTheme({
    palette: {
        mode: "dark",
        primary: {
            main:  "#4ade80",  // green-400 — LED green for links & accents
            light: "#86efac",  // green-300
            dark:  "#16a34a",  // green-600 — button fills, headings
        },
        secondary: {
            main: "#22d3ee",   // cyan — data/voltage accent
        },
        background: {
            default: "#071507",  // PCB substrate dark green
            paper:   "#0d220d",  // slightly raised surface
        },
        text: {
            primary:   "#f0fdf4",  // green-50 — slightly green-tinted white
            secondary: "#86efac",  // green-300
            disabled:  "#166534",  // green-800
        },
        divider: "rgba(74,222,128,0.12)",
        error:   { main: "#f87171" },   // red LED
        success: { main: "#4ade80" },
        warning: { main: "#fbbf24" },   // amber LED
    },
    components: {
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: "none",
                    border: "1px solid rgba(74,222,128,0.1)",
                },
            },
        },
        MuiDivider: {
            styleOverrides: {
                root: { borderColor: "rgba(74,222,128,0.12)" },
            },
        },
        MuiChip: {
            styleOverrides: {
                outlined: { borderColor: "rgba(74,222,128,0.3)" },
            },
        },
    },
});

export default function HardwareLayout({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider theme={hardwareTheme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}
