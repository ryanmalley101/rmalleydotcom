// Shape of a generated SRD search index (public/<SRD>/search-index.json),
// shared by the Cypher System and D&D 5.5e SRD pages. Each index is built by
// its own script in scripts/ from that SRD's raw JSON; don't hand-edit the
// output, change the script and re-run it.

// An alternate printing of the same entry (an ability revised between
// editions, a class feature that differs per class). The entry's own
// top-level fields are always variants[0].
export interface SrdVariant {
    label: string;
    meta: string;
    description: string;
    source?: string;
}

export interface SrdEntry<C extends string = string> {
    id: string;
    name: string;
    category: C;
    meta: string;
    // Paragraphs separated by "\n\n", lines by "\n", **bold** and *italic*
    // spans, and [[Name]] references resolved through `links`.
    description: string;
    source?: string;
    variants?: SrdVariant[];
    links?: Record<string, string>;
    // Filterable attributes, e.g. { Pool: ["Intellect"], Kind: ["Action"] }.
    // Which keys exist depends on the category; a value can be multiple
    // (an ability costing Might or Speed is in both pools).
    facets?: Record<string, string[]>;
    // Sorts after other entries in the same match tier (e.g. Cypher genre
    // rules, which restate core material for one setting).
    secondary?: boolean;
}
