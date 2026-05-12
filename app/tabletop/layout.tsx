"use client";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Cinzel } from "next/font/google";

// Cinzel — classical Roman letterforms, D&D / fantasy feel
const cinzel = Cinzel({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-cinzel",
    weight: ["400", "600", "700", "900"],
});

// Tabletop section — parchment, warm amber/rust, Cinzel headings
const tabletopTheme = createTheme({
    palette: {
        mode: "light",
        primary: {
            main:  "#9a3412",  // deep rust — links, back buttons, icons via theme
            dark:  "#7c2d12",  // darker mahogany — headings (color: primary.dark)
            light: "#ea580c",  // bright orange — hover
        },
        secondary: {
            main: "#d97706",   // amber — secondary accents
        },
        background: {
            default: "#f0e6d0",  // warm tan parchment
            paper:   "#fef9f0",  // very light cream — MUI Paper cards
        },
        text: {
            primary:   "#1c0a00",  // very dark warm brown
            secondary: "#92400e",  // amber-brown
            disabled:  "#a8856b",
        },
        divider: "rgba(154,52,18,0.18)",
        error:   { main: "#b91c1c" },
        success: { main: "#15803d" },
        warning: { main: "#b45309" },
    },
    typography: {
        // Body uses a warm, legible serif
        fontFamily: "Georgia, 'Times New Roman', serif",
        h1: {
            fontFamily: "var(--font-cinzel), 'Cinzel', Georgia, serif",
            fontWeight: 700,
            letterSpacing: "0.04em",
        },
        h2: {
            fontFamily: "var(--font-cinzel), 'Cinzel', Georgia, serif",
            fontWeight: 700,
            letterSpacing: "0.03em",
        },
        h3: {
            fontFamily: "var(--font-cinzel), 'Cinzel', Georgia, serif",
            fontWeight: 700,
            letterSpacing: "0.02em",
        },
        h4: {
            fontFamily: "var(--font-cinzel), 'Cinzel', Georgia, serif",
            fontWeight: 600,
            letterSpacing: "0.02em",
        },
        h5: {
            fontFamily: "var(--font-cinzel), 'Cinzel', Georgia, serif",
            fontWeight: 600,
        },
        h6: {
            fontFamily: "var(--font-cinzel), 'Cinzel', Georgia, serif",
            fontWeight: 600,
        },
        // Chips, captions, overlines stay sans-serif for legibility
        caption: { fontFamily: "Inter, Arial, sans-serif" },
        overline: { fontFamily: "Inter, Arial, sans-serif" },
        button: { fontFamily: "Inter, Arial, sans-serif" },
    },
    components: {
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: "none",
                    border: "1px solid rgba(154,52,18,0.12)",
                },
            },
        },
        MuiDivider: {
            styleOverrides: {
                root: { borderColor: "rgba(154,52,18,0.18)" },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: { fontFamily: "Inter, Arial, sans-serif" },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: { fontFamily: "Inter, Arial, sans-serif" },
            },
        },
        MuiInputBase: {
            styleOverrides: {
                root: { fontFamily: "Inter, Arial, sans-serif" },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: { fontFamily: "Inter, Arial, sans-serif" },
            },
        },
    },
});

export default function TabletopLayout({ children }: { children: React.ReactNode }) {
    return (
        // cinzel.variable injects --font-cinzel into scope for the CSS var in the theme
        <div className={cinzel.variable} style={{ minHeight: "100vh" }}>
            <ThemeProvider theme={tabletopTheme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </div>
    );
}
