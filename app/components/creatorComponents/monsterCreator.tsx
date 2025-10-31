"use client"

import styles from '@/styles/CreateMonsterStatblock.module.css';
import {
    Button,
    ButtonGroup,
    FormControl,
    Grid,
    IconButton,
    InputAdornment,
    InputLabel,
    ListSubheader,
    MenuItem,
    Select,
    TextField,
    Toolbar,
    Typography
} from "@mui/material";
import Box from '@mui/material/Box';
import type { SelectChangeEvent } from '@mui/material/Select';
import React, { ChangeEvent, Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
// Use an any-typed alias to avoid MUI Grid typing overload issues while we migrate props
import { getMonsterProf, scoreToMod } from "@/5eReference/converters";
import AbilityRow from "@/app/components/creatorComponents/abilityrow";
import ActionRow from "@/app/components/creatorComponents/actionrow";
import MonsterSheet, { cleanMonster } from "@/app/components/creatorComponents/monsterSheet";
import html2canvas from "html2canvas";
import { AiOutlineSearch } from "react-icons/ai";
import { BsFillTrashFill } from "react-icons/bs";
import { FaMasksTheater, FaPersonWalking } from "react-icons/fa6";
import { GiAbdominalArmor, GiBearHead, GiBrain, GiDigHole, GiFlyingTrout, GiHeartPlus, GiMountainClimbing, GiOwl, GiRunningNinja, GiSprint, GiStrongMan, } from "react-icons/gi";
// import AbilityScoreInput from './AbilityScoreInput';
import { type Schema } from '@/amplify/data/resource';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import { generateClient } from 'aws-amplify/data';
import Image from 'next/image';
import { IconContext } from 'react-icons';
import AbilityScoreInput from './abilityscoreinput';
import AppBar from '@mui/material/AppBar';
import { MdOutlineMenu } from "react-icons/md";
import { PiShovel } from "react-icons/pi";
import { GrSwim } from "react-icons/gr";
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

const HeaderRow: React.FC<HeaderRowProps> = ({ monster, setMonster, downloadFile }) => {

    const theme = useTheme()

    // State is typed using the Amplify Gen 2 type
    const [monsterStatblock, setMonsterStatblock] = useState<MyMonsterStatblock>(monster)

    useEffect(() => setMonsterStatblock(monster), [monster])
    // `Date.now()` returns a number (timestamp)
    const [saveThrottleTime, setSaveThrottleTime] = useState<number>(Date.now())

    // Function typing: takes two strings, returns a boolean
    const containsText = (text: string, searchText: string): boolean =>
        text.toLowerCase().indexOf(searchText.toLowerCase()) > -1 || searchText === '';

    const newMonster = async () => {
        // window.prompt returns string | null
        const newMonsterName = window.prompt("Enter Creature Name: NOTE - Creating a new monster will reset the current statblock")
        if (!newMonsterName) {
            console.error("No monster name provided")
            return
        }

        // The list is typed as MonsterListItem[]
        if (monsterList.filter((m) => m.name === newMonsterName).length > 0) {
            console.error("Creature's name is already in the database")
        }

        try {
            // Merge new stats with required fields; type as a Partial of the generated model
            // Generate a new input object for monster creation, omitting fields that are auto-generated or not allowed on create
            const input = {
                ...newMonsterStats,
                publisher: 'spellbound',
                name: newMonsterName,
            };


            const { errors, data: response } = await client.models.MonsterStatblock.create({
                ...input
            })

            console.log("New Monster Response", response)
            // Assuming `cleanMonster` returns a valid MyMonsterStatblock
            setMonster(cleanMonster(response))
        } catch (e) {
            console.error("Error creating creature:", e);
        }
    }

    // State for dropdown selection value (monster name)
    const [selectedOption, setSelectedOption] = useState<string>('');
    // State for the monster list
    const [monsterList, setMonsterList] = useState<MonsterListItem[]>([
        { id: 'none', publisher: 'none', name: 'No Monsters Found', slug: 'No Monsters Found' }
    ])
    // State for search text
    const [searchText, setSearchText] = useState<string>("");

    // Memoized list is typed as MonsterListItem[]
    const displayedOptions = useMemo(
        () => monsterList.filter((option) => containsText(option.name, searchText)),
        [searchText, monsterList]
    )

    useEffect(() => {
        const getMonsterList = async () => {
            // Using the raw query string from the original JS. The response is typed as 'any'.
            const { data: result, errors } = await client.models.MonsterStatblock.list(
                {
                    selectionSet: ['id', 'publisher', 'name'],
                    limit: 1000
                }
            );

            // The inner items need to be typed as MonsterListItem[] for safe sorting
            const items = (result || []) as MonsterListItem[];

            console.log(items.sort((a, b) => a.name.localeCompare(b.name)));

            setMonsterList(items.sort((a, b) => a.name.localeCompare(b.name)))
        }

        getMonsterList()
    }, []);

    // NOTE: The dependency array for this useEffect is missing `saveMonster` 
    // which is used inside. However, since `saveMonster` is defined right before 
    // the effect and doesn't depend on props/state, this is often acceptable in JS/TS 
    // to avoid an infinite loop if `saveMonster` were defined inside the component 
    // or wrapped in `useCallback` (which isn't strictly needed here). I'll keep the original 
    // dependencies and trust the function closure works as intended.
    useEffect(() => {
        console.log("MONSTER GOT CHANGED", monsterStatblock)
        const currentTime = Date.now()

        if (currentTime - saveThrottleTime > 5000) {
            setSaveThrottleTime(currentTime)
            saveMonster(monsterStatblock)
        }
    }, [monsterStatblock, saveThrottleTime]); // Added saveThrottleTime as it's used inside

    // Function parameter typed as MyMonsterStatblock
    const saveMonster = async (monsterToSave: MyMonsterStatblock) => {
        // Convert to UpdateMonsterInput type which has the correct shape for the mutation
        const input: MyMonsterStatblock = { ...monsterToSave };

        // Type assertion to allow deleting a property that might not be on the static type
        delete (input as any).__typename

        let savedMonster: MyMonsterStatblock | null = null
        console.log("TRYING TO SAVE MONSTER", input)

        if (input.publisher === 'wotc-srd') {
            console.error("Can't overwrite wizards of the coast creature")
            return
        }

        // Checking for `id` which is required for an update mutation
        if (!input.id) {
            console.error("Attempting to update creature with no id")
            return
        }

        console.log("Updating a monster", input)
        try {
            // Use Gen 2 client to update the monster
            const { data: updatedCreature, errors } = await client.models.MonsterStatblock.update(input);
        } catch (e) {
            console.error("Error update creature:", e);
        }
        if (savedMonster) {
            console.log("Saved monster", savedMonster)
        }
    }

    // Function parameter typed as string | undefined
    const exportJSON = (name: string | undefined) => {
        const fileName = name ? name : "spellboundmonster";

        // NOTE: The original JS uses `monster.monster`. This implies your `monster` prop
        // has a nested structure. If `monster` is of type `MyMonsterStatblock`, this line
        // should likely be `const json = JSON.stringify(monster, null, 2);`.
        // Sticking to original JS for direct conversion, but casting to `any`.
        const json = JSON.stringify((monster as any).monster, null, 2);

        const blob = new Blob([json], { type: "application/json" });
        const href = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = href;
        link.download = fileName + ".json";
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(href);
    }

    // Event object for MUI Select is typed
    const handleSelectionChange = async (e: SelectChangeEvent<string>) => {
        // e.target.value may be string
        setSelectedOption(e.target.value as string)
    }

    // Function parameters typed
    const getMonster = async (id: string) => {
        console.log(id)
        if (window.confirm("Fetching a new monster will overwrite the existing statblock")) {
            if (id) {
                try {
                    const { data: existingMonster, errors } = await client.models.MonsterStatblock.get({
                        id: id,
                    });

                    // Assuming cleanMonster returns MyMonsterStatblock
                    setMonster(cleanMonster(existingMonster))
                } catch (e) {
                    console.error(e)
                }
            }
        }
    }

    return (
        < Box sx={{ flexGrow: 1 }} >
            <AppBar>
                <Toolbar>
                    <IconButton
                        size="large"
                        edge="start"
                        color="inherit"
                        aria-label="menu"
                        sx={{ mr: 2 }}
                    >
                        <MdOutlineMenu />
                    </IconButton>
                    <Button variant={"contained"} style={{ margin: "5px" }} onClick={newMonster} color="secondary">New</Button>
                    <Button variant={"contained"} style={{ margin: "5px" }} onClick={() => saveMonster(monsterStatblock)} color="secondary">Save</Button>
                    <Button variant={"contained"} style={{ margin: "5px" }} onClick={() => exportJSON(monster.name)} color="secondary">Export
                        JSON</Button>
                    <Button variant={"contained"} style={{ margin: "5px" }} onClick={downloadFile} color="secondary">Download
                        PNG</Button>
                    <FormControl style={{ left: "10%", minWidth: "200px" }}>
                        <InputLabel id="search-select-label" style={{ color: "black" }}>Monster Name</InputLabel>
                        <Select
                            MenuProps={{ autoFocus: false }}
                            labelId="search-select-label"
                            id="search-select"
                            // The value of Select must match the type of selectedOption
                            value={selectedOption}
                            label="Monsters"
                            // onChange event is correctly inferred or typed (HTMLInputElement for Select component)
                            onChange={handleSelectionChange}
                            onClose={() => setSearchText("")}
                            renderValue={() => selectedOption}
                            style={{ backgroundColor: theme.palette.secondary.main, color: "#000000" }}
                            sx={{ color: "black" }}
                        >
                            <ListSubheader>
                                <TextField
                                    size="small"
                                    autoFocus
                                    placeholder="Type to search..."
                                    fullWidth
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <AiOutlineSearch />
                                            </InputAdornment>
                                        )
                                    }}
                                    // onChange event is typed
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
                                    // onKeyDown event is typed
                                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                        if (e.key !== "Escape") {
                                            e.stopPropagation();
                                        }
                                    }}
                                />
                            </ListSubheader>
                            {displayedOptions.map((option, i) => (
                                // The value of MenuItem is a string
                                <MenuItem key={`${option.id}-${i}`} value={option.name} onClick={() => getMonster(option.id)}>
                                    {option.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                </Toolbar>

            </AppBar>
        </Box >
    )
}

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

const CreateMonsterStatblock = () => {

    const [monsterStatblock, setMonsterStatblock] = useState<MyMonsterStatblock>({
        ...newMonsterStats,
        speed: newMonsterStats.speed || { walk: 0, swim: 0, fly: 0, burrow: 0, climb: 0, hover: false }
    });

    const [selectedSave, setSelectedSave] = useState<string>("strength")
    const [saveList, setSaveList] = useState<string[]>([])
    const [selectedSkill, setSelectedSkill] = useState<string>("acrobatics")
    // skillList maps skill name to a proficiency flag: boolean, 'expertise', or null
    const [skillList, setSkillList] = useState<Record<string, string | null>>({})
    const [selectedDamage, setSelectedDamage] = useState<string>("acid")
    const [damageVulnerabilityList, setDamageVulnerabilityList] = useState<string[]>([""])
    const [damageResistanceList, setDamageResistanceList] = useState<string[]>([""])
    const [damageImmunityList, setDamageImmunityList] = useState<string[]>([""])
    const [selectedCondition, setSelectedCondition] = useState<string>("blinded")
    const [conditionImmunityList, setConditionImmunityList] = useState<string[]>([])
    const [specialAbilities, setSpecialAbilities] = useState<Array<MyMonsterAbility>>([])
    const [actions, setActions] = useState<Array<MyMonsterAttack>>([])
    const [bonusActions, setBonusActions] = useState<Array<MyMonsterAbility>>([])
    const [reactions, setReactions] = useState<Array<MyMonsterAbility>>([])
    const [legendaryActions, setLegendaryActions] = useState<Array<MyMonsterAbility>>([])
    const [mythicActions, setMythicActions] = useState<Array<MyMonsterAbility>>([])
    const [hitDieSize, setHitDieSize] = useState<string>("d8")

    const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target as HTMLInputElement & { name: string; value: any };
        setMonsterStatblock({ ...monsterStatblock, [name]: value });
    };

    const rowSpacing = 1

    const handleSpeedChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target as HTMLInputElement & { name: string; value: any };
        setMonsterStatblock({
            ...monsterStatblock,
            speed: {
                ...monsterStatblock.speed,
                [name]: parseInt(value, 10),
            },
        })
    }

    const addSaveProficiency = () => {
        console.log(`Adding save ${selectedSave}`)
        const oldSaves = [...saveList]
        if (!oldSaves.includes(selectedSave)) {
            oldSaves.push(selectedSave)
        }
        setSaveList(oldSaves)
    }

    const removeSaveProficiency = () => {
        setSaveList((saves) => {
            return saves.filter((save) => save !== selectedSave)
        })
    }

    const addDamageResistance = () => {
        const oldDamage = [...damageResistanceList]
        if (!oldDamage.includes(selectedDamage)) {
            oldDamage.push(selectedDamage)
        }
        setDamageResistanceList(oldDamage)
        setDamageVulnerabilityList(damageVulnerabilityList.filter((damage) => damage !== selectedDamage))
        setDamageImmunityList(damageImmunityList.filter((damage) => damage !== selectedDamage))
    }

    const addDamageVulnerability = () => {
        const oldDamage = [...damageVulnerabilityList]
        if (!oldDamage.includes(selectedDamage)) {
            oldDamage.push(selectedDamage)
        }
        setDamageVulnerabilityList(oldDamage)
        setDamageResistanceList(damageResistanceList.filter((damage) => damage !== selectedDamage))
        setDamageImmunityList(damageImmunityList.filter((damage) => damage !== selectedDamage))
    }

    const addDamageImmunity = () => {
        const oldDamage = [...damageImmunityList]
        if (!oldDamage.includes(selectedDamage)) {
            oldDamage.push(selectedDamage)
        }
        setDamageImmunityList(oldDamage)
        setDamageVulnerabilityList(damageVulnerabilityList.filter((damage) => damage !== selectedDamage))
        setDamageResistanceList(damageResistanceList.filter((damage) => damage !== selectedDamage))
    }

    const removeDamage = () => {
        setDamageVulnerabilityList((damageList) => {
            return damageList.filter((damage) => damage !== selectedDamage)
        })
        setDamageResistanceList((damageList) => {
            return damageList.filter((damage) => damage !== selectedDamage)
        })
        setDamageImmunityList((damageList) => {
            return damageList.filter((damage) => damage !== selectedDamage)
        })
    }

    const addSkillProficiency = async (proficiency: string | null) => {
        setSkillList({ ...skillList, [selectedSkill]: proficiency })
    }

    const getPassivePerception = () => {
        if (!monsterStatblock.skill_proficiencies || !monsterStatblock.skill_proficiencies["perception"]) {
            return 10 + Number(scoreToMod(monsterStatblock.wisdom))
        }
        if (monsterStatblock.skill_proficiencies["perception"] == "proficient") {
            return monsterStatblock.wisdom + getMonsterProf(monsterStatblock.cr)
        }
        return monsterStatblock.wisdom + (getMonsterProf(monsterStatblock.cr) * 2)
    }

    const moveCreatureItemUp = (item_type: string, index: number, setter: Dispatch<SetStateAction<any>>) => {
        console.log(item_type + index + setter)
        if (index === 0) return

        setter((item_list: string[]) => {
            const item = item_list[index - 1]
            item_list[index - 1] = item_list[index]
            item_list[index] = item
            console.log(item_list)
            return [...item_list]
        })
    }

    const moveCreatureItemDown = (item_type: string, index: number, setter: Dispatch<SetStateAction<any>>) => {
        console.log(item_type + index + setter)

        setter((item_list: string[]) => {
            if (index === item_list.length - 1) return item_list
            const item = item_list[index]
            item_list[index] = item_list[index + 1]
            item_list[index + 1] = item
            console.log(item_list)
            return [...item_list]
        })

    }

    useEffect(() => {
        console.log("Creature is updating based on setState hook")
        console.log(monsterStatblock)
        console.log([saveList, skillList, damageVulnerabilityList, damageResistanceList, damageImmunityList,
            conditionImmunityList, specialAbilities, actions, bonusActions, reactions, legendaryActions, mythicActions])


        const toUpperCase = (word: string) => {
            return word.charAt(0).toUpperCase()
                + word.slice(1)
        }

        const prof = getMonsterProf(monsterStatblock.cr)

        const strMod = Number(scoreToMod(monsterStatblock.strength))
        const dexMod = Number(scoreToMod(monsterStatblock.dexterity))
        const conMod = Number(scoreToMod(monsterStatblock.constitution))
        const intMod = Number(scoreToMod(monsterStatblock.intelligence))
        const wisMod = Number(scoreToMod(monsterStatblock.wisdom))
        const chaMod = Number(scoreToMod(monsterStatblock.charisma))

        const strSave = saveList.includes("strength") ? strMod + prof : strMod
        const dexSave = saveList.includes("dexterity") ? dexMod + prof : dexMod
        const conSave = saveList.includes("constitution") ? conMod + prof : conMod
        const intSave = saveList.includes("intelligence") ? intMod + prof : intMod
        const wisSave = saveList.includes("wisdom") ? wisMod + prof : wisMod
        const chaSave = saveList.includes("charisma") ? chaMod + prof : chaMod

        const reduceSkills = () => {
            const skillObject: Record<string, number> = {}
            Object.entries(skillList).forEach(([key, val]) => {
                if (val) {
                    let mod = 0

                    if (val === "proficient") {
                        mod = prof
                    } else if (val === "expertise") {
                        mod = prof * 2
                    } else {
                        console.error(`Invalid skill value for ${key}: ${val}`)
                    }

                    if (key === "athletics") {
                        skillObject[key] = (strMod + mod)
                    }
                    if (key === "acrobatics" || key === "sleight_of_hand" || key === "stealth")
                        skillObject[key] = (dexMod + mod)
                    if (key === "arcana" || key === "history" || key === "investigation" || key === "nature" || key === "religion") {
                        skillObject[key] = (intMod + mod)
                    }
                    if (key === "animal_handling" || key === "insight" || key === "medicine" || key === "perception" || key === "survival") {
                        skillObject[key] = (wisMod + mod)
                    }
                    if (key === "deception" || key === "intimidation" || key === "performance" || key === "persuasion") {
                        skillObject[key] = (chaMod + mod)
                    }
                }
            })
            return skillObject
        }

        const getSenses = () => {
            let sensesString = ""
            if (monsterStatblock.blindsight !== 0) {
                sensesString += `blindsight ${monsterStatblock.blindsight} ft.,`
            }
            if (monsterStatblock.darkvision !== 0) {
                sensesString += `darkvision ${monsterStatblock.darkvision} ft.,`
            }
            if (monsterStatblock.tremorsense !== 0) {
                sensesString += `tremorsense ${monsterStatblock.tremorsense} ft.,`
            }
            if (monsterStatblock.truesight !== 0) {
                sensesString += `truesight ${monsterStatblock.truesight}`
            }
            sensesString += `passive Perception ${getPassivePerception()}`
            return sensesString
        }

        setMonsterStatblock(
            {
                ...monsterStatblock,
                skills: reduceSkills(),
                perception: getPassivePerception(),
                strength_save: strSave,
                dexterity_save: dexSave,
                constitution_save: conSave,
                intelligence_save: intSave,
                wisdom_save: wisSave,
                charisma_save: chaSave,
                condition_immunities: conditionImmunityList.length > 0 ? conditionImmunityList.join(", ") : "",
                condition_immunity_list: conditionImmunityList,
                damage_vulnerabilities: damageVulnerabilityList.length > 0 ? damageVulnerabilityList.join(", ") : "",
                damage_vulnerability_list: damageVulnerabilityList,
                damage_resistances: damageResistanceList.length > 0 ? damageResistanceList.join(", ") : "",
                damage_resistance_list: damageResistanceList,
                damage_immunities: damageImmunityList.length > 0 ? damageImmunityList.join(", ") : "",
                damage_immunity_list: damageImmunityList,
                skill_proficiencies: skillList,
                save_proficiencies: saveList,
                special_abilities: specialAbilities,
                senses: getSenses(),
                actions: actions,
                bonus_actions: bonusActions,
                reactions: reactions,
                legendary_actions: legendaryActions,
                mythic_actions: mythicActions
            }
        )
    }, [saveList, skillList, damageVulnerabilityList, damageResistanceList, damageImmunityList,
        conditionImmunityList, specialAbilities, actions, bonusActions, reactions, legendaryActions, mythicActions]);

    // useEffect(() => {
    //     setMonsterStatblock({...monsterStatblock, })
    // }, [monsterStatblock.wisdom, monsterStatblock.skill_proficiencies]);

    const removeSkillProficiency = () => {
        setSkillList({ ...skillList, [selectedSkill]: null })
    }

    const addConditionImmunity = () => {
        const oldConditions = [...conditionImmunityList]
        if (!oldConditions.includes(selectedCondition)) {
            console.log(`adding condition immunity ${selectedCondition}`)
            oldConditions.push(selectedCondition)
            setConditionImmunityList(oldConditions)
        }
    }

    const removeConditionImmunity = () => {
        setConditionImmunityList((conditionList) => {
            return conditionList.filter((condition) => condition !== selectedCondition)
        })
    }

    const addSpecialAbility = () => {
        console.log("Adding new special ability")

        const ability_num = monsterStatblock.special_abilities ? monsterStatblock.special_abilities.length.toString() : "0"

        setSpecialAbilities((oldAbilities) => {
            return [...oldAbilities, { name: `New Ability ${ability_num}`, desc: "New Description" }]
        })
    }

    const removeSpecialAbility = (index: number) => {
        console.log(`Removing special ability ${index}`)
        setSpecialAbilities((oldSpecialAbilities) => {
            return oldSpecialAbilities.filter((action, i) => i !== index)
        })
    }

    const handleSpecialAbilityUpdate = (ability: MyMonsterAbility, index: number) => {
        setSpecialAbilities((oldAbilities) => {
            return oldAbilities.map((oldAbility, oldIndex: number) => {
                if (oldIndex === index) {
                    return ability
                }
                return oldAbility
            })
        })
    }

    const addAction = () => {
        console.log("Adding new action")

        const action_num = monsterStatblock.actions ? monsterStatblock.actions.length.toString() : "0"

        setActions((oldActions) => {
            return [...oldActions, {
                name: `New Action ${action_num}`,
                desc: "Action",
                type: "Melee Weapon Attack",
                reach: 5,
                attack_bonus: "[STR ATK]",
                short_range: 0,
                long_range: 0,
                targets: "One Target.",
                damage: [{ damage_dice: "1d6", damage_type: "slashing" }],
            }]
        })
    }

    const removeAction = (index: number) => {
        console.log(`Removing action ${index}`)
        setActions((oldActions) => {
            return oldActions.filter((action, i) => i !== index)
        })
    }

    const handleActionUpdate = (action: MyMonsterAttack, index: number) => {
        setActions((oldActions) => {
            return oldActions.map((oldAction, oldIndex: number) => {
                if (oldIndex === index) {
                    return action
                }
                return oldAction
            })
        })
    }

    const addBonusAction = () => {
        console.log("Adding new bonus action")

        const bonus_action_num = monsterStatblock.bonus_actions ? monsterStatblock.bonus_actions.length.toString : "0"

        setBonusActions((oldBonusActions) => {
            return [...oldBonusActions, { name: `New Bonus Action ${bonus_action_num}`, desc: "New Description" }]
        })
    }

    const removeBonusAction = (index: number) => {
        console.log(`Removing bonus action ${index}`)
        setBonusActions((oldBonusActions) => {
            return oldBonusActions.filter((action, i) => i !== index)
        })
    }

    const handleBonusActionUpdate = (bonusAction: MyMonsterAbility, index: number) => {
        setBonusActions((oldBonusActions) => {
            return oldBonusActions.map((oldBonusAction, oldIndex: number) => {
                if (oldIndex === index) {
                    return bonusAction
                }
                return oldBonusAction
            })
        })
    }

    const addReaction = () => {
        console.log("Adding new reaction")

        const reaction_num = monsterStatblock.reactions ? monsterStatblock.reactions.length.toString : "0"

        setReactions((oldReactions) => {
            return [...oldReactions, { name: `New Reaction ${reaction_num}`, desc: "New Description" }]
        })
    }

    const removeReaction = (index: number) => {
        console.log(`Removing reaction ${index}`)
        setReactions((oldReactions) => {
            return oldReactions.filter((action, i) => i !== index)
        })
    }

    const handleReactionUpdate = (reaction: MyMonsterAbility, index: number) => {
        setReactions((oldReactions) => {
            return oldReactions.map((oldReaction, oldIndex: number) => {
                if (oldIndex === index) {
                    return reaction
                }
                return oldReaction
            })
        })
    }

    const addLegendaryAction = () => {
        console.log("Adding new reaction")

        const legendary_action_num = monsterStatblock.legendary_actions ? monsterStatblock.legendary_actions.length.toString : "0"

        setLegendaryActions((oldLegendaryActions) => {
            return [...oldLegendaryActions, { name: `New Legendary Action ${legendary_action_num}`, desc: "New Description" }]
        })
    }

    const removeLegendaryAction = (index: number) => {
        console.log(`Removing legendary action ${index}`)
        setLegendaryActions((oldLegendaryActions) => {
            return oldLegendaryActions.filter((action, i) => i !== index)
        })
    }

    const handleLegendaryActionUpdate = (legendaryAction: MyMonsterAbility, index: number) => {
        setLegendaryActions((oldLegendaryActions) => {
            return oldLegendaryActions.map((oldLegendaryAction, oldIndex: number) => {
                if (oldIndex === index) {
                    return legendaryAction
                }
                return oldLegendaryAction
            })
        })
    }

    const addMythicAction = () => {
        console.log("Adding new mythic action")

        const mythic_action_num = monsterStatblock.mythic_actions ? monsterStatblock.mythic_actions.length.toString : "0"

        setMythicActions((oldMythicActions) => {
            return [...oldMythicActions, { name: `New Mythic Action ${mythic_action_num}`, desc: "New Description" }]
        })
    }

    const removeMythicAction = (index: number) => {
        console.log(`Removing mythic action ${index}`)
        setMythicActions((oldMythicActions) => {
            return oldMythicActions.filter((action, i) => i !== index)
        })
    }

    const handleMythicActionUpdate = (mythicAction: MyMonsterAbility, index: number) => {
        setMythicActions((oldMythicActions) => {
            return oldMythicActions.map((oldMythicActions, oldIndex: number) => {
                if (oldIndex === index) {
                    return mythicAction
                }
                return oldMythicActions
            })
        })
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
        setMonsterStatblock({
            ...monsterStatblock,
            hit_dice_num: dieNum,
            hit_dice: `${dieNum}${hitDieSize}+${dieNum * scoreToMod(monsterStatblock.constitution)}`
        })
    }

    useEffect(() => {
        const calcHitPoints = () => {
            const dieSize = Number(hitDieSize.split("d")[1])
            return (Math.ceil(monsterStatblock.hit_dice_num * (dieSize / 2 + .5) + monsterStatblock.hit_dice_num * scoreToMod(monsterStatblock.constitution)))
        }

        setMonsterStatblock({ ...monsterStatblock, hit_points: calcHitPoints() })
    }, [monsterStatblock.hit_dice_num, monsterStatblock.constitution])

    const initializedMonsterId = useRef(monsterStatblock.id);

    useEffect(() => {
        // Only run this on initial load or when monsterStatblock is replaced entirely
        if (monsterStatblock && monsterStatblock.id !== initializedMonsterId.current) {
            console.log("Initializing creature state from monsterStatblock prop", monsterStatblock)

            changeSize(monsterStatblock.size)
            setSaveList((monsterStatblock.save_proficiencies ?? []).filter((v): v is string => v != null))
            setSkillList(monsterStatblock.skill_proficiencies ?? {})
            setDamageVulnerabilityList((monsterStatblock.damage_vulnerability_list ?? []) as string[])
            setDamageResistanceList((monsterStatblock.damage_resistance_list ?? []) as string[])
            setDamageImmunityList((monsterStatblock.damage_immunity_list ?? []) as string[])
            setSpecialAbilities((monsterStatblock.special_abilities ?? []) as MyMonsterAbility[])
            setActions((monsterStatblock.actions ?? []) as MyMonsterAttack[])
            setBonusActions((monsterStatblock.bonus_actions ?? []) as MyMonsterAbility[])
            setReactions((monsterStatblock.reactions ?? []) as MyMonsterAbility[])
            setLegendaryActions((monsterStatblock.legendary_actions ?? []) as MyMonsterAbility[])
            setMythicActions((monsterStatblock.mythic_actions ?? []) as MyMonsterAbility[])
            setConditionImmunityList((monsterStatblock.condition_immunity_list ?? []) as string[])

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
    console.log(specialAbilities)


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
                                    value={monsterStatblock.name}
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
                                    value={monsterStatblock.subtype}
                                    onChange={handleInputChange} />
                            </Grid>
                            <Grid size={1.9}>
                                <TextField name="alignment" label="Alignment"
                                    value={monsterStatblock.alignment}
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
                                            value={monsterStatblock.hit_points}
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
                                                value={monsterStatblock.hit_dice_num}
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
                                            value={monsterStatblock.armor_class} type={"number"}
                                            onChange={handleInputChange} />


                                    </Grid>
                                    <Grid size={2.5}>
                                        <TextField name="armor_desc" label="Armor Desc" variant="outlined"
                                            value={monsterStatblock.armor_desc} onChange={handleInputChange} />

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
                                        value={monsterStatblock.speed.walk ? monsterStatblock.speed.walk : 0}
                                        onChange={handleSpeedChange}
                                        type={"number"} />
                                </Stack>
                            </Grid>

                            <Grid size={12 / 5}>
                                <Stack direction="row" spacing={1}>
                                    <GiMountainClimbing size={50} />
                                    <TextField name="climb" label="Climb" variant="outlined"
                                        value={monsterStatblock.speed.climb ? monsterStatblock.speed.climb : 0}
                                        onChange={handleSpeedChange}
                                        type={"number"} />
                                </Stack>
                            </Grid>

                            <Grid size={12 / 5}>

                                <Stack direction="row" spacing={1}>
                                    <GrSwim size={50} />
                                    <TextField name="swim" label="Swim" variant="outlined"
                                        value={monsterStatblock.speed.swim ? monsterStatblock.speed.swim : 0}
                                        onChange={handleSpeedChange} type={"number"} />
                                </Stack>
                            </Grid>

                            <Grid size={12 / 5}>
                                <Stack direction="row" spacing={1}>

                                    <GiFlyingTrout size={50} />
                                    <TextField name="fly" label="Fly" variant="outlined"
                                        value={monsterStatblock.speed.fly} onChange={handleSpeedChange}
                                        type={"number"} />
                                </Stack>
                            </Grid>

                            <Grid size={12 / 5}>
                                <Stack direction="row" spacing={1}>

                                    <GiDigHole size={60}/>
                                    <TextField name="burrow" label="Burrow" variant="outlined"
                                        value={monsterStatblock.speed.burrow ? monsterStatblock.speed.burrow : 0}
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

                                {Object.entries(monsterStatblock.skill_proficiencies ? monsterStatblock.skill_proficiencies : {}).map(([key, val]) => {
                                    if (val) {
                                        const skillString = `${key} (${val})`
                                        return <div key={key + val}><Button name={key}
                                            onClick={removeSkillProficiency}
                                            variant={"outlined"}>{skillString}&nbsp;
                                            <BsFillTrashFill /></Button>
                                        </div>
                                    }
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
                                    {(monsterStatblock.save_proficiencies ? monsterStatblock.save_proficiencies : []).map((save, i) => {
                                        return <div key={save + i}><Button name={save}
                                            onClick={removeSaveProficiency}
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
                                    {(monsterStatblock.condition_immunity_list ? monsterStatblock.condition_immunity_list : []).map((condition, i) => {
                                        return <div key={condition + i}><Button name={condition}
                                            onClick={removeConditionImmunity}
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
                                            <Button type={"button"} onClick={() => addDamageVulnerability()}>Vulnerable</Button>
                                            <Button type={"button"} onClick={() => addDamageResistance()}>Resistant</Button>
                                            <Button type={"button"} onClick={() => addDamageImmunity()}>Immune</Button>
                                        </ButtonGroup>
                                    </Stack>
                                    {(monsterStatblock.damage_vulnerability_list ? monsterStatblock.damage_vulnerability_list : []).map((damage, i) => {
                                        return <div key={damage + i}><Button name={damage} onClick={removeDamage}
                                            variant={"outlined"}>
                                            {damage} (Vulnerable)&nbsp;
                                            <BsFillTrashFill />
                                        </Button></div>
                                    })}
                                    {(monsterStatblock.damage_resistance_list ? monsterStatblock.damage_resistance_list : []).map((damage, i) => {
                                        return <div key={damage + i}><Button name={damage} onClick={removeDamage}
                                            variant={"outlined"}>
                                            {damage} (Resistant)&nbsp;
                                            <BsFillTrashFill />
                                        </Button></div>
                                    })}
                                    {(monsterStatblock.damage_immunity_list ? monsterStatblock.damage_immunity_list : []).map((damage, i) => {
                                        return <div key={damage + i}><Button name={damage} onClick={removeDamage}
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
                                value={monsterStatblock.languages} onChange={handleInputChange} />
                        </Grid>

                        <Grid size={2}>
                            <TextField name="blindsight" label="Blindsight"
                                variant="outlined"
                                value={monsterStatblock.blindsight} onChange={handleInputChange}
                                type={"number"} />
                        </Grid>
                        <Grid size={2}>
                            <TextField name="darkvision" label="Darkvision"
                                variant="outlined"
                                value={monsterStatblock.darkvision} onChange={handleInputChange}
                                type={"number"} />
                        </Grid>
                        <Grid size={2}>
                            <TextField name="tremorsense" label="Tremorsense"
                                variant="outlined"
                                value={monsterStatblock.tremorsense} onChange={handleInputChange}
                                type={"number"} />
                        </Grid>
                        <Grid size={2}>
                            <TextField name="truesight" label="Truesight"
                                variant="outlined"
                                value={monsterStatblock.truesight} onChange={handleInputChange}
                                type={"number"} />
                        </Grid>
                    </Grid>
                    <Stack>
                        <Stack direction={"row"}>
                            <Typography align={"center"} height={"100%"} padding={"5px"}>
                                Abilities:
                            </Typography>
                            <Button type={"button"} onClick={addSpecialAbility}>New Ability</Button>
                        </Stack>
                        {specialAbilities.map((ability, index: number) => {
                            console.log(`Ability`)
                            console.log(ability)
                            return <AbilityRow ability={ability} key={ability.name + index} index={index}
                                handleAbilityUpdate={handleSpecialAbilityUpdate}
                                handleAbilityRemove={() => removeSpecialAbility(index)}
                                moveCreatureItemUp={() => moveCreatureItemUp("special_abilities", index, setSpecialAbilities)}
                                moveCreatureItemDown={() => moveCreatureItemDown("special_abilities", index, setSpecialAbilities)} />
                        })}
                        <Stack direction={"row"}>
                            <Typography align={"center"} height={"100%"} padding={"5px"}>
                                Actions:
                            </Typography>
                            <Button type={"button"} onClick={addAction}>New Action</Button>
                        </Stack>
                        {actions.map((action, index: number) => {
                            return <ActionRow action={action} key={action.name + index} index={index}
                                monsterData={monsterStatblock}
                                handleActionUpdate={handleActionUpdate}
                                handleActionRemove={() => removeAction(index)}
                                moveCreatureItemUp={() => moveCreatureItemUp("actions", index, setActions)}
                                moveCreatureItemDown={() => moveCreatureItemDown("actions", index, setActions)} />
                        })}
                        <Stack direction={"row"}>
                            <Typography align={"center"} height={"100%"} padding={"5px"}>
                                Bonus Actions:
                            </Typography>
                            <Button type={"button"} onClick={addBonusAction}>New Bonus Action</Button>
                        </Stack>

                        {bonusActions.map((bonus_action, index: number) => {
                            return <AbilityRow ability={bonus_action} key={bonus_action.name + index} index={index}
                                handleAbilityUpdate={handleBonusActionUpdate}
                                handleAbilityRemove={() => removeBonusAction(index)}
                                moveCreatureItemUp={() => moveCreatureItemUp("bonus_actions", index, setBonusActions)}
                                moveCreatureItemDown={() => moveCreatureItemDown("bonus_actions", index, setBonusActions)} />
                        })}
                        <Stack direction={"row"}>
                            <Typography align={"center"} height={"100%"} padding={"5px"}>
                                Reactions:
                            </Typography>
                            <Button type={"button"} onClick={addReaction}>New Reaction</Button>
                        </Stack>
                        {reactions.map((reaction, index: number) => {
                            return <AbilityRow ability={reaction} key={reaction.name + index} index={index}
                                handleAbilityUpdate={handleReactionUpdate}
                                handleAbilityRemove={() => removeReaction(index)}
                                moveCreatureItemUp={() => moveCreatureItemUp("reactions", index, setReactions)}
                                moveCreatureItemDown={() => moveCreatureItemDown("reactions", index, setReactions)} />
                        })}
                        <TextField name="legendary_desc" label="Legendary Description"
                            variant="outlined"
                            value={monsterStatblock.legendary_desc} onChange={handleInputChange} multiline
                            fullWidth />
                        <Stack direction={"row"}>

                            <Typography align={"center"} height={"100%"} padding={"5px"}>
                                Legendary Actions:
                            </Typography>
                            <Button type={"button"} onClick={addLegendaryAction}>New Legendary Action</Button>
                        </Stack>

                        {legendaryActions.map((legendary_action, index: number) => {
                            return <AbilityRow ability={legendary_action} key={legendary_action.name + index} index={index}
                                handleAbilityUpdate={handleLegendaryActionUpdate}
                                handleAbilityRemove={() => removeLegendaryAction(index)}
                                moveCreatureItemUp={() => moveCreatureItemUp("legendary_actions", index, setLegendaryActions)}
                                moveCreatureItemDown={() => moveCreatureItemDown("legendary_actions", index, setLegendaryActions)} />
                        })}
                        <TextField name="mythic_desc" label="Mythic Description"
                            variant="outlined"
                            value={monsterStatblock.mythic_desc} onChange={handleInputChange} multiline
                            fullWidth />
                        <Stack direction={"row"}>
                            <Typography align={"center"} height={"100%"} padding={"5px"}>
                                Mythic Actions:
                            </Typography>
                            <Button type={"button"} onClick={addMythicAction}>New Mythic Action</Button>
                        </Stack>
                        {mythicActions.map((mythic_action, index: number) => {
                            return <AbilityRow ability={mythic_action} key={mythic_action.name + index} index={index}
                                handleAbilityUpdate={handleMythicActionUpdate}
                                handleAbilityRemove={() => removeMythicAction(index)}
                                moveCreatureItemUp={() => moveCreatureItemUp("mythic_actions", index, setMythicActions)}
                                moveCreatureItemDown={() => moveCreatureItemDown("mythic_actions", index, setMythicActions)} />
                        })}

                        <TextField name="desc" label="Creature Description"
                            variant="outlined"
                            value={monsterStatblock.desc} onChange={handleInputChange} multiline fullWidth />

                    </Stack>
                </form>

            </div >
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