import React, {ReactElement, useEffect, useState} from "react";
import styles from "@/styles/MonsterSheet.module.css"
import {crToXP, getToHit, plusMinus, scoreToMod, skillToAbilityMap} from "@/5eReference/converters";
import { DiceRoller } from "@dice-roller/rpg-dice-roller";
// import {rollAttack} from "@/messageUtilities/mailroom";
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '@/amplify/data/resource';
import { createDefaultKnightStatblock } from "@/5eReference/monsterStatblockGenerator";
import { getMods } from "@/5eReference/converters"
import type { SkillName } from "@/5eReference/converters";
const client = generateClient<Schema>();
type MyMonsterStatblock = Schema['MonsterStatblock']['type'];
type MyMonsterAbility = Schema['MonsterAbility']['type'];
type MyMonsterAttack = Schema['MonsterAttack']['type'];
type MyDamage = Schema['DamageDice']['type'];

export const replaceDamageTags = (tagString:string, monsterData:MyMonsterStatblock) => {
  return tagString
    .replace('+[STR]', plusMinus(scoreToMod(monsterData.strength)))
    .replace('+[DEX]', plusMinus(scoreToMod(monsterData.dexterity)))
    .replace('+[CON]', plusMinus(scoreToMod(monsterData.constitution)))
    .replace('+[INT]', plusMinus(scoreToMod(monsterData.intelligence)))
    .replace('+[WIS]', plusMinus(scoreToMod(monsterData.wisdom)))
    .replace('+[CHA]', plusMinus(scoreToMod(monsterData.charisma)))
}

// Get rid of __typenames just so I can stick with the auto generated mutations
export const cleanMonster = (m:any) => {
  delete m.__typename
  delete m.speed.__typename
  delete m.skills.__typename
  delete m.skill_proficiencies.__typename
  m.special_abilities = m.special_abilities.map((ability:any) => {
    delete ability.__typename
    return ability
  })
  m.actions = m.actions.map((action:any) => {
    delete action.__typename
    return action
  })
  m.reactions = m.reactions.map((ability:any) => {
    delete ability.__typename
    return ability
  })
  m.bonus_actions = m.bonus_actions.map((ability:any) => {
    delete ability.__typename
    return ability
  })
  m.legendary_actions = m.legendary_actions.map((ability:any) => {
    delete ability.__typename
    return ability
  })
  m.mythic_actions = m.mythic_actions.map((ability:any) => {
    delete ability.__typename
    return ability
  })
  delete m.updatedAt
  return m
}

export const descAttack = (monsterData:MyMonsterStatblock, attack:MyMonsterAttack) : ReactElement => {
  const getRange = () => {
    switch (attack.type) {
      case "Melee Weapon Attack":
        return `reach ${attack.reach} ft.`
      case "Melee Spell Attack":
        return `reach ${attack.reach} ft.`
      case "Ranged Weapon Attack":
        return `ranged ${attack.short_range}/${attack.long_range} ft.`
      case "Ranged Spell Attack":
        return `ranged ${attack.short_range} ft.`
      case "Melee or Ranged Weapon Attack":
        return `reach ${attack.reach} ft. or ranged ${attack.short_range}/${attack.long_range} ft.`
      default:
        console.error(`Invalid type for action ${attack}`)
        return ""
    }
  }

  const getDamage = () => {
    if (!attack.damage || attack.damage.length === 0) {
      return 'N/A'
    }
    const damage = [...attack.damage]
    const initialText = ''
    const roller = new DiceRoller()
    const damageString = damage.reduce<string>((accumulator, currentValue) => {
      if (!currentValue) return accumulator;
      const damage_dice = replaceDamageTags(currentValue.damage_dice, monsterData)
      console.log(damage_dice)
      if (damage_dice) {
        const diceRoll = roller.roll(damage_dice)
        const average = Array.isArray(diceRoll) ? diceRoll[0].averageTotal : diceRoll.averageTotal
        accumulator += `${Math.floor(average)} (${damage_dice}) ${currentValue.damage_type} damage plus `
      }
      return accumulator
    }, initialText)

    // Trim the last " plus" from the damage tags
    return damageString.slice(0, -6)
  }


  if (attack && monsterData) 
    return <>
        <strong>{attack.name}&nbsp;</strong>{attack.type}:
        {getToHit(monsterData, attack)} to hit, {getRange()} Hit: {getDamage()}. {attack.effect}
      </>
  else return <> </>
}

interface MonsterSheetProps {
  slug?: string;
  statblock?: MyMonsterStatblock;
  printRef?: React.RefObject<HTMLDivElement>;
  rollable?: boolean;
  playerId?: string;
  gameId?: string;
}


const MonsterSheet: React.FC<MonsterSheetProps> = ({slug, statblock, printRef, rollable, playerId, gameId}) => {
  const defaultStatblock = createDefaultKnightStatblock("default-publisher");
  const [monsterData, setMonsterData] = useState<MyMonsterStatblock>(defaultStatblock);

  useEffect(() => {
    async function fetchData() {
      console.log(slug)

      if (!slug) {
        console.error("No slug provided for MonsterSheet fetchData")
        return
      }

      const { data, errors } = await client.models.MonsterStatblock.get({
        id: slug
      });

      console.log(data)
      if (data){
        setMonsterData(cleanMonster(data))
      }
      //
      // const response = await fetch(`https://api.open5e.com/v1/monsters/?slug__in=&slug__iexact=${slug}`);
      // const data = await response.json()
      // console.log(data.results[0])
      //
      // // Validate the API response against the schema
      // // const isValid = validate(data, Monster);
      // const isValid = true
      // if (isValid) {
      //     setMonsterData(data.results[0]);
      // }
    }

    if (statblock) {
      setMonsterData(statblock)
    } else {
      fetchData();
    }
  }, [slug, statblock]);

  const getSpeed = () => {
    if (!monsterData.speed) {
      return null
    }
    let speedString = ""
    for (const [key, value] of Object.entries(monsterData.speed)) {
      if (key === "walk" && value) {
        speedString = speedString.concat(value.toString(), ' ft., ')
      } else if (value) {
        speedString = speedString.concat(key, " ", value.toString(), ' ft., ')
      }
    }
    speedString = speedString.substring(0, speedString.length - 2)
    return speedString
  }

  const getAbilityScores = () => {

    if (rollable) {
      return (
        <table className={styles.attributes}>
          <tbody>
          <tr>
            <th>STR</th>
            <th>DEX</th>
            <th>CON</th>
            <th>INT</th>
            <th>WIS</th>
            <th>CHA</th>
          </tr>
          <tr>
            <td>{monsterData.strength} ({scoreToMod(monsterData.strength)})</td>
            <td>{monsterData.dexterity} ({scoreToMod(monsterData.dexterity)})</td>
            <td>{monsterData.constitution} ({scoreToMod(monsterData.constitution)})</td>
            <td>{monsterData.intelligence} ({scoreToMod(monsterData.intelligence)})</td>
            <td>{monsterData.wisdom} ({scoreToMod(monsterData.wisdom)})</td>
            <td>{monsterData.charisma} ({scoreToMod(monsterData.charisma)})</td>
          </tr>
          </tbody>
        </table>
      )
    }

    return (
      <table className={styles.attributes}>
        <tbody>
        <tr>
          <th>STR</th>
          <th>DEX</th>
          <th>CON</th>
          <th>INT</th>
          <th>WIS</th>
          <th>CHA</th>
        </tr>
        <tr>
          <td>{monsterData.strength} ({scoreToMod(monsterData.strength)})</td>
          <td>{monsterData.dexterity} ({scoreToMod(monsterData.dexterity)})</td>
          <td>{monsterData.constitution} ({scoreToMod(monsterData.constitution)})</td>
          <td>{monsterData.intelligence} ({scoreToMod(monsterData.intelligence)})</td>
          <td>{monsterData.wisdom} ({scoreToMod(monsterData.wisdom)})</td>
          <td>{monsterData.charisma} ({scoreToMod(monsterData.charisma)})</td>
        </tr>
        </tbody>
      </table>
    )
  }

  const getSaves = () => {
    let saveStr = ""

    const mods = getMods(monsterData)

    const strSave = monsterData.strength_save ?? mods["strength"]
    const dexSave = monsterData.dexterity_save ?? mods["dexterity"]
    const conSave = monsterData.constitution_save ?? mods["wisdom"]
    const intSave = monsterData.intelligence_save ?? mods["wisdom"]
    const wisSave = monsterData.wisdom_save ?? mods["intelligence"]
    const chaSave = monsterData.charisma_save ??  mods["charisma"]

    if (!strSave && !dexSave && !conSave && !intSave && !wisSave && !chaSave) {
      return null
    }
    if (strSave !== mods["strength"]) {
      saveStr += `STR ${plusMinus(strSave)}, `
    }
    if (dexSave !== mods["dexterity"]) {
      saveStr += `DEX ${plusMinus(dexSave)}, `
    }
    if (conSave !== mods["constitution"]) {
      saveStr += `CON ${plusMinus(conSave)}, `
    }
    if (intSave !== mods["intelligence"]) {
      saveStr += `INT ${plusMinus(intSave)}, `
    }
    if (wisSave !== mods["wisdom"]) {
      saveStr += `WIS ${plusMinus(wisSave)}, `
    }
    if (chaSave !== mods["charisma"]) {
      saveStr += `CHA ${plusMinus(chaSave)}, `
    }
    saveStr = saveStr.substring(0, saveStr.length - 2)
    return <div><span className={styles.bold}>Saving Throws </span><span>{saveStr}</span></div>
  }

  const getSkills = () => {
    const mods = getMods(monsterData)

    if (!monsterData.skills) {
      return null
    }
    let skillStr = ""
    for (const [skill, mod] of Object.entries(monsterData.skills)) {
      if (mod && mod !== mods[skillToAbilityMap[skill as SkillName]]) {
        const upperCaseValue = skill.toString().charAt(0).toUpperCase() + skill.toString().slice(1)
        skillStr = skillStr.concat(upperCaseValue, " ", plusMinus(mod), ', ').replace('_', ' ')
      }
    }
    skillStr = skillStr.substring(0, skillStr.length - 2)
    if (skillStr) {
      return <div><span className={styles.bold}>Skills </span><span>{skillStr}</span></div>
    } else {
      return null
    }
  }

  const getDamageVulnerabilities = () => {
    if (!monsterData.damage_vulnerabilities) {
      return null
    }
    return <div><span
      className={styles.bold}>Damage Vulnerabilities </span><span>{monsterData.damage_vulnerabilities}</span>
    </div>
  }

  const getDamageResistances = () => {
    if (!monsterData.damage_resistances) {
      return null
    }
    return <div><span
      className={styles.bold}>Damage Resistances </span><span>{monsterData.damage_resistances}</span>
    </div>
  }

  const getDamageImmunities = () => {
    if (!monsterData.damage_immunities) {
      return null
    }
    return <div><span className={styles.bold}>Damage Immunities </span><span>{monsterData.damage_immunities}</span>
    </div>
  }

  const getConditionImmunities = () => {
    if (!monsterData.condition_immunities) {
      return null
    }
    return <div><span
      className={styles.bold}>Condition Immunities </span><span>{monsterData.condition_immunities}</span></div>
  }

  const getSenses = () => {
    if (!monsterData.senses) {
      return null
    }
    return <div><span className={styles.bold}>Senses</span><span> {monsterData.senses}</span></div>
  }

  const getLanguages = () => {
    if (!monsterData.languages) {
      return null
    }
    return <div><span className={styles.bold}>Languages</span><span> {monsterData.languages}</span></div>
  }

  const getCR = () => {
    if (!monsterData.cr) {
      return null
    }
    return <div><span
      className={styles.bold}>Challenge</span><span> {monsterData.cr} ({crToXP(monsterData.cr)} XP)</span></div>
  }

  const getAbilities = (abilityList?: (MyMonsterAbility | null | undefined)[] | null | undefined) => {
    if (!abilityList || abilityList.length === 0) {
      return null
    }
    const items = abilityList.filter((a): a is MyMonsterAbility => a != null)
    return items.map((ability) => (
      <div key={monsterData.name + ability.name} className={styles.abilities}>
        <span className={styles.abilityname}>{ability.name}. </span>
        <span>{ability.desc}</span>
      </div>
    ))
  }

  // const handleAttackRoll = (attack) => {
  //   rollAttack(attack, monsterData, playerId, gameId, false)
  // }

  const getActions = () => {

    if (!monsterData.actions) {
      return null
    }
    let actionList = []
    for (const action of monsterData.actions) {
      // console.log(action)
      if (!action) {
        continue
      }
      else if (action.type === "Ability" || !action.attack_bonus) {
        actionList.push(
          <div key={monsterData.name + action.name} className={styles.abilities}>
            <span className={styles.abilityname}>{action.name}. </span>
            <span>{action.desc}</span>
          </div>
        )
      } else {
        const attack = descAttack(monsterData, action)
        actionList.push(
          <div key={monsterData.name + action.name} className={styles.abilities}>
            <label style={{width: "120px"}}
                   className={styles.labelButton} 
                  //  onClick={() => handleAttackRoll(action)}
                   >
                    {attack}
            </label>
          </div>
        )
      }
    }
    return actionList.map((action) => (action))
  }

  const getBonusActions = () => {
    if (!monsterData.bonus_actions || monsterData.bonus_actions.length === 0 ) {
      return null
    }
    else {
      return (
        <div>
          <div className={styles.actions + " " + styles.red}>Bonus Actions</div>
          <div className={styles.hr}></div>
          {monsterData.bonus_actions.map((bonusAction) => {
            if (!bonusAction) return null;
            return (
              <div key={bonusAction.name} className={styles.abilities}>
                <span className={styles.abilityname}>{bonusAction.name}. </span>
                <span>{bonusAction.desc}</span>
              </div>
            )
          })}
        </div>
      )
    }
  }


  const getReactions = () => {
    if (!monsterData.reactions || monsterData.reactions.length === 0) {
      return null
    }
    return (
      <div>
        <div className={styles.actions + " " + styles.red}>Reactions</div>
        <div className={styles.hr}></div>
        {monsterData.reactions.map((reaction) => {
          if (!reaction) return null;
          return (
            <div key={reaction.name} className={styles.abilities}>
              <span className={styles.abilityname}>{reaction.name}. </span>
              <span>{reaction.desc}</span>
            </div>
          )
      })}
      </div>
    )
  }

  const getLegendaryActions = () => {
    if (!monsterData.legendary_actions || monsterData.legendary_actions.length === 0) {
      return null
    }
    return (
      <div>
        <div className={styles.actions + " " + styles.red}>Legendary Actions</div>
        <div className={styles.hr}></div>
        {monsterData.legendary_desc}
        {monsterData.legendary_actions.map((reaction) => {
          if (!reaction) return null;
          return (
            <div key={reaction.name} className={styles.abilities}>
              <span className={styles.abilityname}>{reaction.name}. </span>
              <span>{reaction.desc}</span>
            </div>
        )})}
      </div>
    )
  }

  const getMythicActions = () => {
    if (!monsterData.mythic_actions || monsterData.mythic_actions.length === 0) {
      return null
    }
    return (
      <div>
        <div className={styles.actions + " " + styles.red}>Mythic Actions</div>
        <div className={styles.hr}></div>
        {monsterData.mythic_desc}
        {monsterData.mythic_actions.map((reaction) => {
          if (!reaction) return null;
          return (
          <div key={reaction.name} className={styles.abilities}>
            <span className={styles.abilityname}>{reaction.name}. </span>
            <span>{reaction.desc}</span>
          </div>
        )})}
      </div>
    )
  }

  if (!monsterData) {
    console.log('No monster data returned')
    return null
  } else {
    return (
      <div className={styles.monsterSheetContainer} ref={printRef}>
        <div className={styles.name}>{monsterData.name}</div>
        <div
          className={styles.description}>{monsterData.size} {monsterData.type}{monsterData.subtype ? ` ${monsterData.subtype}` : null}, {monsterData.alignment}</div>

        <div className={styles.gradient}></div>

        <div className="red">
          <div><span
            className={styles.bold + ' ' + styles.red}>Armor Class</span><span> {monsterData.armor_class} {monsterData.armor_desc ? `(${monsterData.armor_desc})` : null}</span>
          </div>
          <div><span
            className={styles.bold + ' ' + styles.red}>Hit Points</span><span> {monsterData.hit_points} ({monsterData.hit_dice})</span>
          </div>
          <div><span className={styles.bold + ' ' + styles.red}>Speed</span><span> {getSpeed()}</span></div>
        </div>

        <div className={styles.gradient}></div>
        {getAbilityScores()}

        <div className={styles.gradient}></div>
        {getSaves()}
        {getSkills()}
        {getDamageVulnerabilities()}
        {getDamageResistances()}
        {getDamageImmunities()}
        {getConditionImmunities()}
        {getSenses()}
        {getLanguages()}
        {getCR()}

        <div className={styles.gradient}></div>

        {getAbilities(monsterData.special_abilities)}

        <div className={styles.actions + " " + styles.red}>Actions</div>

        <div className={styles.hr}></div>
        {getActions()}
        {getBonusActions()}
        {getReactions()}
        {getLegendaryActions()}
        {getMythicActions()}
      </div>
    );
  }
}

export default MonsterSheet;
