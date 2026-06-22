# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Ryan Malley's personal site (rmalley.com) — a single Next.js 14 App Router codebase backed by one AWS Amplify Gen2 project (Cognito + AppSync/GraphQL + DynamoDB + S3). The homepage links to four categories: **Software**, **Hardware**, **Tabletop**, and **Personal**. By far the largest of these is Tabletop — a full D&D 5e / Cypher System campaign-management platform — but it is one category among several, not the whole app. The standalone D&D monster statblock creator (`/create/monster`) is one feature, older than the campaign platform and not part of it.

## Commands

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run lint      # Run ESLint
```

No test framework is configured. Backend changes go through `amplify/` and require an `ampx sandbox` (local dev) or a deploy (`ampx pipeline-deploy`, run automatically by Amplify Hosting's CI on push) before they take effect — editing `amplify/data/resource.ts` alone does nothing until one of those runs.

## Root layout and theming

`app/layout.tsx` is minimal: it just mounts `ThemeRegistry` (MUI theme + emotion cache) and renders children. There is **no site-wide auth gate** — that surprised past sessions, so it's worth stating plainly: auth is applied per-section, inconsistently, via whichever of two guards that section's own `layout.tsx` imports.

Each top-level category also reskins itself completely via its own nested `ThemeProvider` in its `layout.tsx` — there is no single "the app's theme":

| Section | Theme | Auth guard |
|---|---|---|
| `/` (homepage), `/login` | root theme (`app/theme.ts`) — dark indigo/slate | none |
| `/software` | own dark theme (GitHub-style near-black, indigo/sky accents) | none |
| `/hardware` | own dark theme (PCB-green) | none |
| `/personal` | root theme (no override) | `AuthGuard` (redirects to `/login?next=...`) |
| `/create` (Monster Creator) | root theme (no override) | `AuthenticatorWrapper` (inline blocking Amplify `<Authenticator>`) |
| `/tabletop` (landing page itself) | own theme — light parchment, rust/amber, Cinzel headings (`app/tabletop/layout.tsx`) | none |
| `/tabletop/campaigns/*`, `/tabletop/worlds/*` | same tabletop theme | `AuthGuard` |

`AuthGuard` (`app/components/AuthGuard.tsx`) and `AuthenticatorWrapper` (`app/AuthenticatorWrapper.tsx`) are two different mechanisms, not interchangeable: AuthGuard checks the session client-side and redirects to a standalone `/login` page (which itself renders the Amplify `<Authenticator>`); AuthenticatorWrapper renders the Authenticator inline and blocks until signed in. New gated routes should pick one deliberately rather than assuming a parent layout already covers it — several routes (the bare `/tabletop` landing page, `/software`, `/hardware`) are intentionally public.

## Software

Two real projects under `/software` (`app/software/page.tsx` lists them):
- **Verkada Packet Capture Analyzer** (`/software/pcap-analyzer`) — uploads a `.pcap`/`.pcapng`/`.pcap.zst`, runs a per-device network health audit (DHCP/ARP/DNS/cloud reachability/TLS/802.1X) entirely client-side. Parsing/analysis lives in `app/software/pcap-analyzer/lib/`.
- **pykada** (`/software/pykada`) — a Python SDK for Verkada's API; the route just redirects to its static docs (`index.html`), it isn't a Next.js feature.

## Hardware

Placeholder only (`app/hardware/page.tsx` says "Projects coming soon"). No real content yet.

## Personal

One tool: Todos (`/personal/todos`), a simple task tracker (title, description, priority, due date) backed by the `TodoItem` model. Gated by `AuthGuard`.

## Monster Creator (`/create/monster`)

A standalone D&D 5e statblock builder, predates the Tabletop campaign platform and shares only the `MonsterStatblock` data model and the same Amplify backend with it — not otherwise wired together.

- `monsterCreator.tsx` (`app/components/creatorComponents/`) — root orchestrator holding all monster state.
- `monsterSheet.tsx` — live visual preview; exported to PNG via `html2canvas`.
- `monsterMarkdown.tsx` — markdown export.
- `headerrow.tsx`, `actionrow.tsx`, `abilityrow.tsx`, `abilityscoreinput.tsx` — editors for the statblock's sections.
- `5eReference/` — pure game-mechanics helpers (`converters.tsx`: `scoreToMod()`, `calculateDependentStats()`; `monsterStatblockGenerator.tsx`: blank/default templates; `characterSheetGenerators.tsx`).
- Bulk creation at `/create/monster/bulk` (batch JSON upload) and import from open5e at `/create/monster/import-open5e` (`lib/open5eConverter.ts`).

The `MonsterStatblock` model (`amplify/data/resource.ts`) is large and fully typed — abilities, saves, skills, senses, resistances/immunities, actions/bonus actions/reactions/legendary/mythic actions — built from shared custom types (`DamageDice`, `MovementSpeed`, `SkillMods`, `MonsterAbility`, `MonsterAttack`).

## Tabletop platform (`/tabletop`)

The large one. Supports campaigns in **either D&D 5e or the Cypher System** — `Campaign.system` is a free-text string (`"D&D 5e"`, `"D&D 5.5e (2024)"`, `"Cypher System"`, etc.) that several features branch on.

### Data model

Full detail lives in `amplify/data/resource.ts` — don't duplicate it here, but the shape is:

- **Worlds & wiki**: `DnDWorld` → `WikiArticle` (single `articleType` field — Category and Article Type used to be two separate fields, squashed into one; see "Wiki" below) → `WikiArticleRevision` (throttled pre-edit snapshots), `WorldMap` (image + JSON pins).
- **Campaigns**: `Campaign` (links to one or more worlds, holds a GM-dashboard scratch-data JSON blob) → `CampaignSession`, `CampaignMember`/`CampaignInvite` (join-by-code), `VttBoard` (grid + JSON token positions).
- **Characters**: `PlayerCharacter` — system-agnostic core fields plus a catch-all `systemDataJson` for whichever ruleset's specific data doesn't have its own column (Cypher pools/edge/effort live there; D&D fields like HP/AC/conditions/death saves/spell slots got their own top-level columns instead, added over time as features needed them). `Companion` for pets/familiars/mounts.
- **GM trackers**: `NPC` is deliberately thin — just `{ campaignId, articleId, isAlive, relationship, notes }`. An NPC *is* a `WikiArticle` with `articleType: "Character"`; name/description/lore live on the article, this model only holds state specific to *this* campaign's playthrough. See `lib/npcLinks.ts` (`ensureNpcLink`) for the find-or-create pattern used wherever an article gets pinned/tracked as an NPC. `Quest` (objectives as JSON, free-text quest-giver) and `Faction` (−5 to +5 reputation) are plain per-campaign trackers, not article-backed.
- **Misc**: `UserPreference` (one row per user — autosave default, GM dashboard layout/table-mode).

Authorization is mostly `allow.owner()` for GM-only content. `PlayerCharacter` and `VttBoard` are fully `allow.authenticated()` because players need direct write access. `WikiArticle`, `Companion`, `CampaignMember`, `CampaignInvite` use a hybrid (owner writes, any authenticated user reads) for the same reason.

### GM Dashboards — split by system, shared infrastructure

`gm-dashboard/` (Cypher) and `dnd-dashboard/` (D&D 5e) are **separate route trees** under each campaign, because the two systems track fundamentally different party state (Cypher pools/edge/effort/damage-track vs. D&D HP/AC/conditions/death-saves/concentration). Which button to show is decided in `app/tabletop/campaigns/[campaignId]/page.tsx` by checking `campaign.system`.

What they share lives in `_dashboard-shared/` (sibling to both, not inside either): `SessionPrepCard`, `SpotlightNpcs`, `QuestProgress`, `WikiSearchPin`, `QuickWikiDialog`, `PinnedArticlesView` — all genuinely system-agnostic. `useGmDashboardLayout` (`lib/`) persists collapsed-section state and a "Table Mode" toggle, also shared.

**Table Mode** (a high-contrast theme for a shared/projected screen) is implemented as a *nested* `ThemeProvider` swapped in via `createTheme(outerTheme, { palette: TABLE_MODE_PALETTE })` (`lib/tableModeTheme.ts`) — not a manual CSS override. This matters: because the dashboard's own components already reference theme tokens (`"primary.main"`, `"success.main"`, etc.) rather than hardcoded hex, swapping the palette this way recolors every MUI control automatically. Avoid reintroducing hardcoded hex colors in dashboard components for exactly this reason — they won't adapt when Table Mode is on.

Each dashboard has a read-only `player-view/` route (no GM controls, meant to be cast to a shared screen) and its own `PartyCard.tsx` (system-specific party-member rendering + inline damage/heal controls).

**Known real-time gotcha**: don't use Amplify's `observeQuery()` for live PlayerCharacter updates on these dashboards — its internal merge helper doesn't null-check incoming subscription payloads, and AppSync can legitimately deliver a null item on some update events, crashing the page. Both dashboards instead do a manual `list()` + raw `onCreate`/`onUpdate`/`onDelete` subscriptions with explicit null guards. If a mutation elsewhere selects only a few fields, live subscribers receive an incomplete payload — mutations that need to reach subscribers should select the full field set.

### Wiki (`worlds/[worldId]/wiki/`)

Single classification field `articleType` (`lib/wikiArticleTypes.ts` — `ARTICLE_TYPES`, `ARTICLE_TYPE_COLORS`, `DEFAULT_ARTICLE_TYPE`; the list mostly mirrors World Anvil's own template names, since articles are frequently imported from there). Full-text search, tag/type filtering, `[[Title]]` wiki-links with Ctrl+K insertion and broken-link detection (`useWikiLinkInsert.tsx`), image galleries with drag-and-drop, parent/child article hierarchy, a `visibleToPlayers` flag, and throttled revision history (`lib/wikiRevisions.ts`, `RevisionHistoryDialog.tsx`).

WorldAnvil import (`worlds/[worldId]/import/`) maps WorldAnvil's `templateType` onto this app's `articleType` via `ARTICLE_TYPE_MAP` — a handful of WorldAnvil templates have no direct equivalent here (Language/Session Report → Document, Title → Profession, Technology → Natural Law); see the comment above that map before changing it.

### Roll20 bridge (`roll20-bridge/`)

A separate Chrome MV3 extension, **not part of the Next.js build** — has its own `package.json`/esbuild step. One-directional (Roll20 → app), GM-side only, targets the "Cypher Systems Official" Roll20 sheet specifically (a different template than the Monte Cook Games one, with different field names — see the extension's README before assuming field names transfer). Supports both a sandbox and a production Amplify backend via an in-extension environment switch (`ENVIRONMENTS` in both `background.js` and `options-src.js` — duplicated rather than shared, since the two run in separate extension contexts with no build step wiring them together). `roll20-bridge/README.md` documents Roll20 DOM quirks (repeating-section row identity, description-field span/textarea collision) in detail — read it before touching `content.js`.

### Other reference tools under `/tabletop`

Generators (loot, magic items, NPCs, spell scrolls), an encounter difficulty calculator, an initiative tracker, a conditions reference, and searchable SRDs for both the D&D 5.5e ruleset (`/tabletop/srd`) and the Cypher System (`/tabletop/cypher`, backed by `lib/cypherSrd.ts`). The landing page (`app/tabletop/TabletopContent.tsx`) groups everything by game system (D&D 5e / Cypher System) rather than by function.

## Conventions worth knowing before editing

- **JSON-blob escape valves** (`systemDataJson`, `gmScreenJson`, `objectivesJson`, etc.) are used deliberately instead of new columns/models whenever data is system-specific, free-form, or still evolving. Don't "fix" these into proper relational fields without checking whether that flexibility is load-bearing.
- **Article-backed entities**: NPCs are the first case of "this campaign-tracker entity is actually a wiki article plus a thin state record" — if asked to do something similar for another entity, that's the established pattern to follow, not a one-off.
- Runtime Amplify config loads from `amplify_outputs.json` (generated by `ampx sandbox`/`ampx generate outputs`, gitignored, not committed — values aren't secrets, they're just per-environment and churn-prone).
