"use client";

import { Box, Container, Typography, Button, Divider } from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Cpu } from "lucide-react";

export default function HardwarePage() {
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
          <Cpu size={32} color="#22d3ee" />
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "text.primary" }}>
            Hardware
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ color: "text.secondary", mb: 5 }}>
          Electronics, embedded systems, and physical builds.
        </Typography>

        <Divider sx={{ mb: 4 }} />

        <Typography variant="body1" sx={{ color: "text.secondary" }}>
          Projects coming soon.
        </Typography>
      </Container>
    </Box>
  );
}
