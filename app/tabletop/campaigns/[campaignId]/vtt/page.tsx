"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Box, Container, Typography, Button, Card, CardActionArea, CardContent,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    CircularProgress, IconButton, Tooltip, Divider, Select, MenuItem,
    FormControl, InputLabel,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, LayoutGrid, Plus, Trash2, Map } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type VttBoard = Schema["VttBoard"]["type"];

function parseTokenCount(json: string | null | undefined): number {
    if (!json) return 0;
    try { return (JSON.parse(json) as unknown[]).length; }
    catch { return 0; }
}

export default function VttListPage() {
    const { campaignId } = useParams<{ campaignId: string }>();
    const router = useRouter();

    const [boards, setBoards] = useState<VttBoard[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newCols, setNewCols] = useState("30");
    const [newRows, setNewRows] = useState("20");
    const [creating, setCreating] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    async function load() {
        const res = await client.models.VttBoard.list();
        setBoards((res.data ?? []).filter(b => b.campaignId === campaignId)
            .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")));
        setLoading(false);
    }

    useEffect(() => { load(); }, [campaignId]);

    async function createBoard() {
        if (!newName.trim()) return;
        setCreating(true);
        const { data } = await client.models.VttBoard.create({
            campaignId,
            name: newName.trim(),
            gridCols: parseInt(newCols, 10) || 30,
            gridRows: parseInt(newRows, 10) || 20,
            tokensJson: "[]",
        });
        setCreating(false);
        setCreateOpen(false);
        setNewName("");
        if (data) router.push(`/tabletop/campaigns/${campaignId}/vtt/${data.id}`);
        else load();
    }

    async function deleteBoard() {
        if (!deleteId) return;
        await client.models.VttBoard.delete({ id: deleteId });
        setDeleteId(null);
        load();
    }

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <LayoutGrid size={32} color="#8C5A3A" />
                        <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                            Virtual Table
                        </Typography>
                    </Box>
                    <Button variant="contained" startIcon={<Plus size={16} />}
                        onClick={() => setCreateOpen(true)}
                        sx={{ backgroundColor: "primary.main", "&:hover": { backgroundColor: "primary.dark" } }}>
                        New Board
                    </Button>
                </Box>
                <Typography variant="body1" sx={{ color: "text.secondary", mb: 4 }}>
                    Drag and drop tokens onto a grid. Token positions sync in real time for all viewers.
                </Typography>

                <Divider sx={{ mb: 4 }} />

                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                        <CircularProgress sx={{ color: "primary.main" }} />
                    </Box>
                ) : boards.length === 0 ? (
                    <Box sx={{ textAlign: "center", py: 10 }}>
                        <Map size={48} color="#c9a87c" style={{ marginBottom: 12 }} />
                        <Typography sx={{ color: "text.secondary", mb: 2 }}>No boards yet.</Typography>
                        <Button variant="outlined" onClick={() => setCreateOpen(true)}
                            sx={{ borderColor: "primary.main", color: "primary.main" }}>
                            Create your first board
                        </Button>
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                        {boards.map(b => {
                            const tokenCount = parseTokenCount(b.tokensJson);
                            return (
                                <Card key={b.id} sx={{ borderLeft: "4px solid", borderColor: "primary.light" }}>
                                    <Box sx={{ display: "flex", alignItems: "stretch" }}>
                                        <CardActionArea
                                            component={Link}
                                            href={`/tabletop/campaigns/${campaignId}/vtt/${b.id}`}
                                            sx={{ flex: 1 }}
                                        >
                                            <CardContent sx={{ py: 1.5 }}>
                                                <Typography variant="h6" sx={{ fontWeight: 700, color: "primary.dark" }}>
                                                    {b.name}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                                    {b.gridCols ?? 30} × {b.gridRows ?? 20} grid
                                                    {" · "}
                                                    {tokenCount} token{tokenCount !== 1 ? "s" : ""}
                                                </Typography>
                                            </CardContent>
                                        </CardActionArea>
                                        <Box sx={{ display: "flex", alignItems: "center", pr: 1 }}>
                                            <Tooltip title="Delete board">
                                                <IconButton size="small" color="error"
                                                    onClick={() => setDeleteId(b.id)}>
                                                    <Trash2 size={16} />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                </Card>
                            );
                        })}
                    </Box>
                )}

                {/* Create dialog */}
                <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>New Board</DialogTitle>
                    <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
                        <TextField label="Board Name" fullWidth required
                            value={newName} onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") createBoard(); }}
                            placeholder="e.g. Tavern Brawl, Dungeon Level 1" />
                        <Box sx={{ display: "flex", gap: 2 }}>
                            <TextField label="Columns" type="number" fullWidth
                                value={newCols} onChange={e => setNewCols(e.target.value)}
                                inputProps={{ min: 10, max: 60 }} />
                            <TextField label="Rows" type="number" fullWidth
                                value={newRows} onChange={e => setNewRows(e.target.value)}
                                inputProps={{ min: 8, max: 40 }} />
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button variant="contained" onClick={createBoard}
                            disabled={creating || !newName.trim()}
                            sx={{ backgroundColor: "primary.main" }}>
                            {creating ? <CircularProgress size={18} /> : "Create"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete dialog */}
                <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
                    <DialogTitle>Delete Board?</DialogTitle>
                    <DialogContent>
                        <Typography>All tokens on this board will be lost.</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={deleteBoard}>Delete</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
