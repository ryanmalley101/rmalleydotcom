"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Box, type SxProps, type Theme } from "@mui/material";

// Shared markdown renderer used across all long-form prose fields in the app
// (session notes, timeline descriptions, day notes, etc.). Formats headings,
// bold, italics, lists, blockquotes, and inline code consistently.

interface MarkdownContentProps {
    children: string;
    sx?: SxProps<Theme>;
    dim?: boolean; // use secondary text color instead of primary
}

export function MarkdownContent({ children, sx, dim = false }: MarkdownContentProps) {
    return (
        <Box sx={{
            color: dim ? "text.secondary" : "text.primary",
            lineHeight: 1.8,
            fontSize: "0.9rem",
            fontFamily: "Georgia, 'Times New Roman', serif",
            "& p": { mt: 0, mb: 1, "&:last-child": { mb: 0 } },
            "& strong": { fontWeight: 700 },
            "& em": { fontStyle: "italic" },
            "& h1, & h2, & h3, & h4": {
                fontFamily: "'Cinzel', serif",
                fontWeight: 700, mt: 1.5, mb: 0.5, lineHeight: 1.3,
            },
            "& h1": { fontSize: "1.1rem" },
            "& h2": { fontSize: "1rem" },
            "& h3, & h4": { fontSize: "0.9rem" },
            "& ul, & ol": { pl: 2.5, mb: 1, mt: 0 },
            "& li": { mb: 0.25 },
            "& blockquote": {
                borderLeft: "3px solid", borderColor: "primary.light",
                pl: 1.5, ml: 0, my: 1, color: "text.secondary",
                fontStyle: "italic",
            },
            "& code": {
                fontFamily: "monospace", fontSize: "0.82em",
                backgroundColor: "rgba(0,0,0,0.06)", px: 0.5, py: 0.1, borderRadius: 0.5,
            },
            "& pre": {
                backgroundColor: "rgba(0,0,0,0.06)", p: 1.5, borderRadius: 1,
                overflow: "auto", my: 1,
                "& code": { backgroundColor: "transparent", p: 0 },
            },
            "& hr": { borderColor: "divider", my: 2 },
            "& a": { color: "primary.main", "&:hover": { color: "primary.dark" } },
            "& table": { borderCollapse: "collapse", width: "100%", mb: 1 },
            "& th, & td": { border: "1px solid", borderColor: "divider", px: 1, py: 0.5, textAlign: "left" },
            "& th": { fontWeight: 700, backgroundColor: "rgba(0,0,0,0.04)" },
            ...sx,
        }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {children}
            </ReactMarkdown>
        </Box>
    );
}
