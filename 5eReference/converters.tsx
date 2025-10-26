// @ts-nocheck
export const plusMinus = (save) => {
    if (Number(save) >= 0) {
        return (`+${save.toString()}`)
    } else {
        return `${save.toString()}`
    }
}

const scoreToMod = (score) => {
    const mod = Math.floor((Number(score) - 10) / 2)
    if (mod < 0) {
        return mod.toString()
    } else {
        return '+' + mod.toString()
    }
}

const getMonsterProf = (cr) => {
    return Math.max(Math.floor((Number(cr) - 1) / 4), 0) + 2
}

const crToXP = (cr) => {
    const CR_TO_XP_TABLE = {
        0: 0,
        .125: 25,
        .25: 50,
        .5: 100,
        1: 200,
        2: 450,
        3: 700,
        4: 1100,
        5: 1800,
        6: 2300,
        7: 2900,
        8: 3900,
        9: 5000,
        10: 5900,
        11: 7200,
        12: 8400,
        13: 10000,
        14: 11500,
        15: 13000,
        16: 15000,
        17: 18000,
        18: 20000,
        19: 22000,
        20: 25000,
        21: 33000,
        22: 41000,
        23: 50000,
        24: 62000,
        25: 76000,
        26: 90000,
        27: 105000,
        28: 120000,
        29: 137000,
        30: 155000
    }

    return CR_TO_XP_TABLE[cr.toString()]
}

const getToHit = (monsterData, attack) => {
    console.log(attack)

    if (Number(attack.attack_bonus)) {
        return plusMinus(Number(attack.attack_bonus))
    }

    const prof = monsterData.proficiency_bonus ? monsterData.proficiency_bonus : getMonsterProf(monsterData.cr)
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
        return plusMinus(values.reduce((accumulator, currentValue) => {
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
            }
        }, hit_bonus))

    }

    // console.error("Attack bonus is neither an integer nor a valid shorthand like [STR ATK]")
}


export {crToXP, scoreToMod, getMonsterProf, getToHit}