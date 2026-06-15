"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
    Box, Container, Typography, Button, TextField, Chip,
    CircularProgress, Card, CardContent, CardActionArea,
    IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
    DialogActions, Collapse, Select, MenuItem, FormControl, InputLabel,
    Checkbox, Autocomplete,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Plus, ScrollText, Pencil, Trash2, ChevronDown, ChevronUp, CheckSquare } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type Quest = Schema["Quest"]["type"];
type NPC   = Schema["NPC"]["type"];

type QuestStatus = "active" | "completed" | "failed" | "on_hold";

interface Objective { text: string; done: boolean; }

const STATUS_COLORS: Record<QuestStatus, string> = {
    active: "#15803d",
    completed: "#1d4ed8",
    failed: "#b91c1c",
    on_hold: "#b45309",
};

interface QuestForm {
    title: string;
    description: string;
    status: QuestStatus;
    questGiver: string;
    reward: string;
    notes: string;
    objectives: Objective[];
}

const EMPTY_FORM: QuestForm = {
    title: "", description: "", status: "active",
    questGiver: "", reward: "", notes: "",
    objectives: [],
};

function ObjectiveList({ objectives, onChange }: { objectives: Objective[]; onChange: (o: Objective[]) => void }) {
    const [draft, setDraft] = useState("");
    function add() {
        const t = draft.trim();
        if (!t) return;
        onChange([...objectives, { text: t, done: false }]);
        setDraft("");
    }
    return (
        <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, color: "primary.dark" }}>Objectives</Typography>
            {objectives.map((obj, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 0.5 }}>
                    <Checkbox size="small" checked={obj.done}
                        onChange={e => {
                            const next = [...objectives];
                            next[i] = { ...obj, done: e.target.checked };
                            onChange(next);
                        }} sx={{ p: 0.5, mt: 0.25 }} />
                    <TextField size="small" fullWidth value={obj.text}
                        onChange={e => {
                            const next = [...objectives];
                            next[i] = { ...obj, text: e.target.value };
                            onChange(next);
                        }}
                        sx={{ "& input": { textDecoration: obj.done ? "line-through" : "none", color: obj.done ? "text.disabled" : "text.primary" } }}
                    />
                    <IconButton size="small" onClick={() => onChange(objectives.filter((_, j) => j !== i))}>
                        <Trash2 size={13} />
                    </IconButton>
                </Box>
            ))}
            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                <TextField size="small" placeholder="New objective…" value={draft} fullWidth
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
                <Button size="small" onClick={add} sx={{ whiteSpace: "nowrap" }}>Add</Button>
            </Box>
        </Box>
    );
}

function QuestFormPanel({ value, onChange, npcNames }: { value: QuestForm; onChange: (v: QuestForm) => void; npcNames: string[] }) {
    const f = (field: keyof QuestForm) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            onChange({ ...value, [field]: e.target.value });
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <TextField label="Title *" required value={value.title} onChange={f("title")} sx={{ flex: "2 1 200px" }} />
                <FormControl sx={{ flex: "1 1 140px" }} size="small">
                    <InputLabel>Status</InputLabel>
                    <Select label="Status" value={value.status}
                        onChange={e => onChange({ ...value, status: e.target.value as QuestStatus })}>
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="on_hold">On Hold</MenuItem>
                        <MenuItem value="completed">Completed</MenuItem>
                        <MenuItem value="failed">Failed</MenuItem>
                    </Select>
                </FormControl>
            </Box>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <Autocomplete
                    freeSolo options={npcNames} value={value.questGiver}
                    onInputChange={(_, v) => onChange({ ...value, questGiver: v })}
                    sx={{ flex: "1 1 160px" }}
                    renderInput={params => <TextField {...params} label="Quest Giver" size="small" />}
                />
                <TextField label="Reward" value={value.reward} onChange={f("reward")} sx={{ flex: "1 1 160px" }} size="small" />
            </Box>
            <TextField label="Description" multiline minRows={2} value={value.description} onChange={f("description")} fullWidth />
            <ObjectiveList objectives={value.objectives} onChange={o => onChange({ ...value, objectives: o })} />
            <TextField label="Notes" multiline minRows={2} value={value.notes} onChange={f("notes")} fullWidth />
        </Box>
    );
}

export default function QuestsPage() {
    const { campaignId } = useParams<{ campaignId: string }>();

    const [quests, setQuests]         = useState<Quest[]>([]);
    const [npcNames, setNpcNames]     = useState<string[]>([]);
    const [loading, setLoading]       = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [editQuest, setEditQuest]   = useState<Quest | null>(null);
    const [deleteQuest, setDeleteQuest] = useState<Quest | null>(null);
    const [form, setForm]             = useState<QuestForm>({ ...EMPTY_FORM });
    const [saving, setSaving]         = useState(false);
    const [expanded, setExpanded]     = useState<Record<string, boolean>>({});
    const [statusFilter, setStatusFilter] = useState<QuestStatus | "all">("all");

    async function load() {
        const [questRes, npcRes] = await Promise.all([
            client.models.Quest.list(),
            client.models.NPC.list(),
        ]);
        setQuests((questRes.data ?? []).filter(q => q.campaignId === campaignId));
        setNpcNames(
            (npcRes.data ?? [])
                .filter(n => n.campaignId === campaignId && n.name)
                .map(n => n.name)
                .sort()
        );
        setLoading(false);
    }

    useEffect(() => { load(); }, [campaignId]);

    async function handleCreate() {
        if (!form.title.trim()) return;
        setSaving(true);
        await client.models.Quest.create({
            campaignId,
            title: form.title.trim(),
            description: form.description || undefined,
            status: form.status,
            questGiver: form.questGiver || undefined,
            reward: form.reward || undefined,
            notes: form.notes || undefined,
            objectivesJson: JSON.stringify(form.objectives),
        });
        setSaving(false);
        setCreateOpen(false);
        setForm({ ...EMPTY_FORM });
        load();
    }

    async function handleEdit() {
        if (!editQuest || !form.title.trim()) return;
        setSaving(true);
        await client.models.Quest.update({
            id: editQuest.id,
            title: form.title.trim(),
            description: form.description || undefined,
            status: form.status,
            questGiver: form.questGiver || undefined,
            reward: form.reward || undefined,
            notes: form.notes || undefined,
            objectivesJson: JSON.stringify(form.objectives),
        });
        setSaving(false);
        setEditQuest(null);
        load();
    }

    async function handleDelete() {
        if (!deleteQuest) return;
        await client.models.Quest.delete({ id: deleteQuest.id });
        setDeleteQuest(null);
        load();
    }

    async function toggleObjective(quest: Quest, idx: number) {
        const objectives: Objective[] = JSON.parse(quest.objectivesJson ?? "[]");
        objectives[idx] = { ...objectives[idx], done: !objectives[idx].done };
        await client.models.Quest.update({ id: quest.id, objectivesJson: JSON.stringify(objectives) });
        load();
    }

    function openEdit(q: Quest) {
        setEditQuest(q);
        setForm({
            title: q.title, description: q.description ?? "",
            status: (q.status as QuestStatus) ?? "active",
            questGiver: q.questGiver ?? "", reward: q.reward ?? "",
            notes: q.notes ?? "",
            objectives: JSON.parse(q.objectivesJson ?? "[]"),
        });
    }

    const filtered = quests.filter(q => statusFilter === "all" || q.status === statusFilter);

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 3, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <ScrollText size={26} color="#8C5A3A" />
                        <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>Quests</Typography>
                        <Chip label={`${quests.length} total`} size="small" />
                    </Box>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                        {(["all", "active", "on_hold", "completed", "failed"] as const).map(s => (
                            <Chip key={s} label={s === "all" ? "All" : s.replace("_", " ")}
                                onClick={() => setStatusFilter(s)}
                                variant={statusFilter === s ? "filled" : "outlined"}
                                size="small"
                                sx={statusFilter === s && s !== "all" ? { backgroundColor: STATUS_COLORS[s as QuestStatus], color: "#fff" } : {}} />
                        ))}
                        <Button variant="contained" startIcon={<Plus size={16} />}
                            onClick={() => { setForm({ ...EMPTY_FORM }); setCreateOpen(true); }}
                            sx={{ backgroundColor: "primary.main" }}>
                            New Quest
                        </Button>
                    </Box>
                </Box>

                {filtered.length === 0 ? (
                    <Box sx={{ textAlign: "center", py: 10 }}>
                        <ScrollText size={40} color="#c9a87c" style={{ marginBottom: 12 }} />
                        <Typography sx={{ color: "text.secondary" }}>
                            {quests.length === 0 ? "No quests yet. Create one to track your party's objectives." : "No quests match this filter."}
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                        {filtered.map(quest => {
                            const objectives: Objective[] = JSON.parse(quest.objectivesJson ?? "[]");
                            const doneCount = objectives.filter(o => o.done).length;
                            return (
                                <Card key={quest.id} sx={{ borderLeft: "4px solid", borderColor: STATUS_COLORS[(quest.status as QuestStatus) ?? "active"] }}>
                                    <Box sx={{ display: "flex", alignItems: "stretch" }}>
                                        <CardActionArea sx={{ flex: 1 }} onClick={() => setExpanded(p => ({ ...p, [quest.id]: !p[quest.id] }))}>
                                            <CardContent sx={{ py: 1.5 }}>
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "primary.dark" }}>
                                                        {quest.title}
                                                    </Typography>
                                                    <Chip label={quest.status?.replace("_", " ") ?? "active"} size="small"
                                                        sx={{ height: 18, fontSize: "0.65rem", textTransform: "capitalize",
                                                            backgroundColor: STATUS_COLORS[(quest.status as QuestStatus) ?? "active"] + "22",
                                                            color: STATUS_COLORS[(quest.status as QuestStatus) ?? "active"] }} />
                                                    {quest.questGiver && (
                                                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                                            from {quest.questGiver}
                                                        </Typography>
                                                    )}
                                                    {objectives.length > 0 && (
                                                        <Chip icon={<CheckSquare size={10} />}
                                                            label={`${doneCount}/${objectives.length}`} size="small"
                                                            sx={{ height: 18, fontSize: "0.65rem" }} />
                                                    )}
                                                </Box>
                                                {quest.description && !expanded[quest.id] && (
                                                    <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5,
                                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                        {quest.description}
                                                    </Typography>
                                                )}
                                            </CardContent>
                                        </CardActionArea>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, pr: 1 }}>
                                            <IconButton size="small" onClick={() => setExpanded(p => ({ ...p, [quest.id]: !p[quest.id] }))}>
                                                {expanded[quest.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </IconButton>
                                            <Tooltip title="Edit">
                                                <IconButton size="small" onClick={() => openEdit(quest)}><Pencil size={14} /></IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton size="small" color="error" onClick={() => setDeleteQuest(quest)}><Trash2 size={14} /></IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                    <Collapse in={!!expanded[quest.id]}>
                                        <CardContent sx={{ pt: 0, pb: "12px !important" }}>
                                            {quest.description && (
                                                <Typography variant="body2" sx={{ mb: 1.5 }}>{quest.description}</Typography>
                                            )}
                                            {objectives.length > 0 && (
                                                <Box sx={{ mb: 1.5 }}>
                                                    {objectives.map((obj, i) => (
                                                        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                            <Checkbox size="small" checked={obj.done}
                                                                onChange={() => toggleObjective(quest, i)} sx={{ p: 0.5 }} />
                                                            <Typography variant="body2"
                                                                sx={{ textDecoration: obj.done ? "line-through" : "none",
                                                                    color: obj.done ? "text.disabled" : "text.primary" }}>
                                                                {obj.text}
                                                            </Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            )}
                                            {quest.reward && (
                                                <Typography variant="body2" sx={{ mb: 0.5 }}><strong>Reward:</strong> {quest.reward}</Typography>
                                            )}
                                            {quest.notes && (
                                                <Typography variant="body2" sx={{ color: "text.secondary" }}>{quest.notes}</Typography>
                                            )}
                                        </CardContent>
                                    </Collapse>
                                </Card>
                            );
                        })}
                    </Box>
                )}

                {/* Create Dialog */}
                <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>New Quest</DialogTitle>
                    <DialogContent sx={{ pt: 2 }}><QuestFormPanel value={form} onChange={setForm} npcNames={npcNames} /></DialogContent>
                    <DialogActions>
                        <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button variant="contained" onClick={handleCreate} disabled={saving || !form.title.trim()}
                            sx={{ backgroundColor: "primary.main" }}>
                            {saving ? <CircularProgress size={16} /> : "Create"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={!!editQuest} onClose={() => setEditQuest(null)} maxWidth="sm" fullWidth>
                    <DialogTitle>Edit Quest</DialogTitle>
                    <DialogContent sx={{ pt: 2 }}><QuestFormPanel value={form} onChange={setForm} npcNames={npcNames} /></DialogContent>
                    <DialogActions>
                        <Button onClick={() => setEditQuest(null)}>Cancel</Button>
                        <Button variant="contained" onClick={handleEdit} disabled={saving || !form.title.trim()}
                            sx={{ backgroundColor: "primary.main" }}>
                            {saving ? <CircularProgress size={16} /> : "Save"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete confirmation */}
                <Dialog open={!!deleteQuest} onClose={() => setDeleteQuest(null)}>
                    <DialogTitle>Delete "{deleteQuest?.title}"?</DialogTitle>
                    <DialogContent><Typography>This cannot be undone.</Typography></DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteQuest(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={handleDelete}>Delete</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
