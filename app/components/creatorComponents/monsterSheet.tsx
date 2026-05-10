import React, { ReactElement, useEffect, useState } from "react";
import styles from "@/styles/MonsterSheet.module.css";
import { crToXP, getToHit, plusMinus, scoreToMod, skillToAbilityMap, getMods, getMonsterProf } from "@/5eReference/converters";
import { DiceRoller } from "@dice-roller/rpg-dice-roller";
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '@/amplify/data/resource';
import { createDefaultKnightStatblock } from "@/5eReference/monsterStatblockGenerator";
import type { SkillName } from "@/5eReference/converters";

const client = generateClient<Schema>();
type MyMonsterStatblock = Schema['MonsterStatblock']['type'];
type MyMonsterAbility = Schema['MonsterAbility']['type'];
type MyMonsterAttack = Schema['MonsterAttack']['type'];

export const replaceDamageTags = (tagString: string, monsterData: MyMonsterStatblock) => {
  return tagString
    .replace('+[STR]', plusMinus(scoreToMod(monsterData.strength)))
    .replace('+[DEX]', plusMinus(scoreToMod(monsterData.dexterity)))
    .replace('+[CON]', plusMinus(scoreToMod(monsterData.constitution)))
    .replace('+[INT]', plusMinus(scoreToMod(monsterData.intelligence)))
    .replace('+[WIS]', plusMinus(scoreToMod(monsterData.wisdom)))
    .replace('+[CHA]', plusMinus(scoreToMod(monsterData.charisma)));
};

export const cleanMonster = (m: any) => {
  delete m.__typename;
  delete m.speed.__typename;
  delete m.skills.__typename;
  delete m.skill_proficiencies.__typename;
  m.special_abilities = m.special_abilities.map((ability: any) => { delete ability.__typename; return ability; });
  m.actions = m.actions.map((action: any) => { delete action.__typename; return action; });
  m.reactions = m.reactions.map((ability: any) => { delete ability.__typename; return ability; });
  m.bonus_actions = m.bonus_actions.map((ability: any) => { delete ability.__typename; return ability; });
  m.legendary_actions = m.legendary_actions.map((ability: any) => { delete ability.__typename; return ability; });
  m.mythic_actions = m.mythic_actions.map((ability: any) => { delete ability.__typename; return ability; });
  delete m.updatedAt;
  return m;
};

export const descAttack = (monsterData: MyMonsterStatblock, attack: MyMonsterAttack): ReactElement => {
  const getRange = () => {
    switch (attack.type) {
      case "Melee Weapon Attack": return `reach ${attack.reach} ft.`;
      case "Melee Spell Attack": return `reach ${attack.reach} ft.`;
      case "Ranged Weapon Attack": return `ranged ${attack.short_range}/${attack.long_range} ft.`;
      case "Ranged Spell Attack": return `ranged ${attack.short_range} ft.`;
      case "Melee or Ranged Weapon Attack": return `reach ${attack.reach} ft. or ranged ${attack.short_range}/${attack.long_range} ft.`;
      default: console.error(`Invalid type for action ${attack}`); return "";
    }
  };

  const getDamage = () => {
    if (!attack.damage || attack.damage.length === 0) return 'N/A';
    const damage = [...attack.damage];
    const roller = new DiceRoller();
    const damageString = damage.reduce<string>((acc, curr) => {
      if (!curr) return acc;
      const damage_dice = replaceDamageTags(curr.damage_dice, monsterData);
      if (damage_dice) {
        const diceRoll = roller.roll(damage_dice);
        const average = Array.isArray(diceRoll) ? diceRoll[0].averageTotal : diceRoll.averageTotal;
        acc += `${Math.floor(average)} (${damage_dice}) ${curr.damage_type} damage plus `;
      }
      return acc;
    }, '');
    return damageString.slice(0, -6);
  };

  if (attack && monsterData)
    return (
      <>
        <strong>{attack.name}&nbsp;</strong>{attack.type}:
        {getToHit(monsterData, attack)} to hit, {getRange()} Hit: {getDamage()}. {attack.effect}
      </>
    );
  else return <></>;
};

interface MonsterSheetProps {
  slug?: string;
  statblock?: MyMonsterStatblock;
  printRef?: React.RefObject<HTMLDivElement>;
  rollable?: boolean;
  playerId?: string;
  gameId?: string;
}

const MonsterSheet: React.FC<MonsterSheetProps> = ({ slug, statblock, printRef }) => {
  const defaultStatblock = createDefaultKnightStatblock("knight", "default-publisher");
  const [monsterData, setMonsterData] = useState<MyMonsterStatblock>(defaultStatblock);

  useEffect(() => {
    async function fetchData() {
      if (!slug) return;
      const { data } = await client.models.MonsterStatblock.get({ id: slug });
      if (data) setMonsterData(cleanMonster(data));
    }
    if (statblock) setMonsterData(statblock);
    else fetchData();
  }, [slug, statblock]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const formatXP = (xp: number | undefined) => xp != null ? xp.toLocaleString() : '—';

  const crToString = (cr: number) => {
    if (cr === 0.125) return '1/8';
    if (cr === 0.25) return '1/4';
    if (cr === 0.5) return '1/2';
    return String(cr);
  };

  const getSpeed = () => {
    if (!monsterData.speed) return null;
    let s = "";
    for (const [key, value] of Object.entries(monsterData.speed)) {
      if (key === "walk" && value) s += `${value} ft., `;
      else if (value) s += `${key} ${value} ft., `;
    }
    return s.slice(0, -2);
  };

  const getInitiative = () => {
    const dexMod = scoreToMod(monsterData.dexterity);
    const pb = getMonsterProf(monsterData.cr);
    const mod = dexMod + pb;
    return { mod, score: 10 + mod };
  };

  const getAbilityTable55 = () => {
    const mods = getMods(monsterData);
    const abilities = [
      { label: 'STR', score: monsterData.strength,     mod: mods.strength,     save: monsterData.strength_save     ?? mods.strength },
      { label: 'DEX', score: monsterData.dexterity,    mod: mods.dexterity,    save: monsterData.dexterity_save    ?? mods.dexterity },
      { label: 'CON', score: monsterData.constitution, mod: mods.constitution, save: monsterData.constitution_save ?? mods.constitution },
      { label: 'INT', score: monsterData.intelligence, mod: mods.intelligence, save: monsterData.intelligence_save ?? mods.intelligence },
      { label: 'WIS', score: monsterData.wisdom,       mod: mods.wisdom,       save: monsterData.wisdom_save       ?? mods.wisdom },
      { label: 'CHA', score: monsterData.charisma,     mod: mods.charisma,     save: monsterData.charisma_save     ?? mods.charisma },
    ];

    const renderHalf = (half: typeof abilities) => (
      <table className={styles.abilityTable55}>
        <thead>
          <tr>
            <th></th>
            {half.map(a => <th key={a.label}>{a.label}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Score</td>
            {half.map(a => <td key={a.label}>{a.score}</td>)}
          </tr>
          <tr>
            <td>Mod</td>
            {half.map(a => <td key={a.label}>{plusMinus(a.mod)}</td>)}
          </tr>
          <tr>
            <td>Save</td>
            {half.map(a => (
              <td key={a.label} className={a.save !== a.mod ? styles.saveProficient : ''}>
                {plusMinus(a.save)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    );

    return (
      <div className={styles.abilityHalves}>
        {renderHalf(abilities.slice(0, 3))}
        {renderHalf(abilities.slice(3))}
      </div>
    );
  };

  const getSkills = () => {
    const mods = getMods(monsterData);
    if (!monsterData.skills) return null;
    let s = "";
    for (const [skill, mod] of Object.entries(monsterData.skills)) {
      if (mod && mod !== mods[skillToAbilityMap[skill as SkillName]]) {
        const label = skill.charAt(0).toUpperCase() + skill.slice(1);
        s += `${label.replace('_', ' ')} ${plusMinus(mod)}, `;
      }
    }
    s = s.slice(0, -2);
    return s ? <div><span className={styles.bold}>Skills </span><span>{s}</span></div> : null;
  };

  const getDamageVulnerabilities = () => {
    if (!monsterData.damage_vulnerabilities) return null;
    return <div><span className={styles.bold}>Damage Vulnerabilities </span><span>{monsterData.damage_vulnerabilities}</span></div>;
  };

  const getDamageResistances = () => {
    if (!monsterData.damage_resistances) return null;
    return <div><span className={styles.bold}>Damage Resistances </span><span>{monsterData.damage_resistances}</span></div>;
  };

  const getDamageImmunities = () => {
    if (!monsterData.damage_immunities) return null;
    return <div><span className={styles.bold}>Damage Immunities </span><span>{monsterData.damage_immunities}</span></div>;
  };

  const getConditionImmunities = () => {
    if (!monsterData.condition_immunities) return null;
    return <div><span className={styles.bold}>Condition Immunities </span><span>{monsterData.condition_immunities}</span></div>;
  };

  const getSenses = () => {
    if (!monsterData.senses) return null;
    return <div><span className={styles.bold}>Senses </span><span>{monsterData.senses}</span></div>;
  };

  const getLanguages = () => {
    if (!monsterData.languages) return null;
    return <div><span className={styles.bold}>Languages </span><span>{monsterData.languages}</span></div>;
  };

  const getCR = () => {
    if (!monsterData.cr) return null;
    const xp = crToXP(monsterData.cr);
    const pb = getMonsterProf(monsterData.cr);
    return (
      <div>
        <span className={styles.bold}>CR </span>
        <span>{crToString(monsterData.cr)} (XP {formatXP(xp)}; PB {plusMinus(pb)})</span>
      </div>
    );
  };

  const getAbilities = (abilityList?: (MyMonsterAbility | null | undefined)[] | null) => {
    if (!abilityList || abilityList.length === 0) return null;
    return abilityList.filter((a): a is MyMonsterAbility => a != null).map(ability => (
      <div key={monsterData.name + ability.name} className={styles.abilities}>
        <span className={styles.abilityname}>{ability.name}. </span>
        <span style={{ whiteSpace: 'pre-wrap' }}>{ability.desc}</span>
      </div>
    ));
  };

  const getActions = () => {
    if (!monsterData.actions) return null;
    return monsterData.actions.map((action, i) => {
      if (!action) return null;
      if (action.type === "Ability" || !action.attack_bonus) {
        return (
          <div key={monsterData.name + action.name + i} className={styles.abilities}>
            <span className={styles.abilityname}>{action.name}. </span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{action.desc}</span>
          </div>
        );
      }
      return (
        <div key={monsterData.name + action.name + i} className={styles.abilities}>
          <label style={{ width: "120px" }} className={styles.labelButton}>
            {descAttack(monsterData, action)}
          </label>
        </div>
      );
    });
  };

  const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <>
      <div className={styles.sectionHeader}>{children}</div>
      <div className={styles.hr}></div>
    </>
  );

  const getBonusActions = () => {
    if (!monsterData.bonus_actions || monsterData.bonus_actions.length === 0) return null;
    return (
      <div>
        <SectionHeader>Bonus Actions</SectionHeader>
        {monsterData.bonus_actions.map(a => {
          if (!a) return null;
          return (
            <div key={a.name} className={styles.abilities}>
              <span className={styles.abilityname}>{a.name}. </span>
              <span>{a.desc}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const getReactions = () => {
    if (!monsterData.reactions || monsterData.reactions.length === 0) return null;
    return (
      <div>
        <SectionHeader>Reactions</SectionHeader>
        {monsterData.reactions.map(a => {
          if (!a) return null;
          return (
            <div key={a.name} className={styles.abilities}>
              <span className={styles.abilityname}>{a.name}. </span>
              <span>{a.desc}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const getLegendaryActions = () => {
    if (!monsterData.legendary_actions || monsterData.legendary_actions.length === 0) return null;
    return (
      <div>
        <SectionHeader>Legendary Actions</SectionHeader>
        {monsterData.legendary_desc && (
          <p style={{ fontStyle: 'italic', margin: '4px 0 6px 0', fontSize: '0.9em' }}>
            {monsterData.legendary_desc}
          </p>
        )}
        {monsterData.legendary_actions.map(a => {
          if (!a) return null;
          return (
            <div key={a.name} className={styles.abilities}>
              <span className={styles.abilityname}>{a.name}. </span>
              <span>{a.desc}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const getMythicActions = () => {
    if (!monsterData.mythic_actions || monsterData.mythic_actions.length === 0) return null;
    return (
      <div>
        <SectionHeader>Mythic Actions</SectionHeader>
        {monsterData.mythic_desc && (
          <p style={{ fontStyle: 'italic', margin: '4px 0 6px 0', fontSize: '0.9em' }}>
            {monsterData.mythic_desc}
          </p>
        )}
        {monsterData.mythic_actions.map(a => {
          if (!a) return null;
          return (
            <div key={a.name} className={styles.abilities}>
              <span className={styles.abilityname}>{a.name}. </span>
              <span>{a.desc}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (!monsterData) return null;

  const { mod: initMod, score: initScore } = getInitiative();
  const hasTraits = !!(monsterData.special_abilities?.filter(Boolean).length);

  return (
    <div className={styles.monsterSheetContainer} ref={printRef}>
      {/* ── Full-width header ── */}
      <div className={styles.name}>{monsterData.name}</div>
      <div className={styles.description}>
        {monsterData.size} {monsterData.type}
        {monsterData.subtype ? ` (${monsterData.subtype})` : ''}, {monsterData.alignment}
      </div>
      <div className={styles.gradient}></div>

      {/* ── Two-column body ── */}
      <div className={styles.twoColumn}>

        {/* Left column: stats + traits */}
        <div>
          <div>
            <span className={`${styles.bold} ${styles.red}`}>AC</span>{' '}
            {monsterData.armor_class}{monsterData.armor_desc ? ` (${monsterData.armor_desc})` : ''}
            {'   '}
            <span className={`${styles.bold} ${styles.red}`}>Initiative</span>{' '}
            {plusMinus(initMod)} ({initScore})
          </div>
          <div>
            <span className={`${styles.bold} ${styles.red}`}>HP</span>{' '}
            {monsterData.hit_points}{monsterData.hit_dice ? ` (${monsterData.hit_dice})` : ''}
          </div>
          <div>
            <span className={`${styles.bold} ${styles.red}`}>Speed</span>{' '}
            {getSpeed()}
          </div>

          <div className={styles.gradient}></div>
          {getAbilityTable55()}
          <div className={styles.gradient}></div>

          {getSkills()}
          {getDamageVulnerabilities()}
          {getDamageResistances()}
          {getDamageImmunities()}
          {getConditionImmunities()}
          {getSenses()}
          {getLanguages()}
          {getCR()}

          {hasTraits && (
            <>
              <div className={styles.gradient}></div>
              <SectionHeader>Traits</SectionHeader>
              {getAbilities(monsterData.special_abilities)}
            </>
          )}
        </div>

        {/* Right column: actions */}
        <div>
          <SectionHeader>Actions</SectionHeader>
          {getActions()}
          {getBonusActions()}
          {getReactions()}
          {getLegendaryActions()}
          {getMythicActions()}
        </div>

      </div>
    </div>
  );
};

export default MonsterSheet;
