"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { useCampaignRole } from "@/lib/useCampaignRole";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    ArrowLeft, Bookmark, Calendar, ChevronRight, ClipboardList,
    Gauge, LayoutGrid, Map, Plus, Shield, Swords, Users,
} from "lucide-react";

const client = generateClient<Schema>();
type Campaign        = Schema["Campaign"]["type"];
type Session         = Schema["CampaignSession"]["type"];
type PlayerCharacter = Schema["PlayerCharacter"]["type"];
type World           = Schema["DnDWorld"]["type"];
type Encounter       = Schema["Encounter"]["type"];
type CampaignMember  = Schema["CampaignMember"]["type"];
type WorldMap        = Schema["WorldMap"]["type"];

// ── Section divider ───────────────────────────────────────────────────────────
function SectionDivider({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="flex items-center gap-3 my-8">
            <div className="flex items-center gap-2 shrink-0">
                <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary/20 text-primary">
                    <Icon size={13} />
                </div>
                <span className="text-xs font-black uppercase tracking-[0.2em] text-primary font-cinzel">
                    {label}
                </span>
            </div>
            <Separator className="flex-1 bg-border" />
        </div>
    );
}

// ── Palette dot switcher ──────────────────────────────────────────────────────
const DOTS = [
    { key: "shadcn",    color: "#ef6b1a", href: "shadcn",    label: "shadcn/ui" },
    { key: "ember",     color: "#ef6b1a", href: "",          label: "Mantine — Ember" },
    { key: "arcane",    color: "#4dbce9", href: "arcane",    label: "Arcane Midnight" },
    { key: "verdant",   color: "#4ade80", href: "verdant",   label: "Verdant Depths" },
    { key: "void",      color: "#ef4444", href: "void",      label: "Void Crimson" },
    { key: "underdark", color: "#a855f7", href: "underdark", label: "Underdark" },
    { key: "gilded",    color: "#e8c060", href: "gilded",    label: "Gilded Obsidian" },
    { key: "daylight",  color: "#c45214", href: "daylight",  label: "Daylight Parchment" },
] as const;

// ── Tool shortcut card ────────────────────────────────────────────────────────
function ToolCard({ icon: Icon, label, href }: { icon: React.ElementType; label: string; href: string }) {
    return (
        <Link href={href} className="block no-underline group">
            <Card className="border-t-2 border-t-primary/40 transition-colors duration-100 group-hover:bg-primary/5">
                <CardContent className="p-3 flex items-center gap-2">
                    <div className="h-5 w-5 flex items-center justify-center rounded-sm bg-primary text-background shrink-0">
                        <Icon size={12} />
                    </div>
                    <span className="text-sm font-semibold text-foreground flex-1">{label}</span>
                    <ChevronRight size={12} className="text-muted-foreground" />
                </CardContent>
            </Card>
        </Link>
    );
}

// ── Nav card (World section) ──────────────────────────────────────────────────
function NavCard({ icon: Icon, label, desc, href }: {
    icon: React.ElementType; label: string; desc: string; href: string;
}) {
    return (
        <Link href={href} className="block no-underline group">
            <Card className="h-full border-t-2 border-t-primary/40 transition-colors duration-100 group-hover:bg-primary/5">
                <CardHeader className="p-3 pb-1">
                    <div className="flex items-center gap-2">
                        <div className="h-5 w-5 flex items-center justify-center rounded-sm bg-primary/20 text-primary shrink-0">
                            <Icon size={12} />
                        </div>
                        <CardTitle className="text-sm">{label}</CardTitle>
                        <ChevronRight size={12} className="text-muted-foreground ml-auto" />
                    </div>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                    <CardDescription>{desc}</CardDescription>
                </CardContent>
            </Card>
        </Link>
    );
}

// ── Session row ────────────────────────────────────────────────────────────────
function SessionRow({ s, campaignId }: { s: Session; campaignId: string }) {
    return (
        <Link href={`/tabletop/campaigns/${campaignId}/sessions/${s.id}`} className="block no-underline group">
            <Card className={cn(
                "border-l-4 border-l-primary/70 transition-colors duration-100",
                "group-hover:bg-primary/5"
            )}>
                <CardContent className="p-3 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-7 text-center shrink-0">
                        #{s.sessionNumber ?? "?"}
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                            {s.title || "Untitled Session"}
                        </p>
                        {s.prepNotes && (
                            <p className="text-xs text-muted-foreground truncate">{s.prepNotes.slice(0, 100)}</p>
                        )}
                    </div>
                    {s.date && <span className="text-xs text-muted-foreground shrink-0">{s.date}</span>}
                </CardContent>
            </Card>
        </Link>
    );
}

// ── Character card ────────────────────────────────────────────────────────────
function CharCard({ pc, campaignId }: { pc: PlayerCharacter; campaignId: string }) {
    const level = (() => {
        if (!pc.classesJson) return pc.level;
        try { return (JSON.parse(pc.classesJson) as { level: number }[]).reduce((s, c) => s + c.level, 0); }
        catch { return pc.level; }
    })();
    return (
        <Link href={`/tabletop/campaigns/${campaignId}/characters/${pc.id}`} className="block no-underline group">
            <Card className="border-l-4 border-l-heading/60 group-hover:bg-primary/5 transition-colors duration-100">
                <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{pc.characterName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                            {[pc.race, pc.characterClass].filter(Boolean).join(" · ")}
                            {pc.playerName ? ` — ${pc.playerName}` : ""}
                        </p>
                    </div>
                    {level && <Badge variant="gold" className="shrink-0">Lv {level}</Badge>}
                </CardContent>
            </Card>
        </Link>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ShadcnPreview() {
    const { campaignId } = useParams<{ campaignId: string }>();
    const { isGm: isGM } = useCampaignRole(campaignId);

    const [campaign, setCampaign]   = useState<Campaign | null>(null);
    const [sessions, setSessions]   = useState<Session[]>([]);
    const [characters, setChars]    = useState<PlayerCharacter[]>([]);
    const [worlds, setWorlds]       = useState<World[]>([]);
    const [encounters, setEncounters] = useState<Encounter[]>([]);
    const [members, setMembers]     = useState<CampaignMember[]>([]);
    const [worldMaps, setWorldMaps] = useState<WorldMap[]>([]);
    const [loading, setLoading]     = useState(true);

    useDocumentTitle(campaign?.name ?? null);

    useEffect(() => {
        Promise.all([
            client.models.Campaign.get({ id: campaignId }),
            client.models.CampaignSession.list(),
            client.models.PlayerCharacter.list(),
            client.models.DnDWorld.list(),
            client.models.Encounter.list(),
            client.models.CampaignMember.list(),
            client.models.WorldMap.list(),
        ]).then(([cRes, sRes, pcRes, wRes, encRes, memRes, mapRes]) => {
            const camp = cRes.data;
            setCampaign(camp);
            setSessions((sRes.data ?? []).filter(s => s.campaignId === campaignId)
                .sort((a, b) => (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0)));
            setChars((pcRes.data ?? []).filter(pc => pc.campaignId === campaignId));
            setEncounters((encRes.data ?? []).filter(e => e.campaignId === campaignId));
            setMembers((memRes.data ?? []).filter(m => m.campaignId === campaignId));
            if (camp) {
                const wIds = (camp.worldIds ?? []).filter((id): id is string => !!id);
                setWorlds((wRes.data ?? []).filter(w => wIds.includes(w.id)));
                setWorldMaps((mapRes.data ?? []).filter(m => wIds.includes(m.worldId)));
            }
        }).finally(() => setLoading(false));
    }, [campaignId]);

    const dashboardHref = campaign?.system === "Cypher System"
        ? `/tabletop/campaigns/${campaignId}/gm-dashboard`
        : `/tabletop/campaigns/${campaignId}/dnd-dashboard`;

    if (loading) {
        return (
            <div className="shadcn-root min-h-screen bg-background flex items-center justify-center">
                <div className="text-primary animate-pulse text-sm">Loading…</div>
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="shadcn-root min-h-screen bg-background flex items-center justify-center">
                <p className="text-primary">Campaign not found.</p>
            </div>
        );
    }

    return (
        <TooltipProvider delayDuration={200}>
            <div className="shadcn-root min-h-screen bg-background py-10 font-body">
                <div className="mx-auto max-w-3xl px-4">

                    {/* Top bar */}
                    <div className="flex items-center justify-between mb-8">
                        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-primary px-0">
                            <Link href="/tabletop/campaigns">
                                <ArrowLeft size={14} /> My Campaigns
                            </Link>
                        </Button>
                        <div className="flex items-center gap-3">
                            {/* Palette switcher */}
                            <div className="flex gap-1.5">
                                {DOTS.map(d => (
                                    <Tooltip key={d.key}>
                                        <TooltipTrigger asChild>
                                            <Link
                                                href={`/tabletop/campaigns/${campaignId}/preview${d.href ? `/${d.href}` : ""}`}
                                                className="block rounded-full transition-all duration-100"
                                                style={{
                                                    width: 16, height: 16,
                                                    background: d.color,
                                                    boxShadow: d.key === "shadcn" ? `0 0 0 2px white, 0 0 6px ${d.color}` : "none",
                                                }}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent>{d.label}</TooltipContent>
                                    </Tooltip>
                                ))}
                            </div>
                            <Button variant="ghost" size="sm" asChild className="text-muted-foreground text-xs">
                                <Link href={`/tabletop/campaigns/${campaignId}`}>← MUI</Link>
                            </Button>
                        </div>
                    </div>

                    {/* Hero */}
                    <div className="rounded-xl border border-border bg-gradient-to-br from-card to-background p-6 mb-8
                                    shadow-[0_8px_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(239,107,26,0.12)]">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h1 className="font-cinzel text-3xl font-black text-heading leading-tight
                                               [text-shadow:0_2px_16px_hsl(45_78%_63%/0.3)]">
                                    {campaign.name}
                                </h1>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    {campaign.status && (
                                        <Badge variant="default">{campaign.status}</Badge>
                                    )}
                                    {campaign.system && (
                                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                            {campaign.system}
                                        </span>
                                    )}
                                    {worlds.map(w => (
                                        <Link key={w.id} href={`/tabletop/worlds/${w.id}`}
                                            className="text-xs text-primary hover:underline">
                                            🌍 {w.name}
                                        </Link>
                                    ))}
                                </div>
                                {campaign.description && (
                                    <p className="mt-3 text-sm text-muted-foreground max-w-lg">
                                        {campaign.description}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                                {["✏️", "⚙️"].map(icon => (
                                    <button key={icon}
                                        className="h-8 w-8 rounded-md text-muted-foreground hover:bg-card transition-colors
                                                   flex items-center justify-center text-sm">
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Active tools */}
                    <div className={cn(
                        "grid gap-2 mb-8",
                        campaign.system ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"
                    )}>
                        {campaign.system && (
                            <ToolCard icon={Shield} label="GM Dashboard" href={dashboardHref} />
                        )}
                        <ToolCard icon={LayoutGrid} label="Virtual Table"
                            href={`/tabletop/campaigns/${campaignId}/vtt`} />
                        <ToolCard icon={Bookmark} label="Chronicle"
                            href={`/tabletop/campaigns/${campaignId}/timeline`} />
                        <ToolCard icon={Calendar} label="Calendar"
                            href={`/tabletop/campaigns/${campaignId}/calendar`} />
                    </div>

                    {/* Maps */}
                    {worldMaps.length > 0 && (
                        <>
                            <SectionDivider icon={Map} label="Maps" />
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                                {worldMaps.map(m => (
                                    <Link key={m.id}
                                        href={`/tabletop/worlds/${m.worldId}/maps/${m.id}?campaign=${campaignId}`}
                                        className="block no-underline group">
                                        <Card className="group-hover:bg-primary/5 transition-colors duration-100">
                                            <CardContent className="p-3 flex items-center gap-2">
                                                <Map size={13} className="text-primary shrink-0" />
                                                <span className="text-sm font-semibold text-foreground truncate flex-1">
                                                    {m.name}
                                                </span>
                                                <ChevronRight size={11} className="text-muted-foreground" />
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Story & History */}
                    <SectionDivider icon={Calendar} label="Story & History" />
                    <div className="flex justify-end mb-3">
                        {isGM && (
                            <Button size="sm" asChild>
                                <Link href={`/tabletop/campaigns/${campaignId}/sessions/new`}>
                                    <Plus size={13} /> New Session
                                </Link>
                            </Button>
                        )}
                    </div>
                    {sessions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No sessions yet.</p>
                    ) : (
                        <div className="flex flex-col gap-2 mb-8">
                            {sessions.map(s => <SessionRow key={s.id} s={s} campaignId={campaignId} />)}
                        </div>
                    )}

                    {/* Characters & Combat */}
                    <SectionDivider icon={Users} label="Characters & Combat" />
                    <div className="flex gap-2 mb-3 flex-wrap">
                        {isGM && (
                            <>
                                <Button variant="subtle" size="sm" asChild>
                                    <Link href={`/tabletop/campaigns/${campaignId}/characters/new`}>
                                        <Plus size={12} /> Add Character
                                    </Link>
                                </Button>
                                <Button variant="subtle" size="sm" asChild>
                                    <Link href={`/tabletop/campaigns/${campaignId}/initiative`}>
                                        <Swords size={12} /> Initiative
                                    </Link>
                                </Button>
                            </>
                        )}
                    </div>
                    {(characters.length > 0 || encounters.length > 0) ? (
                        <div className="grid sm:grid-cols-2 gap-2 mb-8">
                            {characters.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    {characters.map(pc => (
                                        <CharCard key={pc.id} pc={pc} campaignId={campaignId} />
                                    ))}
                                </div>
                            )}
                            {encounters.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    {encounters.map(enc => (
                                        <Link key={enc.id}
                                            href={`/tabletop/campaigns/${campaignId}/encounters/${enc.id}`}
                                            className="block no-underline group">
                                            <Card className="border-l-4 border-l-primary/50 group-hover:bg-primary/5 transition-colors duration-100">
                                                <CardContent className="p-3 flex items-center justify-between">
                                                    <span className="text-sm font-semibold text-foreground">
                                                        {enc.name}
                                                    </span>
                                                    {enc.status && enc.status !== "planned" && (
                                                        <Badge variant="default" className="capitalize text-[10px]">
                                                            {enc.status}
                                                        </Badge>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-6 mb-8">
                            No characters or encounters yet.
                        </p>
                    )}

                    {/* World */}
                    <SectionDivider icon={Map} label="World" />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
                        <NavCard icon={Users} label="NPCs" desc="Non-player characters"
                            href={`/tabletop/campaigns/${campaignId}/npcs`} />
                        <NavCard icon={ClipboardList} label="Quests" desc="Active & completed"
                            href={`/tabletop/campaigns/${campaignId}/quests`} />
                        <NavCard icon={Shield} label="Factions" desc="Reputation tracker"
                            href={`/tabletop/campaigns/${campaignId}/factions`} />
                        <NavCard icon={Gauge} label="Resources" desc="Custom trackers"
                            href={`/tabletop/campaigns/${campaignId}/resources`} />
                    </div>

                    {/* Campaign */}
                    <SectionDivider icon={Users} label="Campaign" />
                    {members.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                            {members.map(m => (
                                <Card key={m.id}
                                    className={cn("border-l-4",
                                        m.role === "gm" ? "border-l-heading/60" : "border-l-primary/40"
                                    )}>
                                    <CardContent className="p-3 flex items-center justify-between">
                                        <span className="text-sm font-semibold text-foreground">
                                            {m.playerName || "—"}
                                        </span>
                                        <Badge variant={m.role === "gm" ? "gold" : "muted"}>
                                            {m.role === "gm" ? "GM" : "Player"}
                                        </Badge>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                    {isGM && (
                        <div className="flex gap-2">
                            {["Invite Player", "Invite GM"].map(label => (
                                <Button key={label} variant="outline" size="sm">
                                    <Plus size={12} /> {label}
                                </Button>
                            ))}
                        </div>
                    )}

                </div>
            </div>
        </TooltipProvider>
    );
}
