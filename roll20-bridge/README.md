# Cypher Sheet → Tabletop Bridge

A Chrome extension that mirrors the official Roll20 Cypher System sheet
(Might/Speed/Intellect pools, edges, damage track) into this app's
`PlayerCharacter` records. **One-directional only** (Roll20 → app) and
**GM-side**: it watches whatever character sheets are open in *your* browser.

## What it syncs

From the official Roll20 Cypher System sheet (`attr_might`, `attr_speed`,
`attr_intellect` and their `_max`/`edge` variants, plus `attr_damage-track`):
current/max pools, edges, and damage track (Hale/Impaired/Debilitated — Roll20's
"Dead" state folds into Debilitated, since the app has no separate dead state).

**Not synced**: XP, cyphers, abilities, arcs, recovery rolls. Recovery rolls
were left out deliberately — the Roll20 sheet models that field as "which
roll am I about to use," not "which have I used today," so it doesn't map
cleanly onto the app's four independent checkboxes.

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
3. **Sign in**: click "Details" on the extension → "Extension options" (or
   right-click the extension icon → Options). Sign in with the **same
   account** you use on the tabletop app.
4. **Set the campaign**: open the campaign in the app and copy the ID out of
   the URL bar (`/tabletop/campaigns/<this part>`), paste it into the options
   page, click Save.

## Using it

- In Roll20, **pop out each PC's character sheet** into its own tab/window
  (right-click the sheet → "Pop out", or open it in a new tab) so they're all
  rendered at once — the extension only sees sheets that are actually open.
- Make sure each PC's **Character Name** field on the Roll20 sheet exactly
  matches that character's name in the app (case-insensitive, otherwise
  exact). That's how a sheet gets matched to a `PlayerCharacter` record —
  there's no separate mapping UI in this first version.
- Change a pool value or the damage track on a sheet; after a short debounce
  (~600ms) it should land in the app. Check `chrome://extensions` → this
  extension → "service worker" → Inspect, for `[Roll20 Bridge]` log lines if
  something doesn't seem to be syncing.

## Known limitations

- **Brittle to sheet changes.** If Roll20 or the official sheet template
  changes its field names, this silently stops working. Attribute names were
  verified against the [official sheet source](https://github.com/Roll20/roll20-character-sheets/blob/master/CypherSystem/CypherSystem.htm)
  at the time this was built.
- **Exact name matching only.** No fuzzy matching, no manual override table yet.
- **One-directional.** Edits made in the app don't push back to Roll20.
