"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Box, Container, Typography, Button, CircularProgress } from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Hammer } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

// Placeholder — the old SVG + tokensJson board canvas was removed as part of
// the VTT overhaul's Phase 0 schema change (tokens are now their own
// VttToken model, not a blob on VttBoard). This page comes back for real in
// Phase 1 (Konva rendering shell) and Phase 2 (tokens). See the VTT
// development roadmap for the full phase breakdown.
export default function VttBoardPage() {
    const { campaignId, boardId } = useParams<{ campaignId: string; boardId: string }>();
    const router = useRouter();

    const [boardName, setBoardName] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        client.models.VttBoard.get({ id: boardId }).then(({ data }) => {
            if (!data) { router.push(`/tabletop/campaigns/${campaignId}/vtt`); return; }
            setBoardName(data.name ?? "");
            setLoading(false);
        });
    }, [boardId, campaignId, router]);

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
                <CircularProgress sx={{ color: "primary.main" }} />
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="sm">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}/vtt`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back to Boards
                </Button>

                <Box sx={{ textAlign: "center", py: 8 }}>
                    <Hammer size={40} color="#c9a87c" style={{ marginBottom: 12 }} />
                    <Typography variant="h5" sx={{ fontWeight: 700, color: "primary.dark", mb: 1 }}>
                        {boardName}
                    </Typography>
                    <Typography variant="body1" sx={{ color: "text.secondary" }}>
                        This board's canvas is being rebuilt on a new rendering engine with map images,
                        real token art, and fog of war. Check back as the VTT overhaul phases land.
                    </Typography>
                </Box>
            </Container>
        </Box>
    );
}
