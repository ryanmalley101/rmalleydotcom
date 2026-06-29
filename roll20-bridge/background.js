// Service worker: receives attribute-change events from content scripts,
// debounces per character, and writes the merged result to PlayerCharacter
// via AppSync (Cognito User Pool auth). No Amplify SDK here on purpose —
// MV3 service workers have no window/localStorage, so this talks to AppSync
// and Cognito directly with plain fetch(). The interactive SRP sign-in
// happens once in options.html (which has a real DOM); after that, this
// worker only needs the REFRESH_TOKEN_AUTH flow, which is a plain REST call.

// Each environment is a separate Amplify backend — its own Cognito User
// Pool, AppSync API, and DynamoDB tables. "sandbox" is `ampx sandbox` (local
// dev); "production" is the deployed app at rmalley.com. Duplicated in
// options-src.js rather than shared, same reasoning as REPEATING_SECTIONS
// below — these run in separate extension contexts with no build step
// wiring them together.
const ENVIRONMENTS = {
    sandbox: {
        label: "Sandbox (ampx sandbox)",
        region: "us-west-1",
        clientId: "1gmqdtr2ldb0ldk3v6s5iclg1b",
        appsyncUrl: "https://jrw674z5g5h3xkhxsxu75g3q5u.appsync-api.us-west-1.amazonaws.com/graphql",
    },
    production: {
        label: "Production (rmalley.com)",
        // TODO: fill these in from the deployed branch's own amplify_outputs.json.
        region: "us-west-1",
        clientId: "1cfni3urd1s2kr6eno3hgta1i8",
        appsyncUrl: "https://xustopicsreizdrzfxbnmzqdya.appsync-api.us-west-1.amazonaws.com/graphql",
    },
};
const DEFAULT_ENVIRONMENT = "sandbox";

async function getActiveEnvironment() {
    const { environment } = await chrome.storage.local.get("environment");
    return environment && ENVIRONMENTS[environment] ? environment : DEFAULT_ENVIRONMENT;
}

function envKey(base, env) {
    return `${base}_${env}`;
}

const DEBOUNCE_MS = 600;
const ROLL_LOG_CAP = 50; // per campaign — this is a live feed, not an archive
const pending = new Map(); // characterName -> { attrs: {}, rows: Map<"section|rowId", {section,rowId,row}>, timer }
let characterCache = null; // { campaignId, fetchedAt, byNameLower: Map<string,string> }

chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "ATTR_CHANGE") {
        queueChange(msg.characterName, msg.attr, msg.value);
    } else if (msg?.type === "REPEATING_ROW") {
        queueRepeatingRow(msg.characterName, msg.section, msg.rowId, msg.row);
    } else if (msg?.type === "CHAT_ROLL") {
        recordRoll(msg.characterName, msg.formula, msg.total, msg.raw)
            .catch((err) => console.error("[Roll20 Bridge] failed to record roll", err));
    }
});

function getPendingEntry(characterName) {
    let entry = pending.get(characterName);
    if (!entry) {
        entry = { attrs: {}, rows: new Map(), timer: null };
        pending.set(characterName, entry);
    }
    return entry;
}

function queueChange(characterName, attr, value) {
    const entry = getPendingEntry(characterName);
    entry.attrs[attr] = value;
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => flush(characterName), DEBOUNCE_MS);
}

function queueRepeatingRow(characterName, section, rowId, row) {
    const entry = getPendingEntry(characterName);
    entry.rows.set(`${section}|${rowId}`, { section, rowId, row });
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => flush(characterName), DEBOUNCE_MS);
}

async function flush(characterName) {
    const entry = pending.get(characterName);
    if (!entry) return;
    pending.delete(characterName);
    try {
        await applyChanges(characterName, entry.attrs, entry.rows);
    } catch (err) {
        console.error("[Roll20 Bridge] sync failed for", characterName, err);
    }
}

function num(v) {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
}

function mapDamageTrack(v) {
    // Sheet radio values: 0 Hale, 1 Impaired, 2 Debilitated, 3 Dead.
    // The app's model has no "dead" bucket, so it folds into debilitated.
    switch (String(v)) {
        case "0": return "hale";
        case "1": return "impaired";
        default: return "debilitated";
    }
}

// Splits incoming sheet attributes into fields that live inside the JSON blob
// (systemDataJson, requiring a read-merge-write) vs. fields that are direct
// top-level columns on PlayerCharacter (no read needed, just an overwrite).
function mapAttrsToPatch(attrs) {
    const dataPatch = {};
    const topLevelPatch = {};

    if ("attr_might" in attrs) dataPatch.currentMight = num(attrs.attr_might);
    if ("attr_might_max" in attrs) dataPatch.mightPool = num(attrs.attr_might_max);
    if ("attr_might_edge" in attrs) dataPatch.mightEdge = num(attrs.attr_might_edge);
    if ("attr_speed" in attrs) dataPatch.currentSpeed = num(attrs.attr_speed);
    if ("attr_speed_max" in attrs) dataPatch.speedPool = num(attrs.attr_speed_max);
    if ("attr_speed_edge" in attrs) dataPatch.speedEdge = num(attrs.attr_speed_edge);
    if ("attr_intellect" in attrs) dataPatch.currentIntellect = num(attrs.attr_intellect);
    if ("attr_intellect_max" in attrs) dataPatch.intellectPool = num(attrs.attr_intellect_max);
    if ("attr_intellect_edge" in attrs) dataPatch.intellectEdge = num(attrs.attr_intellect_edge);
    if ("attr_damage-track" in attrs) dataPatch.damageTrack = mapDamageTrack(attrs["attr_damage-track"]);
    if ("attr_effort" in attrs) dataPatch.effort = num(attrs.attr_effort);
    if ("attr_background" in attrs) dataPatch.backstory = attrs.attr_background;
    if ("attr_shins" in attrs) dataPatch.shins = num(attrs.attr_shins);

    if ("attr_descriptor" in attrs) topLevelPatch.race = attrs.attr_descriptor;
    if ("attr_type" in attrs) topLevelPatch.characterClass = attrs.attr_type;
    if ("attr_focus" in attrs) topLevelPatch.subclass = attrs.attr_focus;
    if ("attr_tier" in attrs) topLevelPatch.level = num(attrs.attr_tier);
    if ("attr_xp" in attrs) topLevelPatch.xp = num(attrs.attr_xp);

    return { dataPatch, topLevelPatch };
}

// Mirrors content.js's REPEATING_SECTIONS — section name -> which CypherData
// array it feeds. (Duplicated rather than shared: these run in separate
// extension contexts with no build step wiring them together.)
const REPEATING_SECTIONS = {
    "skills":         { listKey: "skills" },
    "abilities":      { listKey: "abilities" },
    "cypher-list":    { listKey: "cyphers" },
    "artifact-list":  { listKey: "artifacts" },
    "equipment-list": { listKey: "equipment" },
};

function mapSkillLevel(v) {
    switch (String(v)) {
        case "1": return "trained";
        case "2": return "specialized";
        case "-1": return "inability";
        default: return null; // 0 (untrained) or unset — nothing worth recording
    }
}

// Builds the app-shaped entry for one repeating-section row, or null if the
// row doesn't have enough filled in yet to be worth importing (e.g. a fresh
// blank row Roll20 added when the user clicked "+").
function buildEntryFromRow(section, rowId, row) {
    switch (section) {
        case "skills": {
            const name = (row["skillname"] || "").trim();
            if (!name) return null;
            const level = mapSkillLevel(row["skilllvl"]);
            if (!level) return null;
            return { roll20Id: rowId, name, level };
        }
        case "abilities": {
            const name = (row["abilityname"] || "").trim();
            if (!name) return null;
            const entry = { roll20Id: rowId, name, description: row["abilitydesc"] || "" };
            if (row["abilitycost"] && num(row["abilitycost"]) > 0) entry.cost = row["abilitycost"];
            return entry;
        }
        case "cypher-list": {
            const name = (row["cypher-name"] || "").trim();
            if (!name) return null;
            return {
                roll20Id: rowId, name, level: row["cypher-level"] || "1", effect: row["cypher-description"] || "",
                used: Boolean(row["cypher-used"]),
            };
        }
        case "artifact-list": {
            const name = (row["artifact-name"] || "").trim();
            if (!name) return null;
            const entry = { roll20Id: rowId, name, effect: row["artifact-description"] || "" };
            if (row["artifact-level"]) entry.level = num(row["artifact-level"]);
            const threshold = row["artdepthreshold"];
            const dice = row["artdepdice"];
            if (threshold && dice && dice !== "100") {
                entry.depletion = `${threshold} in ${dice === "0" ? "automatic" : dice}`;
            }
            return entry;
        }
        case "equipment-list": {
            const name = (row["equipment-name"] || "").trim();
            if (!name) return null;
            return { roll20Id: rowId, name, quantity: row["equipment-qty"] ? num(row["equipment-qty"]) : 1 };
        }
        default:
            return null;
    }
}

// Upserts one row into the right CypherData array, matched by roll20Id.
function applyRowToSnapshot(snap, section, rowId, row) {
    const def = REPEATING_SECTIONS[section];
    if (!def) return;
    const entry = buildEntryFromRow(section, rowId, row);
    if (!entry) return; // blank/incomplete row — leave whatever's already there alone
    const list = Array.isArray(snap[def.listKey]) ? snap[def.listKey].slice() : [];
    const idx = list.findIndex(e => e && e.roll20Id === rowId);
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    snap[def.listKey] = list;
}

async function applyChanges(characterName, attrs, rows) {
    const pcId = await resolveCharacterId(characterName);
    if (!pcId) {
        console.warn(`[Roll20 Bridge] no character named "${characterName}" found in the configured campaign`);
        return;
    }

    const { dataPatch, topLevelPatch } = mapAttrsToPatch(attrs);
    const hasRows = rows && rows.size > 0;

    const patch = { ...topLevelPatch };
    if (Object.keys(dataPatch).length > 0 || hasRows) {
        const pc = await getPlayerCharacter(pcId);
        let snap = {};
        try { snap = pc.systemDataJson ? JSON.parse(pc.systemDataJson) : {}; } catch { /* start fresh */ }
        Object.assign(snap, dataPatch);
        if (hasRows) {
            for (const { section, rowId, row } of rows.values()) {
                applyRowToSnapshot(snap, section, rowId, row);
            }
        }
        patch.systemDataJson = JSON.stringify(snap);
    }

    await updatePlayerCharacter(pcId, patch);
    console.log(`[Roll20 Bridge] synced ${characterName}:`, {
        ...dataPatch, ...topLevelPatch,
        rows: hasRows ? [...rows.values()] : undefined,
    });
}

// ── Character name → PlayerCharacter id, cached for 5 minutes ────────────────

async function resolveCharacterId(characterName) {
    const env = await getActiveEnvironment();
    const { [envKey("campaignId", env)]: campaignId } = await chrome.storage.local.get(envKey("campaignId", env));
    if (!campaignId) {
        console.warn(`[Roll20 Bridge] no campaign configured for the ${env} environment — open the extension options page.`);
        return null;
    }
    const fresh = characterCache && characterCache.env === env && characterCache.campaignId === campaignId
        && (Date.now() - characterCache.fetchedAt) < 5 * 60 * 1000;
    if (!fresh) {
        const items = await listCampaignCharacters(campaignId);
        const byNameLower = new Map(items.map(c => [c.characterName.trim().toLowerCase(), c.id]));
        characterCache = { env, campaignId, fetchedAt: Date.now(), byNameLower };
    }
    return characterCache.byNameLower.get(characterName.trim().toLowerCase()) ?? null;
}

// ── AppSync GraphQL ───────────────────────────────────────────────────────────

async function gqlRequest(query, variables) {
    const env = await getActiveEnvironment();
    const token = await getValidIdToken(env);
    const res = await fetch(ENVIRONMENTS[env].appsyncUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join("; "));
    return json.data;
}

async function getPlayerCharacter(id) {
    const data = await gqlRequest(
        `query Get($id: ID!) { getPlayerCharacter(id: $id) { id characterName systemDataJson } }`,
        { id },
    );
    return data.getPlayerCharacter;
}

// Every scalar field on PlayerCharacter. Confirmed empirically: AppSync's
// subscription broadcast here only resolves to a non-null payload when the
// mutation's own selection set is the *complete* field list — the same full
// set the Amplify-generated client always requests by default. Selecting
// only the fields this extension cares about (id/campaignId/systemDataJson)
// made every live subscriber (incl. the GM dashboard) receive a null payload
// instead of the update.
const PLAYER_CHARACTER_FIELDS = `
    id campaignId characterName playerName race background alignment xp
    classesJson characterClass subclass level strength dexterity constitution
    intelligence wisdom charisma saveProficienciesJson skillProficienciesJson
    maxHp currentHp tempHp armorClass speed initiative hitDice
    deathSaveSuccesses deathSaveFailures inspiration exhaustion attacksJson
    inventoryJson copper silver electrum gold platinum spellcastingAbility
    spellSlotsJson spellsJson featuresJson personality ideals bonds flaws
    backstory notes allies gender age height weight eyes skin hair languages
    proficiencies pdfKey portraitKey system systemDataJson savingThrows
    skillProfs equipment features spells createdAt updatedAt
`;

async function updatePlayerCharacter(id, patch) {
    await gqlRequest(
        `mutation Upd($input: UpdatePlayerCharacterInput!) {
            updatePlayerCharacter(input: $input) { ${PLAYER_CHARACTER_FIELDS} }
        }`,
        { input: { id, ...patch } },
    );
}

async function listCampaignCharacters(campaignId) {
    const data = await gqlRequest(
        `query List($filter: ModelPlayerCharacterFilterInput) {
            listPlayerCharacters(filter: $filter) { items { id characterName } }
        }`,
        { filter: { campaignId: { eq: campaignId } } },
    );
    return data.listPlayerCharacters.items;
}

// ── Chat roll log ─────────────────────────────────────────────────────────────
// A live feed for the GM dashboard, not an archive — recordRoll() always
// prunes each campaign back down to ROLL_LOG_CAP right after writing.

// Full field list, not just { id } — same reasoning as PLAYER_CHARACTER_FIELDS
// above: AppSync's onCreate broadcast to live subscribers (the GM dashboard)
// only resolves to a non-null/complete payload when the mutation's own
// selection set is the full field list, not a subset.
const ROLL_LOG_FIELDS = `id campaignId characterName formula total raw rolledAt`;

async function recordRoll(characterName, formula, total, raw) {
    const env = await getActiveEnvironment();
    const key = envKey("campaignId", env);
    const { [key]: campaignId } = await chrome.storage.local.get(key);
    if (!campaignId) return; // no campaign configured — same as character sync, just skip

    await gqlRequest(
        `mutation Create($input: CreateRollLogEntryInput!) {
            createRollLogEntry(input: $input) { ${ROLL_LOG_FIELDS} }
        }`,
        { input: { campaignId, characterName, formula, total, raw, rolledAt: new Date().toISOString() } },
    );
    await pruneRollLog(campaignId);
}

async function pruneRollLog(campaignId) {
    const data = await gqlRequest(
        `query List($filter: ModelRollLogEntryFilterInput) {
            listRollLogEntries(filter: $filter) { items { id rolledAt } }
        }`,
        { filter: { campaignId: { eq: campaignId } } },
    );
    const items = data.listRollLogEntries.items;
    if (items.length <= ROLL_LOG_CAP) return;

    const oldestFirst = items.slice().sort((a, b) => (a.rolledAt || "").localeCompare(b.rolledAt || ""));
    const toDelete = oldestFirst.slice(0, items.length - ROLL_LOG_CAP);
    for (const item of toDelete) {
        await gqlRequest(
            `mutation Del($input: DeleteRollLogEntryInput!) { deleteRollLogEntry(input: $input) { id } }`,
            { input: { id: item.id } },
        );
    }
}

// ── Token handling ─────────────────────────────────────────────────────────────
// Initial sign-in (SRP) happens in options.html. From then on this worker
// only needs REFRESH_TOKEN_AUTH, which is a plain unauthenticated REST call.

async function getValidIdToken(env) {
    const key = envKey("auth", env);
    const { [key]: auth } = await chrome.storage.local.get(key);
    if (!auth?.refreshToken) {
        throw new Error(`Not signed in to the ${env} environment — open the extension options page and sign in.`);
    }
    if (Date.now() < auth.expiresAt - 60_000) return auth.idToken;
    return refreshIdToken(env, auth.refreshToken);
}

async function refreshIdToken(env, refreshToken) {
    const res = await fetch(`https://cognito-idp.${ENVIRONMENTS[env].region}.amazonaws.com/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
        },
        body: JSON.stringify({
            AuthFlow: "REFRESH_TOKEN_AUTH",
            ClientId: ENVIRONMENTS[env].clientId,
            AuthParameters: { REFRESH_TOKEN: refreshToken },
        }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Token refresh failed — sign in again from options.");

    const idToken = json.AuthenticationResult.IdToken;
    const expiresAt = Date.now() + json.AuthenticationResult.ExpiresIn * 1000;
    const key = envKey("auth", env);
    const { [key]: auth } = await chrome.storage.local.get(key);
    const updated = { ...auth, idToken, expiresAt };
    await chrome.storage.local.set({ [key]: updated });
    return idToken;
}
