"use client";

import { useEffect, useState } from "react";
import { Box, Paper, Typography, Button, CircularProgress, Divider, Collapse } from "@mui/material";
import Link from "next/link";
import { History, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { MarkdownContent } from "@/lib/MarkdownContent";

const client = generateClient<Schema>();
type Session = Schema["CampaignSession"]["type"];

// Most recent session wins: highest session number, then latest date, then
// latest createdAt — so unnumbered sessions still resolve sensibly.
function compareSessionsDesc(a: Session, b: Session): number {
    const an = a.sessionNumber, bn = b.sessionNumber;
    if (an != null && bn != null && an !== bn) return bn - an;
    if ((an == null) !== (bn == null)) return an == null ? 1 : -1;
    const d = (b.date ?? "").localeCompare(a.date ?? "");
    if (d !== 0) return d;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
}

async function loadPreviousSession(campaignId: string, excludeId?: string | null): Promise<Session | null> {
    const all: Session[] = [];
    let nextToken: string | null | undefined;
    do {
        const res = await client.models.CampaignSession.list({
            filter: { campaignId: { eq: campaignId } },
            nextToken,
        });
        all.push(...(res.data ?? []));
        nextToken = res.nextToken;
    } while (nextToken);
    const candidates = all.filter(s => s.id !== excludeId);
    candidates.sort(compareSessionsDesc);
    return candidates[0] ?? null;
}

function Section({ title, body, empty }: { title: string; body?: string | null; empty: string }) {
    return (
        <Box>
            <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700, lineHeight: 1.6 }}>
                {title}
            </Typography>
            {body?.trim() ? (
                <MarkdownContent>{body}</MarkdownContent>
            ) : (
                <Typography variant="body2" sx={{ color: "text.disabled", fontStyle: "italic" }}>{empty}</Typography>
            )}
        </Box>
    );
}

// Read-only reference panel for the new-session page: shows where the last
// session left off (recap first, since that's what the next prep builds on).
export function PreviousSessionSidebar({ campaignId, excludeId }: { campaignId: string; excludeId?: string | null }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [prepOpen, setPrepOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        loadPreviousSession(campaignId, excludeId)
            .then(s => { if (!cancelled) setSession(s); })
            .catch(() => { if (!cancelled) setSession(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // excludeId changes once the draft autosaves; the previous session doesn't, so load once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campaignId]);

    return (
        <Paper variant="outlined" sx={{
            p: 2.5,
            position: { md: "sticky" }, top: { md: 24 },
            maxHeight: { md: "calc(100vh - 48px)" }, overflowY: { md: "auto" },
        }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <History size={18} color="#8C5A3A" />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "primary.dark", flex: 1 }}>
                    Last Session
                </Typography>
                {session && (
                    <Button component={Link} href={`/tabletop/campaigns/${campaignId}/sessions/${session.id}`}
                        target="_blank" size="small" endIcon={<ExternalLink size={12} />}
                        sx={{ fontSize: "0.7rem", minWidth: 0 }}>
                        Open
                    </Button>
                )}
            </Box>

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={22} /></Box>
            ) : !session ? (
                <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic" }}>
                    No previous sessions — this is the first one.
                </Typography>
            ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <Box>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                            {session.sessionNumber != null ? `Session #${session.sessionNumber}` : "Session"}
                            {session.date ? ` · ${session.date}` : ""}
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {session.title || "Untitled Session"}
                        </Typography>
                    </Box>
                    <Divider />
                    <Section title="Session Recap" body={session.sessionNotes} empty="No recap was written." />
                    <Section title="Player Summary" body={session.playerSummary} empty="No player summary." />
                    {session.prepNotes?.trim() && (
                        <Box>
                            <Button size="small" onClick={() => setPrepOpen(o => !o)}
                                startIcon={prepOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                sx={{ p: 0, minWidth: 0, color: "text.secondary", fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.08em" }}>
                                PREP NOTES
                            </Button>
                            <Collapse in={prepOpen}>
                                <Box sx={{ mt: 1 }}>
                                    <MarkdownContent dim>{session.prepNotes}</MarkdownContent>
                                </Box>
                            </Collapse>
                        </Box>
                    )}
                </Box>
            )}
        </Paper>
    );
}
