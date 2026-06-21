// Shared Cypher System rules-reference data — used by the character sheet's
// damage track reminder and the GM dashboard's quick-reference panel, so the
// wording only lives in one place.

export type DamageTrack = "hale" | "impaired" | "debilitated";

export const DAMAGE_TRACK_INFO: Record<DamageTrack, { label: string; color: string; effect: string }> = {
    hale: {
        label: "Hale", color: "#2e7d32",
        effect: "No penalties. You're functioning at full capacity.",
    },
    impaired: {
        label: "Impaired", color: "#f57c00",
        effect: "You can't apply Effort to any task, and all of your tasks are one step harder than normal.",
    },
    debilitated: {
        label: "Debilitated", color: "#c62828",
        effect: "You can't move or take physical actions. You can still think and talk, but mental actions are one step harder, and you still can't apply Effort. Reaching 0 in a Pool while already debilitated means death.",
    },
};

// Standard difficulty ladder. Target number is always level × 3.
export const DIFFICULTY_TABLE: { level: number; name: string; targetNumber: number }[] = [
    { level: 1, name: "Simple", targetNumber: 3 },
    { level: 2, name: "Standard", targetNumber: 6 },
    { level: 3, name: "Demanding", targetNumber: 9 },
    { level: 4, name: "Difficult", targetNumber: 12 },
    { level: 5, name: "Strenuous", targetNumber: 15 },
    { level: 6, name: "Intimidating", targetNumber: 18 },
    { level: 7, name: "Formidable", targetNumber: 21 },
    { level: 8, name: "Heroic", targetNumber: 24 },
    { level: 9, name: "Immortal", targetNumber: 27 },
    { level: 10, name: "Impossible", targetNumber: 30 },
];

// Cost to apply Effort: the first level costs 3 points from the relevant
// Pool; each additional level costs 2 more. Subtract the matching Edge from
// the total (per use), down to a minimum of 0.
export const EFFORT_COST_TABLE: { level: number; cumulativeCost: number }[] = [
    { level: 1, cumulativeCost: 3 },
    { level: 2, cumulativeCost: 5 },
    { level: 3, cumulativeCost: 7 },
    { level: 4, cumulativeCost: 9 },
    { level: 5, cumulativeCost: 11 },
    { level: 6, cumulativeCost: 13 },
];

export const STEP_MODIFIERS: { label: string; effect: string }[] = [
    { label: "Asset (1 step)", effect: "Each asset eases the task by one step — treat the difficulty as one level lower (−3 target number) per asset, before Effort." },
    { label: "Skill: trained", effect: "Eases the task by one step." },
    { label: "Skill: specialized", effect: "Eases the task by two steps." },
    { label: "Skill: inability", effect: "Hinders the task by one step (+3 target number)." },
    { label: "Hindered", effect: "Each hindrance makes the task one step harder (+3 target number) per source." },
];

// Default cypher carry limit before "too many cyphers" risk applies (most
// characters; some foci/abilities raise this).
export const DEFAULT_CYPHER_LIMIT = 2;
