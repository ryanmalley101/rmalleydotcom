"use client";

import { Suspense } from "react";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Authenticator } from "@aws-amplify/ui-react";
import { Amplify } from "aws-amplify";
import { getCurrentUser } from "aws-amplify/auth";
import { Box, CircularProgress } from "@mui/material";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

Amplify.configure(outputs, { ssr: true });

function RedirectIfAuthed({ next }: { next: string }) {
    const router = useRouter();

    useEffect(() => {
        getCurrentUser()
            .then(() => router.replace(next))
            .catch(() => { /* not signed in — show the form */ });
    }, [next, router]);

    return null;
}

function LoginInner() {
    const params = useSearchParams();
    const next = params.get("next") ?? "/tabletop";

    return (
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f0e6d0" }}>
            <Authenticator>
                {() => {
                    // Authenticated — navigate away
                    if (typeof window !== "undefined") {
                        window.location.replace(next);
                    }
                    return (
                        <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
                            <CircularProgress />
                        </Box>
                    );
                }}
            </Authenticator>
            <RedirectIfAuthed next={next} />
        </Box>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CircularProgress />
            </Box>
        }>
            <LoginInner />
        </Suspense>
    );
}
