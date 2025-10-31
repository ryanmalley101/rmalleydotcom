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
  damage_dice: a.string().required(),
  damage_type: a.string().required(),
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
  MonsterStatblock: a.model({
    id: a.id().required(),
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
    save_proficiencies: a.string().required().array(),
    perception: a.integer(),
    skills: a.ref('SkillMods'),
    skill_proficiencies: a.ref('SkillProfs'),
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
