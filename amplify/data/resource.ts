import { a, defineData, type ClientSchema } from '@aws-amplify/backend';
// import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

// --- Re-usable Custom Types (from s and non-model Types) ---

const Song = a.customType({
  title: a.string(),
  url: a.string(),
});

const SongQueue = a.customType({
  playlistName: a.string(),
  songs: a.ref('Song').array(),
});

const Game = a.customType({
  name: a.string(),
  userGamesId: a.id(),
});

const User = a.customType({
  id: a.id(),
  email: a.string(),
  username: a.string(),
});

const CreateGameResponse = a.customType({
  id: a.id().required(),
});

const CreateNewGame = a.customType({
  gameName: a.string().required(),
  ownerId: a.id().required(),
  username: a.string().required(),
});

const DamageDie = a.customType({
  damageType: a.string().required(),
  damageString: a.string().required(),
});

const Message = a.customType({
  gameMessageListId: a.id(),
  owner: a.id(),
  messageType: a.string(),
  advantage: a.string(),
  damageDice: a.json().array(),
  damageDiceResults: a.json().array(),
  rolls: a.json().array(),
  abilityName: a.string(),
  saveAbility: a.string(),
  saveScore: a.integer(),
  messageText: a.string(),
  placeholder: a.string(),
  diceString: a.string(),
});

const ParseMessageResponse = a.customType({
  id: a.id().required(),
});

const ParseMessage = a.customType({
  owner: a.id().required(),
  gameMessageListId: a.id().required(),
  messageType: a.string(),
  messageText: a.string(),
  abilityName: a.string(),
  d20mod: a.integer(),
  gameId: a.id(),
  saveAbility: a.string(),
  saveScore: a.integer(),
  advantage: a.string(),
  damageDice: a.ref('DamageDie').array(),
});

const Player = a.customType({
  name: a.string(),
  userPlayersId: a.id(),
  gamePlayersId: a.id(),
});

const Map = a.customType({
  gameMapsId: a.id(),
  sizeX: a.integer(),
  sizeY: a.integer(),
  name: a.string(),
});

const Token = a.customType({
  mapTokensId: a.id(),
  imageURL: a.string(),
  points: a.float().array(),
  radius: a.float(),
  layer: a.string(),
  text: a.string(),
  fill: a.string(),
  stroke: a.string(),
  fontSize: a.float(),
  width: a.float(),
  height: a.float(),
  rotation: a.float(),
  x: a.float(),
  y: a.float(),
  token: a.string(),
});

const Ping = a.customType({
  gamePingsId: a.id(),
  x: a.float(),
  y: a.float(),
  scale: a.float(),
  ttl: a.integer(),
});

const Ruler = a.customType({
  id: a.id(),
  points: a.float().array(),
  mapRulersId: a.id(),
  playerRulersId: a.id(),
});

const DamageDice = a.customType({
  damage_dice: a.string(),
  damage_type: a.string(),
});

const Attack = a.customType({
  name: a.string().required(),
  notes: a.string().required(),
  attack_bonus: a.string().required(),
  damage: a.ref('DamageDice').array().required(),
});


const Spell = a.customType({
  is_prepared: a.boolean(),
  is_concentration: a.boolean(),
  is_ritual: a.boolean(),
  is_attack: a.boolean(),
  name: a.string().required(),
  level: a.integer().required(),
  source: a.string().required(),
  save_ability: a.string(),
  attack_save: a.integer().required(),
  damage: a.ref('DamageDice').array(),
  cast_time: a.string().required(),
  range_shape: a.string().required(),
  duration: a.string().required(),
  components: a.string().required(),
  notes: a.string().required(),
});


const Item = a.customType({
  equipped: a.boolean().required(),
  name: a.string().required(),
  count: a.integer().required(),
  weight: a.float().required(),
  value: a.string().required(),
  notes: a.string().required(),
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

// const MovementSpeed = a.customType({
//   walk: a.integer(),
//   swim: a.integer(),
//   fly: a.integer(),
//   climb: a.integer(),
//   burrow: a.integer(),
//   hover: a.boolean(),
//   notes: a.string(),
// });

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

const SkillProfs = a.customType({
  acrobatics: a.string(),
  animal_handling: a.string(),
  arcana: a.string(),
  athletics: a.string(),
  deception: a.string(),
  history: a.string(),
  insight: a.string(),
  intimidation: a.string(),
  investigation: a.string(),
  medicine: a.string(),
  nature: a.string(),
  perception: a.string(),
  performance: a.string(),
  persuasion: a.string(),
  religion: a.string(),
  sleight_of_hand: a.string(),
  stealth: a.string(),
  survival: a.string(),
});

const MonsterAbility = a.customType({
  name: a.string(),
  desc: a.string(),
});


const MonsterAttack = a.customType({
  name: a.string(),
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


// const MonsterStatblock = a.customType({
//   ownerId: a.string(),
//   name: a.string(),
//   createdAt: a.datetime(),
//   updatedAt: a.datetime(),
//   desc: a.string(),
//   size: a.string(),
//   type: a.string(),
//   subtype: a.string(),
//   group: a.string(),
//   alignment: a.string(),
//   armor_class: a.integer(),
//   armor_desc: a.string(),
//   hit_points: a.integer(),
//   hit_dice: a.string(),
//   hit_dice_num: a.integer(),
//   speed: a.ref('MovementSpeed'),
//   strength: a.integer(),
//   dexterity: a.integer(),
//   constitution: a.integer(),
//   intelligence: a.integer(),
//   wisdom: a.integer(),
//   charisma: a.integer(),
//   strength_save: a.integer(),
//   dexterity_save: a.integer(),
//   constitution_save: a.integer(),
//   intelligence_save: a.integer(),
//   wisdom_save: a.integer(),
//   charisma_save: a.integer(),
//   save_proficiencies: a.string().array(),
//   perception: a.integer(),
//   skills: a.ref('SkillMods'),
//   skill_proficiencies: a.ref('SkillProfs'),
//   damage_vulnerabilities: a.string(),
//   damage_vulnerability_list: a.string().array(),
//   damage_resistances: a.string(),
//   damage_resistance_list: a.string().array(),
//   damage_immunities: a.string(),
//   damage_immunity_list: a.string().array(),
//   condition_immunities: a.string(),
//   condition_immunity_list: a.string().array(),
//   senses: a.string(),
//   languages: a.string(),
//   challenge_rating: a.string(),
//   cr: a.float(),
//   actions: a.ref('MonsterAttack').array(),
//   bonus_actions: a.ref('MonsterAbility').array(),
//   reactions: a.ref('MonsterAbility').array(),
//   legendary_desc: a.string(),
//   legendary_actions: a.ref('MonsterAbility').array(),
//   blindsight: a.integer(),
//   blindBeyond: a.boolean(),
//   darkvision: a.integer(),
//   tremorsense: a.integer(),
//   truesight: a.integer(),
//   special_abilities: a.ref('MonsterAbility').array(),
//   mythic_desc: a.string(),
//   mythic_actions: a.ref('MonsterAbility').array(),
// });


// --- Schema Definition ---

const schema = a.schema({
  // --- Custom Types Definition ---
  Song,
  SongQueue,
  CreateGameResponse,
  DamageDie,
  ParseMessageResponse,
  Player,
  Map,
  Token,
  Ping,
  Ruler,
  DamageDice,
  Attack,
  Spell,
  Item,
  MovementSpeed,
  SkillMods,
  SkillProfs,
  MonsterAbility,
  MonsterAttack,

  // --- Model Definitions ---

  // Game: a.model({
  //   id: a.id().required(),
  //   name: a.string().required(),
    
  //   // // Relationship: owner: User! @belongsTo
  //   // ownerId: a.id().required(), // Added foreign key
  //   // owner: a.belongsTo('User', 'ownerId'),
    
  //   // Relationship: messageList: [Message]! @hasMany
  //   messageList: a.hasMany('Message', 'gameId'),
    
  //   dms: a.id().array(),
    
  //   // Relationship: players: [Player]! @hasMany
  //   players: a.hasMany('Player', 'gameId'),
    
  //   // Relationship: maps: [Map]! @hasMany
  //   maps: a.hasMany('Map', 'gameId'),
    
  //   activeMap: a.id(),
    
  //   // Relationship: characterSheets: [CharacterSheet]! @hasMany
  //   characterSheets: a.hasMany('CharacterSheet', 'gameId'),
    
  //   // Relationship: pings: [Ping]! @hasMany
  //   pings: a.hasMany('Ping', 'gameId'),
    
  //   gameMode: a.string(),
  //   activeSong: a.ref('Song'),
  //   songPlaying: a.boolean(),
  //   songQueue: a.ref('Song').array(),
  //   paused: a.boolean(),
  // }).authorization(allow => [allow.owner()]),

  // User: a.model({
  //   id: a.id().required(),
  //   email: a.string().required(),
  //   username: a.string().required(),
    
  //   // Relationship: players: [Player] @hasMany
  //   players: a.hasMany('Player', 'userId'),
    
  //   // Relationship: games: [Game] @hasMany
  //   games: a.hasMany('Game', 'ownerId'),
  // }).authorization(allow => [allow.owner()]),

  // Message: a.model({
  //   id: a.id().required(),
    
  //   // Relationship: game: Game @belongsTo
  //   gameId: a.id().required(), // Field already existed in Gen 1
  //   game: a.belongsTo('Game', 'gameId'),
  //   messageType: a.string(),
  //   advantage: a.string(),
  //   damageDice: a.json().array(),
  //   damageDiceResults: a.json().array(),
  //   rolls: a.json().array(),
  //   abilityName: a.string(),
  //   saveAbility: a.string(),
  //   saveScore: a.integer(),
  //   messageText: a.string(),
  //   diceString: a.string(),
  //   placeholder: a.string(),
  // })
  // .authorization(allow => [allow.owner()]),

  // Player: a.model({
  //   id: a.id().required(),
  //   name: a.string().required(),
    
  //   // Relationship: game: Game! @belongsTo
  //   gameId: a.id().required(), // Added foreign key
  //   game: a.belongsTo('Game', 'gameId'),
    
  //   // Relationship: user: User! @belongsTo
  //   userId: a.id().required(), // Added foreign key
  //   user: a.belongsTo('User', 'userId'),
    
  //   // Relationship: rulers: [Ruler] @hasMany
  //   rulers: a.hasMany('Ruler', 'playerId'),
  // }).authorization(allow => [allow.ownerDefinedIn('userId')]),

  // Map: a.model({
  //   id: a.id().required(), // Added implicit ID
    
  //   // Relationship: tokens: [Token]! @hasMany
  //   tokens: a.hasMany('Token', 'mapId'),
    
  //   // Relationship: rulers: [Ruler] @hasMany
  //   rulers: a.hasMany('Ruler', 'mapId'),
    
  //   sizeX: a.integer().required(),
  //   sizeY: a.integer().required(),
  //   name: a.string().required(),
    
  //   // Relationship: game: Game! @belongsTo
  //   gameId: a.id().required(), // Added foreign key
  //   game: a.belongsTo('Game', 'gameId'),
  // }).authorization(allow => [allow.authenticated()]),

  // Token: a.model({
  //   id: a.id().required(), // Added implicit ID
    
  //   // Relationship: map: Map! @belongsTo
  //   mapId: a.id().required(), // Added foreign key
  //   map: a.belongsTo('Map', 'mapId'),
    
  //   // Relationship: character: CharacterSheet @belongsTo
  //   characterSheetId: a.id(), // Added foreign key for one-to-one
  //   character: a.hasOne('CharacterSheet', 'characterSheetId'),
  //   type: a.string(),
  //   imageURL: a.string(),
  //   points: a.float().array(),
  //   radius: a.float(),
  //   layer: a.string(),
  //   fill: a.string(),
  //   stroke: a.string(),
  //   text: a.string(),
  //   fontSize: a.float(),
  //   width: a.float(),
  //   height: a.float(),
  //   rotation: a.float(),
  //   x: a.float(),
  //   y: a.float(),
  //   key: a.string(),
  // }).authorization(allow => [allow.owner()]),

  // Ping: a.model({
  //   id: a.id().required(), // Added implicit ID
    
  //   // Relationship: game: Game! @belongsTo
  //   gameId: a.id().required(), // Added foreign key
  //   game: a.belongsTo('Game', 'gameId'),
    
  //   x: a.float().required(),
  //   y: a.float().required(),
  //   scale: a.float().required(),
  //   ttl: a.integer(), // Note: TTL is configured in resource.ts, not here
  // }).authorization(allow => [allow.owner()]),

  // Ruler: a.model({
  //   id: a.id().required(),
  //   points: a.float().array().required(),
    
  //   // Relationship: map: Map! @belongsTo
  //   mapId: a.id().required(), // Added foreign key
  //   map: a.belongsTo('Map', 'mapId'),
    
  //   // Relationship: player: Player! @belongsTo
  //   playerId: a.id().required(), // Added foreign key
  //   player: a.belongsTo('Player', 'playerId'),
  // }).authorization(allow => [allow.owner()]),

  // CharacterSheet: a.model({
  //   id: a.id().required(), // Added implicit ID
  //   owner: a.id().required(),
  //   players: a.id().array().required(),
    
  //   // Relationship: game: Game! @belongsTo
  //   gameId: a.id().required(), // Added foreign key
  //   game: a.belongsTo('Game', 'gameId'),
    
  //   // Relationship: token: Token @hasOne
  //   token: a.hasOne('Token', 'characterSheetId'),
    
  //   name: a.string().required(),
  //   class_level: a.string().required(),
  //   background: a.string().required(),
  //   player_name: a.string().required(),
  //   race: a.string().required(),
  //   alignment: a.string().required(),
  //   xp: a.integer().required(),
  //   inspiration: a.integer().required(),
  //   proficiency_bonus: a.integer().required(),
  //   ac: a.integer().required(),
  //   armor_desc: a.string().required(),
  //   max_hp: a.integer().required(),
  //   death_success_1: a.boolean().required(),
  //   death_success_2: a.boolean().required(),
  //   death_success_3: a.boolean().required(),
  //   death_fail_1: a.boolean().required(),
  //   death_fail_2: a.boolean().required(),
  //   death_fail_3: a.boolean().required(),
  //   current_hp: a.integer().required(),
  //   total_hd: a.string().required(),
  //   current_hd: a.integer().required(),
  //   temp_hp: a.integer().required(),
  //   speed: a.string().required(),
  //   strength: a.integer(),
  //   dexterity: a.integer(),
  //   constitution: a.integer(),
  //   intelligence: a.integer(),
  //   wisdom: a.integer(),
  //   charisma: a.integer(),
  //   strength_score: a.integer().required(),
  //   dexterity_score: a.integer().required(),
  //   constitution_score: a.integer().required(),
  //   intelligence_score: a.integer().required(),
  //   wisdom_score: a.integer().required(),
  //   charisma_score: a.integer().required(),
  //   strength_save_mod: a.integer().required(),
  //   dexterity_save_mod: a.integer().required(),
  //   constitution_save_mod: a.integer().required(),
  //   intelligence_save_mod: a.integer().required(),
  //   wisdom_save_mod: a.integer().required(),
  //   charisma_save_mod: a.integer().required(),
  //   strength_save_prof: a.boolean().required(),
  //   dexterity_save_prof: a.boolean().required(),
  //   constitution_save_prof: a.boolean().required(),
  //   intelligence_save_prof: a.boolean().required(),
  //   wisdom_save_prof: a.boolean().required(),
  //   charisma_save_prof: a.boolean().required(),
  //   skills: a.ref('SkillMods'),
  //   skill_proficiencies: a.ref('SkillProfs'),
  //   save_proficiencies: a.string().array(),
  //   passive_perception: a.integer().required(),
  //   passive_investigation: a.integer().required(),
  //   passive_insight: a.integer().required(),
  //   acrobatics_prof: a.boolean(),
  //   animal_handling_prof: a.boolean(),
  //   arcana_prof: a.boolean(),
  //   athletics_prof: a.boolean(),
  //   deception_prof: a.boolean(),
  //   history_prof: a.boolean(),
  //   insight_prof: a.boolean(),
  //   intimidation_prof: a.boolean(),
  //   investigation_prof: a.boolean(),
  //   medicine_prof: a.boolean(),
  //   nature_prof: a.boolean(),
  //   perception_prof: a.boolean(),
  //   performance_prof: a.boolean(),
  //   persuasion_prof: a.boolean(),
  //   religion_prof: a.boolean(),
  //   sleight_of_hand_prof: a.boolean(),
  //   stealth_prof: a.boolean(),
  //   survival_prof: a.boolean(),
  //   acrobatics_mod: a.integer(),
  //   animal_handling_mod: a.integer(),
  //   arcana_mod: a.integer(),
  //   athletics_mod: a.integer(),
  //   deception_mod: a.integer(),
  //   history_mod: a.integer(),
  //   insight_mod: a.integer(),
  //   intimidation_mod: a.integer(),
  //   investigation_mod: a.integer(),
  //   medicine_mod: a.integer(),
  //   nature_mod: a.integer(),
  //   perception_mod: a.integer(),
  //   performance_mod: a.integer(),
  //   persuasion_mod: a.integer(),
  //   religion_mod: a.integer(),
  //   sleight_of_hand_mod: a.integer(),
  //   stealth_mod: a.integer(),
  //   survival_mod: a.integer(),
  //   initiative: a.integer().required(),
  //   defenses: a.string().required(),
  //   senses: a.string().required(),
  //   save_notes: a.string().required(),
  //   movement: a.string().required(),
  //   other_profs: a.string().required(),
  //   attacks: a.ref('Attack').array().required(),
  //   attack_notes: a.string().required(),
  //   spell_slots_1: a.integer().required(),
  //   spell_slots_2: a.integer().required(),
  //   spell_slots_3: a.integer().required(),
  //   spell_slots_4: a.integer().required(),
  //   spell_slots_5: a.integer().required(),
  //   spell_slots_6: a.integer().required(),
  //   spell_slots_7: a.integer().required(),
  //   spell_slots_8: a.integer().required(),
  //   spell_slots_9: a.integer().required(),
  //   spell_slots_max_1: a.integer().required(),
  //   spell_slots_max_2: a.integer().required(),
  //   spell_slots_max_3: a.integer().required(),
  //   spell_slots_max_4: a.integer().required(),
  //   spell_slots_max_5: a.integer().required(),
  //   spell_slots_max_6: a.integer().required(),
  //   spell_slots_max_7: a.integer().required(),
  //   spell_slots_max_8: a.integer().required(),
  //   spell_slots_max_9: a.integer().required(),
  //   pact_level: a.integer().required(),
  //   pact_available: a.integer().required(),
  //   pact_maximum: a.integer().required(),
  //   sp_maximum: a.integer().required(),
  //   sp_available: a.integer().required(),
  //   spells: a.ref('Spell').array().required(),
  //   spells_notes: a.string().required(),
  //   weight_carried: a.integer().required(),
  //   weight_capacity: a.integer().required(),
  //   encumberance_notes: a.string().required(),
  //   pp: a.integer().required(),
  //   gp: a.integer().required(),
  //   ep: a.integer().required(),
  //   sp: a.integer().required(),
  //   cp: a.integer().required(),
  //   attuned_magic_items: a.string().array().required(),
  //   attunement_notes: a.string().required(),
  //   inventory: a.ref('Item').array().required(),
  //   inventory_notes: a.string().required(),
  //   features_left: a.string().required(),
  //   features_center: a.string().required(),
  //   features_right: a.string().required(),
  //   gender: a.string().required(),
  //   age: a.string().required(),
  // height: a.string().required(),
  //   weight: a.string().required(),
  //   faith: a.string().required(),
  //   skin: a.string().required(),
  //   eyes: a.string().required(),
  //   hair: a.string().required(),
  //   organizations: a.string().required(),
  //   backstory: a.string().required(),
  //   personality: a.string().required(),
  //   ideals: a.string().required(),
  //   bonds: a.string().required(),
  //   flaws: a.string().required(),
  //   notes_left: a.string().required(),
  //   notes_center: a.string().required(),
  //   notes_right: a.string().required(),
  // }).authorization(allow => [allow.owner()]),

  MonsterStatblock: a.model({
    id: a.id().required(),
    ownerId: a.string().required(),
    name: a.string().required(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    desc: a.string(),
    size: a.string(),
    type: a.string(),
    subtype: a.string(),
    group: a.string(),
    alignment: a.string(),
    armor_class: a.integer(),
    armor_desc: a.string(),
    current_hit_points: a.integer(),
    hit_points: a.integer(),
    hit_dice_num: a.integer(),
    hit_dice: a.string(),
    speed: a.ref('MovementSpeed'),
    strength: a.integer(),
    dexterity: a.integer(),
    constitution: a.integer(),
    intelligence: a.integer(),
    wisdom: a.integer(),
    charisma: a.integer(),
    strength_save: a.integer(),
    dexterity_save: a.integer(),
    constitution_save: a.integer(),
    intelligence_save: a.integer(),
    wisdom_save: a.integer(),
    charisma_save: a.integer(),
    save_proficiencies: a.string().array(),
    perception: a.integer(),
    skills: a.ref('SkillMods'),
    skill_proficiencies: a.ref('SkillProfs'),
    damage_vulnerabilities: a.string(),
    damage_vulnerability_list: a.string().array(),
    damage_resistances: a.string(),
    damage_resistance_list: a.string().array(),
    damage_immunities: a.string(),
    damage_immunity_list: a.string().array(),
    condition_immunities: a.string(),
    condition_immunity_list: a.string().array(),
    blindsight: a.integer(),
    blindBeyond: a.boolean(),
    darkvision: a.integer(),
    tremorsense: a.integer(),
    truesight: a.integer(),
    senses: a.string(),
    languages: a.string(),
    challenge_rating: a.string(),
    cr: a.float(),
    special_abilities: a.ref('MonsterAbility').array(),
    actions: a.ref('MonsterAttack').array(),
    bonus_actions: a.ref('MonsterAbility').array(),
    reactions: a.ref('MonsterAbility').array(),
    legendary_desc: a.string(),
    legendary_actions: a.ref('MonsterAbility').array(),
    mythic_desc: a.string(),
    mythic_actions: a.ref('MonsterAbility').array(),
  })
  .authorization(allow => [allow.owner()])

  // --- Custom Function-based Mutations ---

  // parseMessage: a.mutation()
  //   .arguments({ : a.ref('ParseMessage').required() })
  //   .returns(a.ref('ParseMessageResponse').required())
  //   .handler(a.handler.function('parseMessage')),

  // createNewGame: a.mutation()
  //   .arguments({ : a.ref('CreateNewGame').required() })
  //   .returns(a.ref('CreateGameResponse').required())
  //   .handler(a.handler.function('createNewGame')),
});

// --- Export the Schema ---

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool', // Or 'iam' based on your default
    // API Key is not used in your schema, but you could add it here
    // apiKeyAuthorizationMode: {
    //   expiresInDays: 30,
    // },
    // iamAuthorizationMode: {
    //   authenticated: [
    //     'identityPool', // or 'userPool'
    //   ],
    //   unauthenticated: [
    //     'identityPool', // or 'userPool'
    //   ]
    // },
  },
});

// This type is used to type client-side calls
export type Schema = ClientSchema<typeof schema>;

// import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

// /*== STEP 1 ===============================================================
// The section below creates a Todo database table with a "content" field. Try
// adding a new "isDone" field as a boolean. The authorization rule below
// specifies that any user authenticated via an API key can "create", "read",
// "update", and "delete" any "Todo" records.
// =========================================================================*/
// const schema = a.schema({
//   Todo: a
//     .model({
//       content: a.string(),
//       }).authorization(allow => [allow.owner()]),
// });

// export type Schema = ClientSchema<typeof schema>;

// export const data = defineData({
//   schema,
//   authorizationModes: {
//     defaultAuthorizationMode: 'userPool',
//     apiKeyAuthorizationMode: {
//       expiresInDays: 30,
//     },
//   },
// });

// /*== STEP 2 ===============================================================
// Go to your frontend source code. From your client-side code, generate a
// Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
// WORK IN THE FRONTEND CODE FILE.)

// Using JavaScript or Next.js React Server Components, Middleware, Server 
// Actions or Pages Router? Review how to generate Data clients for those use
// cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
// =========================================================================*/

// /*
// "use client"
// import { generateClient } from "aws-amplify/data";
// import type { Schema } from "@/amplify/data/resource";

// const client = generateClient<Schema>() // use this Data client for CRUDL requests
// */

// /*== STEP 3 ===============================================================
// Fetch records from the database and use them in your frontend component.
// (THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
// =========================================================================*/

// /* For example, in a React component, you can use this snippet in your
//   function's RETURN statement */
// // const { data: todos } = await client.models.Todo.list()

// // return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
