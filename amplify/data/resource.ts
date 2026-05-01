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

const schema = a.schema({
  DamageDice,
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
});

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

export type Schema = ClientSchema<typeof schema>;
