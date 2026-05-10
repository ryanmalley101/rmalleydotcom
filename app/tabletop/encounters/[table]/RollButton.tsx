"use client";

import { useState } from "react";
import { Box, Button, Card, CardContent, Chip, Typography } from "@mui/material";
import { Dices } from "lucide-react";
import type { EncounterEntry } from "@/lib/encounterTables";

interface RollButtonProps {
    entries: EncounterEntry[];
}

export default function RollButton({ entries }: RollButtonProps) {
    const [result, setResult] = useState<EncounterEntry | null>(null);

    const roll = () => {
        const index = Math.floor(Math.random() * entries.length);
        setResult(entries[index]);
    };

    return (
        <Box sx={{ mb: 5 }}>
            <Button
                variant="contained"
                size="large"
                startIcon={<Dices size={20} />}
                onClick={roll}
                sx={{ mb: result ? 3 : 0 }}
            >
                Roll d100
            </Button>

            {result && (
                <Card
                    elevation={3}
                    sx={{
                        backgroundColor: "background.paper",
                        borderLeft: "4px solid",
                        borderColor: "primary.main",
                    }}
                >
                    <CardContent sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                        <Chip
                            label={result.roll}
                            sx={{
                                fontWeight: 700,
                                fontSize: "1rem",
                                minWidth: 52,
                                backgroundColor: "primary.main",
                                color: "#fff",
                                flexShrink: 0,
                            }}
                        />
                        <Typography variant="body1" sx={{ color: "text.primary", lineHeight: 1.7 }}>
                            {result.description}
                        </Typography>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}
