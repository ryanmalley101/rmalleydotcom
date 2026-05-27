"use client";

import { Box, Container, Stack, Typography, Button, Divider } from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Code2 } from "lucide-react";

const projects = [
  {
    href: "/software/pcap-analyzer",
    title: "Verkada Packet Capture Analyzer",
    description:
      "Upload a .pcap, .pcapng, or .pcap.zst and get a per-device network health audit for Verkada devices — DHCP, ARP, DNS, cloud reachability, TLS, 802.1X. Runs entirely in the browser; nothing is uploaded.",
  },
  {
    href: "/software/pykada",
    title: "pykada",
    description:
      "Python SDK for the Verkada physical security API — cameras, access control, sensors, and more.",
  },
];

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
          <Code2 size={32} color="#6366f1" />
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "text.primary" }}>
            Software
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ color: "text.secondary", mb: 5 }}>
          Web applications, tools, and programming projects.
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
