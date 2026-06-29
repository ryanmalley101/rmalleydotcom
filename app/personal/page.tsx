"use client";

import { Box, Container, Typography } from "@mui/material";
import Link from "next/link";
import { ArrowLeft, CheckSquare, Images } from "lucide-react";

const tools = [
    {
        title: "Todos",
        description: "Track tasks, goals, and to-dos.",
        icon: CheckSquare,
        href: "/personal/todos",
        accent: "#10b981",
    },
    {
        title: "Photo Gallery",
        description: "Upload and browse photos, organized into sub-galleries.",
        icon: Images,
        href: "/personal/gallery",
        accent: "#ec4899",
    },
];

export default function PersonalPage() {
    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Box
                    component={Link}
                    href="/"
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 4,
                        color: "primary.main",
                        textDecoration: "none",
                        fontSize: "0.875rem",
                        "&:hover": { color: "primary.light" },
                    }}
                >
                    <ArrowLeft size={16} />
                    Back
                </Box>

                <Typography
                    variant="h3"
                    component="h1"
                    sx={{ fontWeight: 800, color: "text.primary", mb: 1 }}
                >
                    Personal
                </Typography>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 6 }}>
                    Personal utilities and planning tools.
                </Typography>

                <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap" }}>
                    {tools.map(({ title, description, icon: Icon, href, accent }) => (
                        <Box
                            key={title}
                            component={Link}
                            href={href}
                            sx={{
                                flex: "1 1 180px",
                                maxWidth: 240,
                                backgroundColor: "background.paper",
                                border: "1px solid rgba(255,255,255,0.06)",
                                borderTop: `3px solid ${accent}`,
                                borderRadius: "0 0 10px 10px",
                                p: 2.5,
                                textDecoration: "none",
                                transition: "background-color 0.15s, box-shadow 0.15s",
                                "&:hover": {
                                    backgroundColor: "#222535",
                                    boxShadow: `0 8px 28px ${accent}22`,
                                },
                            }}
                        >
                            <Box sx={{ mb: 1.5 }}>
                                <Icon size={20} color={accent} />
                            </Box>
                            <Typography
                                sx={{ fontWeight: 700, fontSize: "0.95rem", color: "text.primary", mb: 0.5 }}
                            >
                                {title}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ color: "text.secondary", fontSize: "0.8rem", lineHeight: 1.55 }}
                            >
                                {description}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </Container>
        </Box>
    );
}
