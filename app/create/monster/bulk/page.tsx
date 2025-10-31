"use client";

import React, { useState, useCallback, ChangeEvent } from 'react';
import { Upload, Loader, CheckCircle, XCircle } from 'lucide-react';
import { useAuthenticator } from "@aws-amplify/ui-react";

// --- TYPE DEFINITIONS FOR AMPLIFY SCHEMA ---

interface DamageDice {
  damage_dice: string;
  damage_type: string;
}

interface MonsterAbility {
  name: string;
  desc: string;
}

interface MonsterAttack {
  name: string;
  desc?: string;
  effect?: string;
  type?: string;
  attack_bonus?: string;
  reach?: number;
  short_range?: number;
  long_range?: number;
  damage?: DamageDice[];
  targets?: string;
}

interface MovementSpeed {
  walk?: number;
  swim?: number;
  fly?: number;
  climb?: number;
  burrow?: number;
  hover?: boolean;
  notes?: string;
}

interface SkillMods {
    [key: string]: number | undefined; // Flexible skill modifiers
}

interface SkillProfs {
    [key: string]: string | undefined; // Flexible skill proficiencies ('proficient', 'expertise', etc.)
}

// The exact structure expected by client.models.MonsterStatblock.create()
interface MonsterStatblockInput {
  id: string;
  publisher: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  desc?: string | null;
  size: string;
  type: string;
  subtype?: string | null;
  group?: string | null;
  alignment: string;
  armor_class: number;
  armor_desc?: string | null;
  current_hit_points?: number | null;
  hit_points: number;
  hit_dice_num: number;
  hit_dice?: string | null;
  speed: MovementSpeed;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  strength_save?: number | null;
  dexterity_save?: number | null;
  constitution_save?: number | null;
  intelligence_save?: number | null;
  wisdom_save?: number | null;
  charisma_save?: number | null;
  save_proficiencies: string[];
  perception?: number | null;
  skills?: SkillMods | null;
  skill_proficiencies?: SkillProfs | null;
  damage_vulnerabilities?: string | null;
  damage_vulnerability_list: string[];
  damage_resistances?: string | null;
  damage_resistance_list: string[];
  damage_immunities?: string | null;
  damage_immunity_list: string[];
  condition_immunities?: string | null;
  condition_immunity_list: string[];
  blindsight?: number | null;
  blindBeyond?: boolean | null;
  darkvision?: number | null;
  tremorsense?: number | null;
  truesight?: number | null;
  senses?: string | null;
  languages?: string | null;
  challenge_rating?: string | null;
  cr: number;
  special_abilities: MonsterAbility[];
  actions: MonsterAttack[];
  bonus_actions: MonsterAbility[];
  reactions: MonsterAbility[];
  legendary_desc?: string | null;
  legendary_actions: MonsterAbility[];
  mythic_desc?: string | null;
  mythic_actions: MonsterAbility[];
}

// Allows for flexible structure in the raw JSON input
interface RawMonsterData {
  [key: string]: any;
}

interface UploadResults {
  total: number;
  success: number;
  failed: number;
  failedNames: { name: string; reason: string }[];
  error?: string;
}

import { generateClient } from 'aws-amplify/data';
import { type Schema } from '@/amplify/data/resource'

const client = generateClient<Schema>();

// --- Utility Functions for Data Mapping ---

const parseCR = (crString: string | undefined): number => {
  if (!crString) return 0.0;
  if (crString.includes('/')) {
    const parts = crString.split('/').map(Number);
    return parts[0] / parts[1];
  }
  return parseFloat(crString) || 0.0;
};

const parseHitDiceNum = (diceString: string | undefined): number => {
  if (!diceString) return 1;
  const match = diceString.match(/^(\d+)d/);
  return match ? parseInt(match[1], 10) : 1;
};

const ensureStringArray = (field: any): string[] => {
  if (Array.isArray(field)) {
    return field.filter((item): item is string => typeof item === 'string');
  }
  return [];
};

const mapDamageDice = (rawDamage: any): DamageDice[] => {
  if (!Array.isArray(rawDamage)) return [];
  return rawDamage.map((d: any) => ({
    damage_dice: d.damage_dice || '1d4',
    damage_type: d.damage_type || 'untyped',
  }));
};

const mapAttacks = (rawActions: any): MonsterAttack[] => {
    if (!Array.isArray(rawActions)) return [];
    return rawActions.map((a: any) => ({
        name: a.name || 'Unknown Attack',
        desc: a.desc || '',
        effect: a.effect || '',
        type: a.type || 'Melee',
        attack_bonus: a.attack_bonus ? String(a.attack_bonus) : '0',
        reach: a.reach || 5,
        short_range: a.short_range || 0,
        long_range: a.long_range || 0,
        damage: mapDamageDice(a.damage),
        targets: a.targets || 'one target.',
    }));
};

const mapAbilities = (rawAbilities: any): MonsterAbility[] => {
    if (!Array.isArray(rawAbilities)) return [];
    return rawAbilities.map((a: any) => ({
        name: a.name || 'Unknown Ability',
        desc: a.desc || '',
    }));
};


// --- The Main Data Mapper ---
const mapMonster = (raw: RawMonsterData): MonsterStatblockInput => {
  const cr = parseCR(raw.challenge_rating || raw.cr);
  const hit_dice_num = parseHitDiceNum(raw.hit_dice);

  const defaultSpeed: MovementSpeed = { walk: 30, swim: 0, fly: 0, climb: 0, burrow: 0, hover: false, notes: '' };
  const defaultStat = 10;
  
  const abilityScores = {
    strength: raw.strength || defaultStat,
    dexterity: raw.dexterity || defaultStat,
    constitution: raw.constitution || defaultStat,
    intelligence: raw.intelligence || defaultStat,
    wisdom: raw.wisdom || defaultStat,
    charisma: raw.charisma || defaultStat,
  }

  const skills: SkillMods = (raw.skills && typeof raw.skills === 'object') ? raw.skills : {};
  const skill_proficiencies: SkillProfs = (raw.skill_proficiencies && typeof raw.skill_proficiencies === 'object') ? raw.skill_proficiencies : {};


  return {
    id: crypto.randomUUID(),
    publisher: raw.publisher,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // Required Fields with Fallbacks
    name: raw.name || 'Unnamed Monster',
    size: raw.size || 'Medium',
    type: raw.type || 'beast',
    alignment: raw.alignment || 'unaligned',
    armor_class: raw.armor_class || 10,
    hit_points: raw.hit_points || 1,
    hit_dice_num: hit_dice_num,
    speed: { ...defaultSpeed, ...(raw.speed || {}) },
    ...abilityScores,
    cr: cr,

    // Array Fields (Ensure Array)
    save_proficiencies: ensureStringArray(raw.save_proficiencies || raw.saving_throws_list),
    damage_vulnerability_list: ensureStringArray(raw.damage_vulnerability_list || raw.damage_vulnerabilities),
    damage_resistance_list: ensureStringArray(raw.damage_resistance_list || raw.damage_resistances),
    damage_immunity_list: ensureStringArray(raw.damage_immunity_list || raw.damage_immunities),
    condition_immunity_list: ensureStringArray(raw.condition_immunity_list || raw.condition_immunities),

    // Custom Types / Nested Objects
    skills: skills,
    skill_proficiencies: skill_proficiencies,
    special_abilities: mapAbilities(raw.special_abilities),
    actions: mapAttacks(raw.actions),
    bonus_actions: mapAbilities(raw.bonus_actions),
    reactions: mapAbilities(raw.reactions),
    legendary_actions: mapAbilities(raw.legendary_actions),
    mythic_actions: mapAbilities(raw.mythic_actions),

    // Optional Fields (can be null or undefined if missing)
    desc: raw.desc || null,
    subtype: raw.subtype || null,
    group: raw.group || null,
    armor_desc: raw.armor_desc || null,
    hit_dice: raw.hit_dice || null,
    strength_save: raw.strength_save || null,
    dexterity_save: raw.dexterity_save || null,
    constitution_save: raw.constitution_save || null,
    intelligence_save: raw.intelligence_save || null,
    wisdom_save: raw.wisdom_save || null,
    charisma_save: raw.charisma_save || null,
    perception: raw.perception || null,
    blindsight: raw.blindsight || null,
    darkvision: raw.darkvision || null,
    tremorsense: raw.tremorsense || null,
    truesight: raw.truesight || null,
    senses: raw.senses || null,
    languages: raw.languages || null,
    challenge_rating: raw.challenge_rating || null,
    legendary_desc: raw.legendary_desc || null,
    mythic_desc: raw.mythic_desc || null,
    current_hit_points: raw.hit_points || 1, // Start with full HP
    blindBeyond: raw.blindBeyond || false,
  };
};

// --- React Component ---
const MonsterUploader = () => {
  // Use File or null for the state
  const [file, setFile] = useState<File | null>(null); 
  const [status, setStatus] = useState<'idle' | 'uploading' | 'complete' | 'error'>('idle');
  // Use UploadResults or null for the state
  const [results, setResults] = useState<UploadResults | null>(null); 

  // Type the event for file selection
  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/json') {
      setFile(selectedFile);
      setResults(null);
      setStatus('idle');
    } else {
      setFile(null);
      setResults(null);
      setStatus('error');
      // Replace with custom modal/message box in a real application
      console.error('Please select a valid JSON file.');
    }
  }, []);

  const uploadMonsters = useCallback(async () => {
    if (!file) {
      // Replace with custom modal/message box
      console.error('Please select a file first.');
      return;
    }

    setStatus('uploading');
    setResults({ total: 0, success: 0, failed: 0, failedNames: [] });

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const rawMonsters: RawMonsterData[] = JSON.parse(content);

          if (!Array.isArray(rawMonsters)) {
            throw new Error("JSON file must contain a root array of monster objects.");
          }

          const mappedMonsters = rawMonsters.map(mapMonster);
          const total = mappedMonsters.length;
          
          setResults(r => ({ ...r as UploadResults, total }));

          // Use Promise.allSettled for concurrent uploads and robust error handling
          const uploadPromises = mappedMonsters.map((monster: MonsterStatblockInput) => 
            client.models.MonsterStatblock.create(monster)
              .then(() => ({ status: 'fulfilled', name: monster.name }))
              .catch((error: Error) => ({ status: 'rejected', name: monster.name, reason: error.message }))
          );

          const settledResults = await Promise.allSettled(uploadPromises);

          let successCount = 0;
          let failedCount = 0;
          const failedNames: { name: string; reason: string }[] = [];

          settledResults.forEach(res => {
            if (res.status === 'fulfilled') {
              // The value property from Promise.allSettled fulfilled results will contain { status: 'fulfilled', name: string }
              successCount++;
            } else if (res.status === 'rejected') {
              // The reason property from Promise.allSettled rejected results will contain an Error object
              // Since we wrapped the original promise with .catch to resolve to { status: 'rejected', ... }, 
              // we need to cast res.value/res.reason based on the original structure we created in uploadPromises.
              // We rely on the structure from the .then/.catch chain above.
              const resultData = res.reason as { name: string; reason: string };
              failedCount++;
              failedNames.push({ name: resultData.name, reason: resultData.reason });
              console.error(`Failed to upload ${resultData.name}: ${resultData.reason}`);
            }
          });

          setResults({ total, success: successCount, failed: failedCount, failedNames });
          setStatus('complete');

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during file processing.";
          console.error("File processing error:", error);
          setStatus('error');
          setResults({ total: 0, success: 0, failed: 0, failedNames: [], error: errorMessage });
        }
      };
      reader.readAsText(file);
    } catch (error) {
      setStatus('error');
      console.error("File read initiation failed:", error);
    }
  }, [file]);

  const getStatusIcon = (): JSX.Element => {
    if (status === 'uploading') {
        return <Loader className="w-6 h-6 animate-spin text-indigo-500" />;
    }
    if (status === 'complete' && results?.failed === 0) {
        return <CheckCircle className="w-6 h-6 text-emerald-500" />;
    }
    // @ts-expect-error
    if (status === 'error' || (status === 'complete' && results?.failed > 0)) {
        return <XCircle className="w-6 h-6 text-red-500" />;
    }
    return <Upload className="w-6 h-6 text-gray-500" />;
  };
    

    const { user, signOut } = useAuthenticator();
  

  const buttonDisabled: boolean = status === 'uploading' || !file;

  return (
    <div className="p-8 max-w-2xl mx-auto bg-gray-50 min-h-screen">
    <h1>{user?.signInDetails?.loginId}'s todos</h1>
      <button onClick={signOut}>Sign out</button>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'); body { font-family: 'Inter', sans-serif; }`}</style>

      <div className="bg-white p-6 rounded-xl shadow-2xl border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 flex items-center">
          {getStatusIcon()}
          <span className="ml-3">Amplify Monster Uploader</span>
        </h1>
        <p className="text-gray-600 mb-6">
          Upload your `deduplicated_monsters_proper.json` file to create new `MonsterStatblock` records in your Amplify Data store.
        </p>

        {/* File Input */}
        <div className="mb-6">
          <label 
            htmlFor="file-upload" 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Select JSON File (Deduplicated Data)
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-full file:border-0
                       file:text-sm file:font-semibold
                       file:bg-indigo-50 file:text-indigo-700
                       hover:file:bg-indigo-100"
          />
        </div>

        {/* Upload Button */}
        <button
          onClick={uploadMonsters}
          disabled={buttonDisabled}
          className={`w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-xl text-white shadow-lg transition duration-200
            ${buttonDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-indigo-500/50'}`}
        >
          {status === 'uploading' && <Loader className="w-5 h-5 mr-3 animate-spin" />}
          {status === 'uploading' ? `Uploading (${results?.success || 0}/${results?.total || '...'})` : 'Start Bulk Upload'}
        </button>

        {/* Results Display */}
        {results && results.total > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Upload Summary</h2>
            <div className="grid grid-cols-3 gap-4 text-center mb-6">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{results.total}</p>
                <p className="text-sm text-blue-500">Total Records</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg">
                <p className="text-3xl font-bold text-emerald-600">{results.success}</p>
                <p className="text-sm text-emerald-500">Successful Uploads</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-3xl font-bold text-red-600">{results.failed}</p>
                <p className="text-sm text-red-500">Failed Uploads</p>
              </div>
            </div>

            {results.failed > 0 && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mt-4 rounded-md">
                <h3 className="text-lg font-medium text-red-800 mb-2">Failed Monsters ({results.failed})</h3>
                <ul className="list-disc list-inside text-sm text-red-700 max-h-40 overflow-y-auto">
                  {results.failedNames.map((item, index) => (
                    <li key={index} className="truncate" title={item.reason}>
                      <span className="font-semibold">{item.name}</span>: {item.reason.substring(0, 50)}...
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {status === 'error' && results.error && (
                <div className="bg-red-100 border-l-4 border-red-500 p-4 mt-4 rounded-md">
                    <p className="font-semibold text-red-700">Fatal Error:</p>
                    <p className="text-sm text-red-700">{results.error}</p>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MonsterUploader;
