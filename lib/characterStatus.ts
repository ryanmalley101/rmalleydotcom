import type { Schema } from "@/amplify/data/resource";
import { snapshot as dndSnapshot } from "@/app/tabletop/campaigns/[campaignId]/dnd-dashboard/PartyCard";
import { snapshot as cypherSnapshot } from "@/app/tabletop/campaigns/[campaignId]/gm-dashboard/PartyCard";

type PlayerCharacter = Schema["PlayerCharacter"]["type"];

export interface CharacterResource {
    label: string;
    current: number;
    max: number;
}

export type DangerLevel = "healthy" | "wounded" | "critical" | "down";

export interface CharacterStatus {
    resources: CharacterResource[];
    statusLabels: string[];
    dangerLevel: DangerLevel;
}

function dndStatus(pc: PlayerCharacter): CharacterStatus {
    const snap = dndSnapshot(pc);
    const pct = snap.hp.max > 0 ? snap.hp.current / snap.hp.max : 0;
    const dangerLevel: DangerLevel = snap.downed ? "down" : pct <= 0.25 ? "critical" : pct <= 0.5 ? "wounded" : "healthy";
    return {
        resources: [{ label: "HP", current: snap.hp.current, max: snap.hp.max }],
        statusLabels: snap.conditions,
        dangerLevel,
    };
}

function cypherStatus(pc: PlayerCharacter): CharacterStatus {
    const snap = cypherSnapshot(pc);
    const dangerLevel: DangerLevel =
        snap.damageTrack === "debilitated" ? "critical" :
        snap.damageTrack === "impaired" ? "wounded" : "healthy";
    return {
        resources: [
            { label: "Might", current: snap.pools.might.current, max: snap.pools.might.max },
            { label: "Speed", current: snap.pools.speed.current, max: snap.pools.speed.max },
            { label: "Intellect", current: snap.pools.intellect.current, max: snap.pools.intellect.max },
        ],
        // Cypher doesn't track per-character status effects in this app yet —
        // empty here is honest, not a stand-in for something unimplemented.
        statusLabels: [],
        dangerLevel,
    };
}

// Cross-system normalization for UI (currently just the VTT token overlay)
// that needs "how is this character doing" without knowing the rules of
// whatever system built them. D&D and Cypher get real per-system mappings;
// anything else falls back to the D&D shape if maxHp is set (works for many
// HP-based systems even if untuned), or an honest empty status otherwise —
// see CLAUDE.md's note on PlayerCharacter for why D&D and Cypher aren't
// symmetric in the schema to begin with.
export function getCharacterStatus(pc: PlayerCharacter): CharacterStatus {
    if (pc.system === "Cypher System") return cypherStatus(pc);
    if (pc.maxHp != null) return dndStatus(pc);
    return { resources: [], statusLabels: [], dangerLevel: "healthy" };
}
