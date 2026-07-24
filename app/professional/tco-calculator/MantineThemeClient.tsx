"use client";

import "@mantine/core/styles.css";
import { MantineProvider, createTheme } from "@mantine/core";

// Scoped to this route only; the rest of /professional stays on MUI.
// Palette is a neutral slate/blue/violet set, intentionally not echoing any
// real vendor's brand colors, since this tool now compares arbitrary solutions.
const mantineTheme = createTheme({
  primaryColor: "indigo",
  fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
  fontFamilyMonospace: "'IBM Plex Mono', monospace",
  headings: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif", fontWeight: "600" },
  defaultRadius: "md",
});

export default function MantineThemeClient({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme="dark">
      {children}
    </MantineProvider>
  );
}
