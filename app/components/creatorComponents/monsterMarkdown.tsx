"use client"

import React from 'react';
import { TextField, Button, Stack } from '@mui/material';
import type { Schema } from '@/amplify/data/resource';
import { calculateDependentStats, scoreToMod, crToXP, getToHit, getMonsterProf } from '@/5eReference/converters';
import { plusMinus } from '@/5eReference/converters';

type MyMonsterStatblock = Schema['MonsterStatblock']['type'];

interface Props {
    monster: MyMonsterStatblock;
}

const fmtMod = (score:number) => (score >= 0 ? `+${score}` : `${score}`);

// Helper to parse and calculate damage with placeholders
const calculateDamage = (damageStr: string, mods: {[key: string]: number}): string => {
    if (!damageStr) return '';
    
    // Replace ability placeholders with actual modifiers
    let processed = damageStr
    processed = processed.replace(/\[STR\]/g, () => `${mods.strength}`);
    processed = processed.replace(/\[DEX\]/g, () => `${mods.dexterity}`);
    processed = processed.replace(/\[CON\]/g, () => `${mods.constitution}`);
    processed = processed.replace(/\[INT\]/g, () => `${mods.intelligence}`);
    processed = processed.replace(/\[WIS\]/g, () => `${mods.wisdom}`);
    processed = processed.replace(/\[CHA\]/g, () => `${mods.charisma}`);
    
    // Try to calculate average
    try {
        // Extract dice rolls like "3d8" from "3d8+5"
        const diceMatch = processed.match(/(\d+d\d+(?:[+-]\d+)?)/gi);
        if (diceMatch) {
            let total = 0;
            const diceStr = diceMatch.join(' ');
            
            // Simple calculation: for NdM dice, average is N * (M+1)/2
            for (const dice of diceMatch) {
                const match = dice.match(/(\d+)d(\d+)([+-]\d+)?/i);
                if (match) {
                    const count = parseInt(match[1]);
                    const sides = parseInt(match[2]);
                    const mod = match[3] ? parseInt(match[3]) : 0;
                    const avg = Math.round(count * (sides + 1) / 2 + mod);
                    total += avg;
                }
            }
            
            return `${total} (${processed})`;
        }
    } catch (e) {
        // If calculation fails, just return processed string
    }
    
    return processed;
};

const serializeMonsterToMarkdown = (m: MyMonsterStatblock): string => {
    const derived = calculateDependentStats(m) as any;

    const header = `## ${m.name || 'Unnamed Monster'}\n*${m.size || ''} ${m.type || ''}${m.subtype ? ' ('+m.subtype+')' : ''}, ${m.alignment || ''}*\n___\n`;

    const armorLine = `**Armor Class** :: ${m.armor_class ?? ''}${m.armor_desc ? ' ('+m.armor_desc+')' : ''}`;
    const hpLine = `**Hit Points** :: ${m.hit_points ?? ''} (${m.hit_dice ?? ''})`;

    const speeds: string[] = [];
    if (m.speed) {
        if (m.speed.walk) speeds.push(`walk ${m.speed.walk} ft.`);
        if (m.speed.climb) speeds.push(`climb ${m.speed.climb} ft.`);
        if (m.speed.swim) speeds.push(`swim ${m.speed.swim} ft.`);
        if (m.speed.fly) speeds.push(`fly ${m.speed.fly} ft.`);
        if (m.speed.burrow) speeds.push(`burrow ${m.speed.burrow} ft.`);
        if (m.speed.hover) speeds.push(`hover`);
    }
    const speedLine = `**Speed** :: ${speeds.join(', ')}\n___\n`;

    const mods = {
        strength: scoreToMod(m.strength),
        dexterity: scoreToMod(m.dexterity),
        constitution: scoreToMod(m.constitution),
        intelligence: scoreToMod(m.intelligence),
        wisdom: scoreToMod(m.wisdom),
        charisma: scoreToMod(m.charisma),
    };

    const abilitiesTable = `|STR|DEX|CON|INT|WIS|CHA|\n|:--:|:--:|:--:|:--:|:--:|:--:|\n|${m.strength ?? ''} (${fmtMod(mods.strength)})|${m.dexterity ?? ''} (${fmtMod(mods.dexterity)})|${m.constitution ?? ''} (${fmtMod(mods.constitution)})|${m.intelligence ?? ''} (${fmtMod(mods.intelligence)})|${m.wisdom ?? ''} (${fmtMod(mods.wisdom)})|${m.charisma ?? ''} (${fmtMod(mods.charisma)})|\n___\n`;

    // Only show saves where the monster is proficient (in save_proficiencies array)
    const saves: string[] = [];
    const saveProfMap: {[key: string]: string} = {
        strength: 'strength_save',
        dexterity: 'dexterity_save',
        constitution: 'constitution_save',
        intelligence: 'intelligence_save',
        wisdom: 'wisdom_save',
        charisma: 'charisma_save',
    };
    if (derived && m.save_proficiencies) {
        for (const ability of m.save_proficiencies) {
            const saveKey = saveProfMap[ability];
            if (saveKey && derived[saveKey]) {
                const num = Number(derived[saveKey]);
                const label = ability.charAt(0).toUpperCase() + ability.slice(1);
                saves.push(`${label} ${num >= 0 ? '+'+num : num}`);
            }
        }
    }

    // Only show skills where the monster is proficient (skill_proficiencies is not null)
    const skillsArr: string[] = [];
    if (m.skill_proficiencies && derived && derived.skills) {
        for (const [skillName, profLevel] of Object.entries(m.skill_proficiencies)) {
            // Only include if there's a proficiency value (not null)
            if (profLevel) {
                const skillMod = derived.skills[skillName];
                if (skillMod !== undefined) {
                    const num = Number(skillMod);
                    const displayName = skillName.replace(/_/g,' ');
                    skillsArr.push(`${displayName.charAt(0).toUpperCase() + displayName.slice(1)} ${num >= 0 ? '+'+num : num}`);
                }
            }
        }
    }

    // const defenses: string[] = [];
    // if (m.damage_vulnerabilities) defenses.push(`**Damage Vulnerabilities** :: ${m.damage_vulnerabilities}\n`);
    // if (m.damage_resistances) defenses.push(`**Damage Resistances** :: ${m.damage_resistances}\n`);
    // if (m.damage_immunities) defenses.push(`**Damage Immunities** :: ${m.damage_immunities}\n`);
    // if (m.condition_immunities) defenses.push(`**Condition Immunities** :: ${m.condition_immunities}\n`);

    const sensesLine = `**Senses** :: ${derived?.senses ?? m.senses ?? ''}`;
    const languagesLine = `**Languages** :: ${m.languages ?? 'None'}`;
    const crLine = `**Challenge** :: ${m.cr ?? ''}${m.cr !== undefined ? ` (${crToXP(Number(m.cr))} XP)` : ''} {{bonus **Proficiency Bonus** ${plusMinus(getMonsterProf(m.cr))}}}\n___\n`;

    let md = header + armorLine + '\n' + hpLine + '\n' + speedLine + '\n\n' + abilitiesTable;

    if (saves.length) md += `**Saving Throws** :: ${saves.join(', ')}\n`;
    if (skillsArr.length) md += `**Skills** :: ${skillsArr.join(', ')}\n`;
    if (m.damage_vulnerabilities) md += `**Damage Vulnerabilities** :: ${m.damage_vulnerabilities}\n`;
    if (m.damage_resistances) md += `**Damage Resistances** :: ${m.damage_resistances}\n`;
    if (m.damage_immunities) md += `**Damage Immunities** :: ${m.damage_immunities}\n`;
    if (m.condition_immunities)  md += `**Condition Immunities** :: ${m.condition_immunities}\n`;

    // if (defenses.length) md += defenses.map(d=>d);

    md += sensesLine + '\n' + languagesLine + '\n' + crLine + '\n\n';

    if (m.desc) md += m.desc + '\n\n';

    const renderAbilities = (title: string| undefined, arr: any[] | undefined) => {
        if (!arr || arr.length === 0) return '';
        let s = title ? `### ${title}\n` : '';
        for (const a of arr) {
            s += `***${a.name}.***`;
            
            // If type is "ability", just render name and description
            if (a.type === 'Ability' || a.type === 'ability') {
                s += ` ${a.desc || ''}\n:\n\n`;
            }
            // Otherwise, format as attack with type/bonus/reach/damage
            else if (a.type || a.attack_bonus || a.reach || a.targets || a.damage) {
                s += ` *${a.type || ''}*`;
                const parts: string[] = [];
                
                if (a.attack_bonus) {
                    const toHit = getToHit(m, a as any) || (a.attack_bonus ? (a.attack_bonus.toString()) : '');
                    parts.push(`${toHit.replace(/^\+?/,'+') } to hit`);
                }
                if (a.reach) parts.push(`reach ${a.reach} ft.`);
                if (a.targets) parts.push(a.targets.replace('.', ''));
                
                if (parts.length > 0) {
                    s += ': ' + parts.join(', ') + '.';
                } else {
                    s += ':';
                }
                
                // Add damage on new line
                if (a.damage && Array.isArray(a.damage)) {
                    const dmg = (a.damage as any[]).map(d=> {
                        const calc = calculateDamage(d.damage_dice ?? '', mods);
                        return `${calc}${d.damage_type ? ' '+d.damage_type : ''}`;
                    }).join(', ');
                    s += ` *Hit:* ${dmg}.`;
                }
                s += ' ';
                
                // Add description with two newlines and colon
                s += (" " + a.desc || '') + '\n:\n\n';
            }
            // No type or attack info, just description
            else {
                s += ` ${a.desc || ''}\n:\n\n`;
            }
        }
        s += '\n';
        return s;
    }

    md += renderAbilities('', m.special_abilities ?? []);
    md += renderAbilities('Actions', m.actions ?? []);
    md += renderAbilities('Bonus Actions', m.bonus_actions ?? []);
    md += renderAbilities('Reactions', m.reactions ?? []);

    
    // Legendary Actions
    if (m.legendary_actions && m.legendary_actions.length > 0) {
        md += `### Legendary Actions\n`;
        if (m.legendary_desc) md += `${m.legendary_desc}\n:\n`;
        for (const a of m.legendary_actions) {
            md += `***${a.name}.*** ${a.desc || ''}\n:\n`;
        }
        md += '\n';
    }
    
    // Mythic Actions
    if (m.mythic_actions && m.mythic_actions.length > 0) {
        md += `### Mythic Actions\n`;
        if (m.mythic_desc) md += `${m.mythic_desc}\n:\n`;
        for (const a of m.mythic_actions) {
            md += `***${a.name}.*** ${a.desc || ''}\n:\n`;
        }
        md += '\n';
    }

    return md;
}

const MarkdownExport: React.FC<Props> = ({ monster }) => {
    const markdownOutput = React.useMemo(() => serializeMonsterToMarkdown(monster), [monster]);

    const copyMarkdown = async () => {
        try {
            await navigator.clipboard.writeText(markdownOutput);
            // eslint-disable-next-line no-alert
            alert('Markdown copied to clipboard');
        } catch (e) {
            // eslint-disable-next-line no-alert
            alert('Failed to copy markdown');
        }
    }

    return (
        <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField
                label="Markdown Output"
                value={markdownOutput}
                multiline
                minRows={12}
                fullWidth
                InputProps={{ readOnly: true }}
            />
            <Button type="button" variant="contained" onClick={copyMarkdown}>Copy Markdown</Button>
        </Stack>
    )
}

export default MarkdownExport;
