/**
 * Builds public/5_5_SRD/search-index.json, the single dataset the D&D 5.5e
 * SRD search page (/tabletop/srd) loads, from the SRD 5.2.1 JSON beside it.
 *
 * Unlike the Cypher data, this is the published SRD's own structure and
 * mostly clean, so the work here is bringing in what the page used to leave
 * out and cross-linking it:
 *
 *  - Class and subclass feature descriptions become Class Feature entries. A
 *    feature several classes share word for word (Ability Score Improvement)
 *    is one entry; one whose text differs per class (Spellcasting) is one
 *    entry with a version per class. Subclass features also appear in their
 *    class's feature list, so subclass.features only marks which they are.
 *  - Armor, adventuring gear, tools, weapon/mastery properties, and the rules
 *    chapters (Playing the Game, Character Creation, Gameplay Toolbox,
 *    Monster Rules) are added alongside the Rules Glossary.
 *  - Italicized spell and magic item names, class features in each class's
 *    feature table, weapon properties and masteries, glossary "See also"
 *    references, and background feats become [[links]].
 *  - Markdown the page doesn't render is reduced to what it does: headings and
 *    ***bold italic*** become **bold**, and tables (including the glossary's,
 *    which were flattened onto one line) get a paragraph of their own.
 *  - The glossary's "See also" was both in the description and in a separate
 *    field the old page appended, so it showed twice; it now shows once.
 *
 * Run with `npm run build:dnd-index` after changing any file in public/5_5_SRD/.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DndSrdEntry } from "../lib/dndSrdIndex";
import type { SrdVariant } from "../lib/srdIndex";
import { createReport, facets, groupBy, metaLine, norm, paragraphs, slugify, writeIndex } from "./srdBuildUtils";

const DIR = join(__dirname, "..", "public", "5_5_SRD");
const OUT = join(DIR, "search-index.json");

const read = (file: string): any => JSON.parse(readFileSync(join(DIR, file), "utf8"));

const report = createReport();
const tally = report.tally;

const entries: DndSrdEntry[] = [];
const push = (e: DndSrdEntry) => { entries.push(e); tally(`entries: ${e.category}`); };

// ── Markup ───────────────────────────────────────────────────────────────────

// The glossary's tables lost their line breaks: "| a | b | | c | d |" can't
// tell a row boundary from an empty cell, so the |---|---| separator row's
// width says how many cells each row has.
function unflattenTables(text: string): string {
    const separator = /\|(?:\s*:?-{3,}:?\s*\|)+/g;
    let out = "";
    let pos = 0;
    for (const sep of Array.from(text.matchAll(separator))) {
        if (sep.index! < pos) continue;
        const width = (sep[0].match(/-{3,}/g) ?? []).length;
        const row = `\\|(?:[^|\\n]*\\|){${width}}`;
        const before = text.slice(pos, sep.index);
        const header = before.match(new RegExp(`${row}\\s*$`));
        if (!header) continue;
        const rows = [header[0].trim(), sep[0]];
        let rest = text.slice(sep.index! + sep[0].length);
        for (let m = rest.match(new RegExp(`^\\s*${row}`)); m; m = rest.match(new RegExp(`^\\s*${row}`))) {
            rows.push(m[0].trim());
            rest = rest.slice(m[0].length);
        }
        // "Table: Object Armor Class" right before a table is its caption.
        const lead = before.slice(0, header.index).replace(/\s*Table:\s*([^.|]+?)\s*$/, "\n\n**$1**");
        out += `${lead}\n\n${rows.join("\n")}\n\n`;
        pos = text.length - rest.length;
    }
    return out + text.slice(pos);
}

function tidy(text: string | null | undefined): string {
    return unflattenTables(text ?? "")
        .replace(/\r\n/g, "\n")
        .replace(/\*\*\*([^*\n]+?)\*\*\*/g, "**$1**")
        .replace(/\*\*_([^_\n]+?)_\*\*/g, "**$1**")
        .replace(/_\*\*([^*\n]+?)\*\*_/g, "**$1**")
        // Typos in the source: "**Structures._**", "**_Spell Resistance.*",
        // "**Reflect Enchantment.***", "**Behavior for the Turn****".
        .replace(/\*\*([^*_\n]+?)_\*\*/g, "**$1**")
        .replace(/\*\*_([^*_\n]+?)\*(?!\*)/g, "**$1**")
        .replace(/\*\*([^*\n]+?)\*{3,}/g, "**$1**")
        .replace(/^#{1,6}\s+(.+?)\s*#*\s*$/gm, "\n**$1**\n")
        // A run of table lines becomes a paragraph of its own.
        .replace(/(?:^[ \t]*\|.*\|[ \t]*(?:\n|$))+/gm, (block) => `\n\n${block.trim()}\n\n`)
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

const stripMarks = (s: string) => s.replace(/\*+/g, "").trim();

// ── Link targets ─────────────────────────────────────────────────────────────

const rawSpells: any[] = read("spells.json").spells;
const rawItems: any[] = read("magic_items.json").items;
const spellId = (name: string) => `spell-${slugify(name)}`;
const itemId = (name: string) => `item-${slugify(name)}`;
const spellIdByName = new Map(rawSpells.map(s => [norm(s.name), spellId(s.name)]));
const itemIdByName = new Map(rawItems.map(i => [norm(i.name), itemId(i.name)]));

// Spell and magic item names are italicized wherever they're mentioned
// ("casts *Detect Magic*"), which makes them reliable to link.
const ITALIC = /(?<![*\w])\*(?![\s*])([^*\n]+?)(?<![\s*])\*(?![*\w])/g;
function linkItalics(text: string, links: Record<string, string>, selfId?: string): string {
    return text.replace(ITALIC, (whole, inner: string) => {
        const id = spellIdByName.get(norm(inner)) ?? itemIdByName.get(norm(inner));
        if (!id || id === selfId) return whole;
        links[inner] = id;
        tally("italic spell/item names linked");
        return `*[[${inner}]]*`;
    });
}

const linkedText = (text: string | null | undefined, links: Record<string, string>, selfId?: string) =>
    linkItalics(tidy(text), links, selfId);

// ── Monsters ─────────────────────────────────────────────────────────────────

function formatCR(cr: number): string {
    if (cr === 0) return "0";
    if (cr <= 0.13) return "1/8";
    if (cr <= 0.26) return "1/4";
    if (cr <= 0.51) return "1/2";
    return Number.isInteger(cr) ? String(cr) : String(Math.round(cr));
}
const sign = (n: number) => (n >= 0 ? `+${n}` : String(n));
const list = (xs: unknown) => (Array.isArray(xs) ? xs.filter(Boolean).join(", ") : "");

function monsterEntry(m: any): DndSrdEntry {
    const id = `monster-${slugify(m.name)}`;
    const links: Record<string, string> = {};
    const speeds = Object.entries<number>(m.speed || {}).map(([k, v]) => (k === "walk" ? `${v} ft.` : `${k} ${v} ft.`));
    const senses = Object.entries<number>(m.senses || {})
        .map(([k, v]) => (k === "passive_perception" ? `Passive Perception ${v}` : `${k.charAt(0).toUpperCase() + k.slice(1)} ${v} ft.`));
    const skills = Object.entries<number>(m.skills || {})
        .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} ${sign(v)}`);
    const block = (key: string, label: string) => {
        const items: any[] = m[key] ?? [];
        if (!items.length) return null;
        return paragraphs(
            key !== "traits" && `**${label}**`,
            key === "legendary_actions" && m.legendary_desc && linkedText(m.legendary_desc, links, id),
            ...items.map(t => {
                const usage = t.recharge && !/recharge/i.test(t.name) ? ` (Recharge ${t.recharge})`
                    : t.uses_per_day && !/\/day/i.test(t.name) ? ` (${t.uses_per_day}/Day)` : "";
                return `**${t.name}${usage}.** ${linkedText(t.desc, links, id)}`;
            }),
        );
    };
    return {
        id,
        name: m.name,
        category: "Monster",
        meta: `CR ${formatCR(m.cr)} | ${m.size} ${m.type}${m.subtype ? ` (${m.subtype})` : ""} | HP ${m.hit_points} | AC ${m.armor_class}`,
        description: paragraphs(
            [
                `**Armor Class** ${m.armor_class}${m.armor_desc ? ` (${m.armor_desc})` : ""}`,
                `**Hit Points** ${m.hit_points}${m.hit_dice ? ` (${m.hit_dice})` : ""}`,
                speeds.length && `**Speed** ${speeds.join(", ")}`,
                m.initiative_bonus != null && `**Initiative** ${sign(m.initiative_bonus)}`,
            ].filter(Boolean).join("\n"),
            `STR ${m.strength} (${sign(m.strength_mod)})  DEX ${m.dexterity} (${sign(m.dexterity_mod)})  CON ${m.constitution} (${sign(m.constitution_mod)})  ` +
            `INT ${m.intelligence} (${sign(m.intelligence_mod)})  WIS ${m.wisdom} (${sign(m.wisdom_mod)})  CHA ${m.charisma} (${sign(m.charisma_mod)})`,
            [
                skills.length && `**Skills** ${skills.join(", ")}`,
                list(m.damage_vulnerabilities) && `**Vulnerabilities** ${list(m.damage_vulnerabilities)}`,
                list(m.damage_resistances) && `**Resistances** ${list(m.damage_resistances)}`,
                list(m.damage_immunities) && `**Immunities** ${list(m.damage_immunities)}`,
                list(m.condition_immunities) && `**Condition Immunities** ${list(m.condition_immunities)}`,
                list(m.gear) && `**Gear** ${list(m.gear)}`,
                senses.length && `**Senses** ${senses.join(", ")}`,
                list(m.languages) && `**Languages** ${list(m.languages)}`,
                `**CR** ${formatCR(m.cr)}${m.xp != null ? ` (XP ${m.xp.toLocaleString("en-US")}${m.xp_in_lair ? `, or ${m.xp_in_lair.toLocaleString("en-US")} in lair` : ""})` : ""}`,
            ].filter(Boolean).join("\n"),
            block("traits", "Traits"),
            block("actions", "Actions"),
            block("bonus_actions", "Bonus Actions"),
            block("reactions", "Reactions"),
            block("legendary_actions", "Legendary Actions"),
        ),
        links,
        facets: facets({ CR: formatCR(m.cr), Type: m.type, Size: m.size }),
    };
}
for (const m of [...read("monsters.json").monsters, ...read("animals.json").animals]) push(monsterEntry(m));

// ── Spells & magic items ─────────────────────────────────────────────────────

// "Using a Higher-Level Spell Slot. The damage…" → bold lead-in.
const boldLeadIn = (s: string) => s.replace(/^([A-Z][^.]{2,40}\.)\s/, "**$1** ");

for (const s of rawSpells) {
    const id = spellId(s.name);
    const links: Record<string, string> = {};
    const comps: string[] = [];
    if (s.components?.verbal) comps.push("V");
    if (s.components?.somatic) comps.push("S");
    if (s.components?.has_material) comps.push(`M (${s.components.material})`);
    push({
        id,
        name: s.name,
        category: "Spell",
        meta: `${s.level === 0 ? "Cantrip" : `Level ${s.level}`} | ${s.school} | ${(s.classes ?? []).join(", ")}`,
        description: paragraphs(
            [
                `**Casting Time:** ${s.casting_time?.raw ?? ""}${s.casting_time?.ritual ? " (Ritual)" : ""}`,
                `**Range:** ${s.range ?? "—"}`,
                `**Components:** ${comps.join(", ") || "—"}`,
                `**Duration:** ${s.duration?.raw ?? ""}${s.duration?.concentration ? " (Concentration)" : ""}`,
            ].join("\n"),
            linkedText(s.description, links, id),
            s.upcast && boldLeadIn(linkedText(s.upcast, links, id)),
        ),
        links,
        facets: facets({
            Level: s.level === 0 ? "Cantrip" : String(s.level),
            School: s.school,
            Class: s.classes ?? [],
            Casting: [s.casting_time?.ritual && "Ritual", s.duration?.concentration && "Concentration"].filter(Boolean) as string[],
        }),
    });
}

// "Uncommon (+1), Rare (+2), or Very Rare (+3)" is in each of those rarities.
const RARITIES = ["Very Rare", "Uncommon", "Common", "Rare", "Legendary", "Artifact"];
function rarities(raw: string): string[] {
    if (/varies/i.test(raw)) return ["Varies"];
    let rest = raw;
    const found: string[] = [];
    for (const r of RARITIES) {
        if (new RegExp(`\\b${r}\\b`, "i").test(rest)) { found.push(r); rest = rest.replace(new RegExp(`\\b${r}\\b`, "gi"), ""); }
    }
    return found;
}

for (const item of rawItems) {
    const id = itemId(item.name);
    const links: Record<string, string> = {};
    const attunement = item.requires_attunement
        ? `Requires Attunement${item.attunement_note ? ` (${item.attunement_note})` : ""}`
        : null;
    push({
        id,
        name: item.name,
        category: "Magic Item",
        meta: metaLine(item.rarity, item.type, attunement),
        description: linkedText(item.description, links, id),
        links,
        facets: facets({
            Rarity: rarities(item.rarity ?? ""),
            Type: (item.type ?? "").split(" (")[0],
            Attunement: item.requires_attunement ? "Requires attunement" : "No attunement",
        }),
    });
}

// ── Equipment ────────────────────────────────────────────────────────────────

const equipment = read("equipment.json");
const weaponPropertyId = (name: string) => `rule-weapon-property-${slugify(name)}`;
const masteryId = (name: string) => `rule-mastery-property-${slugify(name)}`;
const weaponPropertyIds = new Map(Object.keys(equipment.weapon_properties).map(n => [norm(n), weaponPropertyId(n)]));
const masteryIds = new Map(Object.keys(equipment.mastery_properties).map(n => [norm(n), masteryId(n)]));

for (const [name, text] of Object.entries<string>(equipment.weapon_properties)) {
    push({
        id: weaponPropertyId(name), name, category: "Rule", meta: "Equipment — Weapon Property",
        description: tidy(text), facets: facets({ Section: "Equipment", Tag: "Weapon property" }),
    });
}
for (const [name, text] of Object.entries<string>(equipment.mastery_properties)) {
    push({
        id: masteryId(name), name, category: "Rule", meta: "Equipment — Mastery Property",
        description: tidy(text), facets: facets({ Section: "Equipment", Tag: "Mastery property" }),
    });
}

const costOf = (c: any) => c?.raw ?? (c?.gp != null ? `${c.gp} GP` : null);
const weightOf = (w: any) => (w ? `${w} lb.` : null);

for (const w of equipment.weapons) {
    const links: Record<string, string> = {};
    // "Thrown (Range 20/60)" → "[[Thrown]] (Range 20/60)".
    const properties = (w.properties ?? []).map((p: string) => {
        const [base, ...rest] = p.split(" (");
        const target = weaponPropertyIds.get(norm(base));
        if (!target) return p;
        links[base] = target;
        return [`[[${base}]]`, ...rest].join(" (");
    });
    const masteryTarget = w.mastery && masteryIds.get(norm(w.mastery));
    if (masteryTarget) links[w.mastery] = masteryTarget;
    push({
        id: `weapon-${slugify(w.name)}`,
        name: w.name,
        category: "Equipment",
        meta: metaLine(`${w.category} ${w.combat_type} Weapon`, `${w.damage_dice ?? ""} ${w.damage_type ?? ""}`.trim(), costOf(w.cost)),
        description: [
            properties.length && `**Properties:** ${properties.join(", ")}`,
            w.mastery && `**Mastery:** ${masteryTarget ? `[[${w.mastery}]]` : w.mastery}`,
            weightOf(w.weight) && `**Weight:** ${weightOf(w.weight)}`,
            costOf(w.cost) && `**Cost:** ${costOf(w.cost)}`,
        ].filter(Boolean).join("\n"),
        links,
        facets: facets({
            Group: "Weapon",
            Category: `${w.category} ${w.combat_type}`,
            Property: (w.properties ?? []).map((p: string) => p.split(" (")[0]),
            Mastery: w.mastery,
        }),
    });
}

for (const a of equipment.armor) {
    push({
        id: `armor-${slugify(a.name)}`,
        name: a.name,
        category: "Equipment",
        meta: metaLine(a.category, `AC ${a.ac_formula}`, costOf(a.cost)),
        description: [
            `**Armor Class:** ${a.ac_formula}`,
            a.strength_requirement && `**Strength:** ${a.strength_requirement}`,
            a.stealth_disadvantage && "**Stealth:** Disadvantage",
            a.don_doff && `**Don/Doff:** ${a.don_doff}`,
            weightOf(a.weight) && `**Weight:** ${weightOf(a.weight)}`,
            costOf(a.cost) && `**Cost:** ${costOf(a.cost)}`,
        ].filter(Boolean).join("\n"),
        facets: facets({ Group: "Armor", Category: a.category }),
    });
}

for (const [group, key, prefix] of [["Adventuring Gear", "adventuring_gear", "gear"], ["Tool", "tools", "tool"]] as const) {
    for (const g of equipment[key]) {
        const links: Record<string, string> = {};
        push({
            id: `${prefix}-${slugify(g.name)}`,
            name: g.name,
            category: "Equipment",
            meta: metaLine(group, costOf(g.cost), weightOf(g.weight)),
            // Tool stats are run together on one line: "**Ability:** Int  **Weight:** 8 lb."
            description: linkedText((g.description ?? "").replace(/\s{2,}(?=\*\*)/g, "\n"), links),
            links,
            facets: facets({ Group: group }),
        });
    }
}

// ── Classes & class features ─────────────────────────────────────────────────

const classes: any[] = read("classes.json").classes;
const featureEntryId = (name: string) => `feature-${slugify(name)}`;

interface FeatureUse { className: string; subclass?: string; level: number; description: string }
const featureUses = new Map<string, { name: string; uses: FeatureUse[] }>();
for (const c of classes) {
    const subclassFeatures = new Set(Object.keys(c.subclass?.features ?? {}));
    // A feature can recur in the table (Ability Score Improvement at 4, 8, 12…).
    const levelsByFeature = new Map<string, number[]>();
    for (const row of c.feature_table ?? []) {
        for (const f of row.features ?? []) {
            const base = f.replace(/\s*\([^)]*\)$/, "");
            if (!levelsByFeature.has(base)) levelsByFeature.set(base, []);
            levelsByFeature.get(base)!.push(row.level);
        }
    }
    for (const [name, f] of Object.entries<any>(c.feature_descriptions ?? {})) {
        const key = norm(name);
        if (!featureUses.has(key)) featureUses.set(key, { name, uses: [] });
        const levels = levelsByFeature.get(name) ?? [f.level];
        for (const level of Array.from(new Set(levels))) {
            featureUses.get(key)!.uses.push({
                className: c.name,
                subclass: subclassFeatures.has(name) ? c.subclass.name : undefined,
                level,
                description: f.description ?? "",
            });
        }
    }
}

const ownerLabel = (u: FeatureUse) => (u.subclass ? `${u.subclass} (${u.className})` : u.className);
const joinOwners = (owners: string[]) => (owners.length > 3 ? `${owners.length} classes` : owners.join(", "));
const levelsLabel = (levels: number[]) => {
    const distinct = Array.from(new Set(levels)).sort((a, b) => a - b);
    return `${distinct.length > 1 ? "Levels" : "Level"} ${distinct.join(", ")}`;
};

for (const { name, uses } of Array.from(featureUses.values())) {
    const id = featureEntryId(name);
    const links: Record<string, string> = {};
    // One version per distinct text; classes sharing a text share a version.
    const versions = Array.from(groupBy(uses, u => norm(u.description)).values()).map(group => {
        const owners = Array.from(new Set(group.map(ownerLabel)));
        return {
            label: owners.join(", "),
            meta: metaLine(joinOwners(owners), levelsLabel(group.map(u => u.level))),
            description: linkedText(group[0].description, links),
        };
    });
    if (versions.length > 1) tally("class features with a version per class", 1);
    const owners = Array.from(new Set(uses.map(ownerLabel)));
    push({
        id,
        name,
        category: "Class Feature",
        meta: versions.length > 1 ? metaLine(joinOwners(owners), `${versions.length} versions`) : versions[0].meta,
        description: versions[0].description,
        variants: versions.length > 1 ? versions satisfies SrdVariant[] : undefined,
        links,
        facets: facets({
            Class: Array.from(new Set(uses.map(u => u.className))),
            Level: Array.from(new Set(uses.map(u => String(u.level)))),
            Kind: uses.some(u => u.subclass) ? "Subclass feature" : "Class feature",
        }),
    });
}

// Option lists some classes choose from, kept beside the class rather than in
// its features: Sorcerer Metamagic, Warlock Eldritch Invocations.
const CLASS_OPTIONS: Array<{ key: string; kind: string; prefix: string; heading: string }> = [
    { key: "metamagic", kind: "Metamagic option", prefix: "metamagic", heading: "Metamagic Options" },
    { key: "eldritch_invocations", kind: "Eldritch invocation", prefix: "invocation", heading: "Eldritch Invocations" },
];
const optionIdsByClass = new Map<string, Array<{ heading: string; names: Array<[string, string]> }>>();
for (const c of classes) {
    for (const { key, kind, prefix, heading } of CLASS_OPTIONS) {
        const options: any[] = c[key] ?? [];
        if (!options.length) continue;
        const names: Array<[string, string]> = [];
        for (const o of options) {
            const id = `${prefix}-${slugify(o.name)}`;
            const links: Record<string, string> = {};
            names.push([o.name, id]);
            push({
                id,
                name: o.name,
                category: "Class Feature",
                meta: metaLine(`${c.name} ${kind.replace(/ option$/, "")}`, o.cost, o.prerequisite && `Prereq: ${o.prerequisite}`),
                description: linkedText(o.description, links, id),
                links,
                facets: facets({ Class: c.name, Kind: kind }),
            });
        }
        if (!optionIdsByClass.has(c.name)) optionIdsByClass.set(c.name, []);
        optionIdsByClass.get(c.name)!.push({ heading, names });
    }
}

const featureIdByName = new Map(Array.from(featureUses.keys()).map(k => [k, featureEntryId(featureUses.get(k)!.name)]));

// "Action Surge (two uses)" in the table links to "Action Surge".
function linkFeature(label: string, links: Record<string, string>): string {
    const base = label.replace(/\s*\([^)]*\)$/, "");
    const target = featureIdByName.get(norm(base));
    if (!target) return label;
    links[base] = target;
    return label === base ? `[[${base}]]` : `[[${base}]]${label.slice(base.length)}`;
}

function linkSpellName(name: string, links: Record<string, string>): string {
    const target = spellIdByName.get(norm(name));
    if (!target) return name;
    links[name] = target;
    return `[[${name}]]`;
}

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
function tableExtras(row: any): string {
    return Object.entries<any>(row)
        .filter(([k]) => !["level", "proficiency_bonus", "features"].includes(k))
        .map(([k, v]) => {
            if (Array.isArray(v)) {
                const slots = v.map((n, i) => (n ? `${ordinal(i + 1)} ${n}` : null)).filter(Boolean);
                return slots.length ? `Spell slots ${slots.join(", ")}` : null;
            }
            return v != null && v !== "" && v !== 0 ? `${k} ${v}` : null;
        })
        .filter(Boolean)
        .join(", ");
}

for (const c of classes) {
    const links: Record<string, string> = {};
    const featureLines = (c.feature_table ?? []).map((row: any) => {
        const features = (row.features ?? []).map((f: string) => linkFeature(f, links)).join(", ") || "—";
        const extras = tableExtras(row);
        return `Level ${row.level} (+${row.proficiency_bonus}): ${features}${extras ? ` — ${extras}` : ""}`;
    });
    const sub = c.subclass;
    const subFeatures = Object.values<any>(sub?.features ?? {})
        .sort((a, b) => a.level - b.level)
        .map(f => `Level ${f.level}: ${linkFeature(f.name, links)}`);
    const subSpells = Object.entries<string[]>(sub?.subclass_spells ?? {})
        .map(([level, names]) => `Level ${level}: ${names.map(n => linkSpellName(n, links)).join(", ")}`);
    const optionLists = (optionIdsByClass.get(c.name) ?? []).map(({ heading, names }) => {
        names.forEach(([name, id]) => { links[name] = id; });
        return `**${heading}:** ${names.map(([name]) => `[[${name}]]`).join(", ")}`;
    });
    const spellList = Object.entries<any[]>(c.spell_list ?? {})
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([level, spells]) => `**${level === "0" ? "Cantrips" : `Level ${level}`}:** ${spells.map(s => linkSpellName(s.name, links)).join(", ")}`);
    push({
        id: `class-${slugify(c.name)}`,
        name: c.name,
        category: "Class",
        meta: c.is_spellcaster ? `Spellcaster | ${c.spellcasting_ability ?? "—"}` : "Non-Spellcaster",
        description: paragraphs(
            Object.entries(c.core_traits ?? {}).map(([k, v]) => `**${k}:** ${v}`).join("\n"),
            featureLines.length > 0 && "**Features**\n" + featureLines.join("\n"),
            sub && `**Subclass: ${sub.name}**${sub.tagline ? ` — ${sub.tagline}` : ""}\n` + subFeatures.join("\n"),
            subSpells.length > 0 && "**Subclass Spells**\n" + subSpells.join("\n"),
            ...optionLists,
            spellList.length > 0 && "**Spell List**\n" + spellList.join("\n"),
        ),
        links,
    });
}

// ── Feats, species, backgrounds ──────────────────────────────────────────────

const feats: any[] = read("feats.json").feats;
const featIdByName = new Map(feats.map(f => [norm(f.name), `feat-${slugify(f.name)}`]));

for (const f of feats) {
    const id = `feat-${slugify(f.name)}`;
    const links: Record<string, string> = {};
    push({
        id,
        name: f.name,
        category: "Feat",
        meta: metaLine(f.category, f.prerequisites && `Prereq: ${f.prerequisites}`, f.repeatable && "Repeatable"),
        description: paragraphs(
            linkedText(f.description, links, id),
            ...Object.entries<string>(f.benefits ?? {}).map(([k, v]) => `**${k}.** ${linkedText(v, links, id)}`),
            f.repeatable_note && linkedText(f.repeatable_note, links, id),
        ),
        links,
        facets: facets({ Category: f.category }),
    });
}

for (const s of read("species.json").species) {
    const links: Record<string, string> = {};
    push({
        id: `species-${slugify(s.name)}`,
        name: s.name,
        category: "Species",
        meta: "Species",
        description: paragraphs(
            s.description && linkedText(s.description, links),
            ...Object.entries<string>(s.traits ?? {}).map(([k, v]) => `**${k}.** ${linkedText(v, links)}`),
        ),
        links,
    });
}

for (const b of read("backgrounds.json").backgrounds) {
    const links: Record<string, string> = {};
    const skills = Array.isArray(b.skill_proficiencies) ? b.skill_proficiencies.join(", ") : (b.skill_proficiencies ?? "—");
    // 'Magic Initiate (Cleric) (see "Feats")' → '[[Magic Initiate]] (Cleric)'.
    let feat: string | null = b.feat ? b.feat.replace(/\s*\(see "Feats"\)/i, "") : null;
    const featBase = feat?.split(" (")[0];
    const featTarget = featBase && featIdByName.get(norm(featBase));
    if (feat && featBase && featTarget) {
        links[featBase] = featTarget;
        feat = `[[${featBase}]]${feat.slice(featBase.length)}`;
    }
    push({
        id: `background-${slugify(b.name)}`,
        name: b.name,
        category: "Background",
        meta: `Skills: ${skills}`,
        description: [
            b.ability_scores && `**Ability Score Increases:** ${b.ability_scores}`,
            feat && `**Feat:** ${feat}`,
            b.skill_proficiencies && `**Skill Proficiencies:** ${skills}`,
            b.tool_proficiency && `**Tool Proficiency:** ${b.tool_proficiency}`,
            b.equipment && `**Equipment:** ${linkItalics(b.equipment, links)}`,
        ].filter(Boolean).join("\n\n"),
        links,
    });
}

// ── Rules chapters & glossary ────────────────────────────────────────────────

const CHAPTERS: Array<[string, string]> = [
    ["playing_the_game.json", "Playing the Game"],
    ["character_creation.json", "Character Creation"],
    ["gameplay_toolbox.json", "Gameplay Toolbox"],
    ["monster_rules.json", "Monster Rules"],
];

// chapter → section title → entry id, for resolving "See also" references.
const sectionIds = new Map<string, Map<string, string>>();
const anySectionId = new Map<string, string>();

interface SectionDraft { entry: DndSrdEntry; childTitles: string[] }
const sectionDrafts: SectionDraft[] = [];

for (const [file, chapter] of CHAPTERS) {
    const byTitle = new Map<string, string>();
    sectionIds.set(norm(chapter), byTitle);
    const used = new Set<string>();
    const addSection = (s: any, parent?: any) => {
        const title = stripMarks(s.title);
        let id = `rule-${slugify(chapter)}-${slugify(title)}`;
        if (used.has(id)) id = `rule-${slugify(chapter)}-${slugify(stripMarks(parent?.title ?? ""))}-${slugify(title)}`;
        used.add(id);
        let content: string = s.content ?? "";
        // A subsection repeated inside its parent's text is cut from the parent.
        for (const child of s.subsections ?? []) {
            const childText = (child.content ?? "").trim();
            if (childText.length > 60 && content.includes(childText)) {
                content = content.replace(childText, "");
                tally("rules subsections cut from their parent");
            }
        }
        const links: Record<string, string> = {};
        const entry: DndSrdEntry = {
            id,
            name: title,
            category: "Rule",
            meta: parent ? `${chapter} › ${stripMarks(parent.title)}` : chapter,
            description: linkedText(content, links),
            links,
            facets: facets({ Section: chapter }),
        };
        byTitle.set(norm(title), id);
        if (!anySectionId.has(norm(title))) anySectionId.set(norm(title), id);
        sectionDrafts.push({ entry, childTitles: (s.subsections ?? []).map((c: any) => stripMarks(c.title)) });
        for (const child of s.subsections ?? []) addSection(child, s);
    };
    for (const s of read(file).sections) addSection(s);
}

// Each parent section lists its subsections as links.
for (const { entry, childTitles } of sectionDrafts) {
    if (childTitles.length) {
        const byTitle = sectionIds.get(norm(entry.meta.split(" › ")[0]))!;
        const childLinks = childTitles.map(t => {
            const target = byTitle.get(norm(t));
            if (!target) return t;
            entry.links![t] = target;
            return `[[${t}]]`;
        });
        entry.description = paragraphs(entry.description, `**In this section:** ${childLinks.join(", ")}`);
    }
    push(entry);
}

const glossary: any[] = read("rules_glossary.json").entries;
const glossaryId = (term: string) => `rule-glossary-${slugify(stripMarks(term))}`;
const glossaryIdByTerm = new Map(glossary.map(g => [norm(stripMarks(g.term)), glossaryId(g.term)]));

// *See also* "Playing the Game" ("D20 Tests" and "Proficiency") → link the
// sections, preferring the named chapter; a bare *See also* "Condition" can
// also be another glossary term.
function linkSeeAlso(text: string, links: Record<string, string>, selfId: string): string {
    return text.replace(/\*See also\*([^\n]*)/g, (whole, refs: string) => {
        let chapter: Map<string, string> | undefined;
        const linked = refs.replace(/"([^"]+)"/g, (quoted, inside: string) => {
            // Punctuation sits inside the quotes: "Exhaustion." → [[Exhaustion]].
            const [, title, punctuation] = inside.match(/^(.*?)([.,;:]*)$/)!;
            const key = norm(title);
            if (sectionIds.has(key)) { chapter = sectionIds.get(key); return quoted; }
            const target = chapter?.get(key) ?? anySectionId.get(key) ?? glossaryIdByTerm.get(key);
            if (!target || target === selfId) { tally("glossary see-also references left unlinked"); return quoted; }
            links[title] = target;
            tally("glossary see-also references linked");
            return `"[[${title}]]${punctuation}"`;
        });
        return `*See also*${linked}`;
    });
}

for (const g of glossary) {
    const id = glossaryId(g.term);
    const links: Record<string, string> = {};
    push({
        id,
        name: stripMarks(g.term),
        category: "Rule",
        meta: g.tag ? `Rules Glossary — ${g.tag}` : "Rules Glossary",
        description: linkSeeAlso(linkedText(g.description, links, id), links, id),
        links,
        facets: facets({ Section: "Rules Glossary", Tag: g.tag }),
    });
}

// ── Output ───────────────────────────────────────────────────────────────────

report.print();
writeIndex(OUT, entries);
