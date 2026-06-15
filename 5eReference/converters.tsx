import { type Schema } from '@/amplify/data/resource';
type MyMonsterStatblock = Schema['MonsterStatblock']['type'];
type MyMonsterAttack = Schema['MonsterAttack']['type'];

type OutputSkillMods = NonNullable<MyMonsterStatblock['skills']>;
type SkillName = keyof OutputSkillMods;
type AbilityScores = {
    strength: number; dexterity: number; constitution: number;
    intelligence: number; wisdom: number; charisma: number;
};

const plusMinus = (val: number): string => val < 0 ? `${val}` : `+${val}`;

const scoreToMod = (score: number): number => Math.floor((Number(score) - 10) / 2);

const getMonsterProf = (cr: number) => Math.max(Math.floor((Number(cr) - 1) / 4), 0) + 2;

const crToXP = (cr: number): number => {
    const table: Record<string, number> = {
        "0": 0, "0.125": 25, "0.25": 50, "0.5": 100,
        "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800,
        "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900,
        "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000,
        "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000,
        "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 76000,
        "26": 90000, "27": 105000, "28": 120000, "29": 137000, "30": 155000,
    };
    return table[cr.toString()] ?? 0;
};

const skillToAbilityMap: Record<SkillName, keyof AbilityScores> = {
    acrobatics: 'dexterity',   animal_handling: 'wisdom',  arcana: 'intelligence',
    athletics:  'strength',    deception: 'charisma',      history: 'intelligence',
    insight:    'wisdom',      intimidation: 'charisma',   investigation: 'intelligence',
    medicine:   'wisdom',      nature: 'intelligence',     perception: 'wisdom',
    performance:'charisma',    persuasion: 'charisma',     religion: 'intelligence',
    sleight_of_hand: 'dexterity', stealth: 'dexterity',   survival: 'wisdom',
};

const getMods = (monster: MyMonsterStatblock): AbilityScores => ({
    strength:     scoreToMod(monster.strength),
    dexterity:    scoreToMod(monster.dexterity),
    constitution: scoreToMod(monster.constitution),
    intelligence: scoreToMod(monster.intelligence),
    wisdom:       scoreToMod(monster.wisdom),
    charisma:     scoreToMod(monster.charisma),
});

const getToHit = (monsterData: MyMonsterStatblock, attack: MyMonsterAttack): string | null => {
    if (!attack.attack_bonus) return null;

    if (Number(attack.attack_bonus)) return plusMinus(Number(attack.attack_bonus));

    const prof = getMonsterProf(monsterData.cr);
    const bonusMatch = attack.attack_bonus.toString().match(/\]\+\s*(\d+)/);
    let hit_bonus = bonusMatch ? Number(bonusMatch[1]) : 0;

    const bracketMatch = attack.attack_bonus.toString().match(/\[(.*?)\]/);
    if (bracketMatch) {
        const values = bracketMatch[1].split(/\s+/);
        return plusMinus(
            values.reduce((acc, v): number => {
                switch (v) {
                    case 'STR': return acc + scoreToMod(monsterData.strength);
                    case 'DEX': return acc + scoreToMod(monsterData.dexterity);
                    case 'CON': return acc + scoreToMod(monsterData.constitution);
                    case 'INT': return acc + scoreToMod(monsterData.intelligence);
                    case 'WIS': return acc + scoreToMod(monsterData.wisdom);
                    case 'CHA': return acc + scoreToMod(monsterData.charisma);
                    case 'ATK': return acc + prof;
                    default: return 0;
                }
            }, hit_bonus)
        );
    }
    return null;
};

const getSensesString = (monster: MyMonsterStatblock): string => {
    const parts: string[] = [];
    if (monster.blindsight && monster.blindsight > 0)
        parts.push(`blindsight ${monster.blindsight} ft.${monster.blindBeyond ? ' (blind beyond this radius)' : ''}`);
    if (monster.darkvision  && monster.darkvision  > 0) parts.push(`darkvision ${monster.darkvision} ft.`);
    if (monster.tremorsense && monster.tremorsense > 0) parts.push(`tremorsense ${monster.tremorsense} ft.`);
    if (monster.truesight   && monster.truesight   > 0) parts.push(`truesight ${monster.truesight} ft.`);
    parts.push(`passive Perception ${monster.perception ?? 10}`);
    return parts.join(', ');
};

/**
 * Recomputes derived display fields that depend on stored values.
 * Skills and saves are stored directly as integers — this only updates
 * senses string, passive perception (from skills.perception), and
 * the damage/condition display strings.
 */
export const calculateDependentStats = (monster: MyMonsterStatblock): Partial<MyMonsterStatblock> => {
    const perception = 10 + (monster.skills?.perception ?? scoreToMod(monster.wisdom));
    const senses = getSensesString({ ...monster, perception });

    return {
        perception,
        senses,
        damage_vulnerabilities:  monster.damage_vulnerability_list?.join(', ') ?? '',
        damage_resistances:      monster.damage_resistance_list?.join(', ')    ?? '',
        damage_immunities:       monster.damage_immunity_list?.join(', ')      ?? '',
        condition_immunities:    monster.condition_immunity_list?.join(', ')   ?? '',
    };
};

export const crToString = (cr: number): string => {
    if (cr === 0.125) return '1/8';
    if (cr === 0.25)  return '1/4';
    if (cr === 0.5)   return '1/2';
    return String(cr);
};

export { crToXP, scoreToMod, getMonsterProf, getToHit, plusMinus, getMods, skillToAbilityMap, getSensesString };
export type { SkillName };
