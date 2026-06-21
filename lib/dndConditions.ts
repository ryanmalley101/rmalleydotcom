// Same condition set & colors as the standalone /tabletop/conditions reference
// page (sourced from the 5.5e SRD glossary) — kept here so the GM dashboard's
// condition picker stays visually consistent with that page.
export const CONDITION_COLOR: Record<string, string> = {
    Blinded:       "#546e7a",
    Charmed:       "#880e4f",
    Deafened:      "#37474f",
    Frightened:    "#e65100",
    Grappled:      "#4e342e",
    Incapacitated: "#616161",
    Invisible:     "#0277bd",
    Paralyzed:     "#b71c1c",
    Petrified:     "#78909c",
    Poisoned:      "#2e7d32",
    Prone:         "#795548",
    Restrained:    "#5d4037",
    Stunned:       "#6a1b9a",
    Unconscious:   "#1a1a2e",
};

export const CONDITION_NAMES = Object.keys(CONDITION_COLOR);
