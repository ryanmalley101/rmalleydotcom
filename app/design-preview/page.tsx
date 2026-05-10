"use client";

import { Box, Container, Typography, Button } from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Code2, Cpu, Sword } from "lucide-react";

// ── Preview frame dimensions ──────────────────────────────────────────────────
// Content renders at PW × PH, then is scaled to fit two columns side by side.

const PW = 860;
const PH = 620;
const SCALE = 0.62;
const CW = Math.round(PW * SCALE); // ≈ 533
const CH = Math.round(PH * SCALE); // ≈ 384

// ── Browser chrome wrapper ────────────────────────────────────────────────────

function BrowserFrame({ children }: { children: React.ReactNode }) {
    return (
        <Box sx={{ width: PW, height: PH, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Chrome bar */}
            <Box sx={{
                bgcolor: "#e8e8e8",
                borderBottom: "1px solid #d0d0d0",
                px: 2, py: 1,
                display: "flex", alignItems: "center", gap: 1.5,
                flexShrink: 0,
            }}>
                {/* Traffic lights */}
                {["#ff5f57", "#ffbd2e", "#28c840"].map((c) => (
                    <Box key={c} sx={{ width: 11, height: 11, borderRadius: "50%", bgcolor: c }} />
                ))}
                {/* URL bar */}
                <Box sx={{
                    flex: 1, mx: 2, bgcolor: "#fff", borderRadius: 1,
                    px: 1.5, py: 0.25, display: "flex", alignItems: "center",
                    border: "1px solid #c8c8c8",
                }}>
                    <Typography sx={{ fontSize: 11, color: "#666", fontFamily: "monospace" }}>
                        ryanmalley.com
                    </Typography>
                </Box>
            </Box>
            {/* Page content */}
            <Box sx={{ flex: 1, overflow: "hidden" }}>
                {children}
            </Box>
        </Box>
    );
}

// ── CURRENT ───────────────────────────────────────────────────────────────────

function CurrentVariant() {
    return (
        <BrowserFrame>
            <Box sx={{
                width: "100%", height: "100%",
                bgcolor: "#F1EEE7",
                display: "flex", alignItems: "center",
                fontFamily: "Inter, Roboto, sans-serif",
            }}>
                <Box sx={{ width: "100%", px: 7, py: 4 }}>
                    {/* Hero */}
                    <Box sx={{ textAlign: "center", mb: 6 }}>
                        <Typography sx={{ fontSize: 38, fontWeight: 700, color: "#5F5149", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                            Ryan Malley
                        </Typography>
                        <Typography sx={{ fontSize: 16, color: "#887569", mt: 1.5, fontWeight: 400 }}>
                            Projects &amp; Work
                        </Typography>
                    </Box>

                    {/* Cards */}
                    <Box sx={{ display: "flex", gap: 2.5 }}>
                        {[
                            { title: "Software", Icon: Code2, acc: "#4A7C9E" },
                            { title: "Hardware", Icon: Cpu,   acc: "#5A8C5A" },
                            { title: "Tabletop", Icon: Sword, acc: "#8C5A3A" },
                        ].map(({ title, Icon, acc }) => (
                            <Box key={title} sx={{
                                flex: 1, bgcolor: "#d5b59c", p: 3.5, borderRadius: 2,
                                display: "flex", flexDirection: "column", alignItems: "center",
                                textAlign: "center", gap: 1.5,
                            }}>
                                <Box sx={{ width: 48, height: 48, bgcolor: acc, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Icon size={24} color="#fff" />
                                </Box>
                                <Typography sx={{ fontWeight: 600, fontSize: 17, color: "#5F5149" }}>{title}</Typography>
                                <Typography sx={{ fontSize: 12, color: "#78675e" }}>
                                    {title === "Software" ? "Web apps, tools, and programming projects." : title === "Hardware" ? "Electronics, embedded systems, and builds." : "D&D tools, monster creators, and game aids."}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>
        </BrowserFrame>
    );
}

// ── OPTION A: DARK DEV TOOL ───────────────────────────────────────────────────

function DarkVariant() {
    const cards = [
        { title: "Software", Icon: Code2, acc: "#6366f1", meta: "TypeScript · Next.js · Python" },
        { title: "Hardware", Icon: Cpu,   acc: "#22d3ee", meta: "C / C++ · RTOS · PCB design" },
        { title: "Tabletop", Icon: Sword, acc: "#f59e0b", meta: "D&D 5e · React · game systems" },
    ];

    return (
        <BrowserFrame>
            <Box sx={{
                width: "100%", height: "100%",
                bgcolor: "#0f1117",
                fontFamily: "Inter, Roboto, sans-serif",
                px: 8, py: 5,
                display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
                {/* Badge */}
                <Box sx={{
                    display: "inline-flex", alignItems: "center", gap: 0.75, mb: 4,
                    bgcolor: "#6366f115", border: "1px solid #6366f133",
                    px: 1.5, py: 0.4, borderRadius: 10, width: "fit-content",
                }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "#22c55e" }} />
                    <Typography sx={{ fontSize: 11, color: "#a5b4fc", letterSpacing: 0.5 }}>
                        Open to contract work
                    </Typography>
                </Box>

                {/* Hero */}
                <Typography sx={{ fontSize: 40, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.03em", lineHeight: 1.1, mb: 1 }}>
                    Ryan Malley
                </Typography>
                <Typography sx={{ fontSize: 15, color: "#6366f1", fontWeight: 600, mb: 1.5, letterSpacing: 0.3 }}>
                    Software Engineer
                </Typography>
                <Typography sx={{ fontSize: 13, color: "#94a3b8", mb: 5, maxWidth: 420, lineHeight: 1.6 }}>
                    I build web tools, embedded systems, and tabletop RPG aids. This is where I keep the things I&apos;ve made.
                </Typography>

                {/* Cards */}
                <Box sx={{ display: "flex", gap: 2 }}>
                    {cards.map(({ title, Icon, acc, meta }) => (
                        <Box key={title} sx={{
                            flex: 1, bgcolor: "#1a1d27",
                            borderTop: `3px solid ${acc}`,
                            borderRadius: "0 0 8px 8px", p: 2.5,
                            border: "1px solid #ffffff0f",
                            borderTopColor: acc,
                        }}>
                            <Box sx={{ mb: 1.5 }}>
                                <Icon size={18} color={acc} />
                            </Box>
                            <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9", mb: 0.5 }}>{title}</Typography>
                            <Typography sx={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{meta}</Typography>
                        </Box>
                    ))}
                </Box>
            </Box>
        </BrowserFrame>
    );
}

// ── OPTION B: MINIMAL EDITORIAL ───────────────────────────────────────────────

function MinimalVariant() {
    return (
        <BrowserFrame>
            <Box sx={{
                width: "100%", height: "100%",
                bgcolor: "#fafaf9",
                fontFamily: "Inter, Roboto, sans-serif",
                display: "flex", flexDirection: "column",
            }}>
                {/* Nav */}
                <Box sx={{
                    px: 8, py: 2.5,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    borderBottom: "1px solid #f0f0ef",
                }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#111827", letterSpacing: "-0.01em" }}>
                        ryanmalley
                    </Typography>
                    <Box sx={{ display: "flex", gap: 4 }}>
                        {["Software", "Hardware", "Tabletop"].map((t) => (
                            <Typography key={t} sx={{ fontSize: 13, color: "#6b7280" }}>{t}</Typography>
                        ))}
                    </Box>
                </Box>

                {/* Hero */}
                <Box sx={{ px: 8, pt: 6, pb: 5 }}>
                    <Typography sx={{ fontSize: 13, color: "#7c3aed", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", mb: 2 }}>
                        Software Engineer
                    </Typography>
                    <Typography sx={{ fontSize: 42, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em", lineHeight: 1.1, mb: 2 }}>
                        Ryan Malley
                    </Typography>
                    <Typography sx={{ fontSize: 15, color: "#6b7280", maxWidth: 460, lineHeight: 1.65, mb: 5 }}>
                        I build web tools, embedded systems, and tabletop RPG aids. This is where I keep the things I&apos;ve made.
                    </Typography>

                    {/* Cards — listed style */}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        {[
                            { title: "Software", Icon: Code2, desc: "Web apps, tools, and programming projects.", n: "01" },
                            { title: "Hardware", Icon: Cpu,   desc: "Electronics, embedded systems, and physical builds.", n: "02" },
                            { title: "Tabletop", Icon: Sword, desc: "D&D tools, monster creators, and game aids.", n: "03" },
                        ].map(({ title, Icon, desc, n }) => (
                            <Box key={title} sx={{
                                display: "flex", alignItems: "center", gap: 3,
                                p: 2, borderRadius: 1.5,
                                border: "1px solid #f0ede8",
                                bgcolor: "#ffffff",
                                "&:hover": { borderColor: "#7c3aed20" },
                            }}>
                                <Typography sx={{ fontSize: 11, color: "#d1d5db", fontFamily: "monospace", fontWeight: 600, minWidth: 22 }}>{n}</Typography>
                                <Icon size={16} color="#7c3aed" />
                                <Box sx={{ flex: 1 }}>
                                    <Typography sx={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{title}</Typography>
                                    <Typography sx={{ fontSize: 11, color: "#9ca3af" }}>{desc}</Typography>
                                </Box>
                                <Typography sx={{ fontSize: 13, color: "#d1d5db" }}>→</Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>
        </BrowserFrame>
    );
}

// ── OPTION C: WARM REBRAND ────────────────────────────────────────────────────

function WarmVariant() {
    return (
        <BrowserFrame>
            <Box sx={{
                width: "100%", height: "100%",
                bgcolor: "#faf8f5",
                fontFamily: "Inter, Roboto, sans-serif",
                display: "flex", flexDirection: "column",
            }}>
                {/* Nav */}
                <Box sx={{
                    px: 8, py: 2.5,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    borderBottom: "1px solid #ede9e3",
                }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 15, color: "#1c1917", letterSpacing: "-0.01em" }}>
                        Ryan Malley
                    </Typography>
                    <Box sx={{ display: "flex", gap: 3 }}>
                        {["Software", "Hardware", "Tabletop"].map((t) => (
                            <Typography key={t} sx={{ fontSize: 13, color: "#78716c" }}>{t}</Typography>
                        ))}
                    </Box>
                </Box>

                {/* Hero */}
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", px: 8 }}>
                    <Box sx={{ width: "100%" }}>
                        <Box sx={{ textAlign: "center", mb: 5 }}>
                            <Typography sx={{ fontSize: 11, color: "#c2410c", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", mb: 2 }}>
                                Software Engineer
                            </Typography>
                            <Typography sx={{ fontSize: 40, fontWeight: 800, color: "#1c1917", letterSpacing: "-0.03em", lineHeight: 1.1, mb: 2 }}>
                                Ryan Malley
                            </Typography>
                            <Typography sx={{ fontSize: 14, color: "#78716c", maxWidth: 380, mx: "auto", lineHeight: 1.65 }}>
                                I build web tools, embedded systems, and tabletop RPG aids.
                            </Typography>
                        </Box>

                        {/* Cards */}
                        <Box sx={{ display: "flex", gap: 2 }}>
                            {[
                                { title: "Software", Icon: Code2, acc: "#4A7C9E", desc: "Web apps and tools." },
                                { title: "Hardware", Icon: Cpu,   acc: "#5A8C5A", desc: "Electronics and builds." },
                                { title: "Tabletop", Icon: Sword, acc: "#c2410c", desc: "D&D tools and aids." },
                            ].map(({ title, Icon, acc, desc }) => (
                                <Box key={title} sx={{
                                    flex: 1, bgcolor: "#ffffff",
                                    border: "1px solid #e8e1d8",
                                    borderRadius: 2, p: 3,
                                    display: "flex", flexDirection: "column", alignItems: "center",
                                    textAlign: "center", gap: 1.5,
                                    "&:hover": { borderColor: acc, boxShadow: `0 4px 16px ${acc}18` },
                                    transition: "border-color 0.15s, box-shadow 0.15s",
                                }}>
                                    <Box sx={{ width: 44, height: 44, bgcolor: `${acc}18`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <Icon size={20} color={acc} />
                                    </Box>
                                    <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#1c1917" }}>{title}</Typography>
                                    <Typography sx={{ fontSize: 12, color: "#a8a29e" }}>{desc}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                </Box>
            </Box>
        </BrowserFrame>
    );
}

// ── Scaled preview card ───────────────────────────────────────────────────────

interface VariantCardProps {
    label: string;
    option: string;
    tagline: string;
    swatches: string[];
    children: React.ReactNode;
}

function VariantCard({ label, option, tagline, swatches, children }: VariantCardProps) {
    return (
        <Box>
            {/* Label */}
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mb: 1.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: "1rem", color: "primary.dark" }}>
                    {label}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
                    {option}
                </Typography>
            </Box>

            {/* Scaled preview */}
            <Box sx={{
                width: CW, height: CH,
                overflow: "hidden",
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                boxShadow: 3,
                flexShrink: 0,
            }}>
                <Box sx={{
                    width: PW, height: PH,
                    transform: `scale(${SCALE})`,
                    transformOrigin: "top left",
                    pointerEvents: "none",
                    userSelect: "none",
                }}>
                    {children}
                </Box>
            </Box>

            {/* Tagline */}
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 1.5, mb: 1, fontSize: "0.8rem", lineHeight: 1.5 }}>
                {tagline}
            </Typography>

            {/* Swatches */}
            <Box sx={{ display: "flex", gap: 0.75 }}>
                {swatches.map((c) => (
                    <Box
                        key={c}
                        title={c}
                        sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: c, border: "1px solid #00000018", flexShrink: 0 }}
                    />
                ))}
            </Box>
        </Box>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DesignPreviewPage() {
    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 6 }}>
            <Container maxWidth="xl">
                <Button
                    component={Link}
                    href="/"
                    startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}
                >
                    Back
                </Button>

                <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark", mb: 0.5 }}>
                    Design Comparison
                </Typography>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 5 }}>
                    Four homepage directions — current state plus three alternatives. Swatches show the key palette colors.
                </Typography>

                <Box sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 5,
                }}>
                    <VariantCard
                        label="Current"
                        option="— parchment palette"
                        tagline="Warm and cozy; suits D&D content but reads as a hobby project rather than an engineering portfolio. The tan card fill (#d5b59c) is the heaviest contributor to the 'old' feeling."
                        swatches={["#F1EEE7", "#d5b59c", "#887569", "#5F5149"]}
                    >
                        <CurrentVariant />
                    </VariantCard>

                    <VariantCard
                        label="Option A"
                        option="— Dark Dev Tool"
                        tagline="Signals deep technical credibility immediately. Indigo accent pops against dark surfaces. Adds a bio and tech-stack meta to each card. The D&D section becomes an interesting contrast rather than the default tone."
                        swatches={["#0f1117", "#1a1d27", "#6366f1", "#22d3ee", "#f59e0b"]}
                    >
                        <DarkVariant />
                    </VariantCard>

                    <VariantCard
                        label="Option B"
                        option="— Minimal Editorial"
                        tagline="High contrast, extremely legible. Work leads; design gets out of the way. The numbered list card layout adds editorial structure. Most similar to respected personal engineering sites (Cassidy Williams, Lee Robinson)."
                        swatches={["#fafaf9", "#ffffff", "#7c3aed", "#111827", "#6b7280"]}
                    >
                        <MinimalVariant />
                    </VariantCard>

                    <VariantCard
                        label="Option C"
                        option="— Warm Rebrand"
                        tagline="Closest evolution of the current design. Keeps the warmth and centered layout but replaces the tan card fill with white, adds a nav bar, bio text, and an accent color that's more saturated and intentional."
                        swatches={["#faf8f5", "#ffffff", "#c2410c", "#1c1917", "#78716c"]}
                    >
                        <WarmVariant />
                    </VariantCard>
                </Box>

                <Box sx={{ mt: 6, p: 3, bgcolor: "background.paper", borderRadius: 2, maxWidth: 680 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "primary.dark", mb: 1 }}>
                        What all three alternatives share
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 3, "& li": { mb: 0.5 } }}>
                        {[
                            "A sticky top navigation — eliminates the back-button-only pattern",
                            "A 1–2 sentence bio above the cards",
                            "White card surfaces (no fill color) — the single biggest modernizing change",
                            "A more intentional accent color rather than the murky warm gray primary",
                        ].map((t) => (
                            <Typography key={t} component="li" variant="body2" sx={{ color: "text.secondary" }}>
                                {t}
                            </Typography>
                        ))}
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}
