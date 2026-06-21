// Shared D&D 5e/5.5e rules-reference data for the GM dashboard's quick-reference
// panel. Sourced from the 5.5e (2024) SRD rules glossary bundled at
// /public/5_5_SRD/rules_glossary.json — 2014-rules tables differ in a few
// places (noted inline) and aren't reproduced verbatim here.

export const DEATH_SAVES_REFERENCE = {
    intro: "A character who starts their turn at 0 HP must make a death save: roll a d20.",
    bullets: [
        "10 or higher: success. 3 successes (need not be consecutive) and you become stable.",
        "9 or lower: failure. 3 failures (need not be consecutive) and the character dies.",
        "Natural 1: counts as two failures.",
        "Natural 20: regain 1 hit point and become conscious.",
        "Taking any damage while at 0 HP counts as a failure (two failures if it's a critical hit). Damage at 0 HP equal to or exceeding your HP maximum in one hit kills outright.",
    ],
};

export const CONCENTRATION_REFERENCE = {
    intro: "Taking damage while concentrating forces a Constitution save to maintain it.",
    bullets: [
        "DC = 10, or half the damage taken (rounded down) if that's higher — capped at DC 30.",
        "Starting to concentrate on something else, or being Incapacitated or killed, ends concentration immediately (no save).",
    ],
};

export const COVER_REFERENCE = {
    intro: "Cover only helps the side being attacked or making the save — pick the best applicable degree, they don't stack.",
    bullets: [
        "Half cover: +2 AC and Dex saves.",
        "Three-quarters cover: +5 AC and Dex saves.",
        "Total cover: can't be targeted directly.",
    ],
};

export const EXHAUSTION_REFERENCE = {
    intro2024: "2024 rules: each level is −2 on every d20 Test and −5 ft. Speed, both cumulative. Level 6 kills you. A completed Long Rest removes 1 level.",
    intro2014: "2014 rules: six distinct cumulative levels (disadvantage on ability checks → speed halved → disadvantage on attacks & saves → HP max halved → speed reduced to 0 → death). A Long Rest removes 1 level.",
};

export const RESTING_REFERENCE = {
    shortRest: "1 hour minimum. Spend Hit Dice to heal (roll + CON mod each — players resolve this themselves, nothing for the GM to apply here). Some features recharge on a short rest.",
    longRest: "8 hours minimum. On completion: full HP restored, Exhaustion drops by 1 level, all spell slots restored, some features recharge. 2024 rules also restore all spent Hit Dice; 2014 rules only restore up to half your total Hit Dice.",
};
