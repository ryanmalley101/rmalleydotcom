// Service worker: receives attribute-change events from content scripts,
// debounces per character, and writes the merged result to PlayerCharacter
// via AppSync (Cognito User Pool auth). No Amplify SDK here on purpose —
// MV3 service workers have no window/localStorage, so this talks to AppSync
// and Cognito directly with plain fetch(). The interactive SRP sign-in
// happens once in options.html (which has a real DOM); after that, this
// worker only needs the REFRESH_TOKEN_AUTH flow, which is a plain REST call.

const CONFIG = {
    region: "us-west-1",
    clientId: "1gmqdtr2ldb0ldk3v6s5iclg1b",
    appsyncUrl: "https://jrw674z5g5h3xkhxsxu75g3q5u.appsync-api.us-west-1.amazonaws.com/graphql",
};

const DEBOUNCE_MS = 600;
const pending = new Map(); // characterName -> { attrs: {}, timer }
let characterCache = null; // { campaignId, fetchedAt, byNameLower: Map<string,string> }

chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "ATTR_CHANGE") {
        queueChange(msg.characterName, msg.attr, msg.value);
    }
});

function queueChange(characterName, attr, value) {
    let entry = pending.get(characterName);
    if (!entry) {
        entry = { attrs: {}, timer: null };
        pending.set(characterName, entry);
    }
    entry.attrs[attr] = value;
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => flush(characterName), DEBOUNCE_MS);
}

async function flush(characterName) {
    const entry = pending.get(characterName);
    if (!entry) return;
    pending.delete(characterName);
    try {
        await applyChanges(characterName, entry.attrs);
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

async function applyChanges(characterName, attrs) {
    const pcId = await resolveCharacterId(characterName);
    if (!pcId) {
        console.warn(`[Roll20 Bridge] no character named "${characterName}" found in the configured campaign`);
        return;
    }

    const patch = {};
    if ("attr_might" in attrs) patch.currentMight = num(attrs.attr_might);
    if ("attr_might_max" in attrs) patch.mightPool = num(attrs.attr_might_max);
    if ("attr_mightedge" in attrs) patch.mightEdge = num(attrs.attr_mightedge);
    if ("attr_speed" in attrs) patch.currentSpeed = num(attrs.attr_speed);
    if ("attr_speed_max" in attrs) patch.speedPool = num(attrs.attr_speed_max);
    if ("attr_speededge" in attrs) patch.speedEdge = num(attrs.attr_speededge);
    if ("attr_intellect" in attrs) patch.currentIntellect = num(attrs.attr_intellect);
    if ("attr_intellect_max" in attrs) patch.intellectPool = num(attrs.attr_intellect_max);
    if ("attr_intellectedge" in attrs) patch.intellectEdge = num(attrs.attr_intellectedge);
    if ("attr_damage-track" in attrs) patch.damageTrack = mapDamageTrack(attrs["attr_damage-track"]);

    const pc = await getPlayerCharacter(pcId);
    let snap = {};
    try { snap = pc.systemDataJson ? JSON.parse(pc.systemDataJson) : {}; } catch { /* start fresh */ }
    const merged = { ...snap, ...patch };
    await updatePlayerCharacter(pcId, JSON.stringify(merged));
    console.log(`[Roll20 Bridge] synced ${characterName}:`, patch);
}

// ── Character name → PlayerCharacter id, cached for 5 minutes ────────────────

async function resolveCharacterId(characterName) {
    const { campaignId } = await chrome.storage.local.get("campaignId");
    if (!campaignId) {
        console.warn("[Roll20 Bridge] no campaign configured — open the extension options page.");
        return null;
    }
    const fresh = characterCache && characterCache.campaignId === campaignId
        && (Date.now() - characterCache.fetchedAt) < 5 * 60 * 1000;
    if (!fresh) {
        const items = await listCampaignCharacters(campaignId);
        const byNameLower = new Map(items.map(c => [c.characterName.trim().toLowerCase(), c.id]));
        characterCache = { campaignId, fetchedAt: Date.now(), byNameLower };
    }
    return characterCache.byNameLower.get(characterName.trim().toLowerCase()) ?? null;
}

// ── AppSync GraphQL ───────────────────────────────────────────────────────────

async function gqlRequest(query, variables) {
    const token = await getValidIdToken();
    const res = await fetch(CONFIG.appsyncUrl, {
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

async function updatePlayerCharacter(id, systemDataJson) {
    await gqlRequest(
        `mutation Upd($input: UpdatePlayerCharacterInput!) { updatePlayerCharacter(input: $input) { id } }`,
        { input: { id, systemDataJson } },
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

// ── Token handling ─────────────────────────────────────────────────────────────
// Initial sign-in (SRP) happens in options.html. From then on this worker
// only needs REFRESH_TOKEN_AUTH, which is a plain unauthenticated REST call.

async function getValidIdToken() {
    const { auth } = await chrome.storage.local.get("auth");
    if (!auth?.refreshToken) {
        throw new Error("Not signed in — open the extension options page and sign in.");
    }
    if (Date.now() < auth.expiresAt - 60_000) return auth.idToken;
    return refreshIdToken(auth.refreshToken);
}

async function refreshIdToken(refreshToken) {
    const res = await fetch(`https://cognito-idp.${CONFIG.region}.amazonaws.com/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
        },
        body: JSON.stringify({
            AuthFlow: "REFRESH_TOKEN_AUTH",
            ClientId: CONFIG.clientId,
            AuthParameters: { REFRESH_TOKEN: refreshToken },
        }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Token refresh failed — sign in again from options.");

    const idToken = json.AuthenticationResult.IdToken;
    const expiresAt = Date.now() + json.AuthenticationResult.ExpiresIn * 1000;
    const { auth } = await chrome.storage.local.get("auth");
    const updated = { ...auth, idToken, expiresAt };
    await chrome.storage.local.set({ auth: updated });
    return idToken;
}
