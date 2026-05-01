"use client";

import { Box, Container, Typography, Button, Divider } from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Code2 } from "lucide-react";

export default function SoftwarePage() {
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
          <Code2 size={32} color="#4A7C9E" />
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
            Software
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ color: "text.secondary", mb: 5 }}>
          Web applications, tools, and programming projects.
        </Typography>

        <Divider sx={{ mb: 4 }} />

        <Typography variant="body1" sx={{ color: "text.secondary" }}>
          Projects coming soon.
        </Typography>
      </Container>
    </Box>
  );
}
