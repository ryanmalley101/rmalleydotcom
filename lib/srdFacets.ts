// Filters ("facets"), browse grouping, and URL state for the SRD search pages.
// Facet values come from the index (SrdEntry.facets); what each SRD offers is
// described by an SrdFacetConfig (lib/cypherSrdFacets.ts, lib/dndSrdFacets.ts).

import type { SrdEntry } from "./srdIndex";

export interface SrdFacetConfig {
    // Every category the SRD has, in display order (also validates ?cat=).
    categories: readonly string[];
    // Facet keys in display order; also every key the URL accepts.
    keys: string[];
    // Values listed here come first, in this order; the rest follow
    // numerically (fractions like "1/4" included) or alphabetically.
    preferredOrder?: Record<string, string[]>;
    // The facet a category's browse view (no query) is grouped by.
    browseGrouping?: Record<string, string>;
    // Prefix for numeric group headings, e.g. { Level: "Level " } → "Level 5"
    // (but a "Cantrip" heading stays as it is).
    groupLabelPrefix?: Record<string, string>;
}

// Facet key → selected values. Values within a key are alternatives (Might
// or Speed); different keys must all match (Might, and an Action).
export type FacetSelection = Record<string, string[]>;

const asNumber = (v: string) => {
    const fraction = v.match(/^(\d+)\/(\d+)$/);
    return fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(v);
};

export function compareFacetValues(config: SrdFacetConfig, key: string): (a: string, b: string) => number {
    const preferred = config.preferredOrder?.[key] ?? [];
    const rank = (v: string) => { const i = preferred.indexOf(v); return i < 0 ? Infinity : i; };
    return (a, b) => {
        const byPreference = rank(a) - rank(b);
        if (byPreference) return byPreference;
        const [na, nb] = [asNumber(a), asNumber(b)];
        if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
        return a.localeCompare(b);
    };
}

const facetValues = (entry: SrdEntry, key: string) => entry.facets?.[key] ?? [];

// Whether `entry` satisfies every selected facet, optionally ignoring one key
// (used to count what selecting another value of that key would give).
export function matchesFacets(entry: SrdEntry, selection: FacetSelection, ignoreKey?: string): boolean {
    for (const [key, wanted] of Object.entries(selection)) {
        if (key === ignoreKey || !wanted.length) continue;
        const have = facetValues(entry, key);
        if (!wanted.some((v) => have.includes(v))) return false;
    }
    return true;
}

export interface FacetValueCount { value: string; count: number; selected: boolean }
export interface FacetSummary { key: string; values: FacetValueCount[] }

// The facets worth offering for `items`: each key that takes at least two
// values among them (or has a selection). Each value is counted against the
// other keys' selections, so a count says how many results picking it would
// leave; values that would leave none are hidden unless selected.
export function summarizeFacets<T extends { entry: SrdEntry }>(
    items: T[], selection: FacetSelection, config: SrdFacetConfig,
): FacetSummary[] {
    const distinct = new Map<string, Set<string>>();
    for (const { entry } of items) {
        for (const [key, values] of Object.entries(entry.facets ?? {})) {
            if (!distinct.has(key)) distinct.set(key, new Set());
            values.forEach((v) => distinct.get(key)!.add(v));
        }
    }
    return config.keys.filter((key) => distinct.has(key)).flatMap((key) => {
        const selected = selection[key] ?? [];
        if (distinct.get(key)!.size < 2 && !selected.length) return [];
        const counts = new Map<string, number>();
        for (const { entry } of items) {
            if (!matchesFacets(entry, selection, key)) continue;
            for (const v of facetValues(entry, key)) counts.set(v, (counts.get(v) ?? 0) + 1);
        }
        for (const v of selected) if (!counts.has(v)) counts.set(v, 0);
        const values = Array.from(counts, ([value, count]) => ({ value, count, selected: selected.includes(value) }))
            .sort((a, b) => compareFacetValues(config, key)(a.value, b.value));
        return [{ key, values }];
    });
}

export function toggleFacet(selection: FacetSelection, key: string, value: string): FacetSelection {
    const current = selection[key] ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    const out = { ...selection };
    if (next.length) out[key] = next;
    else delete out[key];
    return out;
}

export interface FacetGroup<T> { label: string; items: T[] }

// Groups items by one facet, in facet-value order; an item with several
// values appears under each, and items without the facet go last under "Other".
// When that facet is being filtered on, only the selected values get a group
// (so filtering features to Warlock doesn't also list a Barbarian group for
// the features every class shares).
export function groupByFacet<T extends { entry: SrdEntry }>(
    items: T[], key: string, config: SrdFacetConfig, selected: string[] = [],
): FacetGroup<T>[] {
    const groups = new Map<string, T[]>();
    const other: T[] = [];
    for (const item of items) {
        const values = facetValues(item.entry, key);
        if (!values.length) { other.push(item); continue; }
        for (const v of values) {
            if (selected.length && !selected.includes(v)) continue;
            if (!groups.has(v)) groups.set(v, []);
            groups.get(v)!.push(item);
        }
    }
    const prefix = config.groupLabelPrefix?.[key] ?? "";
    const ordered = Array.from(groups.keys()).sort(compareFacetValues(config, key))
        .map((value) => ({
            label: Number.isNaN(asNumber(value)) ? value : prefix + value,
            items: groups.get(value)!,
        }));
    return other.length ? [...ordered, { label: "Other", items: other }] : ordered;
}

// ── URL state ────────────────────────────────────────────────────────────────

export interface SearchState {
    query: string;
    category: string; // "All" or one of config.categories
    facets: FacetSelection;
    // An entry to open and scroll to.
    focusId: string | null;
}

// ?q=fire&cat=Cypher&type=Subtle&type=Manifest&id=cypher-x
export function searchStateFromParams(params: URLSearchParams, config: SrdFacetConfig): SearchState {
    const cat = params.get("cat") ?? "";
    const facets: FacetSelection = {};
    for (const key of config.keys) {
        const values = params.getAll(key.toLowerCase()).filter(Boolean);
        if (values.length) facets[key] = values;
    }
    return {
        query: params.get("q") ?? "",
        category: config.categories.includes(cat) ? cat : "All",
        facets,
        focusId: params.get("id"),
    };
}

export function searchStateToParams(state: SearchState, config: SrdFacetConfig): URLSearchParams {
    const params = new URLSearchParams();
    if (state.query.trim()) params.set("q", state.query.trim());
    if (state.category !== "All") params.set("cat", state.category);
    for (const key of config.keys) for (const v of state.facets[key] ?? []) params.append(key.toLowerCase(), v);
    if (state.focusId) params.set("id", state.focusId);
    return params;
}
