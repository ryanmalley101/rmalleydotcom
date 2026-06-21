// Generic, situation-agnostic GM intrusion ideas for the Cypher System.
// Hand-curated (no SRD source file covers this) — broad complications meant
// to spark something specific to the scene at hand, not be used verbatim.

export interface IntrusionIdea {
    category: "Combat" | "Social" | "Environmental" | "Equipment" | "NPC" | "Pacing";
    text: string;
}

export const COMMON_INTRUSIONS: IntrusionIdea[] = [
    { category: "Combat", text: "A creature's attack hits an unintended target — an ally, a bystander, or a piece of the environment." },
    { category: "Combat", text: "A weapon or piece of equipment breaks, jams, or is knocked out of reach mid-fight." },
    { category: "Combat", text: "Reinforcements arrive for the opposition — late, but right when it hurts most." },
    { category: "Combat", text: "The terrain shifts: a floor collapses, a wall crumbles, a rope frays." },
    { category: "Combat", text: "A creature reveals an ability or resistance nobody anticipated." },
    { category: "Combat", text: "Someone's cypher or artifact misfires, malfunctions, or triggers prematurely." },
    { category: "Social", text: "An NPC's hidden agenda surfaces at the worst possible moment." },
    { category: "Social", text: "Something the PC says is overheard by someone who shouldn't have heard it." },
    { category: "Social", text: "An old contact or rival shows up uninvited, with their own complications in tow." },
    { category: "Social", text: "A favor owed comes due — right now, regardless of timing." },
    { category: "Social", text: "An NPC misreads the PC's intentions and reacts accordingly." },
    { category: "Social", text: "A promise made earlier turns out to have consequences nobody foresaw." },
    { category: "Environmental", text: "The weather, light, or visibility suddenly worsens." },
    { category: "Environmental", text: "A structure the PCs are relying on (bridge, scaffold, door) gives way." },
    { category: "Environmental", text: "An automated system, trap, or piece of old-world tech activates unexpectedly." },
    { category: "Environmental", text: "The path forward is blocked, forcing an unplanned detour." },
    { category: "Environmental", text: "A natural hazard (fire, flood, rockfall, toxic gas) appears or worsens." },
    { category: "Equipment", text: "A light source fails at the worst time." },
    { category: "Equipment", text: "Supplies (food, ammunition, charge) run lower than expected." },
    { category: "Equipment", text: "A tool or device works, but not quite the way it was supposed to." },
    { category: "Equipment", text: "Something valuable is lost, dropped, or left behind in the rush." },
    { category: "NPC", text: "An ally hesitates or refuses to act when it matters most." },
    { category: "NPC", text: "An NPC's loyalty turns out to be more conditional than it seemed." },
    { category: "NPC", text: "A minor NPC turns out to have a personal stake in the outcome." },
    { category: "NPC", text: "Someone the PCs trusted is being watched, followed, or used." },
    { category: "Pacing", text: "Time runs shorter than expected — a deadline moves up." },
    { category: "Pacing", text: "Word of the PCs' actions travels faster than they do." },
    { category: "Pacing", text: "A seemingly resolved problem turns out to have a loose end." },
    { category: "Pacing", text: "The PCs' presence draws attention they didn't want." },
    { category: "Pacing", text: "A choice the PCs already made comes back around with new stakes." },
];

export function randomIntrusion(): IntrusionIdea {
    return COMMON_INTRUSIONS[Math.floor(Math.random() * COMMON_INTRUSIONS.length)];
}
