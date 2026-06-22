// Runs on every Roll20 frame (the journal page itself, plus each character
// sheet iframe — including popped-out sheet tabs, which Roll20 also serves
// under app.roll20.net). Each frame with a Cypher System sheet has exactly
// one character's inputs, so no scoping beyond "this document" is needed.
//
// Attribute names verified against the "Cypher Systems Official" Roll20 sheet
// (internally CypherSystemByRoll20.js — NOT the Monte Cook Games sheet, a
// different template with different field names):
// https://github.com/Roll20/roll20-character-sheets/blob/master/Cypher%20Systems%20Official/cypher_systems_by_roll20.html

const TRACKED_ATTRS = [
    "attr_might", "attr_might_max", "attr_might_edge",
    "attr_speed", "attr_speed_max", "attr_speed_edge",
    "attr_intellect", "attr_intellect_max", "attr_intellect_edge",
    "attr_damage-track",
    "attr_descriptor", "attr_type", "attr_focus", "attr_tier", "attr_xp", "attr_effort",
    "attr_background", "attr_shins",
];

// Roll20 "repeating sections" — confirmed against the live rendered DOM that
// each row's inputs use the *plain* field name (e.g. name="attr_skillname"),
// identical across every row of that section. The row's identity is NOT in
// the name attribute at all (that repeating_<section>_<rowid>_<field> form is
// the sheet-worker JS API's internal convention, not what's rendered) — it's
// on the ancestor <div class="repitem" data-reprowid="...">, with the section
// on the ancestor <div class="repcontainer" data-groupname="repeating_...">.
const REPEATING_SECTIONS = {
    "skills":         ["skillname", "skillstat", "skilllvl"],
    "abilities":      ["abilityname", "abilitycost", "abilitydesc"],
    "cypher-list":    ["cypher-name", "cypher-level", "cypher-description", "cypher-used"],
    "artifact-list":  ["artifact-name", "artifact-level", "artifact-description", "artdepthreshold", "artdepdice"],
    "equipment-list": ["equipment-name", "equipment-qty"],
};

// Reverse index: bare field name -> which section it belongs to.
const FIELD_TO_SECTION = {};
for (const [section, fields] of Object.entries(REPEATING_SECTIONS)) {
    for (const field of fields) FIELD_TO_SECTION[field] = section;
}

function getCharacterName() {
    const el = document.querySelector('input[name="attr_character_name"]');
    const name = el?.value?.trim();
    return name || null;
}

function sendAttrChange(characterName, attr, value) {
    chrome.runtime.sendMessage({ type: "ATTR_CHANGE", characterName, attr, value })
        .catch(() => { /* background worker not ready yet — next change will retry */ });
}

// Description-style fields render as a read-only <span name="attr_x"> (shows
// the text) immediately followed by the actual <textarea name="attr_x"> (the
// editable control) — same name on both. A plain `[name=...]` query matches
// the span first, and a span has no .value at all, so the description always
// read as empty. Restricting to actual form-control tags fixes that.
//
// Checkboxes (e.g. cypher-used) need special handling too: a checkbox's
// `.value` is always its static `value="1"` attribute regardless of checked
// state — the actual on/off state is `.checked`. This sheet also renders the
// same checkbox name twice (a hidden mirror plus the visible labeled one);
// Roll20's sheet sandbox keeps every element sharing a name in sync, so
// reading whichever one matches first is fine.
function readFieldValue(scopeEl, field) {
    const matches = scopeEl.querySelectorAll(`[name="attr_${field}"]`);
    for (const el of matches) {
        if (el.tagName === "INPUT" && el.type === "checkbox") return el.checked;
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
            return el.value;
        }
    }
    return "";
}

function readRowFromRepItem(repItemEl, section) {
    const row = {};
    for (const field of REPEATING_SECTIONS[section]) {
        row[field] = readFieldValue(repItemEl, field);
    }
    return row;
}

function sendRepeatingRow(characterName, section, rowId, repItemEl) {
    const row = readRowFromRepItem(repItemEl, section);
    console.log("[Roll20 Bridge] repeating row changed:", section, rowId, row);
    chrome.runtime.sendMessage({ type: "REPEATING_ROW", characterName, section, rowId, row })
        .catch(() => { /* background worker not ready yet — next change will retry */ });
}

function handleChange(e) {
    const name = e.target?.getAttribute?.("name");
    if (!name) return;

    const characterName = getCharacterName();
    if (!characterName) return;

    if (TRACKED_ATTRS.includes(name)) {
        sendAttrChange(characterName, name, e.target.value);
        return;
    }

    const field = name.replace(/^attr_/, "");
    const section = FIELD_TO_SECTION[field];
    if (!section) return;

    const repItem = e.target.closest(".repitem");
    const rowId = repItem?.getAttribute("data-reprowid");
    if (!repItem || !rowId) {
        console.log("[Roll20 Bridge] matched field", field, "but no enclosing .repitem[data-reprowid] found");
        return;
    }

    sendRepeatingRow(characterName, section, rowId, repItem);
}

// Capturing-phase + delegation at the document level: catches Roll20 sheet
// inputs regardless of when they're inserted, without per-element wiring.
// Note: deleting a row in Roll20 doesn't fire a `change` event, so removed
// rows aren't currently detected — they'd need to be removed in the app too.
document.addEventListener("change", handleChange, true);

// ── Initial sync ──────────────────────────────────────────────────────────────
// The listener above only catches *future* edits. Whatever's already filled
// in on a sheet when it's first opened needs a one-time read too.

function readCurrentValue(attr) {
    if (attr === "attr_damage-track") {
        const checked = document.querySelector(`input[name="${attr}"]:checked`);
        return checked ? checked.value : null;
    }
    // attr_background has the same span+textarea pattern as the repeating
    // description fields — readFieldValue() already skips the display-only span.
    const value = readFieldValue(document, attr.replace(/^attr_/, ""));
    return value || null;
}

function syncFlatAttrs(characterName) {
    for (const attr of TRACKED_ATTRS) {
        const value = readCurrentValue(attr);
        if (value !== null && value !== "") {
            sendAttrChange(characterName, attr, value);
        }
    }
}

function syncRepeatingSections(characterName) {
    for (const section of Object.keys(REPEATING_SECTIONS)) {
        const container = document.querySelector(`.repcontainer[data-groupname="repeating_${section}"]`);
        if (!container) continue;
        const repItems = container.querySelectorAll(".repitem[data-reprowid]");
        for (const repItem of repItems) {
            const rowId = repItem.getAttribute("data-reprowid");
            sendRepeatingRow(characterName, section, rowId, repItem);
        }
    }
}

function syncCurrentSheet() {
    const characterName = getCharacterName();
    if (!characterName) return; // this frame has no Cypher sheet rendered in it
    syncFlatAttrs(characterName);
    syncRepeatingSections(characterName);
}

// Roll20's sheet worker can finish populating values slightly after the DOM
// itself is idle, so this waits a bit rather than racing it.
setTimeout(syncCurrentSheet, 1500);

// ── Chat roll watcher ─────────────────────────────────────────────────────────
// Verified against a real exported chat log. Two message shapes matter:
//
// 1. Sheet rolls render through the Cypher sheet's OWN chat template
//    (.sheet-rolltemplate-cyphsys), not Roll20's generic .rolls/.rolltotal/
//    .who markup — there is no .who or .rolltotal anywhere in this sheet's
//    output. Character name is in .sheet-charname, the skill/stat/ability
//    being rolled is in .sheet-title, success/failure in a .sheet-subtitle
//    with class .sheet-success or .sheet-failure, and the actual d20 result
//    sits in an .inlinerollresult right after the element whose
//    data-i18n="roll:" (e.g. <span data-i18n="roll:">Roll:</span>). Ability/
//    cypher description messages use this same template with no roll
//    inside, so they're naturally skipped by requiring a roll result.
//    Recovery rolls are a different shape within the same template: a dice
//    formula (e.g. "1d6+1") next to a result tagged data-i18n="points",
//    with no "Roll:" line at all.
// 2. Plain Roll20 rolls (a GM typing "/roll 1d20" with no sheet involved)
//    use Roll20's native markup instead: .formula for the typed command,
//    .rolled for the final total.
//
// This only runs in the frame that actually has a chat panel — character
// sheet iframes don't, so `watchChat()` is a no-op there.

function textOf(el) {
    return el ? el.textContent.trim() : "";
}

function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function parseCyphsysRoll(msgEl, speakerName) {
    const template = msgEl.querySelector(".sheet-rolltemplate-cyphsys");
    if (!template) return null;

    const charName = textOf(template.querySelector(".sheet-charname")) || speakerName;
    const title = capitalize(textOf(template.querySelector(".sheet-title")));

    const rollLabel = template.querySelector("[data-i18n='roll:']");
    if (rollLabel) {
        const total = textOf(rollLabel.parentElement?.querySelector(".inlinerollresult"));
        if (total) {
            const outcome = textOf(template.querySelector(".sheet-subtitle.sheet-success, .sheet-subtitle.sheet-failure"));
            return {
                characterName: charName,
                formula: outcome ? `${title} — ${outcome}` : title,
                total,
                raw: textOf(template).slice(0, 300),
            };
        }
    }

    if (/recovery roll/i.test(title)) {
        const pointsLine = Array.from(template.querySelectorAll(".sheet-inblock .sheet-line"))
            .find(line => line.querySelector("[data-i18n='points']"));
        const total = textOf(pointsLine?.querySelector(".inlinerollresult"));
        if (total) {
            const dice = textOf(pointsLine.querySelector(".sheet-subtitle"));
            return {
                characterName: charName,
                formula: dice ? `Recovery Roll (${dice})` : "Recovery Roll",
                total,
                raw: textOf(template).slice(0, 300),
            };
        }
    }

    return null; // an ability/cypher description reference with no dice attached
}

function parseNativeRoll(msgEl, speakerName) {
    if (!msgEl.classList.contains("rollresult")) return null;
    const total = textOf(msgEl.querySelector(".rolled"));
    if (!total) return null;
    const formula = textOf(msgEl.querySelector(".formula")).replace(/rolling\s*/i, "");
    return { characterName: speakerName, formula, total, raw: textOf(msgEl).slice(0, 300) };
}

function parseRollMessage(msgEl) {
    const speakerName = textOf(msgEl.querySelector(".by")).replace(/:\s*$/, "");
    return parseCyphsysRoll(msgEl, speakerName) || parseNativeRoll(msgEl, speakerName);
}

function handleChatMutation(mutations) {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue;
            const messages = node.classList?.contains("message")
                ? [node]
                : Array.from(node.querySelectorAll?.(".message") ?? []);
            for (const msg of messages) {
                const roll = parseRollMessage(msg);
                if (roll) {
                    chrome.runtime.sendMessage({ type: "CHAT_ROLL", ...roll })
                        .catch(() => { /* background worker not ready yet — next roll will retry */ });
                }
            }
        }
    }
}

function watchChat() {
    const chatLog = document.querySelector("#textchat .content");
    if (!chatLog) return; // this frame has no chat panel (e.g. a popped-out sheet)
    new MutationObserver(handleChatMutation).observe(chatLog, { childList: true, subtree: true });
}

setTimeout(watchChat, 1500);
