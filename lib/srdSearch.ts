// Search over a generated SRD index (lib/srdIndex.ts), shared by the Cypher
// System (/tabletop/cypher) and D&D 5.5e (/tabletop/srd) SRD pages.
//
// Results come in tiers rather than one blended relevance score: an exact
// name, then names starting with the query, then names containing every query
// word, then entries that only mention the query in their text. Words only
// match at their start ("ice" finds "icy", not "advice" or "Good Advice"), and
// every query word must match somewhere. The meta line (cost, level, type…)
// isn't searched: words like "level" appear in thousands of them.

import type { SrdEntry } from "./srdIndex";

export type MatchTier = "exact" | "namePrefix" | "nameWords" | "text" | "similar";

const TIER_RANK: Record<MatchTier, number> = {
    exact: 4, namePrefix: 3, nameWords: 2, text: 1, similar: 0,
};

export interface SearchDoc {
    entry: SrdEntry;
    name: string;        // normalized, words separated by single spaces
    nameWords: string[];
    spacedName: string;  // name with a leading space, for word-start tests
    text: string;        // normalized description (all variants), markup stripped
}

export interface SearchHit {
    entry: SrdEntry;
    tier: MatchTier;
}

export interface SearchOutcome {
    hits: SearchHit[];
    terms: string[];
    // No entry matched every word, so these are names within a typo or two.
    similar: boolean;
}

// Lowercase, accents folded, apostrophes dropped (so "PC's" and "pcs" meet),
// everything else non-alphanumeric collapsed to a single space.
export function normalize(s: string): string {
    return s.normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

// Markup → plain text: emphasis and link brackets dropped, table pipes and
// |---| rows turned into spaces.
export const stripMarkup = (s: string) => s.replace(/\*|\[\[|\]\]/g, "").replace(/\||-{3,}/g, " ");

export function queryTerms(query: string): string[] {
    return Array.from(new Set(normalize(query).split(" ").filter(Boolean)));
}

export function prepareDocs(entries: SrdEntry[]): SearchDoc[] {
    return entries.map((entry) => {
        const name = normalize(entry.name);
        const descriptions = [entry.description, ...(entry.variants ?? []).slice(1).map((v) => v.description)];
        return {
            entry,
            name,
            nameWords: name.split(" "),
            spacedName: " " + name,
            // Leading space so every word, including the first, follows a space.
            text: " " + normalize(stripMarkup(descriptions.join("\n"))),
        };
    });
}

const startsWord = (haystack: string, term: string) => haystack.includes(" " + term);

function countWordStarts(text: string, term: string, cap: number): number {
    let n = 0;
    for (let at = text.indexOf(" " + term); at >= 0 && n < cap; at = text.indexOf(" " + term, at + 1)) n++;
    return n;
}

// Ranks text-only hits: how often the query words appear (capped, so a giant
// rule blob can't win on volume alone), a bonus when they appear together as
// a phrase, and a bonus for each word that also hit the name.
function textScore(doc: SearchDoc, terms: string[]): number {
    let score = 0;
    for (const t of terms) {
        score += countWordStarts(doc.text, t, 8);
        if (startsWord(doc.spacedName, t)) score += 10;
    }
    if (terms.length > 1 && doc.text.includes(" " + terms.join(" "))) score += 15;
    if (doc.entry.secondary) score -= 5;
    return score;
}

function nameTier(doc: SearchDoc, phrase: string, required: string[]): MatchTier | null {
    if (doc.name === phrase) return "exact";
    if (doc.name.startsWith(phrase)) return "namePrefix";
    if (required.every((t) => startsWord(doc.spacedName, t))) return "nameWords";
    return null;
}

// Words too common to require. They still count toward an exact or
// starts-with name match ("a smile and a word"), and a query made of nothing
// else still searches for them.
const STOP_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "is", "it",
    "of", "on", "or", "the", "to", "with", "your", "you"]);
const requiredTerms = (terms: string[]) => {
    const kept = terms.filter((t) => !STOP_WORDS.has(t));
    return kept.length ? kept : terms;
};

const byName = (a: SearchHit, b: SearchHit) => a.entry.name.localeCompare(b.entry.name);

export function searchSrdIndex(
    docs: SearchDoc[], query: string, category = "All",
): SearchOutcome {
    const terms = queryTerms(query);
    const pool = category === "All" ? docs : docs.filter((d) => d.entry.category === category);

    if (!terms.length) {
        const hits = category === "All" ? [] : pool.map((d) => ({ entry: d.entry, tier: "nameWords" as MatchTier }));
        return { hits: hits.sort(byName), terms, similar: false };
    }

    // The whole query, repeated words and all, for exact/starts-with matching.
    const phrase = normalize(query);
    const required = requiredTerms(terms);
    const scored: Array<SearchHit & { score: number }> = [];
    for (const doc of pool) {
        const tier = nameTier(doc, phrase, required);
        if (tier) {
            // Within a name tier: alphabetical, but secondary entries last.
            scored.push({ entry: doc.entry, tier, score: doc.entry.secondary ? -1 : 0 });
            continue;
        }
        if (required.every((t) => startsWord(doc.spacedName, t) || startsWord(doc.text, t))) {
            scored.push({ entry: doc.entry, tier: "text", score: textScore(doc, required) });
        }
    }

    if (!scored.length) return { hits: similarNames(pool, required), terms, similar: true };

    scored.sort((a, b) =>
        TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.score - a.score || a.entry.name.localeCompare(b.entry.name));
    return { hits: scored.map(({ entry, tier }) => ({ entry, tier })), terms, similar: false };
}

// ── Typo fallback ────────────────────────────────────────────────────────────

// Edit distance, giving up as soon as it must exceed `max`.
function editDistance(a: string, b: string, max: number): number {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        let rowMin = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
            rowMin = Math.min(rowMin, row[j]);
        }
        if (rowMin > max) return max + 1;
        prev = row;
    }
    return prev[b.length];
}

// Short words must match exactly; longer ones may be one or two edits off.
const allowedEdits = (term: string) => (term.length >= 8 ? 2 : term.length >= 4 ? 1 : 0);

// The closest any word in the name comes to `term`, also allowing the name
// word to merely start with it (the user may not have finished typing).
function closestWord(words: string[], term: string): number {
    const max = allowedEdits(term);
    let best = max + 1;
    for (const w of words) {
        if (w.startsWith(term)) return 0;
        best = Math.min(best, editDistance(term, w, max), editDistance(term, w.slice(0, term.length), max));
        if (best === 0) break;
    }
    return best;
}

function similarNames(pool: SearchDoc[], terms: string[]): SearchHit[] {
    const found: Array<{ entry: SrdEntry; distance: number }> = [];
    for (const doc of pool) {
        let distance = 0;
        for (const t of terms) {
            const d = closestWord(doc.nameWords, t);
            if (d > allowedEdits(t)) { distance = -1; break; }
            distance += d;
        }
        if (distance >= 0) found.push({ entry: doc.entry, distance });
    }
    return found
        .sort((a, b) => a.distance - b.distance || a.entry.name.localeCompare(b.entry.name))
        .map(({ entry }) => ({ entry, tier: "similar" as MatchTier }));
}

// ── Highlighting ─────────────────────────────────────────────────────────────

// Matches the query words at the start of a word in display (un-normalized) text.
export function highlightPattern(terms: string[]): RegExp | null {
    if (!terms.length) return null;
    const alternatives = [...terms].sort((a, b) => b.length - a.length)
        .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|");
    return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})`, "giu");
}

// A short excerpt of `text` around the first query word, for showing why an
// entry that only mentions the query in its text turned up.
export function snippet(text: string, pattern: RegExp | null, radius = 90): string | null {
    if (!pattern) return null;
    const plain = stripMarkup(text).replace(/\s+/g, " ");
    pattern.lastIndex = 0;
    const m = pattern.exec(plain);
    pattern.lastIndex = 0;
    if (!m) return null;
    let from = Math.max(0, m.index - radius);
    let to = Math.min(plain.length, m.index + m[0].length + radius);
    if (from > 0) from = plain.indexOf(" ", from) + 1 || from;
    if (to < plain.length) to = plain.lastIndexOf(" ", to) > m.index ? plain.lastIndexOf(" ", to) : to;
    return (from > 0 ? "…" : "") + plain.slice(from, to).trim() + (to < plain.length ? "…" : "");
}
