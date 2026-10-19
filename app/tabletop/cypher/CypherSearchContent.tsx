"use client";

import SrdBrowser, { type SrdBrowserConfig } from "../_srd-shared/SrdBrowser";
import { CYPHER_SRD_INDEX_PATH, type CypherSrdCategory } from "@/lib/cypherSrdIndex";
import { CYPHER_FACETS } from "@/lib/cypherSrdFacets";

// The data behind this page is built by scripts/build-cypher-srd-index.ts.

const COLORS: Record<CypherSrdCategory, string> = {
    Ability:         "#9a3412",
    Artifact:        "#a16207",
    "Character Arc": "#92400e",
    Creature:        "#7c2d12",
    Cypher:          "#b45309",
    Descriptor:      "#15803d",
    Equipment:       "#1e3a5f",
    Flavor:          "#065f46",
    Focus:           "#1d4ed8",
    Glossary:        "#374151",
    Mutation:        "#6d28d9",
    NPC:             "#7e22ce",
    "Quick Stats":   "#9f1239",
    Rule:            "#0e7490",
    Type:            "#0f766e",
};

const BLURBS: Record<CypherSrdCategory, string> = {
    Ability:         "Type, focus, and flavor abilities",
    Artifact:        "Genre artifacts with depletion",
    "Character Arc": "Story goals that earn XP",
    Creature:        "Full creature statblocks",
    Cypher:          "Core and genre cyphers",
    Descriptor:      "The adjective in \"I am a…\"",
    Equipment:       "Fantasy and sci-fi gear",
    Flavor:          "Ability bundles that reskin a type",
    Focus:           "The verb in \"…who…\"",
    Glossary:        "Game terms",
    Mutation:        "Distinctive, beneficial, harmful, powerful",
    NPC:             "Full NPC statblocks",
    "Quick Stats":   "One-line NPC and creature stats",
    Rule:            "Core, optional, and genre rules",
    Type:            "Warrior, Adept, Explorer, Speaker",
};

const CONFIG: SrdBrowserConfig = {
    title: "Cypher System SRD",
    intro: "Search the Cypher System Reference Document — abilities, creatures, cyphers, descriptors, foci, and more.",
    placeholder: "Search abilities, creatures, cyphers, foci…",
    indexPath: CYPHER_SRD_INDEX_PATH,
    iconColor: "#9a3412",
    colors: COLORS,
    blurbs: BLURBS,
    facets: CYPHER_FACETS,
    facetLabels: { Book: "Source book" },
};

export default function CypherSearchContent() {
    return <SrdBrowser config={CONFIG} />;
}
