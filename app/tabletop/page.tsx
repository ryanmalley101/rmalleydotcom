"use client";

import { Box, Container, Typography, Button, Divider } from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Sword } from "lucide-react";

const tools = [
  {
    title: "Monster Creator",
    description:
      "Build and save custom D&D 5e monster statblocks. Supports bulk import from JSON.",
    href: "/create/monster",
  },
];

export default function TabletopPage() {
  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
      <Container maxWidth="md">
        <Button
          component={Link}
          href="/"
          startIcon={<ArrowLeft size={16} />}
          sx={{ mb: 4, color: "primary.main" }}
        >
          Back
        </Button>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <Sword size={32} color="#8C5A3A" />
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
            Tabletop
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ color: "text.secondary", mb: 5 }}>
          Tools for tabletop RPGs and D&amp;D 5e.
        </Typography>

        <Divider sx={{ mb: 4 }} />

        {tools.map(({ title, description, href }) => (
          <Box key={title} sx={{ mb: 3 }}>
            <Typography
              variant="h5"
              component={Link}
              href={href}
              sx={{
                color: "primary.dark",
                fontWeight: 600,
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              {title}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              {description}
            </Typography>
          </Box>
        ))}
      </Container>
    </Box>
  );
}
