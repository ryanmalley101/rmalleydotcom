import { CognitoUserPool, CognitoUser, AuthenticationDetails } from "amazon-cognito-identity-js";

// Each environment is a separate Amplify backend — its own Cognito User
// Pool, AppSync API, and DynamoDB tables. Duplicated from background.js
// rather than shared: these run in separate extension contexts with no
// build step wiring them together (same reasoning as REPEATING_SECTIONS
// in background.js).
const ENVIRONMENTS = {
    sandbox: {
        label: "Sandbox (ampx sandbox)",
        userPoolId: "us-west-1_IX8cuWr5E",
        clientId: "1gmqdtr2ldb0ldk3v6s5iclg1b",
    },
    production: {
        label: "Production (rmalley.com)",
        // TODO: fill these in from the deployed branch's own amplify_outputs.json.
        userPoolId: "us-west-1_yypFmEJ4c",
        clientId: "1cfni3urd1s2kr6eno3hgta1i8",
    },
};
const DEFAULT_ENVIRONMENT = "sandbox";

function envKey(base, env) {
    return `${base}_${env}`;
}

const statusEl = document.getElementById("status");
const envSelect = document.getElementById("environment");
const envBanner = document.getElementById("env-banner");

function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = kind;
}

function userPoolFor(env) {
    const cfg = ENVIRONMENTS[env];
    return new CognitoUserPool({ UserPoolId: cfg.userPoolId, ClientId: cfg.clientId });
}

function updateBanner(env) {
    const isProd = env === "production";
    envBanner.textContent = isProd ? "LIVE — production" : "TEST — sandbox";
    envBanner.className = isProd ? "banner-prod" : "banner-sandbox";
}

async function refreshStatus() {
    const env = envSelect.value;
    const authK = envKey("auth", env);
    const campaignK = envKey("campaignId", env);
    const { [authK]: auth, [campaignK]: campaignId } = await chrome.storage.local.get([authK, campaignK]);
    const parts = [];
    parts.push(auth?.refreshToken ? `Signed in as ${auth.email}.` : "Not signed in.");
    parts.push(campaignId ? `Campaign: ${campaignId}` : "No campaign configured yet.");
    setStatus(parts.join(" "), auth?.refreshToken ? "ok" : "idle");
    document.getElementById("campaign-id").value = campaignId ?? "";
    updateBanner(env);
}

envSelect.addEventListener("change", async () => {
    await chrome.storage.local.set({ environment: envSelect.value });
    refreshStatus();
});

document.getElementById("signin-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const env = envSelect.value;
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const cognitoUser = new CognitoUser({ Username: email, Pool: userPoolFor(env) });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    setStatus("Signing in…", "idle");
    cognitoUser.authenticateUser(authDetails, {
        onSuccess: async (session) => {
            const idToken = session.getIdToken().getJwtToken();
            const refreshToken = session.getRefreshToken().getToken();
            const expiresAt = session.getIdToken().getExpiration() * 1000;
            await chrome.storage.local.set({ [envKey("auth", env)]: { idToken, refreshToken, expiresAt, email } });
            setStatus(`Signed in as ${email} (${ENVIRONMENTS[env].label}).`, "ok");
        },
        onFailure: (err) => {
            setStatus(`Sign-in failed: ${err.message ?? err}`, "err");
        },
    });
});

document.getElementById("signout-btn").addEventListener("click", async () => {
    const env = envSelect.value;
    await chrome.storage.local.remove(envKey("auth", env));
    setStatus(`Signed out of ${ENVIRONMENTS[env].label}.`, "idle");
});

document.getElementById("save-campaign-btn").addEventListener("click", async () => {
    const env = envSelect.value;
    const campaignId = document.getElementById("campaign-id").value.trim();
    await chrome.storage.local.set({ [envKey("campaignId", env)]: campaignId });
    setStatus(`Campaign set to ${campaignId || "(none)"} for ${ENVIRONMENTS[env].label}.`, campaignId ? "ok" : "idle");
});

(async function init() {
    const { environment } = await chrome.storage.local.get("environment");
    envSelect.value = environment && ENVIRONMENTS[environment] ? environment : DEFAULT_ENVIRONMENT;
    refreshStatus();
})();
