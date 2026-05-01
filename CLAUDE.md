# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run lint      # Run ESLint
```

There is no test framework configured in this project.

## Architecture

This is a **D&D 5e monster statblock creator** built with Next.js 14 App Router, AWS Amplify (Cognito + AppSync + DynamoDB), and Material UI.

### App Layout

The entire app is gated behind Amplify's `<Authenticator>` (email/password via Cognito). Layout chain:

```
RootLayout (app/layout.tsx)
  └── AuthenticatorWrapper (app/AuthenticatorWrapper.tsx)  ← login wall + Amplify init
        └── ThemeRegistry (app/components/themeRegistry/)   ← MUI theme provider
              └── {children}
```

### Routes

- `/` — Home (user info, sign-out)
- `/create/monster` — Single monster creator
- `/create/monster/bulk` — Bulk JSON upload for batch creation

### Data Layer

No custom API routes. All data operations go through the Amplify client SDK (`generateClient<Schema>()` from `aws-amplify/data`), which talks to AppSync GraphQL backed by DynamoDB.

The primary data model is `MonsterStatblock` defined in [amplify/data/resource.ts](amplify/data/resource.ts). It contains complex nested types for D&D mechanics: `MovementSpeed`, `MonsterAbility`, `MonsterAttack`, `DamageDice`, `SkillMods`, etc. Real-time updates use `.observeQuery()`.

### Monster Creator Components

The main feature lives in [app/components/creatorComponents/](app/components/creatorComponents/):

- `monsterCreator.tsx` — Root orchestrator (~1360 lines); holds all monster state and passes handlers down
- `monsterSheet.tsx` — Live visual preview of the statblock
- `monsterMarkdown.tsx` — Markdown export
- `headerrow.tsx` — Top bar: search, load, save, new monster actions
- `actionrow.tsx` — Editor for individual attacks/actions
- `abilityrow.tsx` — Editor for special abilities, bonus actions, reactions, legendary/mythic actions
- `abilityscoreinput.tsx` — Ability score field with auto-calculated modifier

### D&D Utilities

[5eReference/](5eReference/) contains pure game-mechanics helpers:

- `converters.tsx` — `scoreToMod()`, `calculateDependentStats()`, `getMonsterProf()`
- `monsterStatblockGenerator.tsx` — Default/blank monster templates

### Styling

MUI with emotion for component styling; CSS modules for page-level styles. Custom theme in [app/components/themeRegistry/theme.ts](app/components/themeRegistry/theme.ts) uses a brown/tan/cream D&D parchment palette.

### Amplify Setup

- Auth config: [amplify/auth/resource.ts](amplify/auth/resource.ts) — email login only, no MFA
- Data schema: [amplify/data/resource.ts](amplify/data/resource.ts) — authenticated users only
- Runtime config loaded from `amplify_outputs.json` (generated, not committed) via [app/config.ts](app/config.ts)
- `window.amplifyConfigured` flag prevents double-initialization on client

### Export

`html2canvas` is used to screenshot the rendered `monsterSheet` component to PNG.
