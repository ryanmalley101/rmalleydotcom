"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Box, TextField, IconButton, Typography, Collapse, Autocomplete, Chip, Tooltip } from "@mui/material";
import { Send, Dices, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { DiceRoll } from "@dice-roller/rpg-dice-roller";

const client = generateClient<Schema>();
type ChatMessage = Schema["ChatMessage"]["type"];
type CampaignMember = Schema["CampaignMember"]["type"];

// A live feed, not a history browser — same spirit as the Roll20 bridge's
// roll log, just without the prune-on-write step since nothing else writes
// here at a volume that needs capping yet.
const MAX_SHOWN = 100;

interface ChatPanelProps {
    campaignId: string;
    authorName: string;
    currentUserId?: string | null;
}

export function ChatPanel({ campaignId, authorName, currentUserId }: ChatPanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [members, setMembers] = useState<CampaignMember[]>([]);
    const [recipients, setRecipients] = useState<CampaignMember[]>([]);
    const listEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        const filter = { campaignId: { eq: campaignId } };

        client.models.ChatMessage.list({ filter }).then(({ data }) => {
            if (cancelled) return;
            const sorted = (data ?? []).sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
            setMessages(sorted.slice(-MAX_SHOWN));
        });

        const onCreate = client.models.ChatMessage.onCreate().subscribe({
            next: (item) => {
                if (!item || item.campaignId !== campaignId) return;
                setMessages(prev => prev.some(m => m.id === item.id) ? prev : [...prev, item].slice(-MAX_SHOWN));
            },
            error: (err) => console.error("[VTT Chat] onCreate subscription error", err),
        });

        return () => { cancelled = true; onCreate.unsubscribe(); };
    }, [campaignId]);

    // For the whisper recipient picker — who else is in this campaign.
    useEffect(() => {
        client.models.CampaignMember.list({ filter: { campaignId: { eq: campaignId } } }).then(({ data }) => {
            setMembers((data ?? []).filter(m => m.userId && m.userId !== currentUserId));
        });
    }, [campaignId, currentUserId]);

    useEffect(() => {
        listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages.length]);

    // Read-side filtering only — anyone with direct API access can still
    // call ChatMessage.list() and get whispered rows back; this hides them
    // from the normal UI, it isn't a real privacy boundary. Making it one
    // means tightening ChatMessage's authorization rule, which — like
    // VttToken's ownerId — needs its own isolated, tested change rather than
    // bundling into this pass.
    const visibleMessages = useMemo(() => messages.filter(m => {
        if (!m.whisperToIds?.length) return true;
        if (m.authorId && m.authorId === currentUserId) return true;
        return !!currentUserId && m.whisperToIds.includes(currentUserId);
    }), [messages, currentUserId]);

    async function send() {
        const text = input.trim();
        if (!text) return;
        setInput("");

        const whisperToIds = recipients.length
            ? recipients.map(r => r.userId).filter((id): id is string => !!id)
            : undefined;

        const rollMatch = text.match(/^\/(?:roll|r)\s+(.+)$/i);
        if (rollMatch) {
            const formula = rollMatch[1].trim();
            try {
                const roll = new DiceRoll(formula);
                await client.models.ChatMessage.create({
                    campaignId, authorName, authorId: currentUserId ?? undefined,
                    rollFormula: formula,
                    rollTotal: String(roll.total),
                    rollBreakdownJson: roll.output,
                    whisperToIds,
                });
            } catch {
                await client.models.ChatMessage.create({
                    campaignId, authorName, authorId: currentUserId ?? undefined,
                    text: `Couldn't parse roll: "${formula}"`, whisperToIds,
                });
            }
            return;
        }

        await client.models.ChatMessage.create({ campaignId, authorName, authorId: currentUserId ?? undefined, text, whisperToIds });
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            <Box sx={{ flex: 1, overflowY: "auto", p: 1.5, display: "flex", flexDirection: "column", gap: 1, minHeight: 0 }}>
                {visibleMessages.length === 0 && (
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>
                        No messages yet. Try "/roll 2d6+4".
                    </Typography>
                )}
                {visibleMessages.map(m => (
                    <Box key={m.id}>
                        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, flexWrap: "wrap" }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.dark", flexShrink: 0 }}>
                                {m.authorName}
                            </Typography>
                            {!!m.whisperToIds?.length && (
                                <Tooltip title="Whispered — only visible to selected recipients">
                                    <Box sx={{ display: "flex", color: "text.disabled" }}><Lock size={10} /></Box>
                                </Tooltip>
                            )}
                            {m.rollTotal != null ? (
                                <>
                                    <Dices size={11} />
                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>rolled {m.rollFormula}</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: "primary.dark" }}>{m.rollTotal}</Typography>
                                    {m.rollBreakdownJson && (
                                        <IconButton size="small" sx={{ p: 0.25 }} onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}>
                                            {expandedId === m.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        </IconButton>
                                    )}
                                </>
                            ) : (
                                <Typography variant="body2" sx={{ wordBreak: "break-word" }}>{m.text}</Typography>
                            )}
                        </Box>
                        {m.rollBreakdownJson && (
                            <Collapse in={expandedId === m.id}>
                                <Typography variant="caption" sx={{ color: "text.disabled", display: "block", pl: 2.5, fontFamily: "monospace" }}>
                                    {m.rollBreakdownJson}
                                </Typography>
                            </Collapse>
                        )}
                    </Box>
                ))}
                <div ref={listEndRef} />
            </Box>
            {members.length > 0 && (
                <Autocomplete
                    multiple size="small" options={members}
                    getOptionLabel={m => m.playerName || "Unnamed"}
                    value={recipients}
                    onChange={(_, value) => setRecipients(value)}
                    renderInput={params => (
                        <TextField {...params} placeholder={recipients.length ? "" : "Whisper to… (blank = everyone)"} />
                    )}
                    renderTags={(value, getTagProps) => value.map((option, index) => (
                        <Chip {...getTagProps({ index })} key={option.id} size="small" label={option.playerName || "Unnamed"} />
                    ))}
                    sx={{ px: 1, pt: 1 }}
                />
            )}
            <Box sx={{ display: "flex", gap: 0.5, p: 1, borderTop: "1px solid", borderColor: "divider", flexShrink: 0 }}>
                <TextField size="small" fullWidth placeholder='Message, or "/roll 2d6+4"' value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") send(); }} />
                <IconButton onClick={send} disabled={!input.trim()} color="primary">
                    <Send size={16} />
                </IconButton>
            </Box>
        </Box>
    );
}
