"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ProfessionalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", display: "flex", alignItems: "center", py: 8 }}>
            <Container maxWidth="sm">
                <Stack spacing={2} alignItems="flex-start">
                    <AlertTriangle size={32} color="#facc15" />
                    <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
                        Something went wrong
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        This page hit an unexpected error. It&apos;s likely a bug in the tool, not something wrong with
                        your scenario, try again or head back and start over.
                    </Typography>
                    <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
                        <Button variant="contained" startIcon={<RotateCcw size={16} />} onClick={() => reset()}>
                            Try again
                        </Button>
                        <Button component={Link} href="/professional" variant="outlined">
                            Back to Professional
                        </Button>
                    </Stack>
                </Stack>
            </Container>
        </Box>
    );
}
