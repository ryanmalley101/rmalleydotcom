"use client"

import styles from '@/styles/CreateMonsterStatblock.module.css';
import {
    Button,
    ButtonGroup,
    Checkbox,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography
} from "@mui/material";
import Box from '@mui/material/Box';
import type { SelectChangeEvent } from '@mui/material/Select';
import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { calculateDependentStats, crToString, scoreToMod } from "@/5eReference/converters";
import AbilityRow from "@/app/components/creatorComponents/abilityrow";
import ActionRow from "@/app/components/creatorComponents/actionrow";
import MonsterSheet from "@/app/components/creatorComponents/monsterSheet";
import html2canvas from "html2canvas";
import { BsFillTrashFill } from "react-icons/bs";
import { FaMasksTheater } from "react-icons/fa6";
import { GiAbdominalArmor, GiBearHead, GiBrain, GiDigHole, GiFlyingTrout, GiHeartPlus, GiMountainClimbing, GiOwl, GiRunningNinja, GiSprint, GiStrongMan } from "react-icons/gi";
import { type Schema } from '@/amplify/data/resource';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import { generateClient } from 'aws-amplify/data';
import { IconContext } from 'react-icons';
import AbilityScoreInput from './abilityscoreinput';
import { GrSwim } from "react-icons/gr";
import HeaderRow from './headerrow';
import MarkdownExport from './monsterMarkdown';
import { newMonsterStats } from './monsterDefaults';

const client = generateClient<Schema>();
type MyMonsterStatblock = Schema['MonsterStatblock']['type'];
type MyMonsterAbility = Schema['MonsterAbility']['type'];
type MyMonsterAttack = Schema['MonsterAttack']['type'];

type MonsterArrayKey = 'special_abilities' | 'actions' | 'bonus_actions' | 'reactions' | 'legendary_actions' | 'mythic_actions';
type AbilityArrayKey = Exclude<MonsterArrayKey, 'actions'>;

const SIZE_TO_HIT_DIE: Record<string, string> = {
    tiny: 'd4',
    small: 'd6',
    medium: 'd8',
    large: 'd10',
    huge: 'd12',
    gargantuan: 'd20',
};

const rowSpacing = 1;

const CreateMonsterStatblock = () => {
    const [monsterStatblock, setMonsterStatblock] = useState<MyMonsterStatblock>({
        ...newMonsterStats,
        speed: newMonsterStats.speed ?? { walk: 0, swim: 0, fly: 0, burrow: 0, climb: 0, hover: false }
    });

    const [selectedSave, setSelectedSave] = useState<string>("strength");
    const [selectedSkill, setSelectedSkill] = useState<string>("acrobatics");
    const [selectedDamage, setSelectedDamage] = useState<string>("acid");
    const [selectedCondition, setSelectedCondition] = useState<string>("blinded");

    const hitDieSize = useMemo(
        () => SIZE_TO_HIT_DIE[monsterStatblock.size] ?? 'd8',
        [monsterStatblock.size]
    );

    const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setMonsterStatblock(prev => ({
            ...prev,
            ...calculateDependentStats({ ...prev, [name]: value }),
            [name]: value
        }));
    };

    const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = event.target;
        setMonsterStatblock(prev => ({ ...prev, [name]: checked }));
    };

    const handleSpeedChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setMonsterStatblock(prev => ({
            ...prev,
            speed: { ...prev.speed, [name]: parseInt(value, 10) },
        }));
    };

    // --- Saving Throws ---
    const addSaveProficiency = () => {
        setMonsterStatblock(prev => {
            const current = prev.save_proficiencies ?? [];
            if (current.includes(selectedSave)) return prev;
            const newSaves = [...current, selectedSave];
            return { ...prev, save_proficiencies: newSaves, ...calculateDependentStats({ ...prev, save_proficiencies: newSaves }) };
        });
    };

    const removeSaveProficiency = (saveToRemove: string) => {
        setMonsterStatblock(prev => {
            const newSaves = (prev.save_proficiencies ?? []).filter(s => s !== saveToRemove);
            return { ...prev, save_proficiencies: newSaves, ...calculateDependentStats({ ...prev, save_proficiencies: newSaves }) };
        });
    };

    // --- Skills ---
    const addSkillProficiency = (proficiency: string | null) => {
        setMonsterStatblock(prev => {
            const newSkills = { ...(prev.skill_proficiencies ?? {}), [selectedSkill]: proficiency };
            return { ...prev, skill_proficiencies: newSkills, ...calculateDependentStats({ ...prev, skill_proficiencies: newSkills }) };
        });
    };

    const removeSkillProficiency = (skillToRemove: string) => {
        setMonsterStatblock(prev => {
            const newSkills = { ...(prev.skill_proficiencies ?? {}), [skillToRemove]: null };
            return { ...prev, skill_proficiencies: newSkills, ...calculateDependentStats({ ...prev, skill_proficiencies: newSkills }) };
        });
    };

    // --- Conditions ---
    const addConditionImmunity = () => {
        setMonsterStatblock(prev => {
            const current = prev.condition_immunity_list ?? [];
            if (current.includes(selectedCondition)) return prev;
            const newList = [...current, selectedCondition];
            return { ...prev, condition_immunity_list: newList, condition_immunities: newList.join(', ') };
        });
    };

    const removeConditionImmunity = (conditionToRemove: string) => {
        setMonsterStatblock(prev => {
            const newList = (prev.condition_immunity_list ?? []).filter(c => c !== conditionToRemove);
            return { ...prev, condition_immunity_list: newList, condition_immunities: newList.join(', ') };
        });
    };

    // --- Damage ---
    const handleDamageModification = (modType: 'vulnerability' | 'resistance' | 'immunity') => {
        setMonsterStatblock(prev => {
            if (!selectedDamage) return prev;
            const vulns = (prev.damage_vulnerability_list ?? []).filter(d => d !== selectedDamage && d);
            const resists = (prev.damage_resistance_list ?? []).filter(d => d !== selectedDamage && d);
            const immunes = (prev.damage_immunity_list ?? []).filter(d => d !== selectedDamage && d);
            if (modType === 'vulnerability') vulns.push(selectedDamage);
            else if (modType === 'resistance') resists.push(selectedDamage);
            else immunes.push(selectedDamage);
            return {
                ...prev,
                damage_vulnerability_list: vulns, damage_vulnerabilities: vulns.join(', '),
                damage_resistance_list: resists, damage_resistances: resists.join(', '),
                damage_immunity_list: immunes, damage_immunities: immunes.join(', '),
            };
        });
    };

    const removeDamageModification = (damageToRemove: string) => {
        setMonsterStatblock(prev => {
            const vulns = (prev.damage_vulnerability_list ?? []).filter(d => d !== damageToRemove);
            const resists = (prev.damage_resistance_list ?? []).filter(d => d !== damageToRemove);
            const immunes = (prev.damage_immunity_list ?? []).filter(d => d !== damageToRemove);
            return {
                ...prev,
                damage_vulnerability_list: vulns, damage_vulnerabilities: vulns.join(', '),
                damage_resistance_list: resists, damage_resistances: resists.join(', '),
                damage_immunity_list: immunes, damage_immunities: immunes.join(', '),
            };
        });
    };

    // --- Generic array handlers for ability-type sections ---
    const addAbilityItem = (key: AbilityArrayKey, namePrefix: string) => {
        setMonsterStatblock(prev => {
            const current = (prev[key] as MyMonsterAbility[]) ?? [];
            return { ...prev, [key]: [...current, { name: `${namePrefix} ${current.length}`, desc: 'New Description' }] };
        });
    };

    const removeItem = (key: MonsterArrayKey, index: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            [key]: ((prev[key] as any[]) ?? []).filter((_: any, i: number) => i !== index)
        }));
    };

    const updateAbilityItem = (key: AbilityArrayKey, ability: MyMonsterAbility, index: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            [key]: ((prev[key] as MyMonsterAbility[]) ?? []).map((old, i) => i === index ? ability : old)
        }));
    };

    // --- Actions (different type from abilities) ---
    const addAction = () => {
        setMonsterStatblock(prev => {
            const current = prev.actions ?? [];
            return {
                ...prev,
                actions: [...current, {
                    name: `New Action ${current.length}`,
                    desc: 'Action',
                    type: 'Melee Weapon Attack',
                    reach: 5,
                    attack_bonus: '[STR ATK]',
                    short_range: 0,
                    long_range: 0,
                    targets: 'One Target.',
                    damage: [{ damage_dice: '1d6', damage_type: 'slashing' }],
                }]
            };
        });
    };

    const handleActionUpdate = (action: MyMonsterAttack, index: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            actions: (prev.actions ?? []).map((old, i) => i === index ? action : old)
        }));
    };

    // --- Reorder ---
    const moveCreatureItemUp = (key: MonsterArrayKey, index: number) => {
        setMonsterStatblock(prev => {
            const list = [...((prev[key] as any[]) ?? [])];
            if (index === 0) return prev;
            [list[index - 1], list[index]] = [list[index], list[index - 1]];
            return { ...prev, [key]: list };
        });
    };

    const moveCreatureItemDown = (key: MonsterArrayKey, index: number) => {
        setMonsterStatblock(prev => {
            const list = [...((prev[key] as any[]) ?? [])];
            if (index === list.length - 1) return prev;
            [list[index], list[index + 1]] = [list[index + 1], list[index]];
            return { ...prev, [key]: list };
        });
    };

    // --- Size / Hit Dice ---
    const handleSizeChange = (e: SelectChangeEvent) => {
        setMonsterStatblock(prev => ({ ...prev, size: e.target.value }));
    };

    const handleHitDiceChange = (dieNum: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            hit_dice_num: dieNum,
            hit_dice: `${dieNum}${hitDieSize}+${dieNum * scoreToMod(prev.constitution)}`
        }));
    };

    useEffect(() => {
        const dieSize = Number(hitDieSize.replace('d', ''));
        if (isNaN(dieSize)) return;
        const hp = Math.ceil(
            monsterStatblock.hit_dice_num * (dieSize / 2 + 0.5) +
            monsterStatblock.hit_dice_num * scoreToMod(monsterStatblock.constitution)
        );
        setMonsterStatblock(prev => ({ ...prev, hit_points: hp }));
    }, [monsterStatblock.hit_dice_num, monsterStatblock.constitution, hitDieSize]);

    const initializedMonsterId = useRef(monsterStatblock.id);
    useEffect(() => {
        if (monsterStatblock.id && monsterStatblock.id !== initializedMonsterId.current) {
            initializedMonsterId.current = monsterStatblock.id;
        }
    }, [monsterStatblock.id]);

    // --- PNG export ---
    const printRef = useRef<HTMLDivElement>(null);

    const downloadFile = async () => {
        if (!printRef.current) return;
        const canvas = await html2canvas(printRef.current);
        const data = canvas.toDataURL('image/jpg');
        const link = document.createElement('a');
        if (typeof link.download === 'string') {
            link.href = data;
            link.download = monsterStatblock.name + '.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            window.open(data);
        }
    };

    const theme = useTheme();

    return (
        <div style={{ maxWidth: '1400px', width: '100%', margin: '0 auto', paddingBottom: '50px' }}>
            <HeaderRow monster={monsterStatblock} setMonster={setMonsterStatblock} downloadFile={downloadFile} />
            <div style={{ margin: '80px 20px 20px' }}>
                <MonsterSheet statblock={monsterStatblock} printRef={printRef} />
            </div>
            <div className={styles.container}>
                <form onSubmit={e => e.preventDefault()}>
                    <FormControl className={styles.form} fullWidth>
                        <Grid container spacing={2} marginY={"10px"}>
                            <Grid size={3}>
                                <TextField name="name" label="Name"
                                    value={monsterStatblock.name ?? ''}
                                    onChange={handleInputChange} />
                            </Grid>
                            <Grid size={1.5}>
                                <FormControl>
                                    <InputLabel id="size-label">Size</InputLabel>
                                    <Select
                                        labelId="size-label"
                                        value={monsterStatblock.size}
                                        label="Size"
                                        onChange={handleSizeChange}
                                    >
                                        <MenuItem value="tiny">Tiny</MenuItem>
                                        <MenuItem value="small">Small</MenuItem>
                                        <MenuItem value="medium">Medium</MenuItem>
                                        <MenuItem value="large">Large</MenuItem>
                                        <MenuItem value="huge">Huge</MenuItem>
                                        <MenuItem value="gargantuan">Gargantuan</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={1.6}>
                                <FormControl>
                                    <InputLabel id="type-label">Type</InputLabel>
                                    <Select
                                        labelId="type-label"
                                        value={monsterStatblock.type}
                                        label="Type"
                                        onChange={(e) => setMonsterStatblock(prev => ({ ...prev, type: e.target.value }))}
                                    >
                                        <MenuItem value="aberration">Aberration</MenuItem>
                                        <MenuItem value="beast">Beast</MenuItem>
                                        <MenuItem value="celestial">Celestial</MenuItem>
                                        <MenuItem value="construct">Construct</MenuItem>
                                        <MenuItem value="dragon">Dragon</MenuItem>
                                        <MenuItem value="elemental">Elemental</MenuItem>
                                        <MenuItem value="fey">Fey</MenuItem>
                                        <MenuItem value="fiend">Fiend</MenuItem>
                                        <MenuItem value="giant">Giant</MenuItem>
                                        <MenuItem value="humanoid">Humanoid</MenuItem>
                                        <MenuItem value="monstrosity">Monstrosity</MenuItem>
                                        <MenuItem value="ooze">Ooze</MenuItem>
                                        <MenuItem value="plant">Plant</MenuItem>
                                        <MenuItem value="undead">Undead</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={2}>
                                <TextField name="subtype" label="Subtype"
                                    value={monsterStatblock.subtype ?? ''}
                                    onChange={handleInputChange} />
                            </Grid>
                            <Grid size={1.9}>
                                <TextField name="alignment" label="Alignment"
                                    value={monsterStatblock.alignment ?? ''}
                                    onChange={handleInputChange} />
                            </Grid>
                            <Grid size={2}>
                                <FormControl>
                                    <InputLabel id="cr-label">CR</InputLabel>
                                    <Select
                                        labelId="cr-label"
                                        value={monsterStatblock.cr}
                                        label="CR"
                                        onChange={(e) => {
                                            const cr = e.target.value as number;
                                            setMonsterStatblock(prev => ({ ...prev, cr, challenge_rating: crToString(cr) }));
                                        }}
                                    >
                                        <MenuItem value={0}>0 (0 XP)</MenuItem>
                                        <MenuItem value={0.125}>1/8 (25 XP)</MenuItem>
                                        <MenuItem value={0.25}>1/4 (50 XP)</MenuItem>
                                        <MenuItem value={0.5}>1/2 (100 XP)</MenuItem>
                                        <MenuItem value={1}>1 (200 XP)</MenuItem>
                                        <MenuItem value={2}>2 (450 XP)</MenuItem>
                                        <MenuItem value={3}>3 (700 XP)</MenuItem>
                                        <MenuItem value={4}>4 (1,100 XP)</MenuItem>
                                        <MenuItem value={5}>5 (1,800 XP)</MenuItem>
                                        <MenuItem value={6}>6 (2,300 XP)</MenuItem>
                                        <MenuItem value={7}>7 (2,900 XP)</MenuItem>
                                        <MenuItem value={8}>8 (3,900 XP)</MenuItem>
                                        <MenuItem value={9}>9 (5,000 XP)</MenuItem>
                                        <MenuItem value={10}>10 (5,900 XP)</MenuItem>
                                        <MenuItem value={11}>11 (7,200 XP)</MenuItem>
                                        <MenuItem value={12}>12 (8,400 XP)</MenuItem>
                                        <MenuItem value={13}>13 (10,000 XP)</MenuItem>
                                        <MenuItem value={14}>14 (11,500 XP)</MenuItem>
                                        <MenuItem value={15}>15 (13,000 XP)</MenuItem>
                                        <MenuItem value={16}>16 (15,000 XP)</MenuItem>
                                        <MenuItem value={17}>17 (18,000 XP)</MenuItem>
                                        <MenuItem value={18}>18 (20,000 XP)</MenuItem>
                                        <MenuItem value={19}>19 (22,000 XP)</MenuItem>
                                        <MenuItem value={20}>20 (25,000 XP)</MenuItem>
                                        <MenuItem value={21}>21 (33,000 XP)</MenuItem>
                                        <MenuItem value={22}>22 (41,000 XP)</MenuItem>
                                        <MenuItem value={23}>23 (50,000 XP)</MenuItem>
                                        <MenuItem value={24}>24 (62,000 XP)</MenuItem>
                                        <MenuItem value={25}>25 (75,000 XP)</MenuItem>
                                        <MenuItem value={26}>26 (90,000 XP)</MenuItem>
                                        <MenuItem value={27}>27 (105,000 XP)</MenuItem>
                                        <MenuItem value={28}>28 (120,000 XP)</MenuItem>
                                        <MenuItem value={29}>29 (135,000 XP)</MenuItem>
                                        <MenuItem value={30}>30 (155,000 XP)</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>

                        {/* Ability Scores + HP/AC row */}
                        <Grid container spacing={1} marginY={rowSpacing} direction="column" sx={{ alignItems: "center" }}>
                            <IconContext.Provider value={{ size: "28px" }}>
                                <Grid container direction="row" spacing={1} sx={{ width: '100%' }}>
                                    <Grid size={2.5}>
                                        <AbilityScoreInput name="strength" label="Strength"
                                            value={monsterStatblock.strength} onChange={handleInputChange}
                                            icon={<GiStrongMan />} modifier={scoreToMod(monsterStatblock.strength)} />
                                    </Grid>
                                    <Grid size={2.5}>
                                        <AbilityScoreInput name="dexterity" label="Dexterity"
                                            value={monsterStatblock.dexterity} onChange={handleInputChange}
                                            icon={<GiRunningNinja />} modifier={scoreToMod(monsterStatblock.dexterity)} />
                                    </Grid>
                                    <Grid size={2.5}>
                                        <AbilityScoreInput name="constitution" label="Constitution"
                                            value={monsterStatblock.constitution} onChange={handleInputChange}
                                            icon={<GiBearHead />} modifier={scoreToMod(monsterStatblock.constitution)} />
                                    </Grid>
                                    <Grid size={0.5}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                                            <GiHeartPlus size={40} />
                                        </Box>
                                    </Grid>
                                    <Grid size={1.5}>
                                        <TextField name="hit_points" label="Hit Points" variant="outlined"
                                            value={monsterStatblock.hit_points ?? ''} onChange={handleInputChange}
                                            type="number"
                                            slotProps={{ input: { style: { width: '13ch', textAlign: 'center' } } }}
                                            sx={{ '& .MuiInputBase-root': { width: '80px' } }} />
                                    </Grid>
                                    <Grid size={2.5}>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                            <TextField name="hit_dice_num" label="Hit Dice" variant="outlined" type="number"
                                                value={monsterStatblock.hit_dice_num ?? ''}
                                                onChange={(e) => handleHitDiceChange(Number(e.target.value))}
                                                slotProps={{ input: { style: { width: '13ch', textAlign: 'center' } } }}
                                                sx={{ '& .MuiInputBase-root': { width: '80px' } }} />
                                            <Box sx={{
                                                alignItems: 'center',
                                                backgroundColor: theme.palette.primary.light,
                                                border: '1px solid grey',
                                                borderRadius: '4px',
                                            }}>
                                                <Typography variant="h6" sx={{ width: '3ch', textAlign: 'center', margin: 'auto', lineHeight: '60px' }}>
                                                    {hitDieSize}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Grid>
                                </Grid>
                                <Grid container direction="row" spacing={1} sx={{ width: '100%' }}>
                                    <Grid size={2.5}>
                                        <AbilityScoreInput name="intelligence" label="Intelligence"
                                            value={monsterStatblock.intelligence} onChange={handleInputChange}
                                            icon={<GiBrain />} modifier={scoreToMod(monsterStatblock.intelligence)} />
                                    </Grid>
                                    <Grid size={2.5}>
                                        <AbilityScoreInput name="wisdom" label="Wisdom"
                                            value={monsterStatblock.wisdom} onChange={handleInputChange}
                                            icon={<GiOwl />} modifier={scoreToMod(monsterStatblock.wisdom)} />
                                    </Grid>
                                    <Grid size={2.5}>
                                        <AbilityScoreInput name="charisma" label="Charisma"
                                            value={monsterStatblock.charisma} onChange={handleInputChange}
                                            icon={<FaMasksTheater />} modifier={scoreToMod(monsterStatblock.charisma)} />
                                    </Grid>
                                    <Grid size={0.5}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                                            <GiAbdominalArmor size={40} />
                                        </Box>
                                    </Grid>
                                    <Grid size={1}>
                                        <TextField name="armor_class" label="AC" variant="outlined"
                                            value={monsterStatblock.armor_class ?? ''} type="number"
                                            onChange={handleInputChange} />
                                    </Grid>
                                    <Grid size={2.5}>
                                        <TextField name="armor_desc" label="Armor Desc" variant="outlined"
                                            value={monsterStatblock.armor_desc ?? ''} onChange={handleInputChange} />
                                    </Grid>
                                </Grid>
                            </IconContext.Provider>
                        </Grid>

                        {/* Speed */}
                        <Grid container spacing={2} marginY={rowSpacing} sx={{ justifyContent: "space-evenly", alignItems: "center" }}>
                            {[
                                { name: 'walk', label: 'Walk', icon: <GiSprint size={50} />, val: monsterStatblock.speed.walk },
                                { name: 'climb', label: 'Climb', icon: <GiMountainClimbing size={50} />, val: monsterStatblock.speed.climb },
                                { name: 'swim', label: 'Swim', icon: <GrSwim size={50} />, val: monsterStatblock.speed.swim },
                                { name: 'fly', label: 'Fly', icon: <GiFlyingTrout size={50} />, val: monsterStatblock.speed.fly },
                                { name: 'burrow', label: 'Burrow', icon: <GiDigHole size={60} />, val: monsterStatblock.speed.burrow },
                            ].map(({ name, label, icon, val }) => (
                                <Grid key={name} size={12 / 5}>
                                    <Stack direction="row" spacing={1}>
                                        {icon}
                                        <TextField name={name} label={label} variant="outlined"
                                            value={val ?? ''} onChange={handleSpeedChange} type="number" />
                                    </Stack>
                                </Grid>
                            ))}
                        </Grid>

                        {/* Skills / Saves / Conditions */}
                        <Grid container spacing={2} marginY={rowSpacing}>
                            <Stack spacing={1}>
                                <Stack direction="row" spacing={1}>
                                    <FormControl>
                                        <InputLabel id="skill-label">Skills</InputLabel>
                                        <Select labelId="skill-label" value={selectedSkill} label="Skills"
                                            onChange={(e) => setSelectedSkill(e.target.value)} style={{ width: 157 }}>
                                            {["acrobatics","animal_handling","arcana","athletics","deception","history","insight","intimidation","investigation","medicine","nature","perception","performance","persuasion","religion","sleight_of_hand","stealth","survival"].map(s => (
                                                <MenuItem key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <ButtonGroup>
                                        <Button type="button" variant="outlined" onClick={() => addSkillProficiency("proficient")}>Proficient</Button>
                                        <Button type="button" variant="outlined" onClick={() => addSkillProficiency("expertise")}>Expertise</Button>
                                    </ButtonGroup>
                                </Stack>
                                {Object.entries(monsterStatblock.skill_proficiencies ?? {}).map(([key, val]) => {
                                    if (!val) return null;
                                    return (
                                        <div key={key + val}>
                                            <Button name={key} onClick={() => removeSkillProficiency(key)} variant="outlined">
                                                {key} ({val})&nbsp;<BsFillTrashFill />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </Stack>
                            <Grid>
                                <Stack spacing={1}>
                                    <Stack direction="row" spacing={1}>
                                        <FormControl>
                                            <InputLabel id="save-label">Saving Throws</InputLabel>
                                            <Select labelId="save-label" value={selectedSave} label="Saving Throws"
                                                onChange={(e) => setSelectedSave(e.target.value)} style={{ width: 157 }}>
                                                {["strength","dexterity","constitution","intelligence","wisdom","charisma"].map(s => (
                                                    <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <ButtonGroup>
                                            <Button type="button" variant="outlined" onClick={addSaveProficiency}>Proficient</Button>
                                        </ButtonGroup>
                                    </Stack>
                                    {(monsterStatblock.save_proficiencies ?? []).map((save, i) => (
                                        <div key={save + i}>
                                            <Button name={save} onClick={() => removeSaveProficiency(save)} variant="outlined">
                                                {save}&nbsp;<BsFillTrashFill />
                                            </Button>
                                        </div>
                                    ))}
                                </Stack>
                            </Grid>
                            <Grid>
                                <Stack spacing={1}>
                                    <Stack direction="row" spacing={1}>
                                        <FormControl>
                                            <InputLabel id="condition-label">Conditions</InputLabel>
                                            <Select labelId="condition-label" value={selectedCondition} label="Conditions"
                                                onChange={(e) => setSelectedCondition(e.target.value)} style={{ width: 157 }}>
                                                {["bleed","blinded","charmed","deafened","exhaustion","frightened","frostbitten","grappled","incapacitated","invisible","paralyzed","petrified","poisoned","prone","restrained","rotting","stunned","unconscious"].map(c => (
                                                    <MenuItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <ButtonGroup>
                                            <Button type="button" onClick={addConditionImmunity}>Immune</Button>
                                        </ButtonGroup>
                                    </Stack>
                                    {(monsterStatblock.condition_immunity_list ?? []).map((condition, i) => (
                                        <div key={condition + i}>
                                            <Button name={condition} onClick={() => removeConditionImmunity(condition)} variant="outlined">
                                                {condition}&nbsp;<BsFillTrashFill />
                                            </Button>
                                        </div>
                                    ))}
                                </Stack>
                            </Grid>
                        </Grid>

                        {/* Damage types */}
                        <Grid container spacing={2} marginY={rowSpacing}>
                            <Grid>
                                <Stack spacing={1}>
                                    <Stack direction="row" spacing={1}>
                                        <FormControl>
                                            <InputLabel id="damage-label">Damage Types</InputLabel>
                                            <Select labelId="damage-label" value={selectedDamage} label="Damage Types"
                                                onChange={(e) => setSelectedDamage(e.target.value)} style={{ width: 157 }}>
                                                <MenuItem value="acid">Acid</MenuItem>
                                                <MenuItem value="bludgeoning">Bludgeoning</MenuItem>
                                                <MenuItem value="cold">Cold</MenuItem>
                                                <MenuItem value="fire">Fire</MenuItem>
                                                <MenuItem value="force">Force</MenuItem>
                                                <MenuItem value="lightning">Lightning</MenuItem>
                                                <MenuItem value="necrotic">Necrotic</MenuItem>
                                                <MenuItem value="piercing">Piercing</MenuItem>
                                                <MenuItem value="poison">Poison</MenuItem>
                                                <MenuItem value="psychic">Psychic</MenuItem>
                                                <MenuItem value="radiant">Radiant</MenuItem>
                                                <MenuItem value="slashing">Slashing</MenuItem>
                                                <MenuItem value="thunder">Thunder</MenuItem>
                                                <MenuItem value="bludgeoning, piercing, and slashing from nonmagical attacks">Nonmagical BPS</MenuItem>
                                                <MenuItem value="bludgeoning, piercing, and slashing from nonmagical attacks that aren't Silvered.">Nonsilver BPS</MenuItem>
                                                <MenuItem value="bludgeoning, piercing, and slashing from nonmagical attacks not made with Adamantine">Nonadamantine BPS</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <ButtonGroup>
                                            <Button type="button" onClick={() => handleDamageModification('vulnerability')}>Vulnerable</Button>
                                            <Button type="button" onClick={() => handleDamageModification('resistance')}>Resistant</Button>
                                            <Button type="button" onClick={() => handleDamageModification('immunity')}>Immune</Button>
                                        </ButtonGroup>
                                    </Stack>
                                    {(monsterStatblock.damage_vulnerability_list ?? []).filter(Boolean).map((damage, i) => (
                                        <div key={damage + i}>
                                            <Button name={damage} onClick={() => removeDamageModification(damage)} variant="outlined">
                                                {damage} (Vulnerable)&nbsp;<BsFillTrashFill />
                                            </Button>
                                        </div>
                                    ))}
                                    {(monsterStatblock.damage_resistance_list ?? []).filter(Boolean).map((damage, i) => (
                                        <div key={damage + i}>
                                            <Button name={damage} onClick={() => removeDamageModification(damage)} variant="outlined">
                                                {damage} (Resistant)&nbsp;<BsFillTrashFill />
                                            </Button>
                                        </div>
                                    ))}
                                    {(monsterStatblock.damage_immunity_list ?? []).filter(Boolean).map((damage, i) => (
                                        <div key={damage + i}>
                                            <Button name={damage} onClick={() => removeDamageModification(damage)} variant="outlined">
                                                {damage} (Immune)&nbsp;<BsFillTrashFill />
                                            </Button>
                                        </div>
                                    ))}
                                </Stack>
                            </Grid>
                        </Grid>
                    </FormControl>

                    {/* Senses / Languages */}
                    <Grid container spacing={2} marginY={rowSpacing}>
                        <Grid size={4}>
                            <TextField fullWidth name="languages" label="Languages" variant="outlined"
                                value={monsterStatblock.languages ?? ''} onChange={handleInputChange} />
                        </Grid>
                        <Grid size={2}>
                            <TextField name="blindsight" label="Blindsight (ft.)" variant="outlined"
                                value={monsterStatblock.blindsight ?? ''} onChange={handleInputChange} type="number" />
                            <FormControlLabel
                                control={<Checkbox name="blindBeyond" checked={monsterStatblock.blindBeyond ?? false} onChange={handleCheckboxChange} />}
                                label="Blind Beyond?" />
                        </Grid>
                        <Grid size={2}>
                            <TextField name="darkvision" label="Darkvision (ft.)" variant="outlined"
                                value={monsterStatblock.darkvision ?? ''} onChange={handleInputChange} type="number" />
                        </Grid>
                        <Grid size={2}>
                            <TextField name="tremorsense" label="Tremorsense (ft.)" variant="outlined"
                                value={monsterStatblock.tremorsense ?? ''} onChange={handleInputChange} type="number" />
                        </Grid>
                        <Grid size={2}>
                            <TextField name="truesight" label="Truesight (ft.)" variant="outlined"
                                value={monsterStatblock.truesight ?? ''} onChange={handleInputChange} type="number" />
                        </Grid>
                    </Grid>

                    {/* Abilities / Actions sections */}
                    <Stack spacing={1}>
                        {([
                            { key: 'special_abilities' as AbilityArrayKey, label: 'Abilities', btnLabel: 'New Ability', prefix: 'New Ability' },
                            { key: 'bonus_actions' as AbilityArrayKey, label: 'Bonus Actions', btnLabel: 'New Bonus Action', prefix: 'New Bonus Action' },
                            { key: 'reactions' as AbilityArrayKey, label: 'Reactions', btnLabel: 'New Reaction', prefix: 'New Reaction' },
                        ]).map(({ key, label, btnLabel, prefix }) => (
                            <React.Fragment key={key}>
                                <Stack direction="row">
                                    <Typography align="center" height="100%" padding="5px">{label}:</Typography>
                                    <Button type="button" onClick={() => addAbilityItem(key, prefix)} variant="contained">{btnLabel}</Button>
                                </Stack>
                                {((monsterStatblock[key] as MyMonsterAbility[]) ?? []).map((ability, index) => (
                                    <AbilityRow key={ability.name + index} ability={ability} index={index}
                                        handleAbilityUpdate={(a: MyMonsterAbility, i: number) => updateAbilityItem(key, a, i)}
                                        handleAbilityRemove={() => removeItem(key, index)}
                                        moveCreatureItemUp={() => moveCreatureItemUp(key, index)}
                                        moveCreatureItemDown={() => moveCreatureItemDown(key, index)} />
                                ))}
                            </React.Fragment>
                        ))}

                        <Stack direction="row">
                            <Typography align="center" height="100%" padding="5px">Actions:</Typography>
                            <Button type="button" onClick={addAction} variant="contained">New Action</Button>
                        </Stack>
                        {(monsterStatblock.actions ?? []).map((action, index) => (
                            <ActionRow key={action.name + index} action={action} index={index}
                                monsterData={monsterStatblock}
                                handleActionUpdate={handleActionUpdate}
                                handleActionRemove={() => removeItem('actions', index)}
                                moveCreatureItemUp={() => moveCreatureItemUp('actions', index)}
                                moveCreatureItemDown={() => moveCreatureItemDown('actions', index)} />
                        ))}

                        <TextField name="legendary_desc" label="Legendary Description" variant="outlined"
                            value={monsterStatblock.legendary_desc ?? ''} onChange={handleInputChange} multiline fullWidth />

                        {([
                            { key: 'legendary_actions' as AbilityArrayKey, label: 'Legendary Actions', btnLabel: 'New Legendary Action', prefix: 'New Legendary Action' },
                        ]).map(({ key, label, btnLabel, prefix }) => (
                            <React.Fragment key={key}>
                                <Stack direction="row">
                                    <Typography align="center" height="100%" padding="5px">{label}:</Typography>
                                    <Button type="button" onClick={() => addAbilityItem(key, prefix)} variant="contained">{btnLabel}</Button>
                                </Stack>
                                {((monsterStatblock[key] as MyMonsterAbility[]) ?? []).map((ability, index) => (
                                    <AbilityRow key={ability.name + index} ability={ability} index={index}
                                        handleAbilityUpdate={(a: MyMonsterAbility, i: number) => updateAbilityItem(key, a, i)}
                                        handleAbilityRemove={() => removeItem(key, index)}
                                        moveCreatureItemUp={() => moveCreatureItemUp(key, index)}
                                        moveCreatureItemDown={() => moveCreatureItemDown(key, index)} />
                                ))}
                            </React.Fragment>
                        ))}

                        <TextField name="mythic_desc" label="Mythic Description" variant="outlined"
                            value={monsterStatblock.mythic_desc ?? ''} onChange={handleInputChange} multiline fullWidth />

                        {([
                            { key: 'mythic_actions' as AbilityArrayKey, label: 'Mythic Actions', btnLabel: 'New Mythic Action', prefix: 'New Mythic Action' },
                        ]).map(({ key, label, btnLabel, prefix }) => (
                            <React.Fragment key={key}>
                                <Stack direction="row">
                                    <Typography align="center" height="100%" padding="5px">{label}:</Typography>
                                    <Button type="button" onClick={() => addAbilityItem(key, prefix)} variant="contained">{btnLabel}</Button>
                                </Stack>
                                {((monsterStatblock[key] as MyMonsterAbility[]) ?? []).map((ability, index) => (
                                    <AbilityRow key={ability.name + index} ability={ability} index={index}
                                        handleAbilityUpdate={(a: MyMonsterAbility, i: number) => updateAbilityItem(key, a, i)}
                                        handleAbilityRemove={() => removeItem(key, index)}
                                        moveCreatureItemUp={() => moveCreatureItemUp(key, index)}
                                        moveCreatureItemDown={() => moveCreatureItemDown(key, index)} />
                                ))}
                            </React.Fragment>
                        ))}

                        <TextField name="desc" label="Creature Description" variant="outlined"
                            value={monsterStatblock.desc ?? ''} onChange={handleInputChange} multiline fullWidth />
                    </Stack>
                </form>
                <MarkdownExport monster={monsterStatblock} />
            </div>
        </div>
    );
};

export default CreateMonsterStatblock;
