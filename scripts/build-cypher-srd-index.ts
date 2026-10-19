/**
 * Builds public/Cypher_SRD/search-index.json, the single cleaned dataset the
 * Cypher SRD search page (/tabletop/cypher) loads.
 *
 * The raw files beside it were scraped from the SRD and have structural
 * problems that, used as-is, surface as duplicate or meaningless search
 * results. This script fixes them once, ahead of time, instead of in the
 * browser on every page load:
 *
 *  - Rules (core, optional, genre) contain the full text of their own
 *    subsections, so one passage matched the parent and every child. Parents
 *    are trimmed back to their own intro.
 *  - Genres publish cypher/artifact lists twice ("X" and "X by Alphabetical
 *    Order"), and some genre rules are verbatim copies of an optional rule.
 *  - Genre cyphers/artifacts only existed inside those list blobs; the
 *    structured copies in genres.json become real Cypher/Artifact entries.
 *  - glossary.json is every definition list in the SRD flattened together
 *    with its context stripped: sidekick statblock fields, creature quick
 *    stats, fantasy gear, trap/creature statblock explainers. Each is moved,
 *    relabelled, or dropped (see GLOSSARY_SECTIONS).
 *  - Abilities revised between editions appear as separate same-named
 *    entries; they're merged into one entry with variants.
 *  - Focus/flavor/type ability lists become [[links]] to the ability.
 *
 * Run with `npm run build:cypher-index` after changing any raw SRD file.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CypherSrdCategory, CypherSrdEntry } from "../lib/cypherSrdIndex";
import type { SrdVariant } from "../lib/srdIndex";
import {
    capitalize, createReport, facets, groupBy, metaLine, norm, orUndefined, paragraphs, slugify, writeIndex,
} from "./srdBuildUtils";

const DIR = join(__dirname, "..", "public", "Cypher_SRD");
const OUT = join(DIR, "search-index.json");

const read = (file: string): any[] => JSON.parse(readFileSync(join(DIR, file), "utf8"));

const report = createReport();
const tally = report.tally;

// "(Cypher System Rulebook, page 64)" → "Cypher System Rulebook".
const BOOK_ALIASES: Record<string, string> = { "Say Alive!": "Stay Alive!" };
const bookOf = (source?: string) => {
    const book = orUndefined(source?.replace(/^\(|\)$/g, "").split(/,\s*page\b/i)[0]);
    return book && (BOOK_ALIASES[book] ?? book);
};

const entries: CypherSrdEntry[] = [];
const push = (e: CypherSrdEntry) => { entries.push(e); tally(`entries: ${e.category}`); };

// ── Abilities ────────────────────────────────────────────────────────────────

// ability-mutation-* rows duplicate mutations.json, which is the better copy.
const rawAbilities = read("abilities.json").filter(a => !a.id.startsWith("ability-mutation-"));

// Same-named abilities are edition/sourcebook revisions, told apart only by an
// id suffix: ability-throw vs ability-throw-2015, ability-outwit-og,
// ability-lethal-damage-hnam-107.
function abilityVariantLabel(a: any): string {
    const base = `ability-${slugify(a.name)}`;
    const suffix = a.id.startsWith(base) ? a.id.slice(base.length).replace(/^-/, "") : a.id;
    if (!suffix) return "CSRD";
    if (suffix === "og") return "OG-CSRD";
    if (/^\d{4}$/.test(suffix)) return `${suffix} edition`;
    const [book, ...page] = suffix.split("-");
    return page.length ? `${book.toUpperCase()} p. ${page.join("-")}` : book.toUpperCase();
}

const abilityMeta = (a: any) => a.cost ? `Cost: ${a.cost}` : "Enabler / No cost";

// Pool from the cost ("2+ Might points", "3 Intellect or Speed points"), and
// whether it's an Enabler or an Action from the word abilities end with.
function abilityFacets(a: any) {
    const pools = Array.from(new Set(((a.cost ?? "") as string).match(/\b(might|speed|intellect)\b/gi) ?? []))
        .map(p => capitalize(p.toLowerCase()));
    const kind = (a.description ?? "").trim().match(/\b(Enabler|Action)\b[^.]*\.?(?:\s*\([^)]*\))?\s*$/)?.[1];
    return facets({ Pool: pools.length ? pools : "No cost", Kind: kind });
}

const abilityIdByName = new Map<string, string>();
for (const group of Array.from(groupBy(rawAbilities, a => norm(a.name)).values())) {
    const labelled = group
        .map(a => ({ a, label: abilityVariantLabel(a) }))
        .sort((x, y) => (x.label === "CSRD" ? -1 : y.label === "CSRD" ? 1 : x.a.id.localeCompare(y.a.id)));
    const primary = labelled[0].a;
    const variants: SrdVariant[] | undefined = group.length > 1
        ? labelled.map(({ a, label }) => ({
            label, meta: abilityMeta(a), description: a.description ?? "", source: orUndefined(a.source),
        }))
        : undefined;
    if (variants) tally("abilities merged into variants", group.length - 1);
    abilityIdByName.set(norm(primary.name), primary.id);
    push({
        id: primary.id,
        name: primary.name,
        category: "Ability",
        meta: abilityMeta(primary),
        description: primary.description ?? "",
        source: orUndefined(primary.source),
        variants,
        facets: abilityFacets(primary),
    });
}

// Misspellings in the foci data that otherwise wouldn't resolve.
const ABILITY_REF_ALIASES: Record<string, string> = { "venemous strike": "venomous strike" };
const abilityIdForRef = (name: string) => {
    const key = norm(name);
    return abilityIdByName.get(ABILITY_REF_ALIASES[key] ?? key);
};

// Splits "Head (12) (if you have X (3) )" into ["Head (12)", "(if you have X (3) )"].
function peelTrailingParen(s: string): [string, string] | null {
    if (!s.endsWith(")")) return null;
    let depth = 0;
    for (let i = s.length - 1; i >= 0; i--) {
        if (s[i] === ")") depth++;
        else if (s[i] === "(" && --depth === 0) return [s.slice(0, i).trimEnd(), s.slice(i)];
    }
    return null;
}

// Splits on `separator` only where it falls outside parentheses, keeping the
// separators so the original punctuation can be restored.
function splitTopLevel(s: string, separator: RegExp): string[] {
    let depth = 0;
    const masked = Array.from(s, ch => {
        if (ch === "(") depth++;
        const out = depth > 0 ? "\u0000" : ch;
        if (ch === ")") depth = Math.max(0, depth - 1);
        return out;
    }).join("");
    const pieces: string[] = [];
    let last = 0;
    for (const m of Array.from(masked.matchAll(new RegExp(separator.source, "g")))) {
        pieces.push(s.slice(last, m.index), s.slice(m.index!, m.index! + m[0].length));
        last = m.index! + m[0].length;
    }
    pieces.push(s.slice(last));
    return pieces;
}

// Turns an ability reference as printed in a focus/flavor/type list —
// "⚡ Escape Plan (136) or ⚡ Perfect Speed Burst (169)",
// "Skill with Attacks (183) , Skill with Defense (183) , or Use the Network (RR, 124)",
// "Increased Resistance (Fire) (OG-CSRD)" — into "[[Name]]" markup, dropping
// page citations but keeping real qualifiers like "(Fire)". The whole string
// is tried before splitting, since some ability names contain "or"
// ("Captivate or Inspire").
const PAGE_CITATION = /^\((?:[A-Z][A-Z-]*(?:,\s*)?)?(?:\d+(?:,\s*\d+)*)?\)$/;
const REF_SEPARATORS = [/\s*,\s*or\s+/, /\s+or\s+/, /\s*,\s*/, /\s+and\s+/];

function linkOneAbilityRef(ref: string, links: Record<string, string>): string | null {
    const bolt = ref.includes("⚡") ? "⚡ " : "";
    let name = ref.replace(/⚡/g, "").trim();
    const tail: string[] = [];
    while (!abilityIdForRef(name)) {
        const peeled = peelTrailingParen(name);
        if (!peeled) return null;
        tail.unshift(peeled[1]);
        name = peeled[0];
    }
    links[name] = abilityIdForRef(name)!;
    const qualifiers = tail.filter(t => !PAGE_CITATION.test(t));
    return [`${bolt}[[${name}]]`, ...qualifiers].join(" ");
}

function linkAbilityRefs(ref: string, links: Record<string, string>, separators = REF_SEPARATORS): string {
    const whole = linkOneAbilityRef(ref, links);
    if (whole) { tally("ability refs linked"); return whole; }
    for (let i = 0; i < separators.length; i++) {
        const pieces = splitTopLevel(ref, separators[i]);
        if (pieces.length === 1) continue;
        return pieces
            .map((piece, j) => (j % 2 ? piece : linkAbilityRefs(piece, links, separators.slice(i + 1))))
            .join("")
            .replace(/\s+,/g, ",");
    }
    if (ref.trim()) tally("ability refs left unlinked");
    return ref.trim();
}

// ── Creatures & NPCs ─────────────────────────────────────────────────────────

function creatureEntry(c: any, category: CypherSrdCategory): CypherSrdEntry {
    return {
        id: c.id,
        name: c.name,
        category,
        meta: metaLine(
            c.level != null && `Level ${c.level} (TN ${c.target_number ?? c.level * 3})`,
            c.health && `HP ${c.health}`,
            c.damage_inflicted && `Dmg ${c.damage_inflicted}`,
            c.armor && `Armor ${c.armor}`,
            c.movement && `Move: ${c.movement}`,
        ),
        description: paragraphs(
            c.description,
            c.motive && `**Motive:** ${c.motive}`,
            c.environment && `**Environment:** ${c.environment}`,
            c.combat && `**Combat:** ${c.combat}`,
            c.interaction && `**Interaction:** ${c.interaction}`,
            c.uses && `**Uses:** ${c.uses}`,
            c.loot && `**Loot:** ${c.loot}`,
            c.gm_intrusion && `**GM Intrusion:** ${c.gm_intrusion}`,
        ),
        source: orUndefined(c.source),
        facets: facets({ Level: c.level != null && String(c.level), Book: bookOf(c.source) }),
    };
}
const creatureNames = new Set<string>();
for (const c of read("creatures.json")) { push(creatureEntry(c, "Creature")); creatureNames.add(norm(c.name)); }
for (const c of read("npcs.json")) { push(creatureEntry(c, "NPC")); creatureNames.add(norm(c.name)); }

// ── Cyphers & artifacts ──────────────────────────────────────────────────────

const genres = read("genres.json");

function cypherEntry(c: any, genre?: string): CypherSrdEntry {
    return {
        id: c.id,
        name: c.name,
        category: "Cypher",
        meta: metaLine(
            c.type && c.type !== "unknown" && capitalize(c.type),
            c.level && `Level ${c.level}`,
            c.form,
            genre && `${genre} Genre`,
        ),
        description: paragraphs(c.effect, c.options && `**Options:** ${c.options}`),
        source: orUndefined(c.source),
        genre,
        facets: facets({ Type: c.type && c.type !== "unknown" && capitalize(c.type), Setting: genre ?? "Core" }),
    };
}
const coreCypherEffects = new Set<string>();
for (const c of read("cyphers.json")) { push(cypherEntry(c)); coreCypherEffects.add(norm(c.effect ?? "").slice(0, 80)); }

// Genre cyphers/artifacts were only findable inside the genre rule blobs that
// list them; genres.json also carries structured copies, which become entries.
for (const g of genres) {
    for (const c of g.cyphers ?? []) {
        if (!c.effect) continue;
        if (coreCypherEffects.has(norm(c.effect).slice(0, 80))) { tally("genre cyphers already in cyphers.json"); continue; }
        push(cypherEntry(c, g.genre));
    }
    for (const a of g.artifacts ?? []) {
        if (!a.effect) continue;
        push({
            id: a.id,
            name: a.name,
            category: "Artifact",
            meta: metaLine(a.level && `Level ${a.level}`, a.form, `${g.genre} Genre`),
            description: paragraphs(a.effect, a.depletion && `**Depletion:** ${a.depletion}`),
            source: orUndefined(a.source),
            genre: g.genre,
            facets: facets({ Genre: g.genre }),
        });
    }
}

// ── Character options ────────────────────────────────────────────────────────

for (const d of read("descriptors.json")) {
    push({
        id: d.id,
        name: d.name,
        category: "Descriptor",
        meta: "Descriptor",
        description: paragraphs(
            d.description,
            d.characteristics?.length && "**Characteristics:**\n" + d.characteristics.join("\n"),
            d.initial_links?.length && "**Initial Links:**\n" +
                d.initial_links.map((l: string, i: number) => `${i + 1}. ${l}`).join("\n"),
        ),
        source: orUndefined(d.source),
        facets: facets({ Book: bookOf(d.source) }),
    });
}

for (const f of read("foci.json")) {
    const links: Record<string, string> = {};
    const byTier = groupBy<any>(f.tier_abilities ?? [], ta => String(ta.tier));
    const tiers = Array.from(byTier.entries())
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([tier, abs]) => `**Tier ${tier}:** ${abs.map(ta => linkAbilityRefs(ta.abilities, links)).join("; ")}`);
    push({
        id: f.id,
        name: f.name,
        category: "Focus",
        meta: "Focus",
        description: paragraphs(f.description, tiers.join("\n"), f.gm_intrusion && `**GM Intrusion:** ${f.gm_intrusion}`),
        source: orUndefined(f.source),
        links,
        facets: facets({ Book: bookOf(f.source) }),
    });
}

for (const t of read("types.json")) {
    const links: Record<string, string> = {};
    const tiers = Object.entries<any>(t.tiers ?? {})
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, tier]) => paragraphs(
            `**${tier.name}**`,
            ...(tier.stats ?? []).map((s: any) => `**${s.stat}.** ${s.value}`),
            tier.abilities?.length && tier.abilities.map((a: string) => linkAbilityRefs(a, links)).join(", "),
        ));
    push({
        id: t.id,
        name: t.name,
        category: "Type",
        meta: "Character Type",
        description: paragraphs(
            t.description,
            ...tiers,
            t.player_intrusions?.length && "**Player Intrusions:**\n" + t.player_intrusions.join("\n"),
        ),
        source: orUndefined(t.source),
        links,
    });
}

for (const f of read("flavors.json")) {
    const links: Record<string, string> = {};
    const tiers = Object.entries<string[]>(f.tiers ?? {})
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([tier, abilities]) => `**Tier ${tier}:** ${abilities.map(a => linkAbilityRefs(a, links)).join(", ")}`);
    push({
        id: f.id,
        name: f.name,
        category: "Flavor",
        meta: "Flavor",
        description: paragraphs(f.description, tiers.join("\n")),
        source: orUndefined(f.source),
        links,
        facets: facets({ Book: bookOf(f.source) }),
    });
}

for (const a of read("character_arcs.json")) {
    push({
        id: a.id,
        name: a.name,
        category: "Character Arc",
        meta: "Character Arc",
        description: paragraphs(
            a.description,
            a.steps?.length && a.steps.map((s: any) => `**${s.name}:** ${s.text}`).join("\n\n"),
            a.notes?.length && a.notes.join("\n\n"),
        ),
        source: orUndefined(a.source),
        facets: facets({ Book: bookOf(a.source) }),
    });
}

for (const m of read("mutations.json")) {
    let name = m.name;
    if (!name) {
        const prefix = `ability-mutation-${m.category}-`;
        const slug = m.id.startsWith(prefix) ? m.id.slice(prefix.length) : m.id;
        name = slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    }
    push({
        id: m.id,
        name,
        category: "Mutation",
        meta: m.category ? `${capitalize(m.category)} Mutation` : "Mutation",
        description: m.description ?? "",
        source: orUndefined(m.source),
        facets: facets({ Kind: m.category && capitalize(m.category) }),
    });
}

// vehicles.json is the whole equipment list from The Stars are Fire
// (binoculars, tents, body armor…), of which vehicles are only a part.
for (const v of read("vehicles.json")) {
    push({
        id: v.id,
        name: v.name,
        category: "Equipment",
        meta: metaLine(
            v.level != null && `Level ${v.level}`,
            v.price,
            v.health && `HP ${v.health}`,
            v.armor && `Armor ${v.armor}`,
            v.movement && `Move: ${v.movement}`,
            "Science Fiction",
        ),
        description: paragraphs(v.description, v.details, v.modifications && `**Modifications:** ${v.modifications}`),
        source: orUndefined(v.source),
        facets: facets({ Group: "Science Fiction" }),
    });
}

// ── Rules ────────────────────────────────────────────────────────────────────

interface Bullet { name?: string; text: string }
interface RuleDraft {
    id: string;
    name: string;
    meta: string;
    source?: string;
    genre?: string;
    facets?: Record<string, string[]>;
    text: string;
    bullets: Bullet[];
    notes: string[];
}

// Section: the core chapter, "Optional Rules", or the genre; Topic only for
// core rules, which the SRD tags (Combat, Actions, Healing & Recovery…).
const ruleDraft = (r: any, meta: string, genre?: string): RuleDraft => ({
    id: r.id,
    name: r.name,
    meta,
    source: orUndefined(r.source),
    genre,
    facets: facets({
        Section: genre ? `${genre} Genre` : r.chapter ?? "Optional Rules",
        Topic: !genre && r.category,
    }),
    text: (r.text ?? "").trim(),
    bullets: (r.bullets ?? []).filter((b: any) => b.text),
    notes: [],
});

// Bullets are flat, but runs like Level / Form / Effect or Price / Details
// describe a single cypher, artifact, or piece of gear whose name the scraper
// lost. Grouping them keeps such an item whole when deciding whether it's a
// duplicate.
const ITEM_FIELDS = new Set(["form", "effect", "effect (alien)", "depletion", "options", "details", "modifications", "damage inflicted"]);
function bulletItems(bullets: Bullet[]): Bullet[][] {
    const items: Bullet[][] = [];
    for (const b of bullets) {
        const field = norm(b.name ?? "");
        const current = items[items.length - 1];
        const currentStart = current ? norm(current[0].name ?? "") : "";
        const inItem = currentStart === "level" || currentStart === "price";
        const priceAfterLevel = field === "price" && currentStart === "level"
            && !current.some(x => norm(x.name ?? "") === "price");
        if (priceAfterLevel || (ITEM_FIELDS.has(field) && inItem)) current.push(b);
        else items.push([b]);
    }
    return items;
}
// An item's bullet texts, longest first, as comparison keys. Very short
// bullets ("1d6 + 3", "Expensive") can't be compared reliably, so an item made
// only of those is never treated as a duplicate.
const itemFingerprints = (item: Bullet[]) => item
    .filter(b => b.text.length >= 20)
    .sort((a, b) => b.text.length - a.text.length)
    .map(b => norm(b.text).slice(0, 60));
const bulletKey = (b: Bullet) => `${norm(b.name ?? "")}::${norm(b.text)}`;
const ruleBody = (r: RuleDraft) => norm(r.text + " " + r.bullets.map(b => b.text).join(" "));

// "X by Alphabetical Order" is X's item list again without its intro. Fold any
// items X lacks into X, or rename it when there's no X.
function mergeAlphabeticalTwins(pool: RuleDraft[]): RuleDraft[] {
    const byName = new Map(pool.map(r => [norm(r.name), r]));
    return pool.filter(twin => {
        const m = twin.name.match(/^(.*) by Alphabetical Order$/i);
        if (!m) return true;
        const base = byName.get(norm(m[1]));
        if (!base) { twin.name = m[1]; return true; }
        const have = new Set(base.bullets.map(bulletKey));
        base.bullets.push(...twin.bullets.filter(b => !have.has(bulletKey(b))));
        tally("'by Alphabetical Order' twin lists merged");
        return false;
    });
}

// A parent rule's text runs straight on into its subsections' text, each one
// embedded whole. Cut each embedded subsection out of its parent. What's left
// between subsections is just their headings, so after the first cut only
// substantial passages (a sidebar's surrounding prose, say) are kept. Bullet
// items an embedded subsection already carries go too.
function trimNestedRules(pool: RuleDraft[]) {
    const texts = pool.map(r => r.text);
    const bodies = pool.map(ruleBody);
    const updates = pool.map((r, i) => {
        const text = texts[i];
        const spans: Array<[number, number]> = [];
        const kids: number[] = [];
        texts.forEach((kid, j) => {
            if (j === i || kid.length <= 60 || kid.length >= text.length) return;
            const at = text.indexOf(kid);
            if (at >= 0) { spans.push([at, at + kid.length]); kids.push(j); }
        });
        if (!spans.length) return null;
        spans.sort((a, b) => a[0] - b[0]);
        const kept = [text.slice(0, spans[0][0])];
        let pos = spans[0][1];
        for (const [from, to] of [...spans.slice(1), [text.length, text.length] as [number, number]]) {
            const gap = text.slice(pos, Math.max(pos, from)).trim();
            if (gap.length >= 60) kept.push(gap);
            pos = Math.max(pos, to);
        }
        const kidBody = kids.map(j => bodies[j]).join(" ");
        const bullets = bulletItems(r.bullets)
            .filter(item => !itemFingerprints(item).some(fp => kidBody.includes(fp)))
            .flat();
        return { text: paragraphs(...kept.map(t => t.trim())), bullets };
    });
    pool.forEach((r, i) => {
        const u = updates[i];
        if (!u) return;
        tally("rules with embedded subsections cut out");
        tally("bullets dropped as duplicated in a subsection", r.bullets.length - u.bullets.length);
        r.text = u.text;
        r.bullets = u.bullets;
    });
}

// Starts of every paragraph of every non-rule entry, so a rule's list item
// that just restates an ability/cypher/piece of gear can be recognized.
const standaloneStarts = new Map<string, CypherSrdCategory>();
for (const e of entries) {
    for (const para of e.description.split(/\n+/)) {
        const body = para.replace(/^\*\*[^*]+\*\*\s*/, "");
        if (body.length >= 40) {
            const key = norm(body).slice(0, 60);
            if (!standaloneStarts.has(key)) standaloneStarts.set(key, e.category);
        }
    }
}

// Each list item is kept in exactly one place: its own entry if it has one,
// otherwise the most specific rule (the one with the fewest items) that lists it.
function dedupeBulletItems(pool: RuleDraft[]) {
    const itemsByRule = pool.map(r => bulletItems(r.bullets));
    const owner = new Map<string, number>();
    itemsByRule.forEach((items, i) => {
        for (const item of items) {
            const fp = itemFingerprints(item)[0];
            if (!fp) continue;
            const current = owner.get(fp);
            if (current === undefined || itemsByRule[current].length > items.length) owner.set(fp, i);
        }
    });
    pool.forEach((r, i) => {
        const homes = new Set<CypherSrdCategory>();
        let movedOut = 0;
        let elsewhere = 0;
        const kept = itemsByRule[i].filter(item => {
            const fps = itemFingerprints(item);
            const home = fps.map(fp => standaloneStarts.get(fp)).find(Boolean);
            if (home) { homes.add(home); movedOut++; return false; }
            if (fps.length && owner.get(fps[0]) !== i) { elsewhere++; return false; }
            return true;
        });
        if (!movedOut && !elsewhere) return;
        tally("rule list items dropped (have their own entry)", movedOut);
        tally("rule list items dropped (listed in a more specific rule)", elsewhere);
        r.bullets = kept.flat();
        if (movedOut) {
            const where = Array.from(homes).sort().join("/");
            r.notes.push(`${movedOut} ${movedOut === 1 ? "item" : "items"} from this list ${movedOut === 1 ? "has its" : "have their"} own ${where} ${movedOut === 1 ? "entry" : "entries"}.`);
        }
    });
}

const optionalRules = mergeAlphabeticalTwins(read("optional_rules.json").map(r => ruleDraft(r, "Optional Rule")));
// One optional rule is also in rules.json, minus its bullets; keep the full one.
const optionalIds = new Set(optionalRules.map(r => r.id));
const coreRules = mergeAlphabeticalTwins(read("rules.json")
    .filter(r => !optionalIds.has(r.id))
    .map(r => ruleDraft(r, [r.chapter, r.category].filter(Boolean).join(" — "))));
// Captured before trimming: anything trimming removes from a core/optional rule
// still lives in another entry, so a genre rule copying the untrimmed text is
// still a copy.
const coreBodies = [...coreRules, ...optionalRules].map(ruleBody);
trimNestedRules([...coreRules, ...optionalRules]);
dedupeBulletItems([...coreRules, ...optionalRules]);

const genrePools: RuleDraft[][] = [];
for (const g of genres) {
    let pool = mergeAlphabeticalTwins((g.rules ?? []).map((r: any) => ruleDraft(r, `${g.genre} Genre`, g.genre)));

    // Some genre rules are word-for-word copies of a section of an optional
    // rule (Spellcasting, Psionics, Power Shifts…), which already has it all
    // (or has handed list items on to their own entries).
    pool = pool.filter(r => {
        const copied = ruleBody(r).length > 200 && coreBodies.some(c => c.includes(norm(r.text))
            && bulletItems(r.bullets).every(item => itemFingerprints(item)
                .every(fp => c.includes(fp) || standaloneStarts.has(fp))));
        if (copied) tally("genre rules dropped as copies of an optional rule");
        return !copied;
    });

    // Exact duplicates within the genre.
    const seen = new Set<string>();
    pool = pool.filter(r => {
        const key = ruleBody(r);
        if (!key || !seen.has(key)) { seen.add(key); return true; }
        tally("genre rules dropped as exact duplicates");
        return false;
    });

    trimNestedRules(pool);
    dedupeBulletItems(pool);
    genrePools.push(pool);
}

const ruleDescription = (r: RuleDraft) => paragraphs(
    r.text,
    r.bullets.map(b => (b.name ? `**${b.name}.** ${b.text}` : b.text)).join("\n\n"),
    ...r.notes,
);

const ruleEntries = new Map<string, CypherSrdEntry>();
for (const r of [...coreRules, ...optionalRules, ...genrePools.flat()]) {
    // Empty here means nothing of its own is left: just headings, or a list
    // whose every item is now its own entry.
    if (!r.text && !r.bullets.length) { tally("rules dropped as empty after trimming"); continue; }
    const description = ruleDescription(r);
    const entry: CypherSrdEntry = {
        id: r.id, name: r.name, category: "Rule", meta: r.meta, description, source: r.source, genre: r.genre,
        facets: r.facets,
        // Genre rules restate or tweak core material for one setting.
        secondary: r.genre ? true : undefined,
    };
    ruleEntries.set(entry.id, entry);
    push(entry);
}
const coreRuleByName = new Map([...coreRules, ...optionalRules].map(r => [norm(r.name), ruleEntries.get(r.id)]));

// ── Glossary ─────────────────────────────────────────────────────────────────

// glossary.json is a flat dump of every definition list in the SRD, in source
// order, with the heading that gave each list its meaning lost. These ranges
// were identified by hand; `anchor` is the term expected at `from`, so if the
// raw file ever changes the build fails instead of silently mislabelling.
type GlossarySection =
    | { from: number; to: number; anchor: string; label: string }
    | { from: number; to: number; anchor: string; equipment: string }
    | { from: number; to: number; anchor: string; dropTerms: string[]; label: string };

const GLOSSARY_SECTIONS: GlossarySection[] = [
    { from: 9, to: 17, anchor: "Aquatic", label: "animal trait" },
    {
        // Sidekick statblocks shredded into their fields. The fields mean nothing
        // without the sidekick they belonged to, whose name didn't survive.
        from: 45, to: 152, anchor: "Signature Abilities", label: "sidekick",
        dropTerms: ["Creature Type", "Damage Inflicted", "Increased Training", "Construction Flaw",
            "Suggested Sidekick Abilities", "Immunity", "Additional Equipment", "Needs", "Cantrips",
            "Blessings of the Gods", "Vulnerability (Fire)", "Skills"],
    },
    { from: 155, to: 161, anchor: "Level", label: "ritual" },
    { from: 162, to: 193, anchor: "Battleaxe", equipment: "Fantasy Weapon" },
    { from: 194, to: 206, anchor: "Beastskin", equipment: "Fantasy Armor" },
    { from: 207, to: 229, anchor: "Acid", equipment: "Fantasy Gear" },
    { from: 230, to: 239, anchor: "Artisan's outfit", equipment: "Fantasy Clothing" },
    { from: 240, to: 244, anchor: "Draft horse", equipment: "Fantasy Animal" },
    { from: 245, to: 249, anchor: "Level", label: "trap stat" },
    { from: 250, to: 257, anchor: "Blindness", label: "poison effect" },
    { from: 319, to: 321, anchor: "Over the Counter (OTC)", label: "drug category" },
    { from: 327, to: 332, anchor: "Programming", label: "hacking task" },
    { from: 356, to: 369, anchor: "Accuracy", label: "power shift" },
    { from: 480, to: 493, anchor: "Level", label: "creature stat" },
];

// One-line NPC/creature stats ("Cat: level 1; Speed defense as level 3").
const QUICK_STAT = /^\s*(?:swarm as a )?level\b/i;

const glossaryRaw = read("glossary.json");
for (const s of GLOSSARY_SECTIONS) {
    if (glossaryRaw[s.from]?.term !== s.anchor) {
        throw new Error(`glossary.json changed: expected "${s.anchor}" at row ${s.from}, found "${glossaryRaw[s.from]?.term}". Re-check GLOSSARY_SECTIONS.`);
    }
}

const glossaryTerms = new Map<string, { name: string; definitions: string[] }>();
const quickStats = new Map<string, { name: string; definitions: string[] }>();
const addDefinition = (map: typeof glossaryTerms, name: string, definition: string) => {
    const key = norm(name);
    if (!map.has(key)) map.set(key, { name, definitions: [] });
    const defs = map.get(key)!.definitions;
    if (!defs.some(d => norm(d) === norm(definition))) defs.push(definition);
};

glossaryRaw.forEach((g, i) => {
    const term: string = g.term.trim();
    const definition: string = (g.definition ?? "").trim();
    if (!definition) { tally("glossary rows dropped (empty)"); return; }
    if (QUICK_STAT.test(definition)) {
        if (creatureNames.has(norm(term))) { tally("glossary quick stats dropped (full statblock exists)"); return; }
        addDefinition(quickStats, term, definition);
        return;
    }
    const section = GLOSSARY_SECTIONS.find(s => i >= s.from && i <= s.to);
    if (section && "equipment" in section) {
        push({
            id: `equipment-${slugify(term)}`, name: term, category: "Equipment", meta: section.equipment, description: definition,
            facets: facets({ Group: section.equipment }),
        });
        tally("glossary rows moved to Equipment");
        return;
    }
    if (section && "dropTerms" in section && section.dropTerms.includes(term)) {
        tally("glossary rows dropped (orphaned sidekick statblock field)");
        return;
    }
    addDefinition(glossaryTerms, section ? `${term} (${section.label})` : term, definition);
});

for (const { name, definitions } of Array.from(quickStats.values())) {
    const level = definitions[0].match(/level\s+(\d+)/i)?.[1];
    push({
        id: `quick-${slugify(name)}`,
        name,
        category: "Quick Stats",
        meta: metaLine(level && `Level ${level}`, definitions.length > 1 && `${definitions.length} versions`),
        description: definitions.length > 1 ? definitions.map(d => `• ${d}`).join("\n") : definitions[0],
        facets: facets({ Level: level }),
    });
}

for (const { name, definitions } of Array.from(glossaryTerms.values())) {
    const definition = definitions.length > 1
        ? definitions.map((d, i) => `**${i + 1}.** ${d}`).join("\n\n")
        : definitions[0];
    // A glossary card that just restates a rule of the same name becomes that
    // rule's lead paragraph instead of a second result.
    const rule = coreRuleByName.get(norm(name));
    if (rule) {
        rule.description = paragraphs(`**In brief:** ${definition}`, rule.description);
        tally("glossary terms folded into the rule of the same name");
        continue;
    }
    push({ id: `glossary-${slugify(name)}`, name, category: "Glossary", meta: "Glossary Term", description: definition });
}

// ── Output ───────────────────────────────────────────────────────────────────

report.print();
writeIndex(OUT, entries);
