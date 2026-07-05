"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
    Box, Button, CircularProgress, Container, Dialog, DialogActions,
    DialogContent, DialogTitle, Typography, Tooltip,
} from "@mui/material";
import Link from "next/link";
import { ArrowLeft, Plus, Users } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { useCampaignRole } from "@/lib/useCampaignRole";
import { TimelineView } from "./_components/TimelineView";
import { EventDialog } from "./_components/EventDialog";

const client = generateClient<Schema>();
type Campaign        = Schema["Campaign"]["type"];
type CampaignSession = Schema["CampaignSession"]["type"];
type TimelineEvent   = Schema["TimelineEvent"]["type"];
type WikiArticle     = Schema["WikiArticle"]["type"];

export default function TimelinePage() {
    const { campaignId } = useParams<{ campaignId: string }>();

    const { isGm: isGM, loading: roleLoading } = useCampaignRole(campaignId);

    const [campaign, setCampaign]         = useState<Campaign | null>(null);
    const [sessions, setSessions]         = useState<CampaignSession[]>([]);
    const [events, setEvents]             = useState<TimelineEvent[]>([]);
    const [articles, setArticles]         = useState<WikiArticle[]>([]);
    const [loading, setLoading]           = useState(true);
    const [dialogOpen, setDialogOpen]     = useState(false);
    const [editing, setEditing]           = useState<TimelineEvent | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<TimelineEvent | null>(null);
    const [deleting, setDeleting]         = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        // TimelineEvent was added recently — guard against the model not being
        // present if the sandbox hasn't been redeployed since the schema change.
        if (!client.models.TimelineEvent) {
            const campaignRes = await client.models.Campaign.get({ id: campaignId });
            setCampaign(campaignRes.data);
            setLoading(false);
            return;
        }
        const [campaignRes, sessionsRes, eventsRes] = await Promise.all([
            client.models.Campaign.get({ id: campaignId }),
            client.models.CampaignSession.list(),
            client.models.TimelineEvent.list(),
        ]);
        const camp = campaignRes.data;
        setCampaign(camp);

        const filteredSessions = (sessionsRes.data ?? [])
            .filter(s => s.campaignId === campaignId)
            .sort((a, b) => (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0));
        setSessions(filteredSessions);

        const filteredEvents = (eventsRes.data ?? [])
            .filter(e => e.campaignId === campaignId);
        setEvents(filteredEvents);

        const worldIds = (camp?.worldIds ?? []).filter((id): id is string => !!id);
        if (worldIds.length > 0) {
            const artRes = await client.models.WikiArticle.list();
            setArticles((artRes.data ?? []).filter(a => worldIds.includes(a.worldId)));
        }
        setLoading(false);
    }, [campaignId]);

    useEffect(() => { load(); }, [load]);

    async function confirmDelete() {
        if (!deleteTarget) return;
        setDeleting(true);
        await client.models.TimelineEvent.delete({ id: deleteTarget.id });
        setDeleteTarget(null);
        setDeleting(false);
        load();
    }

    const worldIds = (campaign?.worldIds ?? []).filter((id): id is string => !!id);
    const pageLoading = loading || roleLoading;

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />}
                    sx={{ mb: 3, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, flexWrap: "wrap", gap: 2 }}>
                    <Box>
                        <Typography variant="h4" component="h1" sx={{ fontFamily: "'Cinzel', serif", fontWeight: 700 }}>
                            Chronicle
                        </Typography>
                        {campaign && (
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                {campaign.name}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{ display: "flex", gap: 1.5 }}>
                        <Tooltip title="Player view">
                            <Button component={Link}
                                href={`/tabletop/campaigns/${campaignId}/timeline/player-view`}
                                variant="outlined" size="small" startIcon={<Users size={14} />}>
                                Player View
                            </Button>
                        </Tooltip>
                        {isGM && (
                            <Button variant="contained" startIcon={<Plus size={16} />}
                                onClick={() => { setEditing(null); setDialogOpen(true); }}
                                sx={{ backgroundColor: "primary.dark", "&:hover": { backgroundColor: "primary.main" } }}>
                                Add Event
                            </Button>
                        )}
                    </Box>
                </Box>

                {pageLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
                        <CircularProgress />
                    </Box>
                ) : !client.models.TimelineEvent ? (
                    <Box sx={{ textAlign: "center", py: 10 }}>
                        <Typography sx={{ color: "text.secondary" }}>
                            Chronicle feature needs a backend deploy — run <code>npx ampx sandbox</code> to activate it.
                        </Typography>
                    </Box>
                ) : (
                    <TimelineView
                        events={events}
                        sessions={sessions}
                        articles={articles}
                        campaignId={campaignId}
                        isGM={isGM}
                        onEdit={event => { setEditing(event); setDialogOpen(true); }}
                        onDelete={setDeleteTarget}
                    />
                )}

                <EventDialog
                    open={dialogOpen}
                    editing={editing}
                    campaignId={campaignId}
                    worldIds={worldIds}
                    onClose={() => setDialogOpen(false)}
                    onSaved={load}
                />

                <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
                    <DialogTitle>Delete Event?</DialogTitle>
                    <DialogContent>
                        <Typography>
                            Permanently delete &quot;{deleteTarget?.title}&quot;? This cannot be undone.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={confirmDelete} disabled={deleting}>
                            {deleting ? "Deleting…" : "Delete"}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
