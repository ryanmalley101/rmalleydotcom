// What the Cypher SRD page offers as filters and browse groupings (the
// mechanics are in lib/srdFacets.ts; the values come from the index, generated
// by scripts/build-cypher-srd-index.ts).

import { CYPHER_SRD_CATEGORIES } from "./cypherSrdIndex";
import type { SrdFacetConfig } from "./srdFacets";

export const CYPHER_FACETS: SrdFacetConfig = {
    categories: CYPHER_SRD_CATEGORIES,
    keys: ["Section", "Topic", "Type", "Setting", "Pool", "Kind", "Level", "Genre", "Group", "Book"],
    preferredOrder: {
        Pool: ["Might", "Speed", "Intellect", "No cost"],
        Kind: ["Enabler", "Action"],
        Type: ["Subtle", "Manifest", "Fantastic"],
        Setting: ["Core"],
        Section: ["How to Play", "Rules", "Experience Points", "Followers & Factions", "Running the Game", "Optional Rules"],
        Book: ["Cypher System Rulebook"],
    },
    browseGrouping: {
        Ability: "Pool", Artifact: "Genre", Creature: "Level", Cypher: "Type", Equipment: "Group",
        Focus: "Book", Mutation: "Kind", NPC: "Level", "Quick Stats": "Level", Rule: "Section",
    },
    groupLabelPrefix: { Level: "Level " },
};
