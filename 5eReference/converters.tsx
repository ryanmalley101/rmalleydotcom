import { type Schema } from '@/amplify/data/resource';
type MyMonsterStatblock = Schema['MonsterStatblock']['type'];
type MyMonsterAttack = Schema['MonsterAttack']['type'];

// Input skill flags are based on SkillProfs (string for true/expertise)
type InputSkillProfs = NonNullable<MyMonsterStatblock['skill_proficiencies']>;

// Output calculated skills are based on SkillMods (integer for bonus)
type OutputSkillMods = NonNullable<MyMonsterStatblock['skills']>;
type SkillName = keyof OutputSkillMods;
type AbilityScores = {
    strength: number; dexterity: number; constitution: number;
    intelligence: number; wisdom: number; charisma: number;
};

const plusMinus = (val:number) : string => {
    return val < 0 ? `${val.toString()}` : `+${val.toString()}`
}

const scoreToMod = (score:number): number => {
    return Math.floor((Number(score) - 10) / 2)
}

const getMonsterProf = (cr:number) => {
    return Math.max(Math.floor((Number(cr) - 1) / 4), 0) + 2
}

const crToXP = (cr: number) : number => {
    const CR_TO_XP_TABLE: Record<string, number> = {
        "0": 0,
        "0.125": 25,
        "0.25": 50,
        "0.5": 100,
        "1": 200,
        "2": 450,
        "3": 700,
        "4": 1100,
        "5": 1800,
        "6": 2300,
        "7": 2900,
        "8": 3900,
        "9": 5000,
        "10": 5900,
        "11": 7200,
        "12": 8400,
        "13": 10000,
        "14": 11500,
        "15": 13000,
        "16": 15000,
        "17": 18000,
        "18": 20000,
        "19": 22000,
        "20": 25000,
        "21": 33000,
        "22": 41000,
        "23": 50000,
        "24": 62000,
        "25": 76000,
        "26": 90000,
        "27": 105000,
        "28": 120000,
        "29": 137000,
        "30": 155000
    }
    return CR_TO_XP_TABLE[cr.toString()]
}


const skillToAbilityMap: Record<SkillName, keyof AbilityScores> = {
    acrobatics: 'dexterity',
    animal_handling: 'wisdom',
    arcana: 'intelligence',
    athletics: 'strength',
    deception: 'charisma',
    history: 'intelligence',
    insight: 'wisdom',
    intimidation: 'charisma',
    investigation: 'intelligence',
    medicine: 'wisdom',
    nature: 'intelligence',
    perception: 'wisdom',
    performance: 'charisma',
    persuasion: 'charisma',
    religion: 'intelligence',
    sleight_of_hand: 'dexterity',
    stealth: 'dexterity',
    survival: 'wisdom',
};

const getToHit = (monsterData:MyMonsterStatblock, attack:MyMonsterAttack) : string | null => {
    if (!attack.attack_bonus) {
        return null
    }

    console.log(attack)

    if (Number(attack.attack_bonus)) {
        return plusMinus(Number(attack.attack_bonus))
    }

    const prof = getMonsterProf(monsterData.cr)
    const additional_bonus_patterns = /\]\+\s*(\d+)/
    const bonus_match = attack.attack_bonus.toString().match(additional_bonus_patterns)
    let hit_bonus = 0
 
    if (bonus_match) {
        console.log(bonus_match)
        hit_bonus = hit_bonus + Number(bonus_match[1])
    }

    const bracket_pattern = /\[(.*?)\]/
    const match = attack.attack_bonus.toString().match(bracket_pattern)
    console.log(match)
    if (match) {
        const values = match[1].split(/\s+/)
        return plusMinus(
            values.reduce((accumulator, currentValue) : number => {
                switch (currentValue) {
                    case "STR":
                        return accumulator + Number(scoreToMod(monsterData.strength))
                    case "DEX":
                        return accumulator + Number(scoreToMod(monsterData.dexterity))
                    case "CON":
                        return accumulator + Number(scoreToMod(monsterData.constitution))
                    case "INT":
                        return accumulator + Number(scoreToMod(monsterData.intelligence))
                    case "WIS":
                        return accumulator + Number(scoreToMod(monsterData.wisdom))
                    case "CHA":
                        return accumulator + Number(scoreToMod(monsterData.charisma))
                    case "ATK":
                        return accumulator + prof
                    default:
                        console.error("Invalid to hit identifier ")
                        return 0
                }
            }, hit_bonus)
        )

    }
    return null

    // console.error("Attack bonus is neither an integer nor a valid shorthand like [STR ATK]")
}



// --- NEW Internal Helper Function for Ability Mods ---

/**
 * Calculates all six ability modifiers from the monster's raw scores.
 */
const getMods = (monster: MyMonsterStatblock): AbilityScores => ({
    strength: scoreToMod(monster.strength),
    dexterity: scoreToMod(monster.dexterity),
    constitution: scoreToMod(monster.constitution),
    intelligence: scoreToMod(monster.intelligence),
    wisdom: scoreToMod(monster.wisdom),
    charisma: scoreToMod(monster.charisma),
});

const getPassivePerception = (monsterStatblock: MyMonsterStatblock) => {
    if (!monsterStatblock.skill_proficiencies || !monsterStatblock.skill_proficiencies["perception"]) {
        return 10 + Number(scoreToMod(monsterStatblock.wisdom))
    }
    if (monsterStatblock.skill_proficiencies["perception"] == "proficient") {
        return monsterStatblock.wisdom + getMonsterProf(monsterStatblock.cr)
    }
    return monsterStatblock.wisdom + (getMonsterProf(monsterStatblock.cr) * 2)
}

// --- Helper Functions Extracted from useEffect Logic (Refactored) ---

/**
 * Calculates the final skill bonus object for the monster.
 * @param monster The full MyMonsterStatblock object.
 */
const calculateSkills = (monster: MyMonsterStatblock): OutputSkillMods => {
    // Derive dependencies internally from the monster object
    const prof = getMonsterProf(monster.cr);
    const mods = getMods(monster);

    // The calculated skills object will store the final number bonus
    const calculatedSkills: Partial<OutputSkillMods> = {};
    const inputProfs = monster.skill_proficiencies || {} as InputSkillProfs; // Ensure we handle potentially null input

    for (const skillName of Object.keys(skillToAbilityMap) as SkillName[]) {
        const abilityName = skillToAbilityMap[skillName];
        const abilityMod = mods[abilityName];
        let bonus = abilityMod;

        // Ensure profStatus is read as a string for comparison
        const profStatus = inputProfs[skillName as keyof InputSkillProfs] as string | undefined;

        // Apply expertise (double proficiency) first
        if (profStatus === 'expertise') {
            bonus += 2 * prof;
        }
        // Apply single proficiency bonus (handles both boolean true and string 'true')
        else if (profStatus === "proficient") {
            bonus += prof;
        }

        // Set the calculated bonus
        calculatedSkills[skillName] = bonus;
    }

    return calculatedSkills as OutputSkillMods;
};

/**
 * Calculates all six saving throw scores.
 * @param monster The full MyMonsterStatblock object.
 */
const calculateSaves = (monster: MyMonsterStatblock) => {
    // Derive dependencies internally from the monster object
    const prof = getMonsterProf(monster.cr);
    const mods = getMods(monster);

    // Initialize the saves object with the correct final structure
    const saves: { 
        strength_save: number; dexterity_save: number; constitution_save: number; 
        intelligence_save: number; wisdom_save: number; charisma_save: number; 
    } = {
        strength_save: 0,
        dexterity_save: 0,
        constitution_save: 0,
        intelligence_save: 0,
        wisdom_save: 0,
        charisma_save: 0,
    };
    
    // Map of ability names to their save field names
    const abilityToSave: Record<keyof AbilityScores, keyof typeof saves> = {
        strength: 'strength_save',
        dexterity: 'dexterity_save',
        constitution: 'constitution_save',
        intelligence: 'intelligence_save',
        wisdom: 'wisdom_save',
        charisma: 'charisma_save',
    };

    (Object.keys(abilityToSave) as Array<keyof AbilityScores>).forEach(ability => {
        const saveKey = abilityToSave[ability];
        const abilityMod = mods[ability];
        
        let saveScore = abilityMod;
        
        // Add proficiency if the ability name exists in the save_proficiencies list (which is a string array)
        if (monster.save_proficiencies && monster.save_proficiencies.includes(ability)) {
            saveScore += prof;
        }
        
        // The assignment is now safe because 'saves' is guaranteed to have these keys as 'number'
        saves[saveKey] = saveScore;
    });

    // Return the correctly typed object
    return saves;
};

/**
 * Calculates the Passive Perception score based on the FINAL calculated Perception bonus.
 * NOTE: This function still requires the calculated skill scores object.
 */
const calculatePassivePerception = (calculatedSkills: OutputSkillMods): number => {
    // We use the final calculated bonus for Perception (which is Mod + Prof/Expertise)
    const perceptionBonus = calculatedSkills.perception || 0;

    // Base is 10 + bonus
    return 10 + perceptionBonus;
};


/**
 * Converts raw sense values into the required descriptive string format (e.g., "blindsight 60 ft., darkvision 120 ft.").
 */
const getSensesString = (monster: MyMonsterStatblock): string => {
    const senses: string[] = [];

    if (monster.blindsight && monster.blindsight > 0) {
        senses.push(`blindsight ${monster.blindsight} ft.${monster.blindBeyond ? ' (blind beyond this radius)' : ''}`);
    }
    if (monster.darkvision && monster.darkvision > 0) {
        senses.push(`darkvision ${monster.darkvision} ft.`);
    }
    if (monster.tremorsense && monster.tremorsense > 0) {
        senses.push(`tremorsense ${monster.tremorsense} ft.`);
    }
    if (monster.truesight && monster.truesight > 0) {
        senses.push(`truesight ${monster.truesight} ft.`);
    }

    // // Add custom senses if available
    // if (monster.senses && monster.senses.trim() !== '') {
    //     // Filter out any senses already handled above to prevent duplication
    //     const customSenses = monster.senses.split(',').filter(s =>
    //         !s.toLowerCase().includes('blindsight') &&
    //         !s.toLowerCase().includes('darkvision') &&
    //         !s.toLowerCase().includes('tremorsense') &&
    //         !s.toLowerCase().includes('truesight')
    //     ).map(s => s.trim());
    //     senses.push(...customSenses);
    // }


    senses.push(`passive Perception ${getPassivePerception(monster)}`);

    return senses.join(', ');
};

/**
 * Main function to calculate all dependent stats in one go.
 */
export const calculateDependentStats = (monster: MyMonsterStatblock): Partial<MyMonsterStatblock> => {

    // The main function's body is now much simpler, delegating calculation

    // 1. Calculate Saving Throws 
    const saves = calculateSaves(monster);

    // 2. Calculate Skills (this returns the final numerical bonuses)
    const newSkillProficiencies = calculateSkills(monster);

    // 3. Calculate Passive Perception using the calculated skill bonus
    const passivePerception = calculatePassivePerception(newSkillProficiencies);

    // 4. Generate the Senses String
    const senses = getSensesString(monster);

    // 5. Join lists into required statblock strings (using generic string maps for types not provided)
    const damageVulnerabilities = monster.damage_vulnerability_list ? monster.damage_vulnerability_list.join(', ') : ""
    const damageResistances = monster.damage_resistance_list ? monster.damage_resistance_list.join(', ') : ""
    const damageImmunities = monster.damage_immunity_list ? monster.damage_immunity_list.join(', ') : ""
    const conditionImmunities = monster.condition_immunity_list ? monster.condition_immunity_list.join(', ') : ""

    // 6. Return the object of all derived fields
    return {
        ...saves,
        skills: newSkillProficiencies,
        perception: passivePerception,
        senses: senses,
        damage_vulnerabilities: damageVulnerabilities,
        damage_resistances: damageResistances,
        damage_immunities: damageImmunities,
        condition_immunities: conditionImmunities,
    };
};


export {crToXP, scoreToMod, getMonsterProf, getToHit, plusMinus, getMods, skillToAbilityMap}
export type {SkillName}