import { CognitoUserPool, CognitoUser, AuthenticationDetails } from "amazon-cognito-identity-js";

// Same User Pool the tabletop app itself uses (from amplify_outputs.json).
const userPool = new CognitoUserPool({
    UserPoolId: "us-west-1_IX8cuWr5E",
    ClientId: "1gmqdtr2ldb0ldk3v6s5iclg1b",
});

const statusEl = document.getElementById("status");

function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = kind;
}

async function refreshStatus() {
    const { auth, campaignId } = await chrome.storage.local.get(["auth", "campaignId"]);
    const parts = [];
    parts.push(auth?.refreshToken ? `Signed in as ${auth.email}.` : "Not signed in.");
    parts.push(campaignId ? `Campaign: ${campaignId}` : "No campaign configured yet.");
    setStatus(parts.join(" "), auth?.refreshToken ? "ok" : "idle");
    document.getElementById("campaign-id").value = campaignId ?? "";
}

document.getElementById("signin-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    setStatus("Signing in…", "idle");
    cognitoUser.authenticateUser(authDetails, {
        onSuccess: async (session) => {
            const idToken = session.getIdToken().getJwtToken();
            const refreshToken = session.getRefreshToken().getToken();
            const expiresAt = session.getIdToken().getExpiration() * 1000;
            await chrome.storage.local.set({ auth: { idToken, refreshToken, expiresAt, email } });
            setStatus(`Signed in as ${email}.`, "ok");
        },
        onFailure: (err) => {
            setStatus(`Sign-in failed: ${err.message ?? err}`, "err");
        },
    });
});

document.getElementById("signout-btn").addEventListener("click", async () => {
    await chrome.storage.local.remove("auth");
    setStatus("Signed out.", "idle");
});

document.getElementById("save-campaign-btn").addEventListener("click", async () => {
    const campaignId = document.getElementById("campaign-id").value.trim();
    await chrome.storage.local.set({ campaignId });
    setStatus(`Campaign set to ${campaignId || "(none)"}.`, campaignId ? "ok" : "idle");
});

refreshStatus();
