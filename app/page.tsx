"use client";

import {
  Box,
  Container,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  Grid,
} from "@mui/material";
import Link from "next/link";
import { Code2, Cpu, Sword } from "lucide-react";

const categories = [
  {
    title: "Software",
    description:
      "Web applications, tools, and programming projects.",
    icon: Code2,
    href: "/software",
    accent: "#4A7C9E",
  },
  {
    title: "Hardware",
    description:
      "Electronics, embedded systems, and physical builds.",
    icon: Cpu,
    href: "/hardware",
    accent: "#5A8C5A",
  },
  {
    title: "Tabletop",
    description:
      "D&D tools, monster creators, and tabletop game aids.",
    icon: Sword,
    href: "/tabletop",
    accent: "#8C5A3A",
  },
];

export default function HomePage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "background.default",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        py: 8,
      }}
    >
      <Container maxWidth="md">
        {/* Hero */}
        <Box sx={{ textAlign: "center", mb: 8 }}>
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight: 700,
              color: "primary.dark",
              letterSpacing: "-0.02em",
              mb: 1.5,
            }}
          >
            Ryan Malley
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: "primary.main", fontWeight: 400 }}
          >
            Projects &amp; Work
          </Typography>
        </Box>

        {/* Category cards */}
        <Grid container spacing={3} justifyContent="center">
          {categories.map(({ title, description, icon: Icon, href, accent }) => (
            <Grid item xs={12} sm={4} key={title}>
              <Card
                elevation={2}
                sx={{
                  height: "100%",
                  backgroundColor: "background.paper",
                  transition: "transform 0.15s, box-shadow 0.15s",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: 6,
                  },
                }}
              >
                <CardActionArea
                  component={Link}
                  href={href}
                  sx={{ height: "100%", p: 1 }}
                >
                  <CardContent
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      gap: 2,
                    }}
                  >
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        backgroundColor: accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={28} color="#fff" />
                    </Box>
                    <Typography
                      variant="h5"
                      component="h2"
                      sx={{ fontWeight: 600, color: "primary.dark" }}
                    >
                      {title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
