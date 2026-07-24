"use client";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

// Professional section, dark slate, corporate-tool aesthetic
const professionalTheme = createTheme({
    palette: {
        mode: "dark",
        primary: {
            main:  "#a78bfa",  // violet-400: links, chips, back buttons
            light: "#ddd6fe",  // violet-200
            dark:  "#7c3aed",  // violet-600: button fills, headings
        },
        secondary: {
            main: "#94a3b8",   // slate-400
        },
        background: {
            default: "#0f1117",
            paper:   "#171a23",
        },
        text: {
            primary:   "#e5e7eb",
            secondary: "#9aa1ae",
            disabled:  "#4b5262",
        },
        divider: "rgba(229,231,235,0.1)",
        error:   { main: "#f87171" },
        success: { main: "#4ade80" },
        warning: { main: "#facc15" },
    },
    components: {
        MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    },
});

export default function ProfessionalThemeClient({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider theme={professionalTheme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}
