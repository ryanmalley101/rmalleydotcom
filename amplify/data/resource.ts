import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

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

// Campaign membership (created by player on join)
// VTT (Virtual Tabletop) — one board per scene, real-time token positions
const VttBoard = a.model({
  campaignId:  a.string().required(),
  name:        a.string().required(),
  gridCols:    a.integer(),  // default 30
  gridRows:    a.integer(),  // default 20
  tokensJson:  a.string(),   // JSON: VttToken[]
}).authorization(allow => [allow.authenticated()]);

const CampaignMember = a.model({
  campaignId: a.string().required(),
  role:       a.string().required(), // 'gm' | 'player'
  playerName: a.string(),
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
}).authorization(allow => [allow.owner()]);

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
  CampaignMember,
  CampaignInvite,
  NPC,
  Quest,
  Faction,
  Companion,
  TodoItem,
  UserPreference,
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
