"use client";

import {
    Box,
    Button,
    Chip,
    Container,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Dices } from "lucide-react";
import type { EncounterTable } from "@/lib/encounterTables";
import RollButton from "./RollButton";

interface Props {
    table: EncounterTable;
}

export default function EncounterTableContent({ table }: Props) {
    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button
                    component={Link}
                    href="/tabletop/encounters"
                    startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}
                >
                    All Tables
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                    <Dices size={32} color="#8C5A3A" />
                    <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                        {table.name}
                    </Typography>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    {table.entries.length} entries &mdash; d100
                </Typography>

                <RollButton entries={table.entries} />

                <Divider sx={{ mb: 4 }} />

                <Typography variant="h6" sx={{ fontWeight: 600, color: "primary.dark", mb: 2 }}>
                    All Entries
                </Typography>

                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700, width: 64, color: "primary.dark" }}>Roll</TableCell>
                            <TableCell sx={{ fontWeight: 700, color: "primary.dark" }}>Encounter</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {table.entries.map(entry => (
                            <TableRow key={entry.roll} hover>
                                <TableCell>
                                    <Chip
                                        label={entry.roll}
                                        size="small"
                                        sx={{ fontWeight: 600, minWidth: 40 }}
                                    />
                                </TableCell>
                                <TableCell sx={{ color: "text.primary", lineHeight: 1.6 }}>
                                    {entry.description}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Container>
        </Box>
    );
}
