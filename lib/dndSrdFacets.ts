// What the D&D 5.5e SRD page offers as filters and browse groupings (the
// mechanics are in lib/srdFacets.ts; the values come from the index, generated
// by scripts/build-dnd-srd-index.ts).

import { DND_SRD_CATEGORIES } from "./dndSrdIndex";
import type { SrdFacetConfig } from "./srdFacets";

export const DND_FACETS: SrdFacetConfig = {
    categories: DND_SRD_CATEGORIES,
    keys: [
        "Section", "Tag", "Type", "Size", "CR", "Level", "School", "Class", "Casting",
        "Rarity", "Attunement", "Group", "Category", "Property", "Mastery", "Kind",
    ],
    preferredOrder: {
        Size: ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"],
        Level: ["Cantrip"],
        Rarity: ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact", "Varies"],
        Attunement: ["Requires attunement", "No attunement"],
        Group: ["Weapon", "Armor", "Adventuring Gear", "Tool"],
        Category: ["Simple Melee", "Simple Ranged", "Martial Melee", "Martial Ranged", "Light Armor", "Medium Armor", "Heavy Armor", "Shield"],
        Kind: ["Class feature", "Subclass feature", "Metamagic option", "Eldritch invocation"],
        Section: ["Playing the Game", "Character Creation", "Equipment", "Gameplay Toolbox", "Monster Rules", "Rules Glossary"],
    },
    browseGrouping: {
        Monster: "Type", Spell: "Level", "Magic Item": "Rarity", Equipment: "Group",
        "Class Feature": "Class", Feat: "Category", Rule: "Section",
    },
    groupLabelPrefix: { CR: "CR ", Level: "Level " },
};
