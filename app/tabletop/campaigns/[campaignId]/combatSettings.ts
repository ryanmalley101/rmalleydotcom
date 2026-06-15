export interface CombatSettings {
    autoRollTurnEffectDamage: boolean;
    autoRollConcentrationCheck: boolean;
    autoRemoveSurprised: boolean;
}

export const DEFAULT_COMBAT_SETTINGS: CombatSettings = {
    autoRollTurnEffectDamage: true,
    autoRollConcentrationCheck: true,
    autoRemoveSurprised: true,
};

export const SETTING_META: Record<keyof CombatSettings, { label: string; desc: string }> = {
    autoRollTurnEffectDamage: {
        label: "Auto-roll turn effect damage",
        desc: "Automatically roll and apply damage from start/end-of-turn effects (poison, bleeding, etc.).",
    },
    autoRollConcentrationCheck: {
        label: "Auto-roll concentration checks",
        desc: "When a concentrating creature takes damage, automatically roll the Constitution saving throw.",
    },
    autoRemoveSurprised: {
        label: "Auto-remove Surprised after round 1",
        desc: "Automatically clear the Surprised condition from all combatants when round 2 begins.",
    },
};

export function parseSettings(
    json: string | null | undefined,
    base: CombatSettings = DEFAULT_COMBAT_SETTINGS,
): CombatSettings {
    if (!json) return { ...base };
    try {
        return { ...base, ...JSON.parse(json) };
    } catch {
        return { ...base };
    }
}
