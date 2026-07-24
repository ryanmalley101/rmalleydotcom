"use client";

import { Box, Container, Stack, Typography, Button, Divider } from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Briefcase } from "lucide-react";

const projects = [
  {
    href: "/professional/tco-calculator",
    title: "Video Surveillance TCO Calculator",
    description:
      "A guided wizard for comparing the total cost of ownership of two video-management deployments (on-prem vs. on-prem, cloud vs. cloud, or one of each), with editable pricing assumptions and NPV, crossover, and cost-by-category charts.",
  },
];

export default function ProfessionalPage() {
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
          <Briefcase size={32} color="#7c3aed" />
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "text.primary" }}>
            Professional
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ color: "text.secondary", mb: 5 }}>
          Tools built for my day job.
        </Typography>

        <Divider sx={{ mb: 4 }} />

        <Stack spacing={2}>
          {projects.map(p => (
            <Box
              key={p.href}
              component={Link}
              href={p.href}
              sx={{
                display: "block",
                p: 3,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                textDecoration: "none",
                "&:hover": { borderColor: "primary.main", backgroundColor: "action.hover" },
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.dark", mb: 0.5 }}>
                {p.title}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {p.description}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}
