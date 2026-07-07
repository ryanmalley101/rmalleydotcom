"use client";

import "@mantine/core/styles.css";
import "./preview.css"; // Tailwind directives + shadcn CSS variables (scoped to .shadcn-root)
import { MantineProvider, createTheme } from "@mantine/core";

const mantineTheme = createTheme({
    primaryColor: "ember",

    // Warm leather-brown dark scale — replaces Mantine's cold grey default.
    // [0] = lightest (readable text), [9] = deepest (near-black leather).
    colors: {
        dark: [
            "#f0ddb5", // 0  warm cream — primary text
            "#d4aa72", // 1  amber — secondary text
            "#a67c4a", // 2  tan — muted text
            "#7a5530", // 3  dark tan — disabled
            "#4a2e14", // 4  subtle border
            "#361f0b", // 5  card hover bg
            "#261508", // 6  card/paper bg
            "#1a0d05", // 7  page background
            "#120903", // 8  deep dark
            "#0c0602", // 9  deepest (nav bars)
        ],

        // Bright ember-orange — pops against the dark leather background.
        ember: [
            "#fff0e5", "#ffd9be", "#ffba8a",
            "#ff9855", "#f87d30", "#ef6b1a",
            "#d95c0f", "#c25010", "#ad4610", "#993c0f",
        ],

        // Aged gold — for headings and premium accents.
        gold: [
            "#fffce0", "#fff5ba", "#ffed85",
            "#ffe24d", "#ffd824", "#f5c90e",
            "#dbb208", "#c09a05", "#a88604", "#907302",
        ],
    },

    fontFamily: "Georgia, 'Times New Roman', serif",
    headings: {
        fontFamily: "var(--font-cinzel), 'Cinzel', Georgia, serif",
        fontWeight: "700",
    },
    defaultRadius: "md",

    // Warm dark backgrounds for Mantine's built-in components.
    other: {
        pageBg:    "#1a0d05",
        cardBg:    "#261508",
        cardHover: "#321b0c",
        border:    "rgba(200, 130, 60, 0.22)",
        divider:   "rgba(200, 130, 60, 0.18)",
        gold:      "#e8c060",
        cream:     "#f0ddb5",
        ember:     "#ef6b1a",
    },
});

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
    return (
        <MantineProvider theme={mantineTheme} defaultColorScheme="dark">
            {children}
        </MantineProvider>
    );
}
