"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Box, Container, Typography, Button, TextField, Dialog,
    DialogTitle, DialogContent, DialogActions, MenuItem, Select,
    FormControl, InputLabel, Card, CardContent, IconButton,
    Tooltip, Divider, CircularProgress, Chip, Checkbox,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, CheckSquare, Plus, Pencil, Trash2 } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();
type TodoItem = Schema["TodoItem"]["type"];

const PRIORITIES = ["low", "medium", "high"] as const;
type Priority = typeof PRIORITIES[number];

const priorityLabel: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High" };
const priorityColor: Record<Priority, string> = {
    low: "#3b82f6",
    medium: "#f59e0b",
    high: "#ef4444",
};

const emptyForm = { title: "", description: "", priority: "medium" as Priority, dueDate: "" };
type Filter = "all" | "active" | "completed";

function toPriority(p: string | null | undefined): Priority {
    if (p === "low" || p === "high") return p;
    return "medium";
}

export default function TodosPage() {
    const [todos, setTodos]       = useState<TodoItem[]>([]);
    const [loading, setLoading]   = useState(true);
    const [filter, setFilter]     = useState<Filter>("all");
    const [dialogOpen, setDialog] = useState(false);
    const [editing, setEditing]   = useState<TodoItem | null>(null);
    const [form, setForm]         = useState(emptyForm);
    const [saving, setSaving]     = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    async function load() {
        const { data } = await client.models.TodoItem.list();
        setTodos(
            (data ?? []).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
        );
        setLoading(false);
    }

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        if (filter === "active")    return todos.filter(t => !t.completed);
        if (filter === "completed") return todos.filter(t =>  t.completed);
        return todos;
    }, [todos, filter]);

    function openCreate() {
        setEditing(null);
        setForm(emptyForm);
        setDialog(true);
    }

    function openEdit(t: TodoItem) {
        setEditing(t);
        setForm({
            title:       t.title,
            description: t.description ?? "",
            priority:    toPriority(t.priority),
            dueDate:     t.dueDate ?? "",
        });
        setDialog(true);
    }

    async function save() {
        if (!form.title.trim()) return;
        setSaving(true);
        if (editing) {
            await client.models.TodoItem.update({ id: editing.id, ...form });
        } else {
            await client.models.TodoItem.create({ ...form, completed: false });
        }
        setSaving(false);
        setDialog(false);
        load();
    }

    async function toggleComplete(todo: TodoItem) {
        await client.models.TodoItem.update({ id: todo.id, completed: !todo.completed });
        setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t));
    }

    async function confirmDelete() {
        if (!deleteId) return;
        await client.models.TodoItem.delete({ id: deleteId });
        setDeleteId(null);
        load();
    }

    const activeCt    = todos.filter(t => !t.completed).length;
    const completedCt = todos.filter(t =>  t.completed).length;

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href="/personal" startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 4, color: "primary.main" }}>
                    Back
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <CheckSquare size={32} color="#10b981" />
                        <Typography variant="h3" component="h1" sx={{ fontWeight: 700, color: "text.primary" }}>
                            Todos
                        </Typography>
                    </Box>
                    <Button variant="contained" startIcon={<Plus size={16} />} onClick={openCreate}
                        sx={{ backgroundColor: "#10b981", "&:hover": { backgroundColor: "#059669" } }}>
                        New Todo
                    </Button>
                </Box>

                <Typography variant="body1" sx={{ color: "text.secondary", mb: 3 }}>
                    {activeCt} active · {completedCt} completed
                </Typography>

                {/* Filter */}
                <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
                    {(["all", "active", "completed"] as Filter[]).map(f => (
                        <Button key={f} size="small"
                            variant={filter === f ? "contained" : "text"}
                            onClick={() => setFilter(f)}
                            sx={{
                                textTransform: "capitalize",
                                ...(filter === f
                                    ? { backgroundColor: "#10b981", "&:hover": { backgroundColor: "#059669" } }
                                    : { color: "text.secondary" }
                                ),
                            }}>
                            {f}
                        </Button>
                    ))}
                </Box>

                <Divider sx={{ mb: 3 }} />

                {loading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                        <CircularProgress sx={{ color: "#10b981" }} />
                    </Box>
                ) : filtered.length === 0 ? (
                    <Box sx={{ textAlign: "center", py: 10 }}>
                        <CheckSquare size={48} color="#6b7280" style={{ marginBottom: 12 }} />
                        <Typography sx={{ color: "text.secondary", mb: 2 }}>
                            {filter === "all" ? "No todos yet." : `No ${filter} todos.`}
                        </Typography>
                        {filter === "all" && (
                            <Button variant="outlined" onClick={openCreate}
                                sx={{ borderColor: "#10b981", color: "#10b981" }}>
                                Create your first todo
                            </Button>
                        )}
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                        {filtered.map(todo => {
                            const p = toPriority(todo.priority);
                            return (
                                <Card key={todo.id} sx={{
                                    borderLeft: "4px solid",
                                    borderColor: priorityColor[p],
                                    opacity: todo.completed ? 0.6 : 1,
                                    transition: "opacity 0.15s",
                                }}>
                                    <Box sx={{ display: "flex", alignItems: "center" }}>
                                        <Checkbox
                                            checked={!!todo.completed}
                                            onChange={() => toggleComplete(todo)}
                                            sx={{ color: "#10b981", "&.Mui-checked": { color: "#10b981" } }}
                                        />
                                        <CardContent sx={{
                                            flex: 1,
                                            py: "10px !important",
                                            "&:last-child": { pb: "10px !important" },
                                        }}>
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                                                <Typography sx={{
                                                    fontWeight: 600,
                                                    color: "text.primary",
                                                    textDecoration: todo.completed ? "line-through" : "none",
                                                }}>
                                                    {todo.title}
                                                </Typography>
                                                <Chip
                                                    label={priorityLabel[p]}
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: priorityColor[p] + "22",
                                                        color: priorityColor[p],
                                                        fontWeight: 600,
                                                        fontSize: "0.65rem",
                                                        height: 18,
                                                        border: `1px solid ${priorityColor[p]}44`,
                                                    }}
                                                />
                                                {todo.dueDate && (
                                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                                        Due {todo.dueDate}
                                                    </Typography>
                                                )}
                                            </Box>
                                            {todo.description && (
                                                <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                                                    {todo.description}
                                                </Typography>
                                            )}
                                        </CardContent>
                                        <Box sx={{ display: "flex", alignItems: "center", pr: 1, gap: 0.5 }}>
                                            <Tooltip title="Edit">
                                                <IconButton size="small" onClick={() => openEdit(todo)}>
                                                    <Pencil size={16} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton size="small" color="error" onClick={() => setDeleteId(todo.id)}>
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

                {/* Create / Edit dialog */}
                <Dialog open={dialogOpen} onClose={() => setDialog(false)} fullWidth maxWidth="sm">
                    <DialogTitle>{editing ? "Edit Todo" : "New Todo"}</DialogTitle>
                    <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
                        <TextField
                            label="Title" fullWidth required autoFocus
                            value={form.title}
                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        />
                        <TextField
                            label="Description" fullWidth multiline rows={2}
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        />
                        <Box sx={{ display: "flex", gap: 2 }}>
                            <FormControl fullWidth>
                                <InputLabel>Priority</InputLabel>
                                <Select label="Priority" value={form.priority}
                                    onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}>
                                    {PRIORITIES.map(p => (
                                        <MenuItem key={p} value={p}>{priorityLabel[p]}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <TextField
                                label="Due Date" type="date" fullWidth
                                value={form.dueDate}
                                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDialog(false)}>Cancel</Button>
                        <Button variant="contained" onClick={save}
                            disabled={saving || !form.title.trim()}
                            sx={{ backgroundColor: "#10b981", "&:hover": { backgroundColor: "#059669" } }}>
                            {saving ? <CircularProgress size={18} /> : editing ? "Save" : "Create"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Delete confirmation */}
                <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
                    <DialogTitle>Delete Todo?</DialogTitle>
                    <DialogContent>
                        <Typography>This will permanently delete the todo item.</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteId(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={confirmDelete}>Delete</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
