"use client";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Cinzel } from "next/font/google";
import { Amplify } from "aws-amplify";
import { MantineProvider, createTheme as createMantineTheme } from "@mantine/core";
import "@mantine/core/styles.css";
import outputs from "@/amplify_outputs.json";

Amplify.configure(outputs, { ssr: true });

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

// Mantine theme — Ember Leather dark, mirrors the palette used in migrated pages.
// Sits alongside MUI's ThemeProvider; neither interferes with the other.
const mantineTheme = createMantineTheme({
    primaryColor: "ember",
    colors: {
        dark: [
            "#f0ddb5","#d4aa72","#a67c4a","#7a5530",
            "#4a2e14","#361f0b","#261508","#1a0d05","#120903","#0c0602",
        ],
        ember: [
            "#fff0e5","#ffd9be","#ffba8a","#ff9855",
            "#f87d30","#ef6b1a","#d95c0f","#c25010","#ad4610","#993c0f",
        ],
        gold: [
            "#fffce0","#fff5ba","#ffed85","#ffe24d",
            "#ffd824","#f5c90e","#dbb208","#c09a05","#a88604","#907302",
        ],
    },
    fontFamily: "Georgia, 'Times New Roman', serif",
    headings: { fontFamily: "var(--font-cinzel), 'Cinzel', Georgia, serif", fontWeight: "700" },
});

export default function TabletopLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className={cinzel.variable} style={{ minHeight: "100vh" }}>
            {/* Mantine wraps first so migrated pages get dark Ember Leather tokens. */}
            {/* MUI ThemeProvider is kept for pages not yet migrated. */}
            <MantineProvider theme={mantineTheme} defaultColorScheme="dark">
                <ThemeProvider theme={tabletopTheme}>
                    <CssBaseline />
                    {children}
                </ThemeProvider>
            </MantineProvider>
        </div>
    );
}
