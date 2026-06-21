// Lightweight client-side loaders + search for the static Cypher System SRD
// JSON in /public/Cypher_SRD/. Mirrors the data the SRD search page already
// uses, but scoped to single categories for "pick from SRD" dialogs.

export interface CreatureSrd {
    id: string;
    name: string;
    level: number;
    target_number?: number;
    health?: string;
    damage_inflicted?: string;
    armor?: string;
    movement?: string;
    modifications?: string;
    combat?: string;
    description?: string;
    motive?: string;
    environment?: string;
    interaction?: string;
    uses?: string;
    loot?: string;
    gm_intrusion?: string;
    source?: string;
}

export interface CypherSrd {
    id: string;
    name: string;
    type: string;
    level: string;
    form?: string;
    effect: string;
    options?: string;
    source?: string;
}

export interface AbilitySrd {
    id: string;
    name: string;
    cost?: string | null;
    description: string;
    source?: string;
}

export interface ArcStep { name: string; text: string }
export interface ArcSrd {
    id: string;
    name: string;
    description: string;
    steps: ArcStep[];
    notes?: string[];
    source?: string;
}

export interface FocusSrd {
    id: string;
    name: string;
    description?: string;
    gm_intrusion?: string;
    source?: string;
}

let creaturesCache: Promise<CreatureSrd[]> | null = null;
let cyphersCache: Promise<CypherSrd[]> | null = null;
let abilitiesCache: Promise<AbilitySrd[]> | null = null;
let arcsCache: Promise<ArcSrd[]> | null = null;
let fociCache: Promise<FocusSrd[]> | null = null;

async function fetchJson<T>(path: string): Promise<T[]> {
    try {
        const res = await fetch(path);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch { return []; }
}

export function loadCreatures(): Promise<CreatureSrd[]> {
    if (!creaturesCache) {
        creaturesCache = Promise.all([
            fetchJson<CreatureSrd>("/Cypher_SRD/creatures.json"),
            fetchJson<CreatureSrd>("/Cypher_SRD/npcs.json"),
        ]).then(([creatures, npcs]) => {
            const byId = new Map<string, CreatureSrd>();
            [...creatures, ...npcs].forEach(c => byId.set(c.id, c));
            return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
        });
    }
    return creaturesCache;
}

export function loadCyphers(): Promise<CypherSrd[]> {
    if (!cyphersCache) {
        cyphersCache = fetchJson<CypherSrd>("/Cypher_SRD/cyphers.json")
            .then(list => list.sort((a, b) => a.name.localeCompare(b.name)));
    }
    return cyphersCache;
}

export function loadAbilities(): Promise<AbilitySrd[]> {
    if (!abilitiesCache) {
        abilitiesCache = fetchJson<AbilitySrd>("/Cypher_SRD/abilities.json")
            .then(list => list.sort((a, b) => a.name.localeCompare(b.name)));
    }
    return abilitiesCache;
}

export function loadArcs(): Promise<ArcSrd[]> {
    if (!arcsCache) {
        arcsCache = fetchJson<ArcSrd>("/Cypher_SRD/character_arcs.json")
            .then(list => list.sort((a, b) => a.name.localeCompare(b.name)));
    }
    return arcsCache;
}

export function loadFoci(): Promise<FocusSrd[]> {
    if (!fociCache) {
        fociCache = fetchJson<FocusSrd>("/Cypher_SRD/foci.json")
            .then(list => list.sort((a, b) => a.name.localeCompare(b.name)));
    }
    return fociCache;
}

// Exact match first (case-insensitive), falling back to "focus name appears
// somewhere in the character's Focus text" since players sometimes type the
// full sentence (e.g. "Focus" field holding "Howls at the Moon" exactly, or
// embedded in a longer custom phrase).
export function findFocusMatch(foci: FocusSrd[], focusText: string): FocusSrd | null {
    const q = focusText.trim().toLowerCase();
    if (!q) return null;
    const exact = foci.find(f => f.name.trim().toLowerCase() === q);
    if (exact) return exact;
    return foci.find(f => q.includes(f.name.trim().toLowerCase())) ?? null;
}

export function searchSrd<T extends { name: string }>(
    items: T[], query: string, limit = 50
): T[] {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, limit);
    return items
        .filter(i => i.name.toLowerCase().includes(q))
        .slice(0, limit);
}

// Formats an arc's step-by-step procedure into plain text for a notes field.
export function formatArcSteps(arc: ArcSrd): string {
    const parts = arc.steps.map(s => `${s.name}: ${s.text}`);
    if (arc.notes?.length) parts.push("", "Notes:", ...arc.notes.map(n => `- ${n}`));
    return parts.join("\n");
}

export function creatureMeta(c: CreatureSrd): string {
    const tn = c.target_number ?? c.level * 3;
    const parts = [`Level ${c.level} (TN ${tn})`];
    if (c.health) parts.push(`HP ${c.health}`);
    if (c.armor) parts.push(`Armor ${c.armor}`);
    if (c.movement) parts.push(`Move: ${c.movement}`);
    return parts.join(" · ");
}
