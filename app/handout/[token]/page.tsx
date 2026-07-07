"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Box, CircularProgress, Container, Typography } from "@mui/material";
import { Amplify } from "aws-amplify";
import { getUrl } from "aws-amplify/storage";
import outputs from "@/amplify_outputs.json";
import { MarkdownContent } from "@/lib/MarkdownContent";

// Configure Amplify for this public route. Guest credentials via the
// Cognito Identity Pool handle the S3 fetch — no login required.
Amplify.configure(outputs, { ssr: false });

interface HandoutContent {
    title: string;
    content: string;
    imageKeys: string[];
}

export default function PublicHandoutPage() {
    const { token } = useParams<{ token: string }>();
    const [handout, setHandout] = useState<HandoutContent | null>(null);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { url } = await getUrl({
                    path: `handouts/${token}/content.json`,
                    options: { expiresIn: 3600 },
                });
                const res = await fetch(url.toString());
                if (!res.ok) { setNotFound(true); return; }
                const data: HandoutContent = await res.json();
                setHandout(data);

                // Resolve image URLs
                if (data.imageKeys?.length) {
                    const resolved = await Promise.all(
                        data.imageKeys.map(async key => {
                            try {
                                const { url: u } = await getUrl({ path: key, options: { expiresIn: 3600 } });
                                return u.toString();
                            } catch { return null; }
                        })
                    );
                    setImageUrls(resolved.filter((u): u is string => !!u));
                }
            } catch {
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        })();
    }, [token]);

    if (loading) {
        return (
            <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: "#f0e6d0" }}>
                <CircularProgress sx={{ color: "#9a3412" }} />
            </Box>
        );
    }

    if (notFound || !handout) {
        return (
            <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: "#f0e6d0" }}>
                <Box sx={{ textAlign: "center" }}>
                    <Typography variant="h5" sx={{ color: "#7c2d12", fontFamily: "Georgia, serif", mb: 1 }}>
                        Handout not found
                    </Typography>
                    <Typography sx={{ color: "#92400e" }}>
                        This link may have expired or been unpublished by the GM.
                    </Typography>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "#f0e6d0", py: 6 }}>
            <Container maxWidth="sm">
                {/* Parchment card */}
                <Box sx={{
                    backgroundColor: "#fef9f0",
                    border: "1px solid rgba(154,52,18,0.2)",
                    borderRadius: 2,
                    p: { xs: 3, sm: 5 },
                    boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                }}>
                    <Typography variant="h4" sx={{
                        fontFamily: "'Georgia', serif", fontWeight: 700,
                        color: "#7c2d12", mb: 3, lineHeight: 1.3,
                    }}>
                        {handout.title}
                    </Typography>

                    {handout.content && (
                        <MarkdownContent sx={{ color: "#1c0a00" }}>{handout.content}</MarkdownContent>
                    )}

                    {imageUrls.length > 0 && (
                        <Box sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 2 }}>
                            {imageUrls.map((url, i) => (
                                <Box key={i} component="img" src={url} alt=""
                                    sx={{ width: "100%", borderRadius: 1.5,
                                        border: "1px solid rgba(154,52,18,0.15)",
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }} />
                            ))}
                        </Box>
                    )}

                    <Box sx={{ mt: 4, pt: 2, borderTop: "1px solid rgba(154,52,18,0.15)" }}>
                        <Typography variant="caption" sx={{ color: "#a8856b" }}>
                            Shared via rmalley.com campaign tools
                        </Typography>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}
