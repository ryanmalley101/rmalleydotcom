// Runs on every Roll20 frame (the journal page itself, plus each character
// sheet iframe — including popped-out sheet tabs, which Roll20 also serves
// under app.roll20.net). Each frame with a Cypher System sheet has exactly
// one character's inputs, so no scoping beyond "this document" is needed.
//
// Attribute names verified against the official Roll20 Cypher System sheet:
// https://github.com/Roll20/roll20-character-sheets/blob/master/CypherSystem/CypherSystem.htm

const TRACKED_ATTRS = [
    "attr_might", "attr_might_max", "attr_mightedge",
    "attr_speed", "attr_speed_max", "attr_speededge",
    "attr_intellect", "attr_intellect_max", "attr_intellectedge",
    "attr_damage-track",
];

function getCharacterName() {
    const el = document.querySelector('input[name="attr_character_name"]');
    const name = el?.value?.trim();
    return name || null;
}

function handleChange(e) {
    const name = e.target?.getAttribute?.("name");
    if (!name || !TRACKED_ATTRS.includes(name)) return;

    const characterName = getCharacterName();
    if (!characterName) return;

    chrome.runtime.sendMessage({
        type: "ATTR_CHANGE",
        characterName,
        attr: name,
        value: e.target.value,
    }).catch(() => { /* background worker not ready yet — next change will retry */ });
}

// Capturing-phase + delegation at the document level: catches Roll20 sheet
// inputs regardless of when they're inserted, without per-element wiring.
document.addEventListener("change", handleChange, true);
