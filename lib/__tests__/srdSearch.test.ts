import { test } from "node:test";
import assert from "node:assert/strict";
import type { SrdEntry } from "../srdIndex";
import { highlightPattern, prepareDocs, searchSrdIndex, snippet } from "../srdSearch";

const entry = (name: string, description: string, category = "Ability", extra: Partial<SrdEntry> = {}): SrdEntry =>
    ({ id: name.toLowerCase().replace(/\W+/g, "-"), name, category, meta: "", description, ...extra });

const docs = prepareDocs([
    entry("Ice Armor", "Your skin is covered in a thin layer of ice."),
    entry("Good Advice", "You give advice to an ally on a device or a notice."),
    entry("Fire Bloom", "Flames erupt in a burst."),
    entry("Hellfire", "Infernal fire and flames burn a foe."),
    entry("Bears a Halo of Fire", "You are wreathed in flames.", "Focus"),
    entry("Fire", "Fire deals ambient damage to anything flammable.", "Rule"),
    entry("Fire Rules", "Fire works differently in this genre.", "Rule", { secondary: true }),
    entry("Fire Safety", "Fire works differently in this setting.", "Rule"),
    entry("Onslaught", "You attack with a force of will, dealing mental damage.", "Ability"),
    entry("Effort", "Spending points from a Pool to ease a task.", "Rule"),
    entry("Increased Effort", "Apply one more level of Effort than normal.", "Ability"),
    entry("Mind Swapper", "Swap minds with a foe for an hour.", "Cypher", { meta: "Level 1d6 | Subtle" }),
]);
const names = (query: string, category?: string) =>
    searchSrdIndex(docs, query, category).hits.map((h) => h.entry.name);

test("text only matches at the start of a word", () => {
    assert.deepEqual(names("ice"), ["Ice Armor"]);
    assert.ok(!names("ice").includes("Good Advice"), "'ice' inside advice/device/notice doesn't count, in the name or the text");
});

test("an exact name comes first, then names starting with the query, then names containing every word", () => {
    const hits = searchSrdIndex(docs, "fire").hits;
    assert.equal(hits[0].entry.name, "Fire");
    assert.deepEqual(hits.slice(0, 4).map((h) => h.tier), ["exact", "namePrefix", "namePrefix", "namePrefix"]);
    const tierOf = (n: string) => hits.find((h) => h.entry.name === n)?.tier;
    assert.equal(tierOf("Bears a Halo of Fire"), "nameWords");
    assert.equal(tierOf("Hellfire"), "text", "no mid-word name match, but its text says fire");
});

test("secondary entries sort last within the same tier", () => {
    const prefixed = searchSrdIndex(docs, "fire").hits.filter((h) => h.tier === "namePrefix").map((h) => h.entry.name);
    assert.deepEqual(prefixed, ["Fire Bloom", "Fire Safety", "Fire Rules"]);
});

test("every query word must match, in the name or the text", () => {
    assert.deepEqual(names("fire flames"), ["Bears a Halo of Fire", "Fire Bloom", "Hellfire"]);
    assert.deepEqual(names("mental damage"), ["Onslaught"]);
    assert.deepEqual(names("hellfire lava"), []);
});

test("common words aren't required, but still count toward an exact name", () => {
    const d = prepareDocs([
        entry("A Smile and a Word", "Charm someone."),
        entry("Word of Command", "Speak and be obeyed."),
    ]);
    assert.deepEqual(searchSrdIndex(d, "a smile and a word").hits.map((h) => [h.entry.name, h.tier]),
        [["A Smile and a Word", "exact"]]);
    assert.deepEqual(searchSrdIndex(d, "word of the command").hits.map((h) => h.entry.name), ["Word of Command"]);
});

test("name matches outrank entries that only mention the query", () => {
    const hits = searchSrdIndex(docs, "effort").hits;
    assert.deepEqual(hits.map((h) => [h.entry.name, h.tier]), [["Effort", "exact"], ["Increased Effort", "nameWords"]]);
});

test("the meta line isn't searched", () => {
    assert.deepEqual(names("subtle"), []);
});

test("a category with no query lists that category alphabetically", () => {
    assert.deepEqual(names("", "Rule"), ["Effort", "Fire", "Fire Rules", "Fire Safety"]);
    assert.deepEqual(names(""), [], "no query and no category shows nothing");
});

test("a typo falls back to similar names", () => {
    const outcome = searchSrdIndex(docs, "onslaugt");
    assert.equal(outcome.similar, true);
    assert.deepEqual(outcome.hits.map((h) => h.entry.name), ["Onslaught"]);
    assert.equal(searchSrdIndex(docs, "onslaught").similar, false);
});

test("apostrophes and accents don't block a match", () => {
    const d = prepareDocs([entry("Résumé Builder", "Uses the PC's history.")]);
    assert.equal(searchSrdIndex(d, "resume").hits.length, 1);
    assert.equal(searchSrdIndex(d, "pcs history").hits.length, 1);
});

test("snippets centre on the first match and highlight at word starts", () => {
    const pattern = highlightPattern(["ice"]);
    const long = "word ".repeat(40) + "a sheet of ice forms" + " word".repeat(40);
    const s = snippet(long, pattern, 20)!;
    assert.ok(s.includes("sheet of ice forms"));
    assert.ok(s.startsWith("…") && s.endsWith("…"));
    assert.equal(snippet("advice and devices", pattern), null);
});
