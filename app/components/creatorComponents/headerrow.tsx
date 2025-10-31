// src/app/components/creatorComponents/HeaderRow.tsx (Recommended Path)

"use client"

import {
    Button,
    FormControl,
    IconButton,
    InputAdornment,
    InputLabel,
    ListSubheader,
    MenuItem,
    Select,
    TextField,
    Toolbar
} from "@mui/material";
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import type { SelectChangeEvent } from '@mui/material/Select';
import { useTheme } from '@mui/material/styles';
import { generateClient } from 'aws-amplify/data';
import React, { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { AiOutlineSearch } from "react-icons/ai";
import { MdOutlineMenu } from "react-icons/md";
import { type Schema } from '@/amplify/data/resource';
import { cleanMonster } from "@/app/components/creatorComponents/monsterSheet";

// --- Types & Constants from Original File ---

const client = generateClient<Schema>();
type MyMonsterStatblock = Schema['MonsterStatblock']['type'];

// Assumed interface for the minimal list item returned by the list query
interface MonsterListItem {
    id: string;
    publisher: string;
    name: string;
    slug?: string;
}

// Assumed type for the new monster default stats (Pulled from the bottom of the original file)
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
};


// --- Component Props Interface ---
interface HeaderRowProps {
    monster: MyMonsterStatblock;
    setMonster: React.Dispatch<React.SetStateAction<MyMonsterStatblock>>;
    downloadFile: () => void;
}

// --- The HeaderRow Component ---

const HeaderRow: React.FC<HeaderRowProps> = ({ monster, setMonster, downloadFile }) => {

    const theme = useTheme()

    // 💡 Fix: State redundancy is removed, relying only on the 'monster' prop.
    // The internal state is *not* needed if the parent handles all monster field updates.
    // NOTE: If you need to save the monster based on changes to the *monster prop*, 
    // you should use the prop itself in the useEffect dependency array.

    // State for the prop data (used for saving/throttling)
    const monsterToSave = monster; 
    
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

        // Check against the current list state
        if (monsterList.filter((m) => m.name === newMonsterName).length > 0) {
            console.error("Creature's name is already in the database")
        }

        try {
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
            const { data: result, errors } = await client.models.MonsterStatblock.list(
                {
                    selectionSet: ['id', 'publisher', 'name'],
                    limit: 1000
                }
            );

            const items = (result || []) as MonsterListItem[];

            setMonsterList(items.sort((a, b) => a.name.localeCompare(b.name)))
        }

        getMonsterList()
    }, []);

    // Function parameter typed as MyMonsterStatblock
    const saveMonster = async (monsterToSave: MyMonsterStatblock) => {
        const { __typename, ...input } = monsterToSave as any; // Clean object for update input

        let savedMonster: MyMonsterStatblock | null = null
        console.log("TRYING TO SAVE MONSTER", input)

        if (input.publisher === 'wotc-srd') {
            console.error("Can't overwrite wizards of the coast creature")
            return
        }

        if (!input.id) {
            console.error("Attempting to update creature with no id")
            return
        }

        console.log("Updating a monster", input)
        try {
            const { data: updatedCreature, errors } = await client.models.MonsterStatblock.update(input);
        } catch (e) {
            console.error("Error update creature:", e);
        }
        if (savedMonster) {
            console.log("Saved monster", savedMonster)
        }
    }

    // Throttled Save Logic - Now using the 'monster' prop directly
    useEffect(() => {
        console.log("MONSTER PROP GOT CHANGED", monster)
        const currentTime = Date.now()

        if (currentTime - saveThrottleTime > 5000) {
            setSaveThrottleTime(currentTime)
            saveMonster(monster) // Use the prop 'monster'
        }
    }, [monster, saveThrottleTime]); 
    // Dependency now is 'monster' prop (assuming it updates whenever fields change)

    // Function parameter typed as string | undefined
    const exportJSON = (name: string | undefined) => {
        const fileName = name ? name : "spellboundmonster";
        
        // Use the prop directly for stringify
        const json = JSON.stringify(monster, null, 2); 

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
        setSelectedOption(e.target.value as string)
        const selectedMonster = displayedOptions.find(opt => opt.name === e.target.value);
        if (selectedMonster) {
            getMonster(selectedMonster.id);
        }
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
        <Box sx={{ flexGrow: 1 }} >
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
                    <Button variant={"contained"} style={{ margin: "5px" }} onClick={() => saveMonster(monsterToSave)} color="secondary">Save</Button>
                    <Button variant={"contained"} style={{ margin: "5px" }} onClick={() => exportJSON(monster.name)} color="secondary">Export JSON</Button>
                    <Button variant={"contained"} style={{ margin: "5px" }} onClick={downloadFile} color="secondary">Download PNG</Button>
                    <FormControl style={{ left: "10%", minWidth: "200px" }}>
                        <InputLabel id="search-select-label" style={{ color: "black" }}>Monster Name</InputLabel>
                        <Select
                            MenuProps={{ autoFocus: false }}
                            labelId="search-select-label"
                            id="search-select"
                            value={selectedOption}
                            label="Monsters"
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
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchText(e.target.value)}
                                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                        if (e.key !== "Escape") {
                                            e.stopPropagation();
                                        }
                                    }}
                                />
                            </ListSubheader>
                            {displayedOptions.map((option, i) => (
                                <MenuItem key={`${option.id}-${i}`} value={option.name}>
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

export default HeaderRow;