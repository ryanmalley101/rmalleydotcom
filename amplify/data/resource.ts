import { a, defineData, type ClientSchema } from '@aws-amplify/backend';
import { suggestPhotoTagsFunction } from '../functions/suggest-photo-tags/resource.js';

const DamageDice = a.customType({
  damage_dice: a.string().required(),
  damage_type: a.string().required(),
});

const MovementSpeed = a.customType({
  walk: a.integer(),
  swim: a.integer(),
  fly: a.integer(),
  climb: a.integer(),
  burrow: a.integer(),
  hover: a.boolean(),
  notes: a.string(),
});

const SkillMods = a.customType({
  acrobatics: a.integer(),
  animal_handling: a.integer(),
  arcana: a.integer(),
  athletics: a.integer(),
  deception: a.integer(),
  history: a.integer(),
  insight: a.integer(),
  intimidation: a.integer(),
  investigation: a.integer(),
  medicine: a.integer(),
  nature: a.integer(),
  perception: a.integer(),
  performance: a.integer(),
  persuasion: a.integer(),
  religion: a.integer(),
  sleight_of_hand: a.integer(),
  stealth: a.integer(),
  survival: a.integer(),
});


const MonsterAbility = a.customType({
  name: a.string().required(),
  desc: a.string().required(),
});

const MonsterAttack = a.customType({
  name: a.string().required(),
  desc: a.string(),
  effect: a.string(),
  type: a.string(),
  attack_bonus: a.string(),
  reach: a.integer(),
  short_range: a.integer(),
  long_range: a.integer(),
  damage: a.ref('DamageDice').array(),
  targets: a.string(),
});

// ── World / Campaign tracker models ──────────────────────────────────────────

// WorldMap: stores a map image (via S3 key) and a JSON-serialised array of pins.
// Pins are stored as JSON rather than a custom type array for schema flexibility.
const WorldMap = a.model({
  worldId:  a.string().required(),
  name:     a.string().required(),
  imageKey: a.string().required(), // Amplify Storage key
  pinsJson: a.string(),            // JSON: MapPin[]
}).authorization(allow => [allow.owner()]);

const Encounter = a.model({
  campaignId:      a.string().required(),
  name:            a.string().required(),
  description:     a.string(),
  monstersJson:    a.string(), // JSON: EncounterEntry[]
  status:          a.string(), // 'planned' | 'active' | 'completed'
  combatStateJson: a.string(), // JSON: live combat state for real-time sync
  settingsJson:    a.string(), // JSON: Partial<CombatSettings> — encounter-level overrides
}).authorization(allow => [allow.owner()]);

const DnDWorld = a.model({
  name:        a.string().required(),
  description: a.string(),
  genre:       a.string(),
}).authorization(allow => [allow.owner()]);

const Campaign = a.model({
  name:         a.string().required(),
  description:  a.string(),
  worldIds:     a.string().array(),
  status:       a.string(),
  system:       a.string(),
  settingsJson: a.string(), // JSON: Partial<CombatSettings> — campaign-level defaults
  gmScreenJson: a.string(), // JSON: GM dashboard scratch data (e.g. intrusion ideas)
  // Cognito sub of the campaign's creator/GM. Explicit rather than relying on
  // the auto-managed owner-auth field, so client code (useCampaignRole) has a
  // value it can read and compare without guessing Amplify's internal
  // identity-claim format. Unset on campaigns created before this field
  // existed — treated as permissive (everyone is GM-equivalent) rather than
  // locking the real creator out; see useCampaignRole.ts.
  gmUserId:       a.string(),
  initiativeJson: a.string(), // JSON: serialized campaign initiative tracker state
}).authorization(allow => [allow.owner()]);

const WikiArticle = a.model({
  worldId:       a.string().required(),
  title:         a.string().required(),
  content:       a.string(),
  tags:          a.string().array(),
  excerpt:       a.string(),
  coverImageUrl: a.string(),
  coverImageKey: a.string(), // Amplify Storage S3 key (preferred over coverImageUrl)
  galleryImageKeys: a.string().array(), // Amplify Storage S3 keys — supplemental gallery images
  status:        a.string(), // 'published' | 'draft' | 'stub'
  articleType:   a.string(),
  parentTitle:   a.string(),
  visibleToPlayers: a.boolean(), // defaults to true client-side when unset
}).authorization(allow => [allow.owner(), allow.authenticated().to(['read'])]);

// Content snapshots for WikiArticle, taken before each save (throttled — see
// lib/wikiRevisions.ts) so edits can be reviewed or rolled back.
const WikiArticleRevision = a.model({
  articleId: a.string().required(),
  title:     a.string(),
  content:   a.string(),
  excerpt:   a.string(),
  savedAt:   a.datetime(),
}).authorization(allow => [allow.owner()]);

// Rolling window of recent dice rolls detected in the Roll20 chat by the
// browser extension (roll20-bridge/) — not a permanent archive. The
// extension prunes each campaign down to its most recent ~50 entries after
// every write, so this is meant to be a live "what just happened" feed for
// the GM dashboard, not roll history.
const RollLogEntry = a.model({
  campaignId:    a.string().required(),
  characterName: a.string(),
  formula:       a.string(),
  total:         a.string(), // kept as text — not every rendered result is a clean integer
  raw:           a.string(), // fallback snippet of the chat message, for anything the parser missed
  rolledAt:      a.datetime(),
}).authorization(allow => [allow.owner(), allow.authenticated().to(['read'])]);

const CampaignSession = a.model({
  campaignId:    a.string().required(),
  sessionNumber: a.integer(),
  title:         a.string(),
  date:          a.string(),
  prepNotes:     a.string(),
  sessionNotes:  a.string(),
  playerSummary: a.string(), // player-facing recap visible to all members
  articleIds:    a.string().array(),
  imageKeys:     a.string().array(), // Amplify Storage S3 keys for attached images (maps, handouts, etc.)
}).authorization(allow => [allow.owner()]);

const PlayerCharacter = a.model({
  // Core identity
  campaignId:     a.string().required(),
  characterName:  a.string().required(),
  playerName:     a.string(),
  race:           a.string(),
  background:     a.string(),
  alignment:      a.string(),
  xp:             a.integer(),
  // Multiclassing: JSON [{class, level, subclass?, hitDie?}]
  classesJson:    a.string(),
  // Legacy single-class fields kept for backward compat
  characterClass: a.string(),
  subclass:       a.string(),
  level:          a.integer(),
  // Ability scores
  strength:       a.integer(),
  dexterity:      a.integer(),
  constitution:   a.integer(),
  intelligence:   a.integer(),
  wisdom:         a.integer(),
  charisma:       a.integer(),
  // Proficiencies: JSON string[] and JSON {[skill]: 'proficient'|'expert'}
  saveProficienciesJson:  a.string(),
  skillProficienciesJson: a.string(),
  // HP & combat
  maxHp:              a.integer(),
  currentHp:          a.integer(),
  tempHp:             a.integer(),
  armorClass:         a.integer(),
  speed:              a.integer(),
  initiative:         a.integer(),
  hitDice:            a.string(),
  deathSaveSuccesses: a.integer(),
  deathSaveFailures:  a.integer(),
  inspiration:        a.boolean(),
  exhaustion:         a.integer(),
  conditionsJson:     a.string(), // JSON: string[] of active condition names
  concentratingOn:    a.string(), // name of the spell/effect currently being concentrated on
  // Attacks JSON [{name, bonus, damage, damageType, properties?, description?}]
  attacksJson:    a.string(),
  // Inventory JSON [{name, type, quantity, weight?, equipped?, attuned?, description?}]
  inventoryJson:  a.string(),
  // Currency
  copper:         a.integer(),
  silver:         a.integer(),
  electrum:       a.integer(),
  gold:           a.integer(),
  platinum:       a.integer(),
  // Spellcasting
  spellcastingAbility: a.string(),
  spellSlotsJson:      a.string(), // JSON {[level]: {max, used}}
  spellsJson:          a.string(), // JSON [{name, level, school?, castingTime?, range?, components?, duration?, description?, prepared?}]
  // Features JSON [{name, source?, description, uses?, maxUses?, recharge?}]
  featuresJson:   a.string(),
  // Personality & background
  personality:    a.string(),
  ideals:         a.string(),
  bonds:          a.string(),
  flaws:          a.string(),
  backstory:      a.string(),
  notes:          a.string(),
  allies:         a.string(),
  // Physical traits
  gender:         a.string(),
  age:            a.string(),
  height:         a.string(),
  weight:         a.string(),
  eyes:           a.string(),
  skin:           a.string(),
  hair:           a.string(),
  // Other proficiency text
  languages:      a.string(),
  proficiencies:  a.string(),
  // Storage keys (Amplify S3)
  pdfKey:         a.string(),
  portraitKey:    a.string(),
  // RPG system fields
  system:         a.string(), // e.g. 'D&D 5e', 'Cypher System'
  systemDataJson: a.string(), // JSON: system-specific character data
  // Legacy text fields kept for backward compat
  savingThrows:   a.string(),
  skillProfs:     a.string(),
  equipment:      a.string(),
  features:       a.string(),
  spells:         a.string(),
}).authorization(allow => [allow.authenticated()]);

// Companion/pet — linked to a PC, visible to all authenticated users (GM can see)
const Companion = a.model({
  characterId:        a.string().required(), // owning PlayerCharacter
  campaignId:         a.string().required(), // for GM list queries
  name:               a.string().required(),
  species:            a.string(),
  companionType:      a.string(), // 'familiar'|'ranger companion'|'mount'|'summoned'|'other'
  maxHp:              a.integer(),
  currentHp:          a.integer(),
  tempHp:             a.integer(),
  armorClass:         a.integer(),
  speed:              a.integer(),
  strength:           a.integer(),
  dexterity:          a.integer(),
  constitution:       a.integer(),
  intelligence:       a.integer(),
  wisdom:             a.integer(),
  charisma:           a.integer(),
  monsterStatblockId: a.string(), // optional link to a statblock template
  notes:              a.string(),
  statsJson:          a.string(), // JSON for saves, skills, actions, etc.
  portraitKey:        a.string(),
}).authorization(allow => [allow.owner(), allow.authenticated().to(['read'])]);

// ── NPC / Quest / Faction trackers ───────────────────────────────────────────

// An NPC is a WikiArticle (category "Person") plus campaign-specific tracking
// state. Name/description/role/etc. all live on the linked article — this
// model only holds state that's specific to *this* campaign's playthrough,
// not a fact about the world (which could differ across campaigns sharing
// the same world/article).
const NPC = a.model({
  campaignId:   a.string().required(),
  articleId:    a.string().required(), // the linked WikiArticle
  isAlive:      a.boolean(),
  relationship: a.string(), // this NPC's relationship to the party, GM's framing
  notes:        a.string(), // campaign-specific GM tracking notes
}).authorization(allow => [allow.owner()]);

const Quest = a.model({
  campaignId:     a.string().required(),
  title:          a.string().required(),
  description:    a.string(),
  status:         a.string(), // 'active' | 'completed' | 'failed' | 'on_hold'
  questGiver:     a.string(),
  reward:         a.string(),
  objectivesJson: a.string(), // JSON: [{text, done}]
  notes:          a.string(),
}).authorization(allow => [allow.owner()]);

const Faction = a.model({
  campaignId:  a.string().required(),
  name:        a.string().required(),
  description: a.string(),
  reputation:  a.integer(), // -5 (Hostile) to +5 (Revered)
  notes:       a.string(),
}).authorization(allow => [allow.owner()]);

const TodoItem = a.model({
  title:       a.string().required(),
  description: a.string(),
  completed:   a.boolean(),
  priority:    a.string(), // 'low' | 'medium' | 'high'
  dueDate:     a.string(),
}).authorization(allow => [allow.owner()]);

// ── Player handouts ──────────────────────────────────────────────────────────

// GM-created handouts (text + images) that can be published for anyone with
// the share link — including players who don't have an account. When isPublic
// is true the content is also written to S3 at handouts/{publicToken}/content.json
// with guest-read access, so the public /handout/[token] route can serve it
// without any Amplify auth.
const Handout = a.model({
  campaignId:  a.string().required(),
  title:       a.string().required(),
  content:     a.string(),            // optional markdown
  imageKeys:   a.string().array(),    // S3 keys under handouts/{publicToken}/
  publicToken: a.string(),            // UUID for the public share URL
  isPublic:    a.boolean(),           // false = draft
  sessionId:   a.string(),            // optional link to a CampaignSession
}).authorization(allow => [allow.owner(), allow.authenticated().to(['read'])]);

// ── Campaign resources ────────────────────────────────────────────────────────

// Freeform GM-defined trackers — anything the table wants to track that doesn't
// fit an existing model (food/water, reputation with a city, morale, corruption,
// etc.). maxValue is optional; when set the UI shows a progress bar.
const CampaignResource = a.model({
  campaignId:  a.string().required(),
  name:        a.string().required(), // "Party Food Supply", "Reputation with Merchants"
  description: a.string(),
  value:       a.float().required(),
  maxValue:    a.float(), // optional — enables progress bar
  unit:        a.string(), // display label after the number: "days", "gold", "points"
  color:       a.string(), // hex accent color for the card border
  sortOrder:   a.integer(),
}).authorization(allow => [allow.owner(), allow.authenticated().to(['read'])]);

// ── Campaign calendar ─────────────────────────────────────────────────────────

// One per campaign. Defines the world's calendar structure — month names and
// lengths, weekday names, and an optional "current day" counter the GM advances
// as the campaign progresses. All structure is stored as JSON escape valves so
// GMs can freely rename months or adjust day counts without a schema migration.
const CampaignCalendar = a.model({
  campaignId:       a.string().required(),
  monthsJson:       a.string(), // JSON: [{name: string, days: number}]
  weekdayNamesJson: a.string(), // JSON: string[] — length is days-per-week
  currentDay:       a.integer(), // current absolute in-world day (1-indexed), optional
  epochName:        a.string(), // optional era label shown in header, e.g. "Year of Rising"
}).authorization(allow => [allow.owner(), allow.authenticated().to(['read'])]);

// Day-by-day campaign notes keyed by absolute day number (1 = first day of
// in-world time, 2 = second, etc.). The display date is always derived
// client-side from the CalendarConfig, so renaming months never breaks entries.
const DailyNote = a.model({
  campaignId:  a.string().required(),
  dayNumber:   a.integer().required(), // absolute 1-indexed in-world day
  title:       a.string(),
  notes:       a.string(),
  articleIds:  a.string().array(), // linked WikiArticle IDs
}).authorization(allow => [allow.owner(), allow.authenticated().to(['read'])]);

// ── Campaign timeline ─────────────────────────────────────────────────────────

// A single narrative event on the campaign's timeline. Sessions contribute
// automatically as anchors; custom events (battles, deaths, revelations, etc.)
// sit between them. Chronological order is driven by realDate (ISO string) so
// campaigns without strict real-world scheduling can still sort consistently.
const TimelineEvent = a.model({
  campaignId:       a.string().required(),
  title:            a.string().required(),
  description:      a.string(),
  eventType:        a.string(), // 'battle'|'revelation'|'death'|'alliance'|'quest'|'milestone'|'other'
  realDate:         a.string(), // ISO "2024-06-15" — primary sort key
  inWorldDate:      a.string(), // free-text "Kythorn 15, 1492 DR" — display only
  articleIds:       a.string().array(), // linked WikiArticle IDs
  sessionId:        a.string(), // optional link to a CampaignSession
  visibleToPlayers: a.boolean(), // false = GM-only; default treated as true by client
}).authorization(allow => [allow.owner(), allow.authenticated().to(['read'])]);

// ── Photo gallery ────────────────────────────────────────────────────────────

// A sub-gallery is just a name/description — photo membership lives on
// GalleryPhoto.subGalleryIds (array-of-ids, same escape-valve pattern as
// Campaign.worldIds) rather than a join table.
const SubGallery = a.model({
  name:        a.string().required(),
  description: a.string(),
}).authorization(allow => [allow.owner(), allow.authenticated().to(['read'])]);

const GalleryPhoto = a.model({
  storageKey:    a.string().required(), // Amplify Storage S3 key
  filename:      a.string().required(),
  uploadedAt:    a.datetime().required(),
  uploaderId:    a.string(),  // Cognito sub
  uploaderName:  a.string(),  // signInDetails.loginId at time of upload
  subGalleryIds: a.string().array(), // SubGallery ids this photo is assigned to
  tags:          a.string().array(), // freeform aesthetic tags (e.g. 'warm', 'bohemian') — manually entered for now, source-agnostic so AI tagging can populate the same field later
}).authorization(allow => [allow.owner(), allow.authenticated().to(['read'])]);

// On-demand AI tag suggestions for a single photo (Bedrock vision call) —
// returns suggestions only, doesn't write to GalleryPhoto itself; the client
// merges them into the same editable tags field a user would type into by hand.
const suggestPhotoTags = a
  .query()
  .arguments({ storageKey: a.string().required() })
  .returns(a.string().array())
  .authorization(allow => [allow.authenticated()])
  .handler(a.handler.function(suggestPhotoTagsFunction));

// Campaign membership (created by player on join)
// VTT (Virtual Tabletop) — one board per scene. Tokens used to live in a
// single tokensJson blob here; they're now their own VttToken model (below)
// so each token can be moved/owned independently instead of rewriting the
// whole board on every drag.
const VttBoard = a.model({
  campaignId:  a.string().required(),
  name:        a.string().required(),
  gridCols:    a.integer(),  // default 30
  gridRows:    a.integer(),  // default 20
  gridType:    a.string(),   // 'square' | 'hex' | 'none' — only 'square' is implemented so far
  gridOffsetX: a.float(),    // pixel offset so the grid can align to a map image that doesn't start at (0,0)
  gridOffsetY: a.float(),
  mapImageKey: a.string(),   // Amplify Storage S3 key — the board's background map
  mapWidthPx:  a.float(),
  mapHeightPx: a.float(),
  backgroundColor: a.string(), // fallback fill when no map image is set
  fogEnabled:  a.boolean(),
  fogJson:     a.string(),   // JSON: GM-painted revealed-cell coordinates
  drawingsJson: a.string(),  // JSON: freehand/shape annotations drawn on the board
}).authorization(allow => [allow.authenticated()]);

// A token on a VttBoard. Provisional authorization below (matches
// VttBoard's allow.authenticated()) — the VTT roadmap's Phase 2 tightens
// this to per-token ownership via allow.ownerDefinedIn('ownerId') so a
// player can only move their own token while the GM can move anything.
// Not implemented yet: it needs real multi-account testing to get the
// ownerId format right, not just a schema guess.
const VttToken = a.model({
  boardId:          a.string().required(),
  x:                a.float().required(),
  y:                a.float().required(),
  width:            a.float().required(),
  height:           a.float().required(),
  rotation:         a.float(),
  imageKey:         a.string(), // Amplify Storage S3 key — falls back to a colored circle when unset
  label:            a.string(),
  color:            a.string(),
  linkedEntityId:   a.string(), // optional link to a PlayerCharacter / NPC / MonsterStatblock / Companion
  linkedEntityType: a.string(), // 'playerCharacter' | 'npc' | 'monsterStatblock' | 'companion'
  ownerId:          a.string(), // controlling player's identity; unset = GM-only
  visibleToPlayers: a.boolean(),
  conditionsJson:   a.string(), // mirrors PlayerCharacter.conditionsJson's shape
  sortOrder:        a.integer(),
}).authorization(allow => [allow.authenticated()]);

// Campaign-wide chat, not scoped to a single board — a GM may want chat
// visible regardless of which scene is currently open. Provisional
// authorization (see VttToken's note above); whisperToIds isn't enforced
// server-side yet, only filtered client-side once the chat UI exists.
const ChatMessage = a.model({
  campaignId:        a.string().required(),
  authorName:        a.string().required(),
  authorId:          a.string(), // sender's identity, for future whisper enforcement
  text:              a.string(),
  rollFormula:       a.string(),
  rollTotal:         a.string(),
  rollBreakdownJson: a.string(), // full dice breakdown, for an expandable "show the dice" detail
  whisperToIds:      a.string().array(), // empty/unset = public
}).authorization(allow => [allow.authenticated()]);

const CampaignMember = a.model({
  campaignId: a.string().required(),
  role:       a.string().required(), // 'gm' | 'player'
  playerName: a.string(),
  userId:     a.string(), // Cognito sub of whoever joined — same rationale as Campaign.gmUserId
}).authorization(allow => [allow.owner(), allow.authenticated().to(['read'])]);

// Invite records — record ID is the invite code
const CampaignInvite = a.model({
  campaignId: a.string().required(),
  role:       a.string().required(), // 'gm' | 'player'
  expiresAt:  a.string(),
}).authorization(allow => [allow.owner(), allow.authenticated().to(['read'])]);

// Per-user app preferences (one row per Cognito user, created lazily on first use)
const UserPreference = a.model({
  autosaveEnabled: a.boolean(),
  gmDashboardLayoutJson: a.string(), // JSON: { collapsedSections: string[], tableMode: boolean }
  masterVolume: a.float(), // 0-1, personal ceiling on session ambient audio — see SessionPlayback
}).authorization(allow => [allow.owner()]);

// Session ambient audio — tracks are scoped to one campaign by path
// (session-music/{campaignId}/*) and by this record's campaignId, same
// posture as every other upload in this app (maps, portraits, wiki images):
// any authenticated user *could* reach a file if they had its exact S3 key,
// but campaignIds are UUIDs, not guessable, and there's no per-campaign
// storage-level authorizer in this app to do better without a Lambda-backed
// signed-URL minter. Treat this as organizational scoping, not a hard
// security boundary — consistent with everything else here, not a new gap.
const SessionTrack = a.model({
  campaignId:      a.string().required(),
  name:            a.string().required(),
  storageKey:      a.string().required(),
  durationSeconds: a.float(),
  uploadedBy:      a.string(), // display name, not a Cognito identity — same convention as playerName elsewhere
}).authorization(allow => [allow.owner(), allow.authenticated().to(['read'])]);

// One row per campaign (find-or-create, like UserPreference) — every
// client computes its own playback position from this shared timeline
// rather than reacting to "play" commands, so seek math stays consistent
// even for a client that subscribes mid-track. See lib/useSessionPlayback.ts.
const SessionPlayback = a.model({
  campaignId:    a.string().required(),
  trackId:       a.string(), // null = nothing playing
  startedAtIso:  a.string(), // when the current playback span began
  offsetSeconds: a.float(),  // track position startedAtIso corresponds to
  paused:        a.boolean(),
  loop:          a.boolean(),
  volume:        a.float(), // GM-broadcast volume, 0-1 — multiplied by each listener's own masterVolume, not synced as a final value
}).authorization(allow => [allow.owner(), allow.authenticated().to(['read'])]);

const schema = a.schema({
  DamageDice,
  MovementSpeed,
  SkillMods,
  MonsterAbility,
  MonsterAttack,
  Encounter,
  DnDWorld,
  Campaign,
  WikiArticle,
  WikiArticleRevision,
  RollLogEntry,
  WorldMap,
  CampaignSession,
  PlayerCharacter,
  VttBoard,
  VttToken,
  ChatMessage,
  CampaignMember,
  CampaignInvite,
  NPC,
  Quest,
  Faction,
  Companion,
  TodoItem,
  CampaignCalendar,
  DailyNote,
  Handout,
  CampaignResource,
  TimelineEvent,
  SubGallery,
  GalleryPhoto,
  suggestPhotoTags,
  UserPreference,
  SessionTrack,
  SessionPlayback,
  MonsterStatblock: a.model({
    id: a.id().required(),
    slug: a.string(),            // open5e slug, used for deduplication on import
    publisher: a.string().required(),
    name: a.string().required(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    desc: a.string(),
    size: a.string().required(),
    type: a.string().required(),
    subtype: a.string(),
    group: a.string(),
    alignment: a.string().required(),
    armor_class: a.integer().required(),
    armor_desc: a.string(),
    current_hit_points: a.integer(),
    hit_points: a.integer().required(),
    hit_dice_num: a.integer().required(),
    hit_dice: a.string(),
    speed: a.ref('MovementSpeed').required(),
    strength: a.integer().required(),
    dexterity: a.integer().required(),
    constitution: a.integer().required(),
    intelligence: a.integer().required(),
    wisdom: a.integer().required(),
    charisma: a.integer().required(),
    strength_save: a.integer(),
    dexterity_save: a.integer(),
    constitution_save: a.integer(),
    intelligence_save: a.integer(),
    wisdom_save: a.integer(),
    charisma_save: a.integer(),
    perception: a.integer(),
    skills: a.ref('SkillMods'),
    damage_vulnerabilities: a.string(),
    damage_vulnerability_list: a.string().required().array(),
    damage_resistances: a.string(),
    damage_resistance_list: a.string().required().array(),
    damage_immunities: a.string(),
    damage_immunity_list: a.string().required().array(),
    condition_immunities: a.string(),
    condition_immunity_list: a.string().required().array(),
    blindsight: a.integer(),
    blindBeyond: a.boolean(),
    darkvision: a.integer(),
    tremorsense: a.integer(),
    truesight: a.integer(),
    senses: a.string(),
    languages: a.string(),
    challenge_rating: a.string(),
    cr: a.float().required(),
    special_abilities: a.ref('MonsterAbility').required().array(),
    actions: a.ref('MonsterAttack').required().array(),
    bonus_actions: a.ref('MonsterAbility').required().array(),
    reactions: a.ref('MonsterAbility').required().array(),
    legendary_desc: a.string(),
    legendary_actions: a.ref('MonsterAbility').required().array(),
    mythic_desc: a.string(),
    mythic_actions: a.ref('MonsterAbility').required().array(),
  })
  .authorization(allow => [allow.authenticated()])
});

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

export type Schema = ClientSchema<typeof schema>;
