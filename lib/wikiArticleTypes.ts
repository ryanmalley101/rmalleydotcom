// Single source of truth for wiki article classification. Previously split
// across two fields (Category + Article Type) — squashed into one
// `articleType` attribute on WikiArticle. Names mostly mirror World Anvil's
// own template names, since articles are frequently imported from there.
export const ARTICLE_TYPES = [
    "Character", "Organization", "Condition", "Prose", "Document",
    "Profession", "Race/Ethnicity", "Plot", "Event", "Species",
    "Material", "Spell", "Myth", "Tradition", "Location", "Item",
    "Natural Law",
];

export const DEFAULT_ARTICLE_TYPE = "Document";

export const ARTICLE_TYPE_COLORS: Record<string, string> = {
    Character:          "#1d4ed8",
    Organization:        "#15803d",
    Condition:           "#b91c1c",
    Prose:               "#7e22ce",
    Document:            "#374151",
    Profession:          "#b45309",
    "Race/Ethnicity":    "#be185d",
    Plot:                "#7c2d12",
    Event:               "#c2410c",
    Species:             "#4d7c0f",
    Material:            "#78716c",
    Spell:               "#6d28d9",
    Myth:                "#92400e",
    Tradition:           "#a16207",
    Location:            "#0e7490",
    Item:                "#ca8a04",
    "Natural Law":       "#1e3a8a",
};
