import { test } from "node:test";
import assert from "node:assert/strict";
import type { SrdEntry } from "../srdIndex";
import {
    compareFacetValues, groupByFacet, matchesFacets, searchStateFromParams, searchStateToParams, summarizeFacets,
    toggleFacet, type SrdFacetConfig,
} from "../srdFacets";

const config: SrdFacetConfig = {
    categories: ["Ability", "Creature", "Cypher"],
    keys: ["Type", "Pool", "Kind", "Level"],
    preferredOrder: { Pool: ["Might", "Speed", "Intellect", "No cost"], Kind: ["Enabler", "Action"] },
    groupLabelPrefix: { Level: "Level " },
};

const entry = (name: string, facets: Record<string, string[]>, category = "Ability"): { entry: SrdEntry } =>
    ({ entry: { id: name, name, category, meta: "", description: "", facets } });

const items = [
    entry("Bash", { Pool: ["Might"], Kind: ["Action"] }),
    entry("Fleet", { Pool: ["Speed"], Kind: ["Action"] }),
    entry("Brawn", { Pool: ["Might", "Speed"], Kind: ["Action"] }),
    entry("Tough", { Pool: ["No cost"], Kind: ["Enabler"] }),
    entry("Onslaught", { Pool: ["Intellect"], Kind: ["Action"] }),
];

test("values within a facet are alternatives; different facets must all match", () => {
    const pick = (sel: Record<string, string[]>) => items.filter((i) => matchesFacets(i.entry, sel)).map((i) => i.entry.name);
    assert.deepEqual(pick({ Pool: ["Might"] }), ["Bash", "Brawn"]);
    assert.deepEqual(pick({ Pool: ["Might", "Intellect"] }), ["Bash", "Brawn", "Onslaught"]);
    assert.deepEqual(pick({ Pool: ["No cost"], Kind: ["Action"] }), []);
});

test("facet counts ignore their own selection but respect the others", () => {
    const summary = summarizeFacets(items, { Pool: ["Might"] }, config);
    const pool = summary.find((s) => s.key === "Pool")!;
    assert.deepEqual(pool.values.map((v) => [v.value, v.count, v.selected]),
        [["Might", 2, true], ["Speed", 2, false], ["Intellect", 1, false], ["No cost", 1, false]],
        "pool counts aren't narrowed by the pool selection, and values follow the preferred order");
    const kind = summary.find((s) => s.key === "Kind")!;
    assert.deepEqual(kind.values.map((v) => [v.value, v.count]), [["Action", 2]],
        "kind counts are narrowed by the pool selection");
});

test("a facet with a single value isn't offered unless it's selected", () => {
    const one = [entry("A", { Kind: ["Action"] }), entry("B", { Kind: ["Action"] })];
    assert.deepEqual(summarizeFacets(one, {}, config), []);
    assert.equal(summarizeFacets(one, { Kind: ["Action"] }, config).length, 1);
});

test("toggling adds and removes values, dropping empty keys", () => {
    let sel = toggleFacet({}, "Pool", "Might");
    sel = toggleFacet(sel, "Pool", "Speed");
    assert.deepEqual(sel, { Pool: ["Might", "Speed"] });
    sel = toggleFacet(toggleFacet(sel, "Pool", "Might"), "Pool", "Speed");
    assert.deepEqual(sel, {});
});

test("grouping orders levels numerically and lists multi-valued items under each value", () => {
    const creatures = [
        entry("Ogre", { Level: ["10"] }, "Creature"),
        entry("Rat", { Level: ["2"] }, "Creature"),
        entry("Odd", {}, "Creature"),
    ];
    assert.deepEqual(groupByFacet(creatures, "Level", config).map((g) => [g.label, g.items.length]),
        [["Level 2", 1], ["Level 10", 1], ["Other", 1]]);
    assert.deepEqual(groupByFacet(items, "Pool", config).map((g) => g.label), ["Might", "Speed", "Intellect", "No cost"]);
    assert.equal(groupByFacet(items, "Pool", config).find((g) => g.label === "Speed")!.items.length, 2);
});

test("search state round-trips through the URL", () => {
    const state = { query: "fire", category: "Cypher", facets: { Type: ["Subtle", "Manifest"] }, focusId: "cypher-x" };
    const params = searchStateToParams(state, config);
    assert.equal(params.toString(), "q=fire&cat=Cypher&type=Subtle&type=Manifest&id=cypher-x");
    assert.deepEqual(searchStateFromParams(params, config), state);
});

test("unknown categories and facets in the URL are ignored", () => {
    const state = searchStateFromParams(new URLSearchParams("cat=Spaceship&colour=red&q=x"), config);
    assert.deepEqual(state, { query: "x", category: "All", facets: {}, focusId: null });
});

test("fractional values like challenge ratings sort numerically", () => {
    const crs = ["2", "1/2", "0", "1/8", "10", "1/4", "1"];
    assert.deepEqual([...crs].sort(compareFacetValues(config, "CR")), ["0", "1/8", "1/4", "1/2", "1", "2", "10"]);
});

test("grouping by a filtered facet only shows the selected values' groups", () => {
    const shared = [entry("Ability Score Improvement", { Class: ["Barbarian", "Warlock"] }), entry("Pact Magic", { Class: ["Warlock"] })];
    assert.deepEqual(groupByFacet(shared, "Class", config, ["Warlock"]).map((g) => [g.label, g.items.length]), [["Warlock", 2]]);
});
