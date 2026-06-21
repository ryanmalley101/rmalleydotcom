"use client";

import { useState, useEffect } from "react";
import { Box, Paper, Typography, LinearProgress, Chip } from "@mui/material";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type Quest = Schema["Quest"]["type"];
interface Objective { text: string; done: boolean }

function parseObjectives(json: string | null | undefined): Objective[] {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

export function QuestProgress({ campaignId }: { campaignId: string }) {
    const [quests, setQuests] = useState<Quest[]>([]);

    useEffect(() => {
        client.models.Quest.list().then(({ data }) => {
            setQuests((data ?? []).filter(q => q.campaignId === campaignId && q.status === "active"));
        });
    }, [campaignId]);

    if (quests.length === 0) {
        return (
            <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
                <Typography variant="body2" sx={{ color: "text.disabled" }}>
                    No active quests.
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {quests.map(quest => {
                    const objectives = parseObjectives(quest.objectivesJson);
                    const done = objectives.filter(o => o.done).length;
                    const pct = objectives.length > 0 ? (done / objectives.length) * 100 : 0;
                    return (
                        <Box key={quest.id}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{quest.title}</Typography>
                                <Chip label={`${done}/${objectives.length}`} size="small" sx={{ height: 18, fontSize: "0.6rem" }} />
                            </Box>
                            <LinearProgress variant="determinate" value={pct}
                                sx={{ height: 6, borderRadius: 3, mt: 0.5, backgroundColor: "#e0e0e0",
                                    "& .MuiLinearProgress-bar": { backgroundColor: "primary.main" } }} />
                        </Box>
                    );
                })}
            </Box>
        </Paper>
    );
}
