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
import React, { ChangeEvent, Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
// Use an any-typed alias to avoid MUI Grid typing overload issues while we migrate props
import { calculateDependentStats, getMonsterProf, scoreToMod } from "@/5eReference/converters";
import AbilityRow from "@/app/components/creatorComponents/abilityrow";
import ActionRow from "@/app/components/creatorComponents/actionrow";
import MonsterSheet from "@/app/components/creatorComponents/monsterSheet";
import html2canvas from "html2canvas";
import { BsFillTrashFill } from "react-icons/bs";
import { FaMasksTheater } from "react-icons/fa6";
import { GiAbdominalArmor, GiBearHead, GiBrain, GiDigHole, GiFlyingTrout, GiHeartPlus, GiMountainClimbing, GiOwl, GiRunningNinja, GiSprint, GiStrongMan, } from "react-icons/gi";
// import AbilityScoreInput from './AbilityScoreInput';
import { type Schema } from '@/amplify/data/resource';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import { generateClient } from 'aws-amplify/data';
import Image from 'next/image';
import { IconContext } from 'react-icons';
import AbilityScoreInput from './abilityscoreinput';
import { GrSwim } from "react-icons/gr";
import HeaderRow from './headerrow';
// import { Amplify } from "aws-amplify";
// import outputs from "@/amplify_outputs.json";
// import "@aws-amplify/ui-react/styles.css";

// Amplify.configure(outputs);

const client = generateClient<Schema>();
type MyMonsterStatblock = Schema['MonsterStatblock']['type'];
type MyMonsterAbility = Schema['MonsterAbility']['type'];
type MyMonsterAttack = Schema['MonsterAttack']['type'];


// Assumed interface for the minimal list item returned by the list query
interface MonsterListItem {
    id: string;
    publisher: string;
    name: string;
    slug?: string; // Included based on the initial state definition
}

// Assumed type for the new monster default stats
// Assuming `newMonsterStats` is an object that contains default properties for a new monster.
// Since it's spread into the input, it should be a partial of the statblock type.
// (newMonsterStats is defined below as a concrete default)


// --- Component Props Interface ---
interface HeaderRowProps {
    monster: MyMonsterStatblock;
    // setMonster is a React state setter function that takes a MonsterStatblock or a function updating it.
    setMonster: React.Dispatch<React.SetStateAction<MyMonsterStatblock>>;
    downloadFile: () => void;
}

// --- The TypeScript Component ---

const newMonsterStats = {
    id: '0',
    name: 'New Monster',
    desc: '',
    size: 'medium',
    type: 'humanoid',
    publisher: 'spellbound',
    group: "",
    subtype: '',
    alignment: 'lawful good',
    armor_class: 10,
    armor_desc: '',
    hit_points: 8,
    hit_dice: '1d8',
    hit_dice_num: 1,
    speed: {
        walk: 30,
        swim: 0,
        fly: 0,
        burrow: 0,
        climb: 0,
        hover: false,
    },
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    strength_save: 0,
    dexterity_save: 0,
    constitution_save: 0,
    intelligence_save: 0,
    wisdom_save: 0,
    charisma_save: 0,
    save_proficiencies: [],
    perception: 0,
    skills: {},
    skill_proficiencies: {},
    damage_vulnerabilities: '',
    damage_vulnerability_list: [],
    damage_resistances: '',
    damage_resistance_list: [],
    damage_immunities: '',
    damage_immunity_list: [],
    condition_immunities: '',
    condition_immunity_list: [],
    blindsight: 0,
    blindBeyond: false,
    darkvision: 0,
    tremorsense: 0,
    truesight: 0,
    senses: '',
    languages: '',
    challenge_rating: "0",
    cr: 0.0,
    actions: [],
    bonus_actions: [],
    reactions: [],
    legendary_desc: '',
    legendary_actions: [],
    special_abilities: [],
    mythic_desc: '',
    mythic_actions: [],
}

import { styled } from '@mui/material/styles';
import MarkdownExport from './monsterMarkdown';

// const Item = styled(Paper)(({ theme }) => ({
//     backgroundColor: '#fff',
//     ...theme.typography.body2,
//     padding: theme.spacing(1),
//     textAlign: 'center',
//     color: (theme.vars ?? theme).palette.text.secondary,
//     ...theme.applyStyles('dark', {
//         backgroundColor: '#1A2027',
//     }),
//     border: 'none',
// }));

const Item = styled('div')(({}))

// Define a type for the keys that map to arrays in the statblock for moving items
type MonsterArrayKey = 'special_abilities' | 'actions' | 'bonus_actions' | 'reactions' | 'legendary_actions' | 'mythic_actions';


const CreateMonsterStatblock = () => {

    const [monsterStatblock, setMonsterStatblock] = useState<MyMonsterStatblock>({
        ...newMonsterStats,
        speed: newMonsterStats.speed || { walk: 0, swim: 0, fly: 0, burrow: 0, climb: 0, hover: false }
    });

    // --- KEPT HELPER STATE ---
    const [selectedSave, setSelectedSave] = useState<string>("strength")
    const [selectedSkill, setSelectedSkill] = useState<string>("acrobatics")
    const [selectedDamage, setSelectedDamage] = useState<string>("acid")
    const [selectedCondition, setSelectedCondition] = useState<string>("blinded")
    const [hitDieSize, setHitDieSize] = useState<string>("d8")

    // --- REMOVED ALL REDUNDANT STATE ---
    // [saveList, setSaveList]
    // [skillList, setSkillList]
    // [conditionImmunityList, setConditionImmunityList]
    // [specialAbilities, setSpecialAbilities]
    // [actions, setActions]
    // [bonusActions, setBonusActions]
    // [reactions, setReactions]
    // [legendaryActions, setLegendaryActions]
    // [mythicActions, setMythicActions]
    // ... (damage lists were removed in the previous step) ...


    const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target as HTMLInputElement & { name: string; value: any };
        setMonsterStatblock({ ...monsterStatblock, ...calculateDependentStats({...monsterStatblock, [name]: value}), [name]: value });
    };

    const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = event.target;
        setMonsterStatblock(prev => ({
            ...prev,
            [name]: checked
        }));
    };

    const rowSpacing = 1

    const handleSpeedChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target as HTMLInputElement & { name: string; value: any };
        setMonsterStatblock({
            ...monsterStatblock,
            speed: {
                ...monsterStatblock.speed,
                [name]: parseInt(value, 0),
            },
        })
    }

    // --- REFACTORED Handlers (Saves, Skills, Conditions) ---

    const addSaveProficiency = () => {
        setMonsterStatblock(prevMonster => {
            const currentSaves = prevMonster.save_proficiencies ?? [];
            const newSaves = currentSaves.includes(selectedSave) ? currentSaves : [...currentSaves, selectedSave];
            
            // Recalculate derived stats
            const tempMonster = { ...prevMonster, save_proficiencies: newSaves };
            const calculatedFields = calculateDependentStats(tempMonster);
            
            return { ...tempMonster, ...calculatedFields };
        });
    }

    const removeSaveProficiency = (saveToRemove: string) => {
        setMonsterStatblock(prevMonster => {
            const newSaves = (prevMonster.save_proficiencies ?? []).filter((save) => save !== saveToRemove)
            
            // Recalculate derived stats
            const tempMonster = { ...prevMonster, save_proficiencies: newSaves };
            const calculatedFields = calculateDependentStats(tempMonster);
            
            return { ...tempMonster, ...calculatedFields };
        });
    }

    const addSkillProficiency = async (proficiency: string | null) => {
         setMonsterStatblock(prevMonster => {
            const newSkills = { ...(prevMonster.skill_proficiencies ?? {}), [selectedSkill]: proficiency };

            // Recalculate derived stats
            const tempMonster = { ...prevMonster, skill_proficiencies: newSkills };
            const calculatedFields = calculateDependentStats(tempMonster);

            return { ...tempMonster, ...calculatedFields };
         });
    }

    const removeSkillProficiency = (skillToRemove: string) => {
        setMonsterStatblock(prevMonster => {
            const newSkills = { ...(prevMonster.skill_proficiencies ?? {}), [skillToRemove]: null };
            
            // Recalculate derived stats
            const tempMonster = { ...prevMonster, skill_proficiencies: newSkills };
            const calculatedFields = calculateDependentStats(tempMonster);

            return { ...tempMonster, ...calculatedFields };
         });
    }
    
    const addConditionImmunity = () => {
        setMonsterStatblock(prev => {
            const currentConditions = prev.condition_immunity_list ?? [];
            if (currentConditions.includes(selectedCondition)) {
                return prev;
            }
            const newConditions = [...currentConditions, selectedCondition];
            return {
                ...prev,
                condition_immunity_list: newConditions,
                condition_immunities: newConditions.join(", ")
            };
        });
    }

    const removeConditionImmunity = (conditionToRemove: string) => {
        setMonsterStatblock(prev => {
            const newConditions = (prev.condition_immunity_list ?? []).filter((condition) => condition !== conditionToRemove);
            return {
                ...prev,
                condition_immunity_list: newConditions,
                condition_immunities: newConditions.join(", ")
            };
        });
    }

    // --- REFACTORED Damage Handlers (from previous step, for completeness) ---

    const handleDamageModification = (modType: 'vulnerability' | 'resistance' | 'immunity') => {
        setMonsterStatblock(prevMonster => {
            if (!selectedDamage) return prevMonster; 

            let vulnerabilities = (prevMonster.damage_vulnerability_list || []).filter(d => d !== selectedDamage && d);
            let resistances = (prevMonster.damage_resistance_list || []).filter(d => d !== selectedDamage && d);
            let immunities = (prevMonster.damage_immunity_list || []).filter(d => d !== selectedDamage && d);

            if (modType === 'vulnerability') {
                vulnerabilities.push(selectedDamage);
            } else if (modType === 'resistance') {
                resistances.push(selectedDamage);
            } else if (modType === 'immunity') {
                immunities.push(selectedDamage);
            }

            return {
                ...prevMonster,
                damage_vulnerability_list: vulnerabilities,
                damage_vulnerabilities: vulnerabilities.join(", "),
                damage_resistance_list: resistances,
                damage_resistances: resistances.join(", "),
                damage_immunity_list: immunities,
                damage_immunities: immunities.join(", "),
            };
        });
    };

    const removeDamageModification = (damageToRemove: string) => {
        setMonsterStatblock(prevMonster => {
            const newVulnerabilities = (prevMonster.damage_vulnerability_list || []).filter(d => d !== damageToRemove);
            const newResistances = (prevMonster.damage_resistance_list || []).filter(d => d !== damageToRemove);
            const newImmunities = (prevMonster.damage_immunity_list || []).filter(d => d !== damageToRemove);
            
            return {
                ...prevMonster,
                damage_vulnerability_list: newVulnerabilities,
                damage_vulnerabilities: newVulnerabilities.join(", "),
                damage_resistance_list: newResistances,
                damage_resistances: newResistances.join(", "),
                damage_immunity_list: newImmunities,
                damage_immunities: newImmunities.join(", "),
            };
        });
    };
    

    const getPassivePerception = () => {
        // This logic is now handled by calculateDependentStats, but we keep the function
        // in case it's used elsewhere. The `useEffect` replacement will overwrite this.
        // A better refactor would be to remove this and just use `monsterStatblock.perception`.
        // For now, we trust `calculateDependentStats` to set `monsterStatblock.perception`.
        return monsterStatblock.perception ?? 10 + Number(scoreToMod(monsterStatblock.wisdom));
    }


    // --- REFACTORED `moveCreatureItemUp/Down` ---
    
    const moveCreatureItemUp = (item_key: MonsterArrayKey, index: number) => {
        setMonsterStatblock(prev => {
            const list = (prev[item_key] as any[] | undefined) ?? [];
            if (index === 0) return prev; // Cannot move up
            
            const newList = [...list];
            const item = newList[index - 1];
            newList[index - 1] = newList[index];
            newList[index] = item;
            
            return { ...prev, [item_key]: newList };
        });
    }

    const moveCreatureItemDown = (item_key: MonsterArrayKey, index: number) => {
         setMonsterStatblock(prev => {
            const list = (prev[item_key] as any[] | undefined) ?? [];
            if (index === list.length - 1) return prev; // Cannot move down
            
            const newList = [...list];
            const item = newList[index];
            newList[index] = newList[index + 1];
            newList[index + 1] = item;
            
            return { ...prev, [item_key]: newList };
        });
    }


    // --- DELETED THE GIANT `useEffect` HOOK ---
    // [ The useEffect that synced saveList, skillList, etc., has been removed ]


    // --- REFACTORED Handlers (Abilities, Actions, etc.) ---

    const addSpecialAbility = () => {
        setMonsterStatblock(prev => {
            const currentAbilities = prev.special_abilities ?? [];
            const ability_num = currentAbilities.length.toString();
            const newAbility = { name: `New Ability ${ability_num}`, desc: "New Description" };
            return { ...prev, special_abilities: [...currentAbilities, newAbility] };
        });
    }

    const removeSpecialAbility = (index: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            special_abilities: (prev.special_abilities ?? []).filter((_, i) => i !== index)
        }));
    }

    const handleSpecialAbilityUpdate = (ability: MyMonsterAbility, index: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            special_abilities: (prev.special_abilities ?? []).map((old, i) => i === index ? ability : old)
        }));
    }

    const addAction = () => {
        setMonsterStatblock(prev => {
            const currentActions = prev.actions ?? [];
            const action_num = currentActions.length.toString();
            const newAction = {
                name: `New Action ${action_num}`,
                desc: "Action",
                type: "Melee Weapon Attack",
                reach: 5,
                attack_bonus: "[STR ATK]",
                short_range: 0,
                long_range: 0,
                targets: "One Target.",
                damage: [{ damage_dice: "1d6", damage_type: "slashing" }],
            };
            return { ...prev, actions: [...currentActions, newAction] };
        });
    }

    const removeAction = (index: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            actions: (prev.actions ?? []).filter((_, i) => i !== index)
        }));
    }

    const handleActionUpdate = (action: MyMonsterAttack, index: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            actions: (prev.actions ?? []).map((old, i) => i === index ? action : old)
        }));
    }

    const addBonusAction = () => {
        setMonsterStatblock(prev => {
            const current = prev.bonus_actions ?? [];
            const num = current.length.toString();
            const newAbility = { name: `New Bonus Action ${num}`, desc: "New Description" };
            return { ...prev, bonus_actions: [...current, newAbility] };
        });
    }

    const removeBonusAction = (index: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            bonus_actions: (prev.bonus_actions ?? []).filter((_, i) => i !== index)
        }));
    }

    const handleBonusActionUpdate = (bonusAction: MyMonsterAbility, index: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            bonus_actions: (prev.bonus_actions ?? []).map((old, i) => i === index ? bonusAction : old)
        }));
    }

    const addReaction = () => {
        setMonsterStatblock(prev => {
            const current = prev.reactions ?? [];
            const num = current.length.toString();
            const newAbility = { name: `New Reaction ${num}`, desc: "New Description" };
            return { ...prev, reactions: [...current, newAbility] };
        });
    }

    const removeReaction = (index: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            reactions: (prev.reactions ?? []).filter((_, i) => i !== index)
        }));
    }

    const handleReactionUpdate = (reaction: MyMonsterAbility, index: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            reactions: (prev.reactions ?? []).map((old, i) => i === index ? reaction : old)
        }));
    }

    const addLegendaryAction = () => {
        setMonsterStatblock(prev => {
            const current = prev.legendary_actions ?? [];
            const num = current.length.toString();
            const newAbility = { name: `New Legendary Action ${num}`, desc: "New Description" };
            return { ...prev, legendary_actions: [...current, newAbility] };
        });
    }

    const removeLegendaryAction = (index: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            legendary_actions: (prev.legendary_actions ?? []).filter((_, i) => i !== index)
        }));
    }

    const handleLegendaryActionUpdate = (legendaryAction: MyMonsterAbility, index: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            legendary_actions: (prev.legendary_actions ?? []).map((old, i) => i === index ? legendaryAction : old)
        }));
    }

    const addMythicAction = () => {
         setMonsterStatblock(prev => {
            const current = prev.mythic_actions ?? [];
            const num = current.length.toString();
            const newAbility = { name: `New Mythic Action ${num}`, desc: "New Description" };
            return { ...prev, mythic_actions: [...current, newAbility] };
        });
    }

    const removeMythicAction = (index: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            mythic_actions: (prev.mythic_actions ?? []).filter((_, i) => i !== index)
        }));
    }

    const handleMythicActionUpdate = (mythicAction: MyMonsterAbility, index: number) => {
        setMonsterStatblock(prev => ({
            ...prev,
            mythic_actions: (prev.mythic_actions ?? []).map((old, i) => i === index ? mythicAction : old)
        }));
    }

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Perform any validation here
        // Send the monsterStatblock object to your backend or store it in state
        console.log(monsterStatblock);
    };

    const handleSizeChange = (e: SelectChangeEvent) => {
        console.log("Changing hit dice size", e)
        const size = e.target.value
        setMonsterStatblock({ ...monsterStatblock, size: size })
        changeSize(size)
    }

    const changeSize = (size: string) => {
        if (size === "tiny") {
            setHitDieSize("d4")
        } else if (size === "small") {
            setHitDieSize("d6")
        } else if (size === "medium") {
            setHitDieSize("d8")
        } else if (size === "large") {
            setHitDieSize("d10")
        } else if (size === "huge") {
            setHitDieSize("d12")
        } else if (size === "gargantuan") {
            setHitDieSize("d20")
        }
    }

    const handleHitDiceChange = (dieNum: number) => {
        // console.log("HITDICE CHANGE", dieNum, parseInt(scoreToMod(monsterStatblock.constitution)))
        setMonsterStatblock(prev => ({
            ...prev,
            hit_dice_num: dieNum,
            hit_dice: `${dieNum}${hitDieSize}+${dieNum * scoreToMod(prev.constitution)}`
        }));
    }

    useEffect(() => {
        const calcHitPoints = () => {
            const dieSize = Number(hitDieSize.split("d")[1])
            if (isNaN(dieSize)) return monsterStatblock.hit_points; // Safety check
            return (Math.ceil(monsterStatblock.hit_dice_num * (dieSize / 2 + .5) + monsterStatblock.hit_dice_num * scoreToMod(monsterStatblock.constitution)))
        }

        setMonsterStatblock(prev => ({ ...prev, hit_points: calcHitPoints() }))
    }, [monsterStatblock.hit_dice_num, monsterStatblock.constitution, hitDieSize]); // Added hitDieSize dependency

    const initializedMonsterId = useRef(monsterStatblock.id);

    useEffect(() => {
        // Only run this on initial load or when monsterStatblock is replaced entirely
        if (monsterStatblock && monsterStatblock.id !== initializedMonsterId.current) {
            console.log("Initializing creature state from monsterStatblock prop", monsterStatblock)

            // --- CLEANED ---
            // This hook should just handle things that *aren't* part of the statblock
            changeSize(monsterStatblock.size)
            // All the setSaveList, setSkillList, etc. are removed.
            
            initializedMonsterId.current = monsterStatblock.id;
        }
    }, [monsterStatblock]);

    const printRef = useRef<HTMLDivElement>(null)

    const downloadFile = async () => {
        const element = printRef.current;
        if (!element) {
            console.error("No element found for downloading image")
            return
        };
        const canvas = await html2canvas(element);

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
    }

    const theme = useTheme()

    console.log("Rendering CreateMonsterStatblock")


    return (
        <div style={{ minWidth: "1300px", maxWidth: "1300px", margin: "0 auto", paddingBottom: "50px" }}>
            <HeaderRow monster={monsterStatblock} setMonster={setMonsterStatblock} downloadFile={downloadFile} />
            <div style={{ margin: "200px" }}>
                {/* <MonsterSheet statblock={monsterStatblock} printRef={printRef} style={{margin: "100px"}}/> */}
                <MonsterSheet statblock={monsterStatblock} printRef={printRef} />
            </div>
            <div className={styles.container}>
                <form onSubmit={handleSubmit}>
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
                                        labelId={"size-label"}
                                        id="size"
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
                                        labelId={"type-label"}
                                        id="type"
                                        value={monsterStatblock.type}
                                        label="Type"
                                        onChange={(e) => setMonsterStatblock({ ...monsterStatblock, type: e.target.value })}
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
                                        <MenuItem value="ooze">Ooze</MenuItem>
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
                                        id="cr"
                                        value={monsterStatblock.cr}
                                        label="CR"
                                        labelId={"cr-label"}
                                        onChange={(e) => setMonsterStatblock({ ...monsterStatblock, cr: e.target.value })}
                                    >
                                        <MenuItem value={0}>0 (0 XP)</MenuItem>
                                        <MenuItem value={.125}>1/8 (25 XP)</MenuItem>
                                        <MenuItem value={1 / 4}>1/4 (50 XP)</MenuItem>
                                        <MenuItem value={1 / 2}>1/2 (100 XP)</MenuItem>
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
                        <Grid container spacing={1} marginY={rowSpacing} direction="column" sx={{ alignItems: "center" }}>
                            <IconContext.Provider value={{ size: "28px" }}>
                                <Grid container direction="row" spacing={1} sx={{ width: '100%' }}>
                                    <Grid size={2.5}>
                                        <AbilityScoreInput
                                            name="strength"
                                            label="Strength"
                                            value={monsterStatblock.strength}
                                            onChange={handleInputChange}
                                            icon={<GiStrongMan />}
                                            modifier={scoreToMod(monsterStatblock.strength)}
                                        />
                                    </Grid>
                                    <Grid size={2.5}>
                                        <AbilityScoreInput
                                            name="dexterity"
                                            label="Dexterity"
                                            value={monsterStatblock.dexterity}
                                            onChange={handleInputChange}
                                            icon={<GiRunningNinja />}
                                            modifier={scoreToMod(monsterStatblock.dexterity)}
                                        />
                                    </Grid>
                                    <Grid size={2.5}>
                                        <AbilityScoreInput
                                            name="constitution"
                                            label="Constitution"
                                            value={monsterStatblock.constitution}
                                            onChange={handleInputChange}
                                            icon={<GiBearHead />}
                                            modifier={scoreToMod(monsterStatblock.constitution)}
                                        />
                                    </Grid>
                                    <Grid size={.5}>
                                        <Box sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            height: '100%',
                                            //   fontSize: '2rem',
                                            //   padding: '4px'
                                        }}>
                                            <GiHeartPlus size={40} />
                                        </Box>
                                    </Grid>
                                    <Grid size={1.5}>
                                        <TextField
                                            name="hit_points"
                                            label="Hit Points"
                                            variant="outlined"
                                            value={monsterStatblock.hit_points ?? ''}
                                            onChange={handleInputChange}
                                            type="number"
                                            slotProps={{
                                                input: {
                                                    style: {
                                                        width: '13ch',
                                                        textAlign: 'center',
                                                        // padding: '8px 4px'
                                                    },
                                                }
                                            }}
                                            sx={{
                                                '& .MuiInputBase-root': {
                                                    width: '80px'
                                                }
                                            }}
                                        />
                                    </Grid>
                                    <Grid size={2.5}>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                            <TextField
                                                name="hit_dice_num"
                                                label="Hit Dice"
                                                variant="outlined"
                                                type="number"
                                                value={monsterStatblock.hit_dice_num ?? ''}
                                                onChange={(e) => handleHitDiceChange(Number(e.target.value))}
                                                slotProps={{
                                                    input: {
                                                        style: {
                                                            width: '13ch',
                                                            textAlign: 'center',
                                                            // padding: '8px 4px'
                                                        },
                                                    }
                                                }}
                                                sx={{
                                                    '& .MuiInputBase-root': {
                                                        width: '80px'
                                                    }
                                                }}
                                            />
                                            <Box
                                                sx={{
                                                    // height: "100%", // Or any desired height for the container
                                                    // display: 'block',
                                                    // flexDirection: 'column', // Arrange children in a column
                                                    // justifyContent: 'center', // Vertically center the content
                                                    alignItems: 'center', // Optionally, horizontally center as well
                                                    backgroundColor: theme.palette.primary.light,
                                                    border: '1px solid grey', // For visualization
                                                    borderRadius: '4px',
                                                }}
                                                flexDirection="row"
                                            >
                                                <Typography
                                                    variant="h6"
                                                    sx={{
                                                        width: '3ch',
                                                        textAlign: 'center',
                                                        height: '100%',
                                                        margin: "auto",
                                                        lineHeight: "60px"
                                                    }}>
                                                    {hitDieSize}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Grid>
                                </Grid>
                                <Grid container direction="row" spacing={1} sx={{ width: '100%' }}>
                                    <Grid size={2.5}>
                                        <AbilityScoreInput
                                            name="intelligence"
                                            label="Intelligence"
                                            value={monsterStatblock.intelligence}
                                            onChange={handleInputChange}
                                            icon={<GiBrain />}
                                            modifier={scoreToMod(monsterStatblock.intelligence)}
                                        />
                                    </Grid>
                                    <Grid size={2.5}>
                                        <AbilityScoreInput
                                            name="wisdom"
                                            label="Wisdom"
                                            value={monsterStatblock.wisdom}
                                            onChange={handleInputChange}
                                            icon={<GiOwl />}
                                            modifier={scoreToMod(monsterStatblock.wisdom)}
                                        />
                                    </Grid>
                                    <Grid size={2.5}>
                                        <AbilityScoreInput
                                            name="charisma"
                                            label="Charisma"
                                            value={monsterStatblock.charisma}
                                            onChange={handleInputChange}
                                            icon={<FaMasksTheater />}
                                            modifier={scoreToMod(monsterStatblock.charisma)}
                                        />
                                    </Grid>
                                    <Grid size={.5}>
                                        <Box sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            height: '100%',
                                            //   fontSize: '2rem',
                                            //   padding: '4px'
                                        }}>
                                            <GiAbdominalArmor size={40} />
                                        </Box>
                                    </Grid>
                                    <Grid size={1}>
                                        <TextField name="armor_class" label="AC"
                                            variant="outlined"
                                            value={monsterStatblock.armor_class ?? ''} type={"number"}
                                            onChange={handleInputChange} />


                                    </Grid>
                                    <Grid size={2.5}>
                                        <TextField name="armor_desc" label="Armor Desc" variant="outlined"
                                            value={monsterStatblock.armor_desc ?? ''} onChange={handleInputChange} />

                                    </Grid>
                                </Grid>
                            </IconContext.Provider>
                        </Grid>
                        <Grid container spacing={2} marginY={rowSpacing} sx={{
                            justifyContent: "space-evenly",
                            alignItems: "center"
                        }}>
                            <Grid size={12 / 5}>
                                <Stack direction="row" spacing={1}>
                                    <GiSprint size={50} />
                                    {/* <FaPersonWalking size={40} /> */}
                                    <TextField name="walk" label="Walk" variant="outlined"
                                        value={monsterStatblock.speed.walk ?? ''}
                                        onChange={handleSpeedChange}
                                        type={"number"} />
                                </Stack>
                            </Grid>

                            <Grid size={12 / 5}>
                                <Stack direction="row" spacing={1}>
                                    <GiMountainClimbing size={50} />
                                    <TextField name="climb" label="Climb" variant="outlined"
                                        value={monsterStatblock.speed.climb ?? ''}
                                        onChange={handleSpeedChange}
                                        type={"number"} />
                                </Stack>
                            </Grid>

                            <Grid size={12 / 5}>

                                <Stack direction="row" spacing={1}>
                                    <GrSwim size={50} />
                                    <TextField name="swim" label="Swim" variant="outlined"
                                        value={monsterStatblock.speed.swim ?? ''}
                                        onChange={handleSpeedChange} type={"number"} />
                                </Stack>
                            </Grid>

                            <Grid size={12 / 5}>
                                <Stack direction="row" spacing={1}>

                                    <GiFlyingTrout size={50} />
                                    <TextField name="fly" label="Fly" variant="outlined"
                                        value={monsterStatblock.speed.fly ?? ''} onChange={handleSpeedChange}
                                        type={"number"} />
                                </Stack>
                            </Grid>

                            <Grid size={12 / 5}>
                                <Stack direction="row" spacing={1}>

                                    <GiDigHole size={60} />
                                    <TextField name="burrow" label="Burrow" variant="outlined"
                                        value={monsterStatblock.speed.burrow ?? ''}
                                        onChange={handleSpeedChange}
                                        type={"number"} />
                                </Stack>
                            </Grid>

                        </Grid>
                        <Grid container spacing={2} marginY={rowSpacing}>
                            <Stack spacing={1}>
                                <Stack direction="row" spacing={1}>
                                    <FormControl>
                                        <InputLabel id="skill-label">Skills</InputLabel>
                                        <Select
                                            id="type"
                                            labelId={"skill-label"}
                                            value={selectedSkill}
                                            label="Type"
                                            onChange={(e) => setSelectedSkill(e.target.value)}
                                            style={{ width: 157 }}
                                        >
                                            <MenuItem value="acrobatics">Acrobatics</MenuItem>
                                            <MenuItem value="animal_handling">Animal Handling</MenuItem>
                                            <MenuItem value="arcana">Arcana</MenuItem>
                                            <MenuItem value="athletics">Athletics</MenuItem>
                                            <MenuItem value="deception">Deception</MenuItem>
                                            <MenuItem value="history">History</MenuItem>
                                            <MenuItem value="insight">Insight</MenuItem>
                                            <MenuItem value="intimidation">Intimidation</MenuItem>
                                            <MenuItem value="investigation">Investigation</MenuItem>
                                            <MenuItem value="medicine">Medicine</MenuItem>
                                            <MenuItem value="nature">Nature</MenuItem>
                                            <MenuItem value="perception">Perception</MenuItem>
                                            <MenuItem value="performance">Performance</MenuItem>
                                            <MenuItem value="persuasion">Persuasion</MenuItem>
                                            <MenuItem value="religion">Religion</MenuItem>
                                            <MenuItem value="sleight_of_hand">Sleight of Hand</MenuItem>
                                            <MenuItem value="stealth">Stealth</MenuItem>
                                            <MenuItem value="survival">Survival</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <ButtonGroup orientation={"horizontal"}>
                                        <Button type={"button"} color="primary" variant="outlined"
                                            onClick={() => addSkillProficiency("proficient")}>Proficient</Button>
                                        <Button type={"button"} color="primary" variant="outlined" onClick={() => addSkillProficiency("expertise")}>Expertise</Button>
                                    </ButtonGroup>
                                </Stack>

                                {/* --- UPDATED JSX --- */}
                                {Object.entries(monsterStatblock.skill_proficiencies ? monsterStatblock.skill_proficiencies : {}).map(([key, val]) => {
                                    if (val) {
                                        const skillString = `${key} (${val})`
                                        return <div key={key + val}><Button name={key}
                                            onClick={() => removeSkillProficiency(key)}
                                            variant={"outlined"}>{skillString}&nbsp;
                                            <BsFillTrashFill /></Button>
                                        </div>
                                    }
                                    return null; // Added explicit return null
                                })}
                            </Stack>
                            <Grid>
                                <Stack spacing={1}>
                                    <Stack direction="row" spacing={1}>
                                        <FormControl>
                                            <InputLabel id="save-label">Saving Throws</InputLabel>
                                            <Select
                                                id="type"
                                                labelId={"save-label"}
                                                value={selectedSave}
                                                label="Type"
                                                onChange={(e) => setSelectedSave(e.target.value)}
                                                style={{ width: 157 }}
                                            >
                                                <MenuItem value="strength">Strength</MenuItem>
                                                <MenuItem value="dexterity">Dexterity</MenuItem>
                                                <MenuItem value="constitution">Constitution</MenuItem>
                                                <MenuItem value="intelligence">Intelligence</MenuItem>
                                                <MenuItem value="wisdom">Wisdom</MenuItem>
                                                <MenuItem value="charisma">Charisma</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <ButtonGroup>
                                            <Button type={"button"} onClick={addSaveProficiency}
                                                variant={"outlined"}>Proficient</Button>
                                        </ButtonGroup>
                                    </Stack>
                                    {/* --- UPDATED JSX --- */}
                                    {(monsterStatblock.save_proficiencies ?? []).map((save, i) => {
                                        return <div key={save + i}><Button name={save}
                                            onClick={() => removeSaveProficiency(save)}
                                            variant={"outlined"}>{save}&nbsp;
                                            <BsFillTrashFill /></Button>
                                        </div>
                                    })}
                                </Stack>
                            </Grid>
                            <Grid>
                                <Stack spacing={1}>
                                    <Stack direction={"row"} spacing={1}>
                                        <FormControl>
                                            <InputLabel id="condition-label">Conditions</InputLabel>
                                            <Select
                                                id="condition_immunities"
                                                value={selectedCondition}
                                                label="Conditions"
                                                labelId={"condition-label"}
                                                onChange={(e) => setSelectedCondition(e.target.value)}
                                                style={{ width: 157 }}
                                            >
                                                <MenuItem value="bleed">Bleed</MenuItem>
                                                <MenuItem value="blinded">Blinded</MenuItem>
                                                <MenuItem value="charmed">Charmed</MenuItem>
                                                <MenuItem value="deafened">Deafened</MenuItem>
                                                <MenuItem value="exhaustion">Exhaustion</MenuItem>
                                                <MenuItem value="frightened">Frightened</MenuItem>
                                                <MenuItem value="frostbitten">Frostbitten</MenuItem>
                                                <MenuItem value="grappled">Grappled</MenuItem>
                                                <MenuItem value="incapacitated">Incapacitated</MenuItem>
                                                <MenuItem value="invisible">Invisible</MenuItem>
                                                <MenuItem value="paralyzed">Paralyzed</MenuItem>
                                                <MenuItem value="petrified">Petrified</MenuItem>
                                                <MenuItem value="poisoned">Poisoned</MenuItem>
                                                <MenuItem value="prone">Prone</MenuItem>
                                                <MenuItem value="restrained">Restrained</MenuItem>
                                                <MenuItem value="rotting">Rotting</MenuItem>
                                                <MenuItem value="stunned">Stunned</MenuItem>
                                                <MenuItem value="unconscious">Unconscious</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <ButtonGroup disableElevation>
                                            <Button type={"button"} onClick={addConditionImmunity}>Immune</Button>
                                        </ButtonGroup>
                                    </Stack>
                                    {/* --- UPDATED JSX --- */}
                                    {(monsterStatblock.condition_immunity_list ?? []).map((condition, i) => {
                                        return <div key={condition + i}><Button name={condition}
                                            onClick={() => removeConditionImmunity(condition)}
                                            variant={"outlined"}>
                                            {condition}&nbsp;
                                            <BsFillTrashFill />
                                        </Button></div>
                                    })}
                                </Stack>
                            </Grid>
                        </Grid>
                        <Grid container spacing={2} marginY={rowSpacing}>
                            {/* <Grid container spacing={2} space={0} marginY={rowSpacing}> */}
                            <Grid>
                                <Stack spacing={1}>
                                    <Stack direction={"row"} spacing={1}>
                                        <FormControl>
                                            <InputLabel id="damage-label">Damage Types</InputLabel>
                                            <Select
                                                id="type"
                                                value={selectedDamage}
                                                label="Damage Types"
                                                onChange={(e) => setSelectedDamage(e.target.value)}
                                                style={{ width: 157 }}

                                            >
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
                                                <MenuItem value="bludgeoning, piercing, and slashing from nonmagical attacks">
                                                    Nonmagical BPS</MenuItem>
                                                <MenuItem
                                                    value="bludgeoning, piercing, and slashing from nonmagical attacks that aren't Silvered.">
                                                    Nonsilver BPS
                                                </MenuItem>
                                                <MenuItem
                                                    value="bludgeoning, piercing, and slashing from nonmagical attacks not made with Adamantine">
                                                    Nonadamantine BPS
                                                </MenuItem>
                                            </Select>
                                        </FormControl>
                                        <ButtonGroup orientation={"horizontal"}>
                                            <Button type={"button"} onClick={() => handleDamageModification('vulnerability')}>Vulnerable</Button>
                                            <Button type={"button"} onClick={() => handleDamageModification('resistance')}>Resistant</Button>
                                            <Button type={"button"} onClick={() => handleDamageModification('immunity')}>Immune</Button>
                                        </ButtonGroup>
                                    </Stack>
                                    {/* --- UPDATED JSX (from previous step) --- */}
                                    {(monsterStatblock.damage_vulnerability_list ?? []).filter(Boolean).map((damage, i) => {
                                        return <div key={damage + i}><Button name={damage} onClick={() => removeDamageModification(damage)}
                                            variant={"outlined"}>
                                            {damage} (Vulnerable)&nbsp;
                                            <BsFillTrashFill />
                                        </Button></div>
                                    })}
                                    {(monsterStatblock.damage_resistance_list ?? []).filter(Boolean).map((damage, i) => {
                                        return <div key={damage + i}><Button name={damage} onClick={() => removeDamageModification(damage)}
                                            variant={"outlined"}>
                                            {damage} (Resistant)&nbsp;
                                            <BsFillTrashFill />
                                        </Button></div>
                                    })}
                                    {(monsterStatblock.damage_immunity_list ?? []).filter(Boolean).map((damage, i) => {
                                        return <div key={damage + i}><Button name={damage} onClick={() => removeDamageModification(damage)}
                                            variant={"outlined"}>
                                            {damage} (Immune)&nbsp;
                                            <BsFillTrashFill />
                                        </Button></div>
                                    })}
                                </Stack>
                            </Grid>
                        </Grid>

                    </FormControl>

                    <Grid container spacing={2} marginY={rowSpacing}>
                        <Grid size={4}>
                            <TextField fullWidth name="languages" label="Languages" variant="outlined"
                                value={monsterStatblock.languages ?? ''} onChange={handleInputChange} />
                        </Grid>

                        <Grid size={2}>
                            <TextField name="blindsight" label="Blindsight (ft.)"
                                variant="outlined"
                                value={monsterStatblock.blindsight ?? ''} onChange={handleInputChange}
                                type={"number"} />
                            <FormControlLabel
                                    control={
                                        <Checkbox
                                            name="blindBeyond"
                                            checked={monsterStatblock.blindBeyond ?? false}
                                            onChange={handleCheckboxChange}
                                        />
                                    }
                                    label="Blind Beyond?"
                                />
                        </Grid>
                        <Grid size={2}>
                            <TextField name="darkvision" label="Darkvision (ft.)"
                                variant="outlined"
                                value={monsterStatblock.darkvision ?? ''} onChange={handleInputChange}
                                type={"number"} />
                        </Grid>
                        <Grid size={2}>
                            <TextField name="tremorsense" label="Tremorsense  (ft.)"
                                variant="outlined"
                                value={monsterStatblock.tremorsense ?? ''} onChange={handleInputChange}
                                type={"number"} />
                        </Grid>
                        <Grid size={2}>
                            <TextField name="truesight" label="Truesight (ft.)"
                                variant="outlined"
                                value={monsterStatblock.truesight ?? ''} onChange={handleInputChange}
                                type={"number"} />
                        </Grid>
                    </Grid>
                    <Stack spacing={1}>
                        <Stack direction={"row"}>
                            <Typography align={"center"} height={"100%"} padding={"5px"}>
                                Abilities:
                            </Typography>
                            <Button type={"button"} onClick={addSpecialAbility} variant="contained">New Ability</Button>
                        </Stack>
                        {/* --- UPDATED JSX --- */}
                        {(monsterStatblock.special_abilities ?? []).map((ability, index: number) => {
                            return <AbilityRow ability={ability} key={ability.name + index} index={index}
                                handleAbilityUpdate={handleSpecialAbilityUpdate}
                                handleAbilityRemove={() => removeSpecialAbility(index)}
                                moveCreatureItemUp={() => moveCreatureItemUp("special_abilities", index)}
                                moveCreatureItemDown={() => moveCreatureItemDown("special_abilities", index)} />
                        })}
                        <Stack direction={"row"}>
                            <Typography align={"center"} height={"100%"} padding={"5px"}>
                                Actions:
                            </Typography>
                            <Button type={"button"} onClick={addAction} variant="contained">New Action</Button>
                        </Stack>
                        {/* --- UPDATED JSX --- */}
                        {(monsterStatblock.actions ?? []).map((action, index: number) => {
                            return <ActionRow action={action} key={action.name + index} index={index}
                                monsterData={monsterStatblock}
                                handleActionUpdate={handleActionUpdate}
                                handleActionRemove={() => removeAction(index)}
                                moveCreatureItemUp={() => moveCreatureItemUp("actions", index)}
                                moveCreatureItemDown={() => moveCreatureItemDown("actions", index)} />
                        })}
                        <Stack direction={"row"}>
                            <Typography align={"center"} height={"100%"} padding={"5px"}>
                                Bonus Actions:
                            </Typography>
                            <Button type={"button"} onClick={addBonusAction} variant="contained">New Bonus Action</Button>
                        </Stack>
                        {/* --- UPDATED JSX --- */}
                        {(monsterStatblock.bonus_actions ?? []).map((bonus_action, index: number) => {
                            return <AbilityRow ability={bonus_action} key={bonus_action.name + index} index={index}
                                handleAbilityUpdate={handleBonusActionUpdate}
                                handleAbilityRemove={() => removeBonusAction(index)}
                                moveCreatureItemUp={() => moveCreatureItemUp("bonus_actions", index)}
                                moveCreatureItemDown={() => moveCreatureItemDown("bonus_actions", index)} />
                        })}
                        <Stack direction={"row"}>
                            <Typography align={"center"} height={"100%"} padding={"5px"}>
                                Reactions:
                            </Typography>
                            <Button type={"button"} onClick={addReaction} variant="contained">New Reaction</Button>
                        </Stack>
                        {/* --- UPDATED JSX --- */}
                        {(monsterStatblock.reactions ?? []).map((reaction, index: number) => {
                            return <AbilityRow ability={reaction} key={reaction.name + index} index={index}
                                handleAbilityUpdate={handleReactionUpdate}
                                handleAbilityRemove={() => removeReaction(index)}
                                moveCreatureItemUp={() => moveCreatureItemUp("reactions", index)}
                                moveCreatureItemDown={() => moveCreatureItemDown("reactions", index)} />
                        })}
                        <TextField name="legendary_desc" label="Legendary Description"
                            variant="outlined"
                            value={monsterStatblock.legendary_desc ?? ''} onChange={handleInputChange} multiline
                            fullWidth />
                        <Stack direction={"row"}>

                            <Typography align={"center"} height={"100%"} padding={"5px"}>
                                Legendary Actions:
                            </Typography>
                            <Button type={"button"} onClick={addLegendaryAction} variant="contained">New Legendary Action</Button>
                        </Stack>
                        {/* --- UPDATED JSX --- */}
                        {(monsterStatblock.legendary_actions ?? []).map((legendary_action, index: number) => {
                            return <AbilityRow ability={legendary_action} key={legendary_action.name + index} index={index}
                                handleAbilityUpdate={handleLegendaryActionUpdate}
                                handleAbilityRemove={() => removeLegendaryAction(index)}
                                moveCreatureItemUp={() => moveCreatureItemUp("legendary_actions", index)}
                                moveCreatureItemDown={() => moveCreatureItemDown("legendary_actions", index)} />
                        })}
                        <TextField name="mythic_desc" label="Mythic Description"
                            variant="outlined"
                            value={monsterStatblock.mythic_desc ?? ''} onChange={handleInputChange} multiline
                            fullWidth />
                        <Stack direction={"row"}>
                            <Typography align={"center"} height={"100%"} padding={"5px"}>
                                Mythic Actions:
                            </Typography>
                            <Button type={"button"} onClick={addMythicAction} variant="contained">New Mythic Action</Button>
                        </Stack>
                        {/* --- UPDATED JSX --- */}
                        {(monsterStatblock.mythic_actions ?? []).map((mythic_action, index: number) => {
                            return <AbilityRow ability={mythic_action} key={mythic_action.name + index} index={index}
                                handleAbilityUpdate={handleMythicActionUpdate}
                                handleAbilityRemove={() => removeMythicAction(index)}
                                moveCreatureItemUp={() => moveCreatureItemUp("mythic_actions", index)}
                                moveCreatureItemDown={() => moveCreatureItemDown("mythic_actions", index)} />
                        })}

                        <TextField name="desc" label="Creature Description"
                            variant="outlined"
                            value={monsterStatblock.desc ?? ''} onChange={handleInputChange} multiline fullWidth />

                    </Stack>
                </form>

            </div >
            <Grid container spacing={2} marginY={rowSpacing}>
                    <MarkdownExport monster={monsterStatblock} />
            </Grid>
            <Grid container spacing={2} marginY={rowSpacing}>
                <Item>
                    <Image
                        src="/5eCRTable.jpg"
                        width={500}
                        height={500}
                        alt="CR Table"
                        style={{ display: "block", marginLeft: "auto", marginRight: "auto" }}
                    />
                </Item>
            </Grid>
        </div >
    );
};

export default CreateMonsterStatblock;