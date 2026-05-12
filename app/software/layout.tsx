"use client";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

// Software section — dark indigo, developer-tool aesthetic
const softwareTheme = createTheme({
    palette: {
        mode: "dark",
        primary: {
            main:  "#818cf8",  // indigo-400 — links, chips, back buttons
            light: "#c7d2fe",  // indigo-200
            dark:  "#6366f1",  // indigo-500 — button fills, headings
        },
        secondary: {
            main: "#38bdf8",   // sky-400
        },
        background: {
            default: "#0d1117",  // GitHub-style near-black
            paper:   "#161b22",  // slightly lighter surface
        },
        text: {
            primary:   "#e6edf3",
            secondary: "#8b949e",
            disabled:  "#484f58",
        },
        divider: "rgba(240,246,252,0.1)",
        error:   { main: "#f85149" },
        success: { main: "#3fb950" },
        warning: { main: "#d29922" },
    },
    components: {
        MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    },
});

export default function SoftwareLayout({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider theme={softwareTheme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}
