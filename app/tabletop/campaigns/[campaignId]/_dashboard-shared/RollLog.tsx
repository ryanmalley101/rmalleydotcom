"use client";

import { useState, useEffect } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { Dices } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type RollLogEntry = Schema["RollLogEntry"]["type"];

const MAX_SHOWN = 20;

function timeAgo(iso: string | null | undefined): string {
    if (!iso) return "";
    const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
}

// Fed by the Roll20 bridge extension watching the chat log — a live feed,
// not a history browser. See RollLogEntry in amplify/data/resource.ts: the
// extension prunes each campaign down to ~50 entries after every write.
export function RollLog({ campaignId }: { campaignId: string }) {
    const [rolls, setRolls] = useState<RollLogEntry[]>([]);

    useEffect(() => {
        let cancelled = false;
        const filter = { campaignId: { eq: campaignId } };

        client.models.RollLogEntry.list({ filter }).then(({ data }) => {
            if (cancelled) return;
            const sorted = (data ?? []).sort((a, b) => (b.rolledAt ?? "").localeCompare(a.rolledAt ?? ""));
            setRolls(sorted.slice(0, MAX_SHOWN));
        });

        console.log("[Roll Log] subscribing for campaign", campaignId);
        const onCreate = client.models.RollLogEntry.onCreate().subscribe({
            next: (item) => {
                console.log("[Roll Log] onCreate fired", item);
                if (!item || item.campaignId !== campaignId) return;
                setRolls(prev => [item, ...prev].slice(0, MAX_SHOWN));
            },
            error: (err) => console.error("[Roll Log] onCreate subscription error", err),
        });

        return () => { cancelled = true; onCreate.unsubscribe(); };
    }, [campaignId]);

    if (rolls.length === 0) {
        return (
            <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="body2" sx={{ color: "text.disabled" }}>
                    No rolls yet — they'll show up here as players roll in Roll20 (requires the Roll20 bridge extension).
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper elevation={1} sx={{ p: 2, mb: 3, maxHeight: 280, overflowY: "auto" }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                {rolls.map(r => (
                    <Box key={r.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Dices size={13} color="#7c2d12" style={{ flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ fontWeight: 700, flex: 1, minWidth: 0,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.characterName}
                        </Typography>
                        {r.formula && (
                            <Typography variant="caption" sx={{ color: "text.secondary", flexShrink: 0 }}>
                                {r.formula}
                            </Typography>
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 700, color: "primary.dark", flexShrink: 0 }}>
                            {r.total}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.disabled", fontSize: "0.65rem", flexShrink: 0 }}>
                            {timeAgo(r.rolledAt)}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Paper>
    );
}
