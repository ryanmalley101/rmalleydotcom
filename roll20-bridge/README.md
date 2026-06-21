# Cypher Sheet → Tabletop Bridge

A Chrome extension that mirrors the **"Cypher Systems Official"** Roll20 sheet
(internally `CypherSystemByRoll20.js` — not the Monte Cook Games sheet, a
different template with different field names) into this app's
`PlayerCharacter` records. **One-directional only** (Roll20 → app) and
**GM-side**: it watches whatever character sheets are open in *your* browser.

## What it syncs

From the sheet:

- Might/Speed/Intellect — current, max, and edge
- Damage track (Hale/Impaired/Debilitated — Roll20's "Dead" state folds into
  Debilitated, since the app has no separate dead state)
- Descriptor, Type, Focus, Tier, XP, Effort
- Background → the app's Backstory field
- Shins

This covers every *flat* field on the sheet, plus these repeating-section
lists (Roll20's dynamically-added rows):

- **Skills** — this sheet uses one unified skills list with a Might/Speed/
  Intellect dropdown per row (rather than three separate lists). Roll20's four
  levels (Inability / Untrained / Trained / Specialized) become three —
  Untrained rows are skipped, same as an unfilled row.
- **Abilities** — name, description, and cost (this sheet has a dedicated
  cost field per ability).
- **Cyphers**, **Equipment** — map close to 1:1. Cyphers also sync their
  "used" checkbox (see below).
- **Artifacts** — Roll20 splits depletion into a die + a threshold number;
  these get combined into the app's one depletion text field (e.g. "1 in 1d20").

Each imported row is tagged internally with the Roll20 row's ID so editing it
again updates the same entry instead of creating a duplicate. It also does a
one-time read of whatever's already filled in when a sheet first loads, not
just future edits — both for the flat fields and these lists.

A used cypher is consumed — checking "used" on the Roll20 sheet (or marking
it used directly in the app) removes it from the app's main cypher list and
the carry-limit count, without deleting the underlying data. It moves to a
collapsed "Used" list on the character sheet, where it can be restored or
deleted by hand.

**Not synced**:
- **Attacks** — Roll20 has repeating sections for these, but the app's Cypher
  sheet has no attacks/weapons list to import them into.
- **Deletions.** Removing a row in Roll20 doesn't fire a `change` event, so a
  deleted cypher/ability/etc. stays in the app until removed there by hand.
- **Recovery rolls** — deliberately skipped. The Roll20 sheet models that
  field as "which roll am I about to use," not "which have I used today," so
  it doesn't map onto the app's four independent checkboxes.

## Setup

1. **Build the options page bundle** (one-time, or after editing `options-src.js`):
   ```
   cd roll20-bridge
   npm install
   npm run build
   ```
2. **Load the extension in Chrome**: go to `chrome://extensions`, enable
   "Developer mode" (top right), click "Load unpacked", and select this
   `roll20-bridge` folder.
3. **Pick an environment**: click "Details" on the extension → "Extension
   options" (or right-click the extension icon → Options). Choose Sandbox or
   Production from the dropdown at the top — see "Environments" below.
4. **Sign in**: with that environment selected, sign in with the **same
   account** you use on the tabletop app there.
5. **Set the campaign**: open the campaign in that environment's app and
   copy the ID out of the URL bar (`/tabletop/campaigns/<this part>`), paste
   it into the options page, click Save.

## Environments

This is one extension install, but it can talk to two completely separate
Amplify backends — each with its own Cognito User Pool, AppSync API, and
DynamoDB tables:

- **Sandbox** — an `ampx sandbox` (local dev backend).
- **Production** — the deployed app at rmalley.com.

The dropdown at the top of the options page picks which one is active. Sign-
in tokens and the configured campaign ID are stored **separately per
environment** (`auth_sandbox` / `auth_production`, etc. in
`chrome.storage.local`), so switching the dropdown doesn't sign you out of
the other one or lose its campaign ID — each environment remembers its own
state independently. `background.js` always reads whichever environment is
currently selected before making a request, so there's no separate "active"
state to keep in sync beyond that one stored value.

The actual endpoint/pool values for each environment live in the
`ENVIRONMENTS` object — duplicated in both `background.js` and
`options-src.js` (see the comment there for why). **Production's values are
placeholders** (`PASTE_PROD_..._HERE`) until you fill them in from that
branch's own `amplify_outputs.json` (region, User Pool ID, App Client ID,
and the AppSync GraphQL URL). Until then, selecting Production will fail at
sign-in/request time with an obvious error rather than silently hitting the
wrong backend.

If production ever runs in a different AWS region than sandbox, no manifest
change is needed — `host_permissions` already uses region wildcards
(`https://*.appsync-api.*.amazonaws.com/*`, `https://cognito-idp.*.amazonaws.com/*`).

## Using it

- In Roll20, **pop out each PC's character sheet** into its own tab/window
  (right-click the sheet → "Pop out", or open it in a new tab) so they're all
  rendered at once — the extension only sees sheets that are actually open.
- Make sure each PC's **Character Name** field on the Roll20 sheet exactly
  matches that character's name in the app (case-insensitive, otherwise
  exact). That's how a sheet gets matched to a `PlayerCharacter` record —
  there's no separate mapping UI in this first version.
- Change a pool value or the damage track on a sheet; after a short debounce
  (~600ms) it should land in the app. Two places to check if something doesn't
  seem to be syncing:
  - The **Roll20 page's own console** (F12 on the Roll20 tab) — `content.js`
    logs every tracked/repeating-section change it detects there.
  - The **extension's service worker console** (`chrome://extensions` → this
    extension → "service worker" → Inspect) — `background.js` logs
    `[Roll20 Bridge] synced ...` or `sync failed for ...` there.

## Known limitations

- **Brittle to sheet changes, and sheet-specific.** This only targets the
  "Cypher Systems Official" sheet's field names, verified against its
  [source](https://github.com/Roll20/roll20-character-sheets/blob/master/Cypher%20Systems%20Official/cypher_systems_by_roll20.html)
  at the time this was built. A different Cypher sheet template (e.g. the
  Monte Cook Games one) uses different field names entirely and would need
  re-deriving `TRACKED_ATTRS`/`REPEATING_SECTIONS` in both `content.js` and
  `background.js` from scratch.
- **Repeating-section row identity isn't in the `name` attribute.** Worth
  knowing if this ever needs debugging again: Roll20's sheet-worker JS API
  refers to repeating-row fields as `repeating_<section>_<rowid>_<field>`,
  but that's *not* what's rendered. In the live DOM, every row reuses the
  same bare `name="attr_<field>"` — the row's actual ID lives on the
  ancestor `<div class="repitem" data-reprowid="...">`, and the section name
  on the ancestor `<div class="repcontainer" data-groupname="repeating_...">`.
  `content.js` walks up from the changed element to find both rather than
  parsing the name string. This is general Roll20 platform behavior, not
  specific to this sheet.
- **Exact name matching only.** No fuzzy matching, no manual override table yet.
- **One-directional.** Edits made in the app don't push back to Roll20.
