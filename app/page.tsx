"use client";

import { Box, Container, Typography } from "@mui/material";
import Link from "next/link";
import { Code2, Cpu, Sword, ListTodo } from "lucide-react";

const categories = [
  {
    title: "Software",
    meta: "TypeScript · Next.js · Python",
    description: "Web applications, tools, and programming projects.",
    icon: Code2,
    href: "/software",
    accent: "#6366f1",
  },
  {
    title: "Hardware",
    meta: "C / C++ · RTOS · PCB design",
    description: "Electronics, embedded systems, and physical builds.",
    icon: Cpu,
    href: "/hardware",
    accent: "#22d3ee",
  },
  {
    title: "Tabletop",
    meta: "D&D 5e · React · game systems",
    description: "D&D tools, monster creators, and tabletop game aids.",
    icon: Sword,
    href: "/tabletop",
    accent: "#f59e0b",
  },
  {
    title: "Personal",
    meta: "todos · planning · utilities",
    description: "Personal task tracking, planning tools, and home utilities.",
    icon: ListTodo,
    href: "/personal",
    accent: "#10b981",
  },
];

export default function HomePage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "background.default",
        display: "flex",
        alignItems: "center",
        py: 8,
      }}
    >
      <Container maxWidth="md">
        {/* Available badge */}

        {/* Name */}
        <Typography
          variant="h2"
          component="h1"
          sx={{
            fontWeight: 800,
            color: "text.primary",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            mb: 1.5,
          }}
        >
          Ryan Malley
        </Typography>

        {/* Role */}
        <Typography
          variant="h6"
          sx={{ color: "primary.main", fontWeight: 600, mb: 2, letterSpacing: 0.2 }}
        >
          Software Engineer
        </Typography>

        {/* Bio */}
        <Typography
          variant="body1"
          sx={{ color: "text.secondary", mb: 6, maxWidth: 460, lineHeight: 1.75 }}
        >
          I build web tools, embedded systems, and tabletop RPG aids.
          This is where I keep the things I&apos;ve made.
        </Typography>

        {/* Category cards */}
        <Box sx={{ display: "flex", gap: 2.5, flexWrap: "wrap" }}>
          {categories.map(({ title, meta, description, icon: Icon, href, accent }) => (
            <Box
              key={title}
              component={Link}
              href={href}
              sx={{
                flex: "1 1 180px",
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
                sx={{
                  fontSize: "0.7rem",
                  color: "text.disabled",
                  fontFamily: "monospace",
                  mb: 1.5,
                  letterSpacing: 0.2,
                }}
              >
                {meta}
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
