import { v4 as uuidv4 } from 'uuid';
import type { Schema } from '@/amplify/data/resource';

type MonsterStatblock = Schema['MonsterStatblock']['type'];

// ── Open5e v2 API types ───────────────────────────────────────────────────────

interface V2Document {
    key: string;
    name: string;
    display_name?: string;
}

interface V2Attack {
    name: string;
    attack_type: string;
    to_hit_mod: number | null;
    reach: number | null;
    range: number | null;
    long_range: number | null;
    damage_die_count: number | null;
    damage_die_type: string | null;
    damage_bonus: number | null;
    damage_type: { name: string; key: string } | null;
    extra_damage_die_count: number | null;
    extra_damage_die_type: string | null;
    extra_damage_bonus: number | null;
    extra_damage_type: { name: string; key: string } | null;
    distance_unit: string;
}

export interface Open5eV2Action {
    name: string;
    desc: string;
    attacks: V2Attack[];
    action_type: 'ACTION' | 'LEGENDARY_ACTION' | 'BONUS_ACTION' | 'REACTION' | 'MYTHIC_ACTION';
    order_in_statblock: number;
    legendary_action_cost: number | null;
    limited_to_form: string | null;
    usage_limits: { type: string; param: number } | null;
}

export interface Open5eV2Creature {
    key: string;
    name: string;
    document: V2Document;
    type: { name: string; key: string };
    size: { name: string; key: string };
    subcategory: string | null;
    category: string | null;
    challenge_rating: number;
    proficiency_bonus: number | null;
    speed: {
        walk?: number; swim?: number; fly?: number;
        climb?: number; burrow?: number; hover?: boolean; unit?: string;
    };
    speed_all: {
        walk: number; swim: number; fly: number;
        climb: number; burrow: number; hover: boolean; unit?: string;
    };
    alignment: string;
    languages: string;
    armor_class: number;
    armor_detail: string | null;
    hit_points: number;
    hit_dice: string;
    ability_scores: {
        strength: number; dexterity: number; constitution: number;
        intelligence: number; wisdom: number; charisma: number;
    };
    saving_throws: Record<string, number>;
    saving_throws_all: Record<string, number>;
    skill_bonuses: Record<string, number>;
    skill_bonuses_all: Record<string, number>;
    passive_perception: number;
    resistances_and_immunities: {
        damage_immunities_display: string;
        damage_immunities: Array<{ name: string; key: string }>;
        damage_resistances_display: string;
        damage_resistances: Array<{ name: string; key: string }>;
        damage_vulnerabilities_display: string;
        damage_vulnerabilities: Array<{ name: string; key: string }>;
        condition_immunities_display: string;
        condition_immunities: Array<{ name: string; key: string }>;
    };
    darkvision_range: number | null;
    blindsight_range: number | null;
    tremorsense_range: number | null;
    truesight_range: number | null;
    actions: Open5eV2Action[];
    traits: Array<{ name: string; desc: string }>;
}

export interface Open5eV2Page {
    count: number;
    next: string | null;
    previous: string | null;
    results: Open5eV2Creature[];
}

// ── Core helpers ──────────────────────────────────────────────────────────────

const profBonusByCr = (cr: number) => Math.max(Math.floor((cr - 1) / 4), 0) + 2;

function crToString(cr: number): string {
    if (cr <= 0) return '0';
    if (Math.abs(cr - 0.125) < 0.001) return '1/8';
    if (Math.abs(cr - 0.25)  < 0.001) return '1/4';
    if (Math.abs(cr - 0.5)   < 0.001) return '1/2';
    return String(Math.round(cr));
}

// ── Damage helpers ────────────────────────────────────────────────────────────

const DAMAGE_TYPES = [
    'acid','bludgeoning','cold','fire','force','lightning',
    'necrotic','piercing','poison','psychic','radiant','slashing','thunder',
];

function extractDamageTypes(desc: string): string[] {
    const pattern = new RegExp(`\\b(${DAMAGE_TYPES.join('|')})\\b`, 'gi');
    const seen: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(desc)) !== null) {
        const t = m[1].toLowerCase();
        if (!seen.includes(t)) seen.push(t);
    }
    return seen;
}

/**
 * Extracts parenthetical dice expressions from an action description.
 * "Hit: 21 (2d10 + 10) piercing plus 14 (4d6) fire" → ["2d10+10", "4d6"]
 *
 * Used instead of the v2 structured damage fields because v2 damage_type
 * has known data quality issues (wrong types for many SRD creatures).
 */
function extractDiceFromDesc(desc: string): string[] {
    return Array.from(
        desc.matchAll(/\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)/g),
        m => m[1].replace(/\s+/g, ''),
    );
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

function parseReach(desc: string): number | undefined {
    const m = desc.match(/reach\s+(\d+)\s*ft/i);
    return m ? parseInt(m[1]) : undefined;
}

function parseRange(desc: string): { short: number; long: number } | undefined {
    const m = desc.match(/range\s+(\d+)\/(\d+)\s*ft/i);
    return m ? { short: parseInt(m[1]), long: parseInt(m[2]) } : undefined;
}

// ── Action converter ──────────────────────────────────────────────────────────

function convertAction(a: Open5eV2Action): NonNullable<MonsterStatblock['actions']>[number] {
    const atk = a.attacks[0];
    const types = extractDamageTypes(a.desc ?? '');
    const diceExprs = extractDiceFromDesc(a.desc ?? '');

    // v2 to_hit_mod is reliable; reach/range structured fields are also reliable
    const attackBonus = atk?.to_hit_mod != null ? String(atk.to_hit_mod) : undefined;
    const reach      = atk?.reach      ?? parseReach(a.desc ?? '');
    const rangeShort = atk?.range      ?? parseRange(a.desc ?? '')?.short;
    const rangeLong  = atk?.long_range ?? parseRange(a.desc ?? '')?.long;

    const damage: { damage_dice: string; damage_type: string }[] = diceExprs.map((dice, i) => ({
        damage_dice: dice,
        damage_type: types[i] ?? '',
    }));

    return {
        name:         a.name,
        desc:         a.desc ?? '',
        effect:       undefined,
        type:         undefined,
        attack_bonus: attackBonus,
        reach,
        short_range:  rangeShort,
        long_range:   rangeLong,
        damage:       damage.length > 0 ? damage : undefined,
        targets:      undefined,
    };
}

// ── Senses ────────────────────────────────────────────────────────────────────

function buildSensesString(m: Open5eV2Creature): string {
    const parts: string[] = [];
    if (m.blindsight_range) {
        const hasBlindBeyond = m.traits.some(t => t.desc?.toLowerCase().includes('blind beyond'));
        parts.push(`blindsight ${m.blindsight_range} ft.${hasBlindBeyond ? ' (blind beyond this radius)' : ''}`);
    }
    if (m.darkvision_range)  parts.push(`darkvision ${m.darkvision_range} ft.`);
    if (m.tremorsense_range) parts.push(`tremorsense ${m.tremorsense_range} ft.`);
    if (m.truesight_range)   parts.push(`truesight ${m.truesight_range} ft.`);
    parts.push(`passive Perception ${m.passive_perception}`);
    return parts.join(', ');
}

// ── Main converter ────────────────────────────────────────────────────────────

export function convertOpen5eMonster(m: Open5eV2Creature): MonsterStatblock {
    const now = new Date().toISOString();
    const ab  = m.ability_scores;

    const hdMatch    = (m.hit_dice ?? '').match(/^(\d+)/);
    const hit_dice_num = hdMatch ? parseInt(hdMatch[1]) : 1;

    // Save proficiencies: v2 `saving_throws` (without _all) only lists proficient saves
    const save_proficiencies = Object.keys(m.saving_throws);
    const st = m.saving_throws_all;
    const strength_save     = save_proficiencies.includes('strength')     ? st.strength     : undefined;
    const dexterity_save    = save_proficiencies.includes('dexterity')    ? st.dexterity    : undefined;
    const constitution_save = save_proficiencies.includes('constitution') ? st.constitution : undefined;
    const intelligence_save = save_proficiencies.includes('intelligence') ? st.intelligence : undefined;
    const wisdom_save       = save_proficiencies.includes('wisdom')       ? st.wisdom       : undefined;
    const charisma_save     = save_proficiencies.includes('charisma')     ? st.charisma     : undefined;

    // Resistances/immunities from structured v2 arrays
    const ri = m.resistances_and_immunities;
    const damage_vulnerability_list = ri.damage_vulnerabilities.map(v => v.key);
    const damage_resistance_list    = ri.damage_resistances.map(v => v.key);
    const damage_immunity_list      = ri.damage_immunities.map(v => v.key);
    const condition_immunity_list   = ri.condition_immunities.map(v => v.key);

    // Speed: speed_all has all modes; treat 0 as absent
    const sa = m.speed_all;
    const speed = {
        walk:   sa.walk   || undefined,
        swim:   sa.swim   || undefined,
        fly:    sa.fly    || undefined,
        climb:  sa.climb  || undefined,
        burrow: sa.burrow || undefined,
        hover:  sa.hover  || undefined,
        notes:  undefined,
    };

    // Senses
    const senses     = buildSensesString(m);
    const blindBeyond = m.traits.some(t => t.desc?.toLowerCase().includes('blind beyond'));

    // Split actions by type, sorted by their statblock order
    const byType = (type: string) =>
        (m.actions ?? [])
            .filter(a => a.action_type === type)
            .sort((a, b) => a.order_in_statblock - b.order_in_statblock);

    const cr = m.challenge_rating;

    return {
        id:        uuidv4(),
        slug:      m.key,
        publisher: m.document.display_name ?? m.document.name,
        name:      m.name,
        createdAt: now,
        updatedAt: now,
        desc:      '',
        size:      m.size.name,
        type:      m.type.name,
        subtype:   m.subcategory ?? '',
        group:     m.category    ?? '',
        alignment: m.alignment,
        armor_class: m.armor_class,
        armor_desc:  m.armor_detail ?? '',
        hit_points:         m.hit_points,
        current_hit_points: m.hit_points,
        hit_dice_num,
        hit_dice: m.hit_dice ?? '',
        speed,
        strength:     ab.strength,
        dexterity:    ab.dexterity,
        constitution: ab.constitution,
        intelligence: ab.intelligence,
        wisdom:       ab.wisdom,
        charisma:     ab.charisma,
        strength_save, dexterity_save, constitution_save,
        intelligence_save, wisdom_save, charisma_save,
        perception: m.passive_perception,
        // v2 provides exact final values for all 18 skills — no proficiency back-calculation needed
        skills: m.skill_bonuses_all as MonsterStatblock['skills'],
        damage_vulnerabilities:  ri.damage_vulnerabilities_display,
        damage_vulnerability_list,
        damage_resistances:      ri.damage_resistances_display,
        damage_resistance_list,
        damage_immunities:       ri.damage_immunities_display,
        damage_immunity_list,
        condition_immunities:    ri.condition_immunities_display,
        condition_immunity_list,
        blindsight:  m.blindsight_range  ?? undefined,
        darkvision:  m.darkvision_range  ?? undefined,
        tremorsense: m.tremorsense_range ?? undefined,
        truesight:   m.truesight_range   ?? undefined,
        blindBeyond,
        senses,
        languages: m.languages ?? '',
        challenge_rating: crToString(cr),
        cr,
        special_abilities:  (m.traits ?? []).map(t => ({ name: t.name, desc: t.desc })),
        actions:            byType('ACTION').map(convertAction),
        bonus_actions:      byType('BONUS_ACTION').map(a => ({ name: a.name, desc: a.desc })),
        reactions:          byType('REACTION').map(a => ({ name: a.name, desc: a.desc })),
        legendary_desc:     '',
        legendary_actions:  byType('LEGENDARY_ACTION').map(a => ({ name: a.name, desc: a.desc })),
        mythic_desc:        '',
        mythic_actions:     byType('MYTHIC_ACTION').map(a => ({ name: a.name, desc: a.desc })),
    };
}
