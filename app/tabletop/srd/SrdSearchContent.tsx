"use client";

import SrdBrowser, { type SrdBrowserConfig } from "../_srd-shared/SrdBrowser";
import { DND_SRD_INDEX_PATH, type DndSrdCategory } from "@/lib/dndSrdIndex";
import { DND_FACETS } from "@/lib/dndSrdFacets";

// The data behind this page is built by scripts/build-dnd-srd-index.ts.

const COLORS: Record<DndSrdCategory, string> = {
    Monster:         "#c62828",
    Spell:           "#6a1b9a",
    "Magic Item":    "#e65100",
    Equipment:       "#37474f",
    Class:           "#0d47a1",
    "Class Feature": "#1565c0",
    Feat:            "#2e7d32",
    Species:         "#00695c",
    Background:      "#4e342e",
    Rule:            "#424242",
};

const BLURBS: Record<DndSrdCategory, string> = {
    Monster:         "Stat blocks, including animals",
    Spell:           "Every SRD spell, by level and class",
    "Magic Item":    "Wondrous items, weapons, armor, potions…",
    Equipment:       "Weapons, armor, gear, and tools",
    Class:           "Core traits, features, and spell lists",
    "Class Feature": "Class and subclass features, Metamagic, invocations",
    Feat:            "Origin, general, fighting style, epic boon",
    Species:         "Species traits",
    Background:      "Ability scores, feats, proficiencies",
    Rule:            "Rules chapters and the Rules Glossary",
};

const CONFIG: SrdBrowserConfig = {
    title: "5.5e SRD Reference",
    intro: "Search the D&D 2024 System Reference Document — monsters, spells, magic items, classes, rules, and more.",
    placeholder: "Search monsters, spells, items, rules…",
    indexPath: DND_SRD_INDEX_PATH,
    iconColor: "#8C5A3A",
    colors: COLORS,
    blurbs: BLURBS,
    facets: DND_FACETS,
    // SRD 5.2.1 is licensed CC-BY-4.0, which requires this attribution.
    footer: "This work includes material from the System Reference Document 5.2.1 (\"SRD 5.2.1\") by Wizards of the Coast LLC, " +
        "available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 " +
        "International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.",
};

export default function SrdSearchContent() {
    return <SrdBrowser config={CONFIG} />;
}
