// Helpers shared by the SRD index build scripts (build-cypher-srd-index.ts,
// build-dnd-srd-index.ts).
import { writeFileSync } from "node:fs";
import type { SrdEntry } from "../lib/srdIndex";

export const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
export const slugify = (s: string) => s.toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
export const paragraphs = (...parts: Array<string | false | null | undefined>) =>
    parts.filter(Boolean).join("\n\n");
export const metaLine = (...parts: Array<string | false | null | undefined>) =>
    parts.filter(Boolean).join(" | ");
export const orUndefined = (s?: string | null) => (s && s.trim()) ? s.trim() : undefined;

export function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of items) {
        const k = key(item);
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(item);
    }
    return map;
}

// Builds an entry's filterable attributes, leaving out empty ones.
export function facets(fields: Record<string, string | string[] | false | null | undefined>): Record<string, string[]> | undefined {
    const out: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(fields)) {
        const values = (Array.isArray(value) ? value : [value]).filter((v): v is string => !!v && !!v.trim());
        if (values.length) out[key] = Array.from(new Set(values));
    }
    return Object.keys(out).length ? out : undefined;
}

// Counts of what a build did, printed at the end so a re-run's effect is visible.
export function createReport() {
    const counts: Record<string, number> = {};
    return {
        tally: (key: string, n = 1) => { counts[key] = (counts[key] ?? 0) + n; },
        print: () => {
            const width = Math.max(...Object.keys(counts).map(k => k.length));
            for (const [k, v] of Object.entries(counts).sort()) console.log(`${k.padEnd(width)}  ${v}`);
        },
    };
}

// Checks ids are unique and every [[link]] resolves, then writes the index one
// entry per line, which keeps diffs of the generated file reviewable.
export function writeIndex(out: string, entries: SrdEntry[]) {
    const ids = new Set<string>();
    for (const e of entries) {
        if (ids.has(e.id)) throw new Error(`Duplicate id in search index: ${e.id}`);
        ids.add(e.id);
    }
    for (const e of entries) {
        for (const [label, target] of Object.entries(e.links ?? {})) {
            if (!ids.has(target)) throw new Error(`${e.id} links "${label}" to missing ${target}`);
        }
        if (e.links && !Object.keys(e.links).length) delete e.links;
    }
    writeFileSync(out, "[\n" + entries.map(e => JSON.stringify(e)).join(",\n") + "\n]\n");
    console.log(`\nWrote ${entries.length} entries to ${out}`);
}
