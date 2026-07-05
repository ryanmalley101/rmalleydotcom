"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import {
    Box, Container, Typography, Button, TextField, MenuItem,
    Select, FormControl, InputLabel, CircularProgress, Divider,
    Grid, Tabs, Tab, IconButton, Tooltip, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Paper, Checkbox, FormControlLabel, Table, TableBody,
    TableCell, TableHead, TableRow, Switch, LinearProgress,
} from "@mui/material";
import Link from "next/link";
import {
    ArrowLeft, Save, Pencil, X, Trash2, User, Plus, Minus,
    Upload, Zap, Shield, BookOpen, Package, Star, Sword, Moon, PawPrint, Heart,
} from "lucide-react";
import { generateClient } from "aws-amplify/data";
import { uploadData, getUrl } from "aws-amplify/storage";
import type { Schema } from "@/amplify/data/resource";
import CypherSheet from "./CypherSheet";
import { useAutosaveDefault } from "@/lib/useAutosaveDefault";

const client = generateClient<Schema>();
type PC         = Schema["PlayerCharacter"]["type"];
type Companion  = Schema["Companion"]["type"];

// ── Constants ──────────────────────────────────────────────────────────────────

const ALIGNMENTS = [
    "Lawful Good","Neutral Good","Chaotic Good",
    "Lawful Neutral","True Neutral","Chaotic Neutral",
    "Lawful Evil","Neutral Evil","Chaotic Evil","Unaligned",
];
const CLASSES = [
    "Artificer","Barbarian","Bard","Blood Hunter","Cleric","Druid","Fighter",
    "Monk","Paladin","Ranger","Rogue","Sorcerer","Warlock","Wizard","Other",
];
const HIT_DICE: Record<string, string> = {
    Artificer:"d8", Barbarian:"d12", Bard:"d8", "Blood Hunter":"d10",
    Cleric:"d8", Druid:"d8", Fighter:"d10", Monk:"d8", Paladin:"d10",
    Ranger:"d10", Rogue:"d8", Sorcerer:"d6", Warlock:"d8", Wizard:"d6", Other:"d8",
};
const ABILITIES = ["strength","dexterity","constitution","intelligence","wisdom","charisma"] as const;
type Ability = typeof ABILITIES[number];
const ABILITY_LABELS: Record<Ability, string> = {
    strength:"STR", dexterity:"DEX", constitution:"CON",
    intelligence:"INT", wisdom:"WIS", charisma:"CHA",
};
const SKILLS: { name: string; ability: Ability; key: string }[] = [
    { name:"Acrobatics",     ability:"dexterity",     key:"acrobatics" },
    { name:"Animal Handling",ability:"wisdom",         key:"animal_handling" },
    { name:"Arcana",         ability:"intelligence",   key:"arcana" },
    { name:"Athletics",      ability:"strength",       key:"athletics" },
    { name:"Deception",      ability:"charisma",       key:"deception" },
    { name:"History",        ability:"intelligence",   key:"history" },
    { name:"Insight",        ability:"wisdom",         key:"insight" },
    { name:"Intimidation",   ability:"charisma",       key:"intimidation" },
    { name:"Investigation",  ability:"intelligence",   key:"investigation" },
    { name:"Medicine",       ability:"wisdom",         key:"medicine" },
    { name:"Nature",         ability:"intelligence",   key:"nature" },
    { name:"Perception",     ability:"wisdom",         key:"perception" },
    { name:"Performance",    ability:"charisma",       key:"performance" },
    { name:"Persuasion",     ability:"charisma",       key:"persuasion" },
    { name:"Religion",       ability:"intelligence",   key:"religion" },
    { name:"Sleight of Hand",ability:"dexterity",      key:"sleight_of_hand" },
    { name:"Stealth",        ability:"dexterity",      key:"stealth" },
    { name:"Survival",       ability:"wisdom",         key:"survival" },
];
const ALIGNMENT_MAP: Record<number, string> = {
    1:"Lawful Good", 2:"Neutral Good", 3:"Chaotic Good",
    4:"Lawful Neutral", 5:"True Neutral", 6:"Chaotic Neutral",
    7:"Lawful Evil", 8:"Neutral Evil", 9:"Chaotic Evil",
};
const DDB_SKILL_MAP: Record<string, string> = {
    "animal-handling":"animal_handling",
    "sleight-of-hand":"sleight_of_hand",
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface ClassEntry { class: string; level: number; subclass?: string; hitDie?: string; }
interface AttackEntry { name: string; bonus: string; damage: string; damageType: string; properties?: string; description?: string; }
interface InventoryItem { name: string; type: string; quantity: number; weight?: number; equipped?: boolean; attuned?: boolean; description?: string; }
interface SpellSlots { [level: string]: { max: number; used: number } }
interface SpellEntry { name: string; level: number; school?: string; castingTime?: string; range?: string; components?: string; duration?: string; description?: string; prepared?: boolean; }
interface FeatureEntry { name: string; source?: string; description: string; uses?: number; maxUses?: number; recharge?: string; }

// ── Companion types ────────────────────────────────────────────────────────────

interface CompanionForm {
    name: string; species: string; companionType: string;
    maxHp: string; currentHp: string; tempHp: string;
    armorClass: string; speed: string;
    strength: string; dexterity: string; constitution: string;
    intelligence: string; wisdom: string; charisma: string;
    notes: string;
}
const EMPTY_COMP: CompanionForm = {
    name: "", species: "", companionType: "other",
    maxHp: "", currentHp: "", tempHp: "0",
    armorClass: "10", speed: "30",
    strength: "10", dexterity: "10", constitution: "10",
    intelligence: "10", wisdom: "10", charisma: "10",
    notes: "",
};
const COMP_TYPES = ["familiar","ranger companion","mount","summoned","other"] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

const mod = (score: number) => Math.floor((score - 10) / 2);
const fmtMod = (n: number) => n >= 0 ? `+${n}` : `${n}`;
const profBonus = (totalLevel: number) => Math.ceil(totalLevel / 4) + 1;
function parseJson<T>(s: string | null | undefined, fallback: T): T {
    if (!s) return fallback;
    try { return JSON.parse(s) as T; } catch { return fallback; }
}

// ── D&D Beyond JSON parser ────────────────────────────────────────────────────

function parseDdbJson(raw: string): Partial<Record<string, unknown>> & { _classes?: ClassEntry[]; _saveProfs?: string[]; _skillProfs?: Record<string, string>; _attacks?: AttackEntry[]; _inventory?: InventoryItem[]; _spells?: SpellEntry[]; _spellSlots?: SpellSlots; _features?: FeatureEntry[] } {
    const data = JSON.parse(raw)?.data ?? JSON.parse(raw);
    const getStat = (id: number) => (data.stats ?? []).find((s: any) => s.id === id)?.value ?? 10;

    const classes: ClassEntry[] = (data.classes ?? []).map((c: any) => ({
        class: c.definition?.name ?? "Unknown",
        level: c.level ?? 1,
        subclass: c.subclassDefinition?.name ?? undefined,
        hitDie: HIT_DICE[c.definition?.name] ?? "d8",
    }));
    const totalLevel = classes.reduce((s, c) => s + c.level, 0);

    // Parse skill/save proficiencies from modifiers
    const allMods: any[] = Object.values(data.modifiers ?? {}).flat();
    const saveProfs: string[] = [];
    const skillProfs: Record<string, string> = {};
    for (const m of allMods) {
        if (m.type === "proficiency") {
            const sub: string = m.subType ?? "";
            if (sub.endsWith("-saving-throws")) {
                const ability = sub.replace("-saving-throws", "");
                if (!saveProfs.includes(ability)) saveProfs.push(ability);
            } else {
                const key = DDB_SKILL_MAP[sub] ?? sub.replace(/-/g, "_");
                if (SKILLS.some(s => s.key === key) && !skillProfs[key]) skillProfs[key] = "proficient";
            }
        } else if (m.type === "expertise") {
            const sub: string = m.subType ?? "";
            const key = DDB_SKILL_MAP[sub] ?? sub.replace(/-/g, "_");
            if (SKILLS.some(s => s.key === key)) skillProfs[key] = "expert";
        }
    }

    // Inventory
    const inventory: InventoryItem[] = (data.inventory ?? []).map((item: any) => ({
        name: item.definition?.name ?? "",
        type: item.definition?.type ?? "Gear",
        quantity: item.quantity ?? 1,
        weight: item.definition?.weight ?? 0,
        equipped: item.equipped ?? false,
        attuned: item.isAttuned ?? false,
        description: item.definition?.description ?? "",
    }));

    // Spells
    const spells: SpellEntry[] = [];
    const spellSources = data.spells ?? {};
    for (const srcSpells of Object.values(spellSources)) {
        if (!Array.isArray(srcSpells)) continue;
        for (const sp of srcSpells) {
            spells.push({
                name: sp.definition?.name ?? "",
                level: sp.definition?.level ?? 0,
                school: sp.definition?.school ?? "",
                castingTime: sp.definition?.activation ? `${sp.definition.activation.activationTime ?? ""} ${sp.definition.activation.activationTypeId === 1 ? "action" : ""}`.trim() : "",
                range: sp.definition?.range?.rangeValue != null ? `${sp.definition.range.rangeValue} ft.` : sp.definition?.range?.aoeType ?? "",
                components: (sp.definition?.components ?? []).map((c: number) => ["V","S","M"][c-1] ?? "").join(", "),
                duration: sp.definition?.duration?.durationType ?? "",
                description: sp.definition?.description ?? "",
                prepared: sp.prepared ?? false,
            });
        }
    }

    // Spell slots from class levels
    const spellSlots: SpellSlots = {};
    const SLOT_TABLE: Record<number, number[]> = {
        1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0],
        4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0],
        7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0],
        10:[4,3,3,3,2,0,0,0,0], 11:[4,3,3,3,2,1,0,0,0], 12:[4,3,3,3,2,1,0,0,0],
        13:[4,3,3,3,2,1,1,0,0], 14:[4,3,3,3,2,1,1,0,0], 15:[4,3,3,3,2,1,1,1,0],
        16:[4,3,3,3,2,1,1,1,0], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1],
        19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1],
    };
    if (totalLevel > 0 && SLOT_TABLE[totalLevel]) {
        SLOT_TABLE[totalLevel].forEach((max, i) => {
            if (max > 0) spellSlots[String(i + 1)] = { max, used: 0 };
        });
    }

    return {
        characterName: data.name ?? "",
        race: data.race?.fullName ?? "",
        alignment: ALIGNMENT_MAP[data.alignmentId] ?? "True Neutral",
        xp: data.currentXp ?? 0,
        strength: getStat(1), dexterity: getStat(2), constitution: getStat(3),
        intelligence: getStat(4), wisdom: getStat(5), charisma: getStat(6),
        maxHp: data.baseHitPoints ?? 0,
        currentHp: (data.baseHitPoints ?? 0) - (data.removedHitPoints ?? 0),
        tempHp: data.temporaryHitPoints ?? 0,
        inspiration: data.inspiration ?? false,
        personality: data.traits?.personalityTraits ?? "",
        ideals: data.traits?.ideals ?? "",
        bonds: data.traits?.bonds ?? "",
        flaws: data.traits?.flaws ?? "",
        backstory: data.notes?.backstory ?? "",
        allies: data.notes?.allies ?? "",
        notes: data.notes?.personalPossessions ?? "",
        gender: data.gender ?? "",
        age: String(data.age ?? ""),
        height: data.height ?? "",
        weight: String(data.weight ?? ""),
        eyes: data.eyes ?? "",
        skin: data.skin ?? "",
        hair: data.hair ?? "",
        _classes: classes,
        _saveProfs: saveProfs,
        _skillProfs: skillProfs,
        _inventory: inventory,
        _spells: spells,
        _spellSlots: spellSlots,
        _features: [],
        _attacks: [],
    };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CharacterPage() {
    const { campaignId, characterId } = useParams<{ campaignId: string; characterId: string }>();
    const router = useRouter();

    const [pc, setPc]             = useState<PC | null>(null);
    useDocumentTitle(pc?.characterName ?? null);
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);
    const [autosaving, setAutosaving] = useState(false);
    const [lastAutosaved, setLastAutosaved] = useState<Date | null>(null);
    const [editing, setEditing]   = useState(false);

    const { autosaveDefault, autosaveDefaultLoaded, setAutosaveDefault } = useAutosaveDefault();
    const [autosaveEnabled, setAutosaveEnabled] = useState(true);
    const autosaveSeededRef = useRef(false);
    const lastSavedRef = useRef<string>("");
    const [tab, setTab]           = useState(0);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [importOpen, setImportOpen]       = useState(false);
    const [importText, setImportText]       = useState("");
    const [importError, setImportError]     = useState("");
    const [shortRestOpen, setShortRestOpen] = useState(false);
    const [shortRestHp, setShortRestHp]     = useState("");
    const [portraitUrl, setPortraitUrl]     = useState<string | null>(null);
    const [portraitUploading, setPortraitUploading] = useState(false);
    const portraitInputRef = useRef<HTMLInputElement>(null);

    // Companions
    const [companions, setCompanions]         = useState<Companion[]>([]);
    const [compOpen, setCompOpen]             = useState(false);
    const [editComp, setEditComp]             = useState<Companion | null>(null);
    const [deleteComp, setDeleteComp]         = useState<Companion | null>(null);
    const [compForm, setCompForm]             = useState<CompanionForm>(EMPTY_COMP);
    const [compSaving, setCompSaving]         = useState(false);

    // Simple string/number fields
    const [form, setForm] = useState<Record<string, string>>({});

    // Array / structured fields
    const [classes, setClasses]     = useState<ClassEntry[]>([]);
    const [saveProfs, setSaveProfs] = useState<string[]>([]);
    const [skillProfs, setSkillProfs] = useState<Record<string, string>>({});
    const [attacks, setAttacks]     = useState<AttackEntry[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [spellSlots, setSpellSlots] = useState<SpellSlots>({});
    const [spells, setSpells]       = useState<SpellEntry[]>([]);
    const [features, setFeatures]   = useState<FeatureEntry[]>([]);

    // Death saves
    const [dss, setDss] = useState(0); // successes
    const [dsf, setDsf] = useState(0); // failures

    function hydrate(p: PC) {
        const newForm = {
            characterName: p.characterName ?? "",
            playerName:    p.playerName ?? "",
            race:          p.race ?? "",
            background:    p.background ?? "",
            alignment:     p.alignment ?? "True Neutral",
            xp:            String(p.xp ?? 0),
            strength:      String(p.strength ?? 10),
            dexterity:     String(p.dexterity ?? 10),
            constitution:  String(p.constitution ?? 10),
            intelligence:  String(p.intelligence ?? 10),
            wisdom:        String(p.wisdom ?? 10),
            charisma:      String(p.charisma ?? 10),
            maxHp:         String(p.maxHp ?? ""),
            currentHp:     String(p.currentHp ?? ""),
            tempHp:        String(p.tempHp ?? 0),
            armorClass:    String(p.armorClass ?? 10),
            speed:         String(p.speed ?? 30),
            initiative:    String(p.initiative ?? 0),
            hitDice:       p.hitDice ?? "",
            spellcastingAbility: p.spellcastingAbility ?? "",
            personality:   p.personality ?? "",
            ideals:        p.ideals ?? "",
            bonds:         p.bonds ?? "",
            flaws:         p.flaws ?? "",
            backstory:     p.backstory ?? "",
            notes:         p.notes ?? "",
            allies:        p.allies ?? "",
            gender:        p.gender ?? "",
            age:           p.age ?? "",
            height:        p.height ?? "",
            weight:        p.weight ?? "",
            eyes:          p.eyes ?? "",
            skin:          p.skin ?? "",
            hair:          p.hair ?? "",
            languages:     p.languages ?? "",
            proficiencies: p.proficiencies ?? "",
            exhaustion:    String(p.exhaustion ?? 0),
            copper:        String(p.copper ?? 0),
            silver:        String(p.silver ?? 0),
            electrum:      String(p.electrum ?? 0),
            gold:          String(p.gold ?? 0),
            platinum:      String(p.platinum ?? 0),
        };
        const newClasses  = parseJson<ClassEntry[]>(p.classesJson, p.characterClass ? [{ class: p.characterClass, level: p.level ?? 1, subclass: p.subclass ?? undefined }] : []);
        const newSaveProfs  = parseJson<string[]>(p.saveProficienciesJson, []);
        const newSkillProfs = parseJson<Record<string, string>>(p.skillProficienciesJson, {});
        const newAttacks    = parseJson<AttackEntry[]>(p.attacksJson, []);
        const newInventory  = parseJson<InventoryItem[]>(p.inventoryJson, []);
        const newSpellSlots = parseJson<SpellSlots>(p.spellSlotsJson, {});
        const newSpells     = parseJson<SpellEntry[]>(p.spellsJson, []);
        const newFeatures   = parseJson<FeatureEntry[]>(p.featuresJson, []);
        const newDss = p.deathSaveSuccesses ?? 0;
        const newDsf = p.deathSaveFailures ?? 0;

        setForm(newForm);
        setClasses(newClasses);
        setSaveProfs(newSaveProfs);
        setSkillProfs(newSkillProfs);
        setAttacks(newAttacks);
        setInventory(newInventory);
        setSpellSlots(newSpellSlots);
        setSpells(newSpells);
        setFeatures(newFeatures);
        setDss(newDss);
        setDsf(newDsf);

        lastSavedRef.current = JSON.stringify({
            form: newForm, classes: newClasses, saveProfs: newSaveProfs,
            skillProfs: newSkillProfs, attacks: newAttacks, inventory: newInventory,
            spellSlots: newSpellSlots, spells: newSpells, features: newFeatures,
            dss: newDss, dsf: newDsf,
        });
    }

    useEffect(() => {
        if (autosaveDefaultLoaded && !autosaveSeededRef.current) {
            setAutosaveEnabled(autosaveDefault);
            autosaveSeededRef.current = true;
        }
    }, [autosaveDefaultLoaded, autosaveDefault]);

    const isDirty = useMemo(() => {
        if (!editing) return false;
        const current = JSON.stringify({ form, classes, saveProfs, skillProfs, attacks, inventory, spellSlots, spells, features, dss, dsf });
        return current !== lastSavedRef.current;
    }, [editing, form, classes, saveProfs, skillProfs, attacks, inventory, spellSlots, spells, features, dss, dsf]);

    useEffect(() => {
        function handler(e: BeforeUnloadEvent) {
            if (isDirty) { e.preventDefault(); e.returnValue = ""; }
        }
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [isDirty]);

    useEffect(() => {
        if (!editing || !autosaveEnabled || !isDirty) return;
        const timer = setTimeout(() => { silentSave(); }, 4000);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editing, autosaveEnabled, isDirty, form, classes, saveProfs, skillProfs, attacks, inventory, spellSlots, spells, features, dss, dsf]);

    async function silentSave() {
        if (!pc) return;
        setAutosaving(true);
        await client.models.PlayerCharacter.update({
            id: pc.id,
            characterName: form.characterName.trim(),
            playerName:    form.playerName.trim() || undefined,
            race:          form.race.trim() || undefined,
            background:    form.background.trim() || undefined,
            alignment:     form.alignment || undefined,
            xp:            num("xp"),
            classesJson:   JSON.stringify(classes),
            characterClass: classes[0]?.class || undefined,
            subclass:      classes[0]?.subclass || undefined,
            level:         totalLevel || undefined,
            strength:      num("strength"),
            dexterity:     num("dexterity"),
            constitution:  num("constitution"),
            intelligence:  num("intelligence"),
            wisdom:        num("wisdom"),
            charisma:      num("charisma"),
            saveProficienciesJson:  JSON.stringify(saveProfs),
            skillProficienciesJson: JSON.stringify(skillProfs),
            maxHp:         num("maxHp") || undefined,
            currentHp:     num("currentHp") || undefined,
            tempHp:        num("tempHp") || undefined,
            armorClass:    num("armorClass") || undefined,
            speed:         num("speed") || undefined,
            initiative:    num("initiative") || undefined,
            hitDice:       form.hitDice || undefined,
            deathSaveSuccesses: dss,
            deathSaveFailures:  dsf,
            inspiration:   form.inspiration === "true",
            exhaustion:    num("exhaustion"),
            attacksJson:   JSON.stringify(attacks),
            inventoryJson: JSON.stringify(inventory),
            copper:        num("copper"), silver: num("silver"),
            electrum:      num("electrum"), gold: num("gold"), platinum: num("platinum"),
            spellcastingAbility: form.spellcastingAbility || undefined,
            spellSlotsJson: JSON.stringify(spellSlots),
            spellsJson:    JSON.stringify(spells),
            featuresJson:  JSON.stringify(features),
            personality:   form.personality || undefined,
            ideals:        form.ideals || undefined,
            bonds:         form.bonds || undefined,
            flaws:         form.flaws || undefined,
            backstory:     form.backstory || undefined,
            notes:         form.notes || undefined,
            allies:        form.allies || undefined,
            gender:        form.gender || undefined,
            age:           form.age || undefined,
            height:        form.height || undefined,
            weight:        form.weight || undefined,
            eyes:          form.eyes || undefined,
            skin:          form.skin || undefined,
            hair:          form.hair || undefined,
            languages:     form.languages || undefined,
            proficiencies: form.proficiencies || undefined,
        });
        lastSavedRef.current = JSON.stringify({ form, classes, saveProfs, skillProfs, attacks, inventory, spellSlots, spells, features, dss, dsf });
        setAutosaving(false);
        setLastAutosaved(new Date());
    }

    async function load() {
        const [pcRes, compRes] = await Promise.all([
            client.models.PlayerCharacter.get({ id: characterId }),
            client.models.Companion.list(),
        ]);
        const data = pcRes.data;
        setPc(data);
        if (data) {
            hydrate(data);
            if (data.portraitKey) {
                try {
                    const { url } = await getUrl({ path: data.portraitKey, options: { expiresIn: 3600 } });
                    setPortraitUrl(url.toString());
                } catch { /* no portrait */ }
            }
        }
        setCompanions((compRes.data ?? []).filter(c => c.characterId === characterId));
        setLoading(false);
    }

    function compNum(k: keyof CompanionForm) { return parseInt(compForm[k] as string, 10) || 0; }

    function openCreateComp() { setEditComp(null); setCompForm({ ...EMPTY_COMP }); setCompOpen(true); }
    function openEditComp(c: Companion) {
        setEditComp(c);
        setCompForm({
            name: c.name, species: c.species ?? "", companionType: c.companionType ?? "other",
            maxHp: String(c.maxHp ?? ""), currentHp: String(c.currentHp ?? ""), tempHp: String(c.tempHp ?? 0),
            armorClass: String(c.armorClass ?? 10), speed: String(c.speed ?? 30),
            strength: String(c.strength ?? 10), dexterity: String(c.dexterity ?? 10),
            constitution: String(c.constitution ?? 10), intelligence: String(c.intelligence ?? 10),
            wisdom: String(c.wisdom ?? 10), charisma: String(c.charisma ?? 10),
            notes: c.notes ?? "",
        });
        setCompOpen(true);
    }

    async function saveComp() {
        if (!compForm.name.trim() || !pc) return;
        setCompSaving(true);
        const payload = {
            name: compForm.name.trim(), species: compForm.species || undefined,
            companionType: compForm.companionType || undefined,
            maxHp: compNum("maxHp") || undefined, currentHp: compNum("currentHp") || undefined,
            tempHp: compNum("tempHp") || undefined, armorClass: compNum("armorClass") || undefined,
            speed: compNum("speed") || undefined,
            strength: compNum("strength") || undefined, dexterity: compNum("dexterity") || undefined,
            constitution: compNum("constitution") || undefined, intelligence: compNum("intelligence") || undefined,
            wisdom: compNum("wisdom") || undefined, charisma: compNum("charisma") || undefined,
            notes: compForm.notes || undefined,
        };
        if (editComp) {
            await client.models.Companion.update({ id: editComp.id, ...payload });
        } else {
            await client.models.Companion.create({ characterId, campaignId, ...payload });
        }
        setCompSaving(false);
        setCompOpen(false);
        load();
    }

    async function confirmDeleteComp() {
        if (!deleteComp) return;
        await client.models.Companion.delete({ id: deleteComp.id });
        setDeleteComp(null);
        load();
    }

    async function adjustCompHp(c: Companion, delta: number) {
        const next = Math.min(c.maxHp ?? 999, Math.max(0, (c.currentHp ?? 0) + delta));
        await client.models.Companion.update({ id: c.id, currentHp: next });
        setCompanions(prev => prev.map(x => x.id === c.id ? { ...x, currentHp: next } : x));
    }

    async function uploadPortrait(file: File) {
        if (!pc) return;
        setPortraitUploading(true);
        const ext = file.name.split(".").pop() ?? "jpg";
        const key = `portraits/${characterId}/${Date.now()}.${ext}`;
        try {
            await uploadData({ path: key, data: file, options: { contentType: file.type } }).result;
            await client.models.PlayerCharacter.update({ id: pc.id, portraitKey: key });
            const { url } = await getUrl({ path: key, options: { expiresIn: 3600 } });
            setPortraitUrl(url.toString());
            setPc(prev => prev ? { ...prev, portraitKey: key } : prev);
        } catch { /* upload failed */ }
        setPortraitUploading(false);
    }

    useEffect(() => { load(); }, [characterId]);

    const f = (field: string) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setForm(prev => ({ ...prev, [field]: e.target.value }));

    const num = (k: string) => parseInt(form[k] ?? "0", 10) || 0;

    const totalLevel = classes.reduce((s, c) => s + c.level, 0);
    const pb = profBonus(totalLevel || num("level") || 1);

    async function save() {
        if (!pc) return;
        setSaving(true);
        await client.models.PlayerCharacter.update({
            id: pc.id,
            characterName: form.characterName.trim(),
            playerName:    form.playerName.trim() || undefined,
            race:          form.race.trim() || undefined,
            background:    form.background.trim() || undefined,
            alignment:     form.alignment || undefined,
            xp:            num("xp"),
            classesJson:   JSON.stringify(classes),
            characterClass: classes[0]?.class || undefined,
            subclass:      classes[0]?.subclass || undefined,
            level:         totalLevel || undefined,
            strength:      num("strength"),
            dexterity:     num("dexterity"),
            constitution:  num("constitution"),
            intelligence:  num("intelligence"),
            wisdom:        num("wisdom"),
            charisma:      num("charisma"),
            saveProficienciesJson:  JSON.stringify(saveProfs),
            skillProficienciesJson: JSON.stringify(skillProfs),
            maxHp:         num("maxHp") || undefined,
            currentHp:     num("currentHp") || undefined,
            tempHp:        num("tempHp") || undefined,
            armorClass:    num("armorClass") || undefined,
            speed:         num("speed") || undefined,
            initiative:    num("initiative") || undefined,
            hitDice:       form.hitDice || undefined,
            deathSaveSuccesses: dss,
            deathSaveFailures:  dsf,
            inspiration:   form.inspiration === "true",
            exhaustion:    num("exhaustion"),
            attacksJson:   JSON.stringify(attacks),
            inventoryJson: JSON.stringify(inventory),
            copper:        num("copper"), silver: num("silver"),
            electrum:      num("electrum"), gold: num("gold"), platinum: num("platinum"),
            spellcastingAbility: form.spellcastingAbility || undefined,
            spellSlotsJson: JSON.stringify(spellSlots),
            spellsJson:    JSON.stringify(spells),
            featuresJson:  JSON.stringify(features),
            personality:   form.personality || undefined,
            ideals:        form.ideals || undefined,
            bonds:         form.bonds || undefined,
            flaws:         form.flaws || undefined,
            backstory:     form.backstory || undefined,
            notes:         form.notes || undefined,
            allies:        form.allies || undefined,
            gender:        form.gender || undefined,
            age:           form.age || undefined,
            height:        form.height || undefined,
            weight:        form.weight || undefined,
            eyes:          form.eyes || undefined,
            skin:          form.skin || undefined,
            hair:          form.hair || undefined,
            languages:     form.languages || undefined,
            proficiencies: form.proficiencies || undefined,
        });
        setSaving(false);
        setEditing(false);
        load();
    }

    function applyImport() {
        setImportError("");
        try {
            const parsed = parseDdbJson(importText);
            setForm(prev => ({
                ...prev,
                ...(Object.fromEntries(
                    Object.entries(parsed)
                        .filter(([k]) => !k.startsWith("_"))
                        .map(([k, v]) => [k, String(v ?? "")])
                )),
            }));
            if (parsed._classes)    setClasses(parsed._classes);
            if (parsed._saveProfs)  setSaveProfs(parsed._saveProfs);
            if (parsed._skillProfs) setSkillProfs(parsed._skillProfs);
            if (parsed._inventory)  setInventory(parsed._inventory);
            if (parsed._spells)     setSpells(parsed._spells);
            if (parsed._spellSlots) setSpellSlots(parsed._spellSlots);
            if (parsed._attacks)    setAttacks(parsed._attacks);
            if (parsed._features)   setFeatures(parsed._features);
            setEditing(true);
            setImportOpen(false);
            setImportText("");
        } catch (e: any) {
            setImportError("Failed to parse JSON: " + (e?.message ?? "Unknown error"));
        }
    }

    async function deleteCharacter() {
        if (!pc) return;
        await client.models.PlayerCharacter.delete({ id: pc.id });
        router.push(`/tabletop/campaigns/${campaignId}`);
    }

    // ── Skill calculation ────────────────────────────────────────────────────

    function abilityScore(ab: Ability): number { return parseInt(form[ab] ?? "10", 10) || 10; }
    function skillMod(key: string, ability: Ability): number {
        const base = mod(abilityScore(ability));
        const prof = skillProfs[key];
        if (prof === "expert") return base + pb * 2;
        if (prof === "proficient") return base + pb;
        return base;
    }
    function saveMod(ability: Ability): number {
        const base = mod(abilityScore(ability));
        return saveProfs.includes(ability) ? base + pb : base;
    }
    function toggleSaveProf(ability: Ability) {
        setSaveProfs(prev =>
            prev.includes(ability) ? prev.filter(a => a !== ability) : [...prev, ability]
        );
    }
    function cycleSkillProf(key: string) {
        setSkillProfs(prev => {
            const cur = prev[key];
            if (!cur) return { ...prev, [key]: "proficient" };
            if (cur === "proficient") return { ...prev, [key]: "expert" };
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }

    const spellSaveDC = 8 + pb + mod(abilityScore((form.spellcastingAbility as Ability) ?? "intelligence"));
    const spellAtk = pb + mod(abilityScore((form.spellcastingAbility as Ability) ?? "intelligence"));

    async function quickSave(fields: Partial<Parameters<typeof client.models.PlayerCharacter.update>[0]>) {
        if (!pc) return;
        await client.models.PlayerCharacter.update({ id: pc.id, ...fields });
        load();
    }

    function doLongRest() {
        const maxHp = num("maxHp");
        // Restore all spell slots
        const restoredSlots: SpellSlots = {};
        for (const [lvl, slot] of Object.entries(spellSlots)) {
            restoredSlots[lvl] = { max: slot.max, used: 0 };
        }
        setSpellSlots(restoredSlots);
        setDss(0);
        setDsf(0);
        setForm(p => ({ ...p, currentHp: String(maxHp), tempHp: "0",
            exhaustion: String(Math.max(0, (parseInt(p.exhaustion) || 0) - 1)) }));
        quickSave({
            currentHp: maxHp,
            tempHp: 0,
            deathSaveSuccesses: 0,
            deathSaveFailures: 0,
            exhaustion: Math.max(0, num("exhaustion") - 1),
            spellSlotsJson: JSON.stringify(restoredSlots),
        });
    }

    function doShortRest(hpGain: number) {
        const newHp = Math.min(num("maxHp"), num("currentHp") + hpGain);
        setForm(p => ({ ...p, currentHp: String(newHp) }));
        quickSave({ currentHp: newHp });
    }

    // ── Loading / not found ───────────────────────────────────────────────────

    if (loading) return (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 12 }}>
            <CircularProgress sx={{ color: "primary.main" }} />
        </Box>
    );
    if (!pc) return (
        <Box sx={{ textAlign: "center", pt: 12 }}>
            <Typography color="error">Character not found.</Typography>
            <Button component={Link} href={`/tabletop/campaigns/${campaignId}`} sx={{ mt: 2 }}>Back to Campaign</Button>
        </Box>
    );

    if (pc.system === "Cypher System") {
        return <CypherSheet pc={pc} campaignId={campaignId} />;
    }

    const classLabel = classes.length > 0
        ? classes.map(c => `${c.class} ${c.level}${c.subclass ? ` (${c.subclass})` : ""}`).join(" / ")
        : [pc.characterClass, pc.subclass].filter(Boolean).join(" — ");

    // ── JSX ───────────────────────────────────────────────────────────────────

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 8 }}>
            <Container maxWidth="md">
                <Button component={Link} href={`/tabletop/campaigns/${campaignId}`}
                    startIcon={<ArrowLeft size={16} />} sx={{ mb: 4, color: "primary.main" }}>
                    Back to Campaign
                </Button>

                {/* Hidden portrait file input */}
                <input ref={portraitInputRef} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadPortrait(f); e.target.value = ""; }} />

                {/* Header */}
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 3 }}>
                    <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                        <Tooltip title={portraitUrl ? "Change portrait" : "Upload portrait"}>
                            <Box onClick={() => portraitInputRef.current?.click()}
                                sx={{ width: 52, height: 52, borderRadius: 2, border: "2px solid",
                                    borderColor: "primary.light", overflow: "hidden", flexShrink: 0,
                                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                    backgroundColor: "action.hover", position: "relative",
                                    "&:hover .portrait-overlay": { opacity: 1 },
                                }}>
                                {portraitUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={portraitUrl} alt="Portrait" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                    portraitUploading
                                        ? <CircularProgress size={20} />
                                        : <User size={24} color="#8C5A3A" />
                                )}
                                {portraitUrl && (
                                    <Box className="portrait-overlay" sx={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.45)",
                                        display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}>
                                        {portraitUploading ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : <Upload size={18} color="#fff" />}
                                    </Box>
                                )}
                            </Box>
                        </Tooltip>
                        <Box>
                            <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>
                                {editing ? form.characterName || "Unnamed" : pc.characterName}
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                {[form.race || pc.race, classLabel].filter(Boolean).join(" · ")}
                            </Typography>
                            <Box sx={{ display: "flex", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
                                {totalLevel > 0 && <Chip label={`Level ${totalLevel}`} size="small" />}
                                {(form.background || pc.background) && <Chip label={form.background || pc.background} size="small" variant="outlined" />}
                                {(form.playerName || pc.playerName) && (
                                    <Typography variant="caption" sx={{ color: "text.secondary", alignSelf: "center" }}>
                                        played by {form.playerName || pc.playerName}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Button size="small" startIcon={<Upload size={14} />} onClick={() => setImportOpen(true)}
                            sx={{ fontSize: "0.75rem" }}>
                            Import D&amp;D Beyond
                        </Button>
                        {editing ? (
                            <>
                                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                    <Switch size="small" checked={autosaveEnabled}
                                        onChange={e => setAutosaveEnabled(e.target.checked)} />
                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Autosave</Typography>
                                    {autosaveDefaultLoaded && autosaveEnabled !== autosaveDefault && (
                                        <Button size="small" onClick={() => setAutosaveDefault(autosaveEnabled)}
                                            sx={{ fontSize: "0.65rem", minWidth: 0, p: 0, textTransform: "none", color: "primary.main" }}>
                                            Set as default
                                        </Button>
                                    )}
                                    {autosaving ? (
                                        <Typography variant="caption" sx={{ color: "text.disabled" }}>Saving…</Typography>
                                    ) : lastAutosaved ? (
                                        <Typography variant="caption" sx={{ color: "text.disabled" }}>
                                            Autosaved {lastAutosaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </Typography>
                                    ) : null}
                                </Box>
                                <Button startIcon={<X size={16} />} onClick={() => { hydrate(pc); setEditing(false); }}>Cancel</Button>
                                <Button variant="contained" startIcon={<Save size={16} />}
                                    onClick={save} disabled={saving} sx={{ backgroundColor: "primary.main" }}>
                                    {saving ? <CircularProgress size={18} /> : "Save"}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Tooltip title="Edit character">
                                    <IconButton onClick={() => setEditing(true)} size="small"><Pencil size={18} /></IconButton>
                                </Tooltip>
                                <Tooltip title="Delete character">
                                    <IconButton size="small" color="error" onClick={() => setConfirmDelete(true)}><Trash2 size={18} /></IconButton>
                                </Tooltip>
                            </>
                        )}
                    </Box>
                </Box>

                <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
                    sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
                    <Tab icon={<User size={14} />} iconPosition="start" label="Overview" />
                    <Tab icon={<Zap size={14} />} iconPosition="start" label="Abilities" />
                    <Tab icon={<Shield size={14} />} iconPosition="start" label="Combat" />
                    <Tab icon={<Star size={14} />} iconPosition="start" label="Spells" />
                    <Tab icon={<Package size={14} />} iconPosition="start" label="Inventory" />
                    <Tab icon={<BookOpen size={14} />} iconPosition="start" label="Features" />
                    <Tab icon={<PawPrint size={14} />} iconPosition="start" label={`Companions${companions.length > 0 ? ` (${companions.length})` : ""}`} />
                </Tabs>

                {/* ═══════ OVERVIEW TAB ═══════ */}
                {tab === 0 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField label="Character Name" fullWidth required
                                    value={form.characterName} onChange={f("characterName")} disabled={!editing} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField label="Player Name" fullWidth
                                    value={form.playerName} onChange={f("playerName")} disabled={!editing} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField label="Race / Species" fullWidth
                                    value={form.race} onChange={f("race")} disabled={!editing} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField label="Background" fullWidth
                                    value={form.background} onChange={f("background")} disabled={!editing} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <FormControl fullWidth disabled={!editing}>
                                    <InputLabel>Alignment</InputLabel>
                                    <Select label="Alignment" value={form.alignment ?? "True Neutral"}
                                        onChange={e => setForm(p => ({ ...p, alignment: e.target.value }))}>
                                        {ALIGNMENTS.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField label="Experience Points" type="number" fullWidth
                                    value={form.xp} onChange={f("xp")} disabled={!editing} />
                            </Grid>
                        </Grid>

                        {/* Classes */}
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "primary.dark", mb: 1 }}>
                                Classes
                            </Typography>
                            {classes.map((cls, i) => (
                                <Box key={i} sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center", flexWrap: "wrap" }}>
                                    {editing ? (
                                        <>
                                            <FormControl size="small" sx={{ minWidth: 130 }}>
                                                <Select value={cls.class} onChange={e => setClasses(prev => {
                                                    const next = [...prev];
                                                    next[i] = { ...next[i], class: e.target.value, hitDie: HIT_DICE[e.target.value] };
                                                    return next;
                                                })}>
                                                    {CLASSES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                                                </Select>
                                            </FormControl>
                                            <TextField label="Level" type="number" size="small" sx={{ width: 72 }}
                                                value={cls.level} onChange={e => setClasses(prev => {
                                                    const next = [...prev];
                                                    next[i] = { ...next[i], level: parseInt(e.target.value) || 1 };
                                                    return next;
                                                })} inputProps={{ min: 1, max: 20 }} />
                                            <TextField label="Subclass" size="small" sx={{ flex: 1, minWidth: 120 }}
                                                value={cls.subclass ?? ""} onChange={e => setClasses(prev => {
                                                    const next = [...prev];
                                                    next[i] = { ...next[i], subclass: e.target.value };
                                                    return next;
                                                })} />
                                            <IconButton size="small" color="error" onClick={() => setClasses(prev => prev.filter((_, j) => j !== i))}>
                                                <Trash2 size={14} />
                                            </IconButton>
                                        </>
                                    ) : (
                                        <Chip label={`${cls.class} ${cls.level}${cls.subclass ? ` — ${cls.subclass}` : ""}`} />
                                    )}
                                </Box>
                            ))}
                            {editing && (
                                <Button size="small" startIcon={<Plus size={14} />}
                                    onClick={() => setClasses(prev => [...prev, { class: "Fighter", level: 1 }])}>
                                    Add Class
                                </Button>
                            )}
                        </Box>

                        <Divider />

                        {/* Physical */}
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "primary.dark" }}>Physical Description</Typography>
                        <Grid container spacing={2}>
                            {[
                                ["Gender","gender"],["Age","age"],["Height","height"],
                                ["Weight","weight"],["Eyes","eyes"],["Skin","skin"],["Hair","hair"],
                            ].map(([label, key]) => (
                                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={key}>
                                    <TextField label={label} fullWidth size="small"
                                        value={form[key] ?? ""} onChange={f(key)} disabled={!editing} />
                                </Grid>
                            ))}
                        </Grid>

                        <Divider />

                        {/* Personality */}
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "primary.dark" }}>Personality</Typography>
                        <Grid container spacing={2}>
                            {[
                                ["Personality Traits","personality"],["Ideals","ideals"],
                                ["Bonds","bonds"],["Flaws","flaws"],
                            ].map(([label, key]) => (
                                <Grid size={{ xs: 12, sm: 6 }} key={key}>
                                    <TextField label={label} fullWidth multiline minRows={3}
                                        value={form[key] ?? ""} onChange={f(key)} disabled={!editing} />
                                </Grid>
                            ))}
                        </Grid>

                        <TextField label="Backstory" fullWidth multiline minRows={5}
                            value={form.backstory ?? ""} onChange={f("backstory")} disabled={!editing} />
                        <TextField label="Allies & Organizations" fullWidth multiline minRows={2}
                            value={form.allies ?? ""} onChange={f("allies")} disabled={!editing} />
                        <TextField label="Notes" fullWidth multiline minRows={4}
                            value={form.notes ?? ""} onChange={f("notes")} disabled={!editing} />
                    </Box>
                )}

                {/* ═══════ ABILITIES TAB ═══════ */}
                {tab === 1 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                            {ABILITIES.map(ab => {
                                const score = parseInt(form[ab] ?? "10") || 10;
                                const m = mod(score);
                                return (
                                    <Paper key={ab} elevation={1} sx={{ textAlign: "center", p: 1.5, borderRadius: 2, minWidth: 80 }}>
                                        <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 1, display: "block" }}>
                                            {ABILITY_LABELS[ab]}
                                        </Typography>
                                        <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark", lineHeight: 1.2, mt: 0.5 }}>
                                            {fmtMod(m)}
                                        </Typography>
                                        {editing ? (
                                            <TextField type="number" size="small" variant="standard"
                                                value={form[ab] ?? "10"} onChange={f(ab)}
                                                inputProps={{ min: 1, max: 30, style: { textAlign: "center", fontWeight: 600 } }}
                                                sx={{ width: 48, mt: 0.5 }} />
                                        ) : (
                                            <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary" }}>{score}</Typography>
                                        )}
                                    </Paper>
                                );
                            })}
                        </Box>
                        <Box sx={{ textAlign: "center" }}>
                            <Chip label={`Proficiency Bonus: ${fmtMod(pb)}`} color="primary" />
                        </Box>

                        <Divider />

                        {/* Saving Throws */}
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "primary.dark" }}>Saving Throws</Typography>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                            {ABILITIES.map(ab => {
                                const isProficient = saveProfs.includes(ab);
                                const value = saveMod(ab);
                                return (
                                    <Box key={ab} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        {editing ? (
                                            <Checkbox size="small" checked={isProficient}
                                                onChange={() => toggleSaveProf(ab)} sx={{ p: 0.5 }} />
                                        ) : (
                                            <Box sx={{ width: 12, height: 12, borderRadius: "50%",
                                                backgroundColor: isProficient ? "primary.main" : "transparent",
                                                border: "2px solid", borderColor: "primary.main", flexShrink: 0 }} />
                                        )}
                                        <Typography variant="body2" sx={{ minWidth: 120, textTransform: "capitalize" }}>
                                            {ab}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: isProficient ? "primary.main" : "text.primary" }}>
                                            {fmtMod(value)}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>

                        <Divider />

                        {/* Skills */}
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "primary.dark" }}>Skills</Typography>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                            {SKILLS.map(sk => {
                                const prof = skillProfs[sk.key];
                                const value = skillMod(sk.key, sk.ability);
                                return (
                                    <Box key={sk.key} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        {editing ? (
                                            <Tooltip title={!prof ? "None → Prof → Expert" : prof === "proficient" ? "→ Expert" : "→ None"}>
                                                <Box component="button" onClick={() => cycleSkillProf(sk.key)}
                                                    sx={{ width: 16, height: 16, borderRadius: prof === "expert" ? 0 : "50%",
                                                        backgroundColor: prof ? "primary.main" : "transparent",
                                                        border: "2px solid", borderColor: "primary.main",
                                                        cursor: "pointer", flexShrink: 0, p: 0 }} />
                                            </Tooltip>
                                        ) : (
                                            <Box sx={{ width: 12, height: 12,
                                                borderRadius: prof === "expert" ? 0 : "50%",
                                                backgroundColor: prof ? "primary.main" : "transparent",
                                                border: "2px solid", borderColor: "primary.main", flexShrink: 0 }} />
                                        )}
                                        <Typography variant="body2" sx={{ minWidth: 150 }}>
                                            {sk.name} <Typography component="span" variant="caption" sx={{ color: "text.secondary" }}>({ABILITY_LABELS[sk.ability]})</Typography>
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: prof ? "primary.main" : "text.primary" }}>
                                            {fmtMod(value)}
                                        </Typography>
                                        {prof === "expert" && <Chip label="E" size="small" sx={{ height: 16, fontSize: "0.6rem", ml: 0.5 }} />}
                                    </Box>
                                );
                            })}
                        </Box>

                        <Divider />
                        <TextField label="Languages" fullWidth multiline minRows={2}
                            value={form.languages ?? ""} onChange={f("languages")} disabled={!editing} />
                        <TextField label="Other Proficiencies (armor, weapons, tools)" fullWidth multiline minRows={2}
                            value={form.proficiencies ?? ""} onChange={f("proficiencies")} disabled={!editing} />
                    </Box>
                )}

                {/* ═══════ COMBAT TAB ═══════ */}
                {tab === 2 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {/* Rest buttons */}
                        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                            <Button variant="outlined" startIcon={<Moon size={16} />}
                                onClick={() => setShortRestOpen(true)}
                                sx={{ borderColor: "#1d4ed8", color: "#1d4ed8" }}>
                                Short Rest
                            </Button>
                            <Button variant="outlined" startIcon={<Moon size={16} />}
                                onClick={doLongRest}
                                sx={{ borderColor: "#7c3aed", color: "#7c3aed" }}>
                                Long Rest
                            </Button>
                            <Typography variant="caption" sx={{ color: "text.secondary", alignSelf: "center", ml: 0.5 }}>
                                Short rest: recover HP. Long rest: full HP, all spell slots, remove 1 exhaustion.
                            </Typography>
                        </Box>
                        {/* HP + combat stats */}
                        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                            {[
                                { label: "Current HP", key: "currentHp", color: "#15803d" },
                                { label: "Max HP",     key: "maxHp",     color: "#374151" },
                                { label: "Temp HP",    key: "tempHp",    color: "#1d4ed8" },
                            ].map(({ label, key, color }) => (
                                <Paper key={key} elevation={1} sx={{ p: 2, textAlign: "center", minWidth: 110, borderRadius: 2, flex: 1 }}>
                                    <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 1, display: "block" }}>
                                        {label}
                                    </Typography>
                                    {editing ? (
                                        <TextField type="number" size="small" variant="standard" fullWidth
                                            value={form[key] ?? ""} onChange={f(key)}
                                            inputProps={{ style: { textAlign: "center", fontSize: "2rem", fontWeight: 700, color } }} />
                                    ) : (
                                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                                            {key === "currentHp" && (
                                                <IconButton size="small" onClick={() => setForm(p => ({ ...p, currentHp: String((parseInt(p.currentHp) || 0) - 1) }))}>
                                                    <Minus size={14} />
                                                </IconButton>
                                            )}
                                            <Typography variant="h3" sx={{ fontWeight: 700, color }}>{form[key] || "—"}</Typography>
                                            {key === "currentHp" && (
                                                <IconButton size="small" onClick={() => setForm(p => ({ ...p, currentHp: String((parseInt(p.currentHp) || 0) + 1) }))}>
                                                    <Plus size={14} />
                                                </IconButton>
                                            )}
                                        </Box>
                                    )}
                                </Paper>
                            ))}
                        </Box>

                        <Grid container spacing={2}>
                            {[
                                { label: "Armor Class", key: "armorClass" },
                                { label: "Initiative",  key: "initiative" },
                                { label: "Speed (ft)",  key: "speed" },
                                { label: "Exhaustion",  key: "exhaustion" },
                            ].map(({ label, key }) => (
                                <Grid size={{ xs: 6, sm: 3 }} key={key}>
                                    <Paper elevation={1} sx={{ p: 2, textAlign: "center", borderRadius: 2 }}>
                                        <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 1, display: "block" }}>
                                            {label}
                                        </Typography>
                                        {editing ? (
                                            <TextField type="number" size="small" variant="standard" fullWidth
                                                value={form[key] ?? ""} onChange={f(key)}
                                                inputProps={{ style: { textAlign: "center", fontSize: "1.5rem", fontWeight: 700 } }} />
                                        ) : (
                                            <Typography variant="h4" sx={{ fontWeight: 700, color: "primary.dark" }}>
                                                {key === "initiative" ? fmtMod(num("initiative")) : (form[key] || "—")}
                                            </Typography>
                                        )}
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>

                        <Box sx={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                            <Box>
                                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
                                    Inspiration
                                </Typography>
                                <Switch checked={form.inspiration === "true"}
                                    onChange={e => setForm(p => ({ ...p, inspiration: String(e.target.checked) }))}
                                    disabled={!editing} />
                            </Box>
                            <TextField label="Hit Dice" sx={{ maxWidth: 150 }}
                                placeholder="e.g. 5d10" value={form.hitDice ?? ""} onChange={f("hitDice")} disabled={!editing} />
                        </Box>

                        {/* Death Saves */}
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "primary.dark", mb: 1 }}>Death Saving Throws</Typography>
                            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                                {(["Successes", "Failures"] as const).map(type => {
                                    const isSuccess = type === "Successes";
                                    const count = isSuccess ? dss : dsf;
                                    const setCount = isSuccess ? setDss : setDsf;
                                    return (
                                        <Box key={type}>
                                            <Typography variant="caption" sx={{ color: isSuccess ? "success.main" : "error.main", display: "block" }}>{type}</Typography>
                                            <Box sx={{ display: "flex", gap: 0.5 }}>
                                                {[1,2,3].map(n => (
                                                    <Box key={n} component="button" onClick={() => editing && setCount(count === n ? n - 1 : n)}
                                                        sx={{ width: 24, height: 24, borderRadius: "50%",
                                                            backgroundColor: n <= count ? (isSuccess ? "success.main" : "error.main") : "transparent",
                                                            border: "2px solid", borderColor: isSuccess ? "success.main" : "error.main",
                                                            cursor: editing ? "pointer" : "default", p: 0 }} />
                                                ))}
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>

                        <Divider />

                        {/* Attacks */}
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "primary.dark", mb: 1 }}>Attacks</Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Bonus</TableCell>
                                        <TableCell>Damage</TableCell>
                                        <TableCell>Type</TableCell>
                                        {editing && <TableCell />}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {attacks.map((atk, i) => (
                                        <TableRow key={i}>
                                            <TableCell>{editing
                                                ? <TextField size="small" variant="standard" value={atk.name} onChange={e => setAttacks(prev => { const n=[...prev]; n[i]={...n[i],name:e.target.value}; return n; })} />
                                                : atk.name}</TableCell>
                                            <TableCell>{editing
                                                ? <TextField size="small" variant="standard" sx={{width:60}} value={atk.bonus} onChange={e => setAttacks(prev => { const n=[...prev]; n[i]={...n[i],bonus:e.target.value}; return n; })} />
                                                : atk.bonus}</TableCell>
                                            <TableCell>{editing
                                                ? <TextField size="small" variant="standard" sx={{width:80}} value={atk.damage} onChange={e => setAttacks(prev => { const n=[...prev]; n[i]={...n[i],damage:e.target.value}; return n; })} />
                                                : atk.damage}</TableCell>
                                            <TableCell>{editing
                                                ? <TextField size="small" variant="standard" value={atk.damageType} onChange={e => setAttacks(prev => { const n=[...prev]; n[i]={...n[i],damageType:e.target.value}; return n; })} />
                                                : atk.damageType}</TableCell>
                                            {editing && <TableCell><IconButton size="small" color="error" onClick={() => setAttacks(prev => prev.filter((_,j)=>j!==i))}><Trash2 size={12}/></IconButton></TableCell>}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {editing && (
                                <Button size="small" startIcon={<Plus size={14}/>} sx={{mt:1}}
                                    onClick={() => setAttacks(prev => [...prev, {name:"",bonus:"+0",damage:"1d6",damageType:""}])}>
                                    Add Attack
                                </Button>
                            )}
                        </Box>
                    </Box>
                )}

                {/* ═══════ SPELLS TAB ═══════ */}
                {tab === 3 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <Grid container spacing={2} alignItems="center">
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <FormControl fullWidth disabled={!editing} size="small">
                                    <InputLabel>Spellcasting Ability</InputLabel>
                                    <Select label="Spellcasting Ability" value={form.spellcastingAbility ?? ""}
                                        onChange={e => setForm(p => ({ ...p, spellcastingAbility: e.target.value }))}>
                                        {ABILITIES.map(ab => <MenuItem key={ab} value={ab}>{ABILITY_LABELS[ab]}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Paper elevation={0} sx={{ p: 1.5, textAlign: "center", border: 1, borderColor: "divider", borderRadius: 2 }}>
                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Spell Save DC</Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{spellSaveDC}</Typography>
                                </Paper>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Paper elevation={0} sx={{ p: 1.5, textAlign: "center", border: 1, borderColor: "divider", borderRadius: 2 }}>
                                    <Typography variant="caption" sx={{ color: "text.secondary" }}>Spell Attack</Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{fmtMod(spellAtk)}</Typography>
                                </Paper>
                            </Grid>
                        </Grid>

                        {/* Spell Slots */}
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "primary.dark", mb: 1 }}>Spell Slots</Typography>
                            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                                {[1,2,3,4,5,6,7,8,9].map(lvl => {
                                    const key = String(lvl);
                                    const slot = spellSlots[key] ?? { max: 0, used: 0 };
                                    return (
                                        <Paper key={lvl} elevation={1} sx={{ p: 1, textAlign: "center", minWidth: 64, borderRadius: 2 }}>
                                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>L{lvl}</Typography>
                                            {editing ? (
                                                <TextField type="number" size="small" variant="standard" sx={{ width: 40 }}
                                                    label="max" value={slot.max} onChange={e => setSpellSlots(prev => ({
                                                        ...prev, [key]: { ...prev[key] ?? {used:0}, max: parseInt(e.target.value)||0 }
                                                    }))} inputProps={{ min:0, style:{textAlign:"center"} }} />
                                            ) : (
                                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                                                    <IconButton size="small" disabled={slot.used >= slot.max}
                                                        onClick={() => setSpellSlots(p => ({...p,[key]:{...p[key],used:(p[key]?.used??0)+1}}))}>
                                                        <Minus size={10}/>
                                                    </IconButton>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                        {slot.max - slot.used}/{slot.max}
                                                    </Typography>
                                                    <IconButton size="small" disabled={(slot.used ?? 0) <= 0}
                                                        onClick={() => setSpellSlots(p => ({...p,[key]:{...p[key],used:Math.max(0,(p[key]?.used??0)-1)}}))} >
                                                        <Plus size={10}/>
                                                    </IconButton>
                                                </Box>
                                            )}
                                        </Paper>
                                    );
                                })}
                            </Box>
                        </Box>

                        <Divider />

                        {/* Spell list by level */}
                        {[0,1,2,3,4,5,6,7,8,9].map(lvl => {
                            const lvlSpells = spells.filter(s => s.level === lvl);
                            if (!editing && lvlSpells.length === 0) return null;
                            return (
                                <Box key={lvl}>
                                    <Typography variant="subtitle2" sx={{ color: "primary.dark", mb: 1 }}>
                                        {lvl === 0 ? "Cantrips" : `Level ${lvl}`}
                                    </Typography>
                                    {lvlSpells.map((sp, i) => {
                                        const globalIdx = spells.findIndex(s => s === sp);
                                        return (
                                            <Paper key={i} elevation={0} sx={{ p: 1.5, mb: 1, border: 1, borderColor: "divider", borderRadius: 2 }}>
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                    {lvl > 0 && (
                                                        <Checkbox size="small" checked={sp.prepared ?? false}
                                                            onChange={e => setSpells(prev => { const n=[...prev]; n[globalIdx]={...n[globalIdx],prepared:e.target.checked}; return n; })}
                                                            disabled={!editing} sx={{ p: 0.5 }} />
                                                    )}
                                                    {editing ? (
                                                        <TextField size="small" variant="standard" value={sp.name} sx={{ flex:1 }}
                                                            onChange={e => setSpells(prev => { const n=[...prev]; n[globalIdx]={...n[globalIdx],name:e.target.value}; return n; })} />
                                                    ) : (
                                                        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>{sp.name}</Typography>
                                                    )}
                                                    {sp.school && <Chip label={sp.school} size="small" sx={{ fontSize: "0.65rem" }} />}
                                                    {editing && (
                                                        <IconButton size="small" color="error" onClick={() => setSpells(prev => prev.filter((_,j)=>j!==globalIdx))}>
                                                            <Trash2 size={12}/>
                                                        </IconButton>
                                                    )}
                                                </Box>
                                                {(sp.castingTime || sp.range || sp.components || sp.duration) && (
                                                    <Typography variant="caption" sx={{ color: "text.secondary", mt: 0.5, display: "block" }}>
                                                        {[sp.castingTime && `Cast: ${sp.castingTime}`, sp.range && `Range: ${sp.range}`, sp.components && `Components: ${sp.components}`, sp.duration && `Duration: ${sp.duration}`].filter(Boolean).join(" · ")}
                                                    </Typography>
                                                )}
                                            </Paper>
                                        );
                                    })}
                                    {editing && (
                                        <Button size="small" startIcon={<Plus size={12}/>}
                                            onClick={() => setSpells(prev => [...prev, {name:"New Spell",level:lvl,prepared:false}])}>
                                            Add {lvl === 0 ? "Cantrip" : "Spell"}
                                        </Button>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                )}

                {/* ═══════ INVENTORY TAB ═══════ */}
                {tab === 4 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {/* Currency */}
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "primary.dark", mb: 1 }}>Currency</Typography>
                            <Grid container spacing={2}>
                                {[["CP","copper"],["SP","silver"],["EP","electrum"],["GP","gold"],["PP","platinum"]].map(([label,key]) => (
                                    <Grid size={{ xs: 4, sm: 2 }} key={key}>
                                        <TextField label={label} type="number" fullWidth size="small"
                                            value={form[key] ?? "0"} onChange={f(key)} disabled={!editing}
                                            inputProps={{ min: 0 }} />
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>

                        <Divider />

                        {/* Item list */}
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "primary.dark", mb: 1 }}>
                                Equipment ({inventory.length} items
                                {inventory.length > 0 && ` · ${inventory.reduce((s,i)=>(s+(i.weight??0)*(i.quantity??1)),0).toFixed(1)} lb`})
                            </Typography>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Type</TableCell>
                                        <TableCell align="center">Qty</TableCell>
                                        <TableCell align="center">Equip</TableCell>
                                        <TableCell align="center">Attune</TableCell>
                                        {editing && <TableCell />}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {inventory.map((item, i) => (
                                        <TableRow key={i}>
                                            <TableCell>{editing
                                                ? <TextField size="small" variant="standard" value={item.name} onChange={e => setInventory(prev => { const n=[...prev]; n[i]={...n[i],name:e.target.value}; return n; })} />
                                                : item.name}</TableCell>
                                            <TableCell>{editing
                                                ? <TextField size="small" variant="standard" sx={{width:100}} value={item.type} onChange={e => setInventory(prev => { const n=[...prev]; n[i]={...n[i],type:e.target.value}; return n; })} />
                                                : item.type}</TableCell>
                                            <TableCell align="center">{editing
                                                ? <TextField type="number" size="small" variant="standard" sx={{width:50}} value={item.quantity} onChange={e => setInventory(prev => { const n=[...prev]; n[i]={...n[i],quantity:parseInt(e.target.value)||1}; return n; })} />
                                                : item.quantity}</TableCell>
                                            <TableCell align="center">
                                                <Checkbox size="small" checked={item.equipped ?? false}
                                                    onChange={e => setInventory(prev => { const n=[...prev]; n[i]={...n[i],equipped:e.target.checked}; return n; })}
                                                    disabled={!editing} sx={{p:0.5}} />
                                            </TableCell>
                                            <TableCell align="center">
                                                <Checkbox size="small" checked={item.attuned ?? false}
                                                    onChange={e => setInventory(prev => { const n=[...prev]; n[i]={...n[i],attuned:e.target.checked}; return n; })}
                                                    disabled={!editing} sx={{p:0.5}} />
                                            </TableCell>
                                            {editing && <TableCell><IconButton size="small" color="error" onClick={() => setInventory(prev => prev.filter((_,j)=>j!==i))}><Trash2 size={12}/></IconButton></TableCell>}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {editing && (
                                <Button size="small" startIcon={<Plus size={14}/>} sx={{mt:1}}
                                    onClick={() => setInventory(prev => [...prev, {name:"",type:"Gear",quantity:1}])}>
                                    Add Item
                                </Button>
                            )}
                        </Box>
                    </Box>
                )}

                {/* ═══════ FEATURES TAB ═══════ */}
                {tab === 5 && (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {features.map((feat, i) => (
                            <Paper key={i} elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                                    {editing ? (
                                        <>
                                            <TextField size="small" label="Name" value={feat.name} sx={{flex:1}}
                                                onChange={e => setFeatures(prev => { const n=[...prev]; n[i]={...n[i],name:e.target.value}; return n; })} />
                                            <TextField size="small" label="Source" value={feat.source ?? ""} sx={{width:160}}
                                                onChange={e => setFeatures(prev => { const n=[...prev]; n[i]={...n[i],source:e.target.value}; return n; })} />
                                            <TextField type="number" size="small" label="Uses" sx={{width:70}} value={feat.uses ?? ""}
                                                onChange={e => setFeatures(prev => { const n=[...prev]; n[i]={...n[i],uses:parseInt(e.target.value)||undefined}; return n; })} />
                                            <TextField type="number" size="small" label="Max" sx={{width:70}} value={feat.maxUses ?? ""}
                                                onChange={e => setFeatures(prev => { const n=[...prev]; n[i]={...n[i],maxUses:parseInt(e.target.value)||undefined}; return n; })} />
                                            <IconButton size="small" color="error" onClick={() => setFeatures(prev => prev.filter((_,j)=>j!==i))}><Trash2 size={14}/></IconButton>
                                        </>
                                    ) : (
                                        <>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>{feat.name}</Typography>
                                            {feat.source && <Chip label={feat.source} size="small" variant="outlined" sx={{fontSize:"0.65rem"}} />}
                                            {feat.maxUses != null && (
                                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                    <IconButton size="small" onClick={() => setFeatures(prev => { const n=[...prev]; n[i]={...n[i],uses:Math.max(0,(n[i].uses??0)-1)}; return n; })}><Minus size={12}/></IconButton>
                                                    <Typography variant="body2">{feat.uses ?? 0}/{feat.maxUses}</Typography>
                                                    <IconButton size="small" onClick={() => setFeatures(prev => { const n=[...prev]; n[i]={...n[i],uses:Math.min(n[i].maxUses!,(n[i].uses??0)+1)}; return n; })}><Plus size={12}/></IconButton>
                                                </Box>
                                            )}
                                        </>
                                    )}
                                </Box>
                                {editing ? (
                                    <TextField multiline minRows={2} fullWidth size="small" label="Description" value={feat.description}
                                        onChange={e => setFeatures(prev => { const n=[...prev]; n[i]={...n[i],description:e.target.value}; return n; })} />
                                ) : (
                                    <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "pre-wrap" }}>{feat.description}</Typography>
                                )}
                            </Paper>
                        ))}
                        {editing && (
                            <Button startIcon={<Plus size={14}/>}
                                onClick={() => setFeatures(prev => [...prev, {name:"New Feature",description:""}])}>
                                Add Feature
                            </Button>
                        )}
                        {!editing && features.length === 0 && (
                            <Typography sx={{ color: "text.secondary", py: 4, textAlign: "center" }}>
                                No features added. Click the pencil icon to edit.
                            </Typography>
                        )}
                    </Box>
                )}

                {/* ═══════ COMPANIONS TAB ═══════ */}
                {tab === 6 && (
                    <Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                            <Typography variant="h6" sx={{ color: "primary.dark", fontWeight: 700 }}>Companions & Pets</Typography>
                            <Button variant="contained" startIcon={<Plus size={16} />} onClick={openCreateComp}
                                sx={{ backgroundColor: "primary.main" }}>
                                Add Companion
                            </Button>
                        </Box>

                        {companions.length === 0 ? (
                            <Box sx={{ textAlign: "center", py: 8 }}>
                                <PawPrint size={40} color="#c9a87c" style={{ marginBottom: 12 }} />
                                <Typography sx={{ color: "text.secondary" }}>
                                    No companions yet. Add a familiar, animal companion, mount, or summoned creature.
                                </Typography>
                            </Box>
                        ) : (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                {companions.map(c => {
                                    const hpPct = c.maxHp ? Math.max(0, Math.min(100, ((c.currentHp ?? 0) / c.maxHp) * 100)) : 0;
                                    const hpColor = hpPct > 50 ? "success" : hpPct > 25 ? "warning" : "error";
                                    return (
                                        <Paper key={c.id} elevation={1} sx={{ p: 2, borderLeft: "3px solid", borderColor: "primary.light" }}>
                                            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1 }}>
                                                <Box>
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                        <PawPrint size={16} color="#8C5A3A" />
                                                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "primary.dark" }}>
                                                            {c.name}
                                                        </Typography>
                                                        {c.companionType && (
                                                            <Chip label={c.companionType} size="small" sx={{ height: 18, fontSize: "0.6rem", textTransform: "capitalize" }} />
                                                        )}
                                                    </Box>
                                                    {c.species && (
                                                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{c.species}</Typography>
                                                    )}
                                                </Box>
                                                <Box sx={{ display: "flex", gap: 0.5 }}>
                                                    <Tooltip title="Edit"><IconButton size="small" onClick={() => openEditComp(c)}><Pencil size={14} /></IconButton></Tooltip>
                                                    <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteComp(c)}><Trash2 size={14} /></IconButton></Tooltip>
                                                </Box>
                                            </Box>

                                            {/* HP bar */}
                                            {c.maxHp != null && c.maxHp > 0 && (
                                                <Box sx={{ mb: 1.5 }}>
                                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                                                        <Heart size={12} color="#b71c1c" />
                                                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                                            HP: {c.currentHp ?? 0} / {c.maxHp}
                                                            {(c.tempHp ?? 0) > 0 && <span style={{ color: "#1565c0" }}> (+{c.tempHp} temp)</span>}
                                                        </Typography>
                                                        <Box sx={{ flex: 1 }} />
                                                        <IconButton size="small" sx={{ p: 0.25 }} onClick={() => adjustCompHp(c, -1)}><Minus size={12} /></IconButton>
                                                        <IconButton size="small" sx={{ p: 0.25 }} onClick={() => adjustCompHp(c, 1)}><Plus size={12} /></IconButton>
                                                    </Box>
                                                    <LinearProgress variant="determinate" value={hpPct} color={hpColor}
                                                        sx={{ height: 6, borderRadius: 1 }} />
                                                </Box>
                                            )}

                                            {/* Stats row */}
                                            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                                                {c.armorClass != null && (
                                                    <Box sx={{ textAlign: "center" }}>
                                                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>AC</Typography>
                                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.armorClass}</Typography>
                                                    </Box>
                                                )}
                                                {c.speed != null && (
                                                    <Box sx={{ textAlign: "center" }}>
                                                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>Speed</Typography>
                                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{c.speed} ft.</Typography>
                                                    </Box>
                                                )}
                                                {(["strength","dexterity","constitution","intelligence","wisdom","charisma"] as const).map(ab => {
                                                    const score = c[ab];
                                                    if (score == null) return null;
                                                    const m = Math.floor((score - 10) / 2);
                                                    return (
                                                        <Box key={ab} sx={{ textAlign: "center", minWidth: 36 }}>
                                                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.6rem", textTransform: "uppercase" }}>
                                                                {ab.slice(0, 3)}
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{score}</Typography>
                                                            <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.65rem" }}>
                                                                {m >= 0 ? `+${m}` : m}
                                                            </Typography>
                                                        </Box>
                                                    );
                                                })}
                                            </Box>

                                            {c.notes && (
                                                <Typography variant="body2" sx={{ color: "text.secondary", mt: 1, fontSize: "0.8rem" }}>
                                                    {c.notes}
                                                </Typography>
                                            )}
                                        </Paper>
                                    );
                                })}
                            </Box>
                        )}
                    </Box>
                )}

                {/* ── Dialogs ─────────────────────────────────────────────────────── */}

                <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
                    <DialogTitle>Delete "{pc.characterName}"?</DialogTitle>
                    <DialogContent><Typography>This cannot be undone.</Typography></DialogContent>
                    <DialogActions>
                        <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={deleteCharacter}>Delete</Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="md" fullWidth>
                    <DialogTitle>Import from D&D Beyond</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
                            On your D&D Beyond character page, open DevTools (F12) → Network tab → reload the page → find the
                            request to <strong>character/v5/character/&lt;id&gt;</strong> → copy the Response body and paste it below.
                        </Typography>
                        <TextField
                            label="D&D Beyond character JSON"
                            fullWidth multiline minRows={10}
                            value={importText}
                            onChange={e => setImportText(e.target.value)}
                            error={!!importError}
                            helperText={importError}
                            placeholder='{"data": {"name": "Your Character", ...}}'
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => { setImportOpen(false); setImportText(""); setImportError(""); }}>Cancel</Button>
                        <Button variant="contained" onClick={applyImport} disabled={!importText.trim()}>Import</Button>
                    </DialogActions>
                </Dialog>
                {/* Companion create/edit dialog */}
                <Dialog open={compOpen} onClose={() => setCompOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>{editComp ? "Edit Companion" : "Add Companion"}</DialogTitle>
                    <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
                        <Box sx={{ display: "flex", gap: 2 }}>
                            <TextField label="Name *" value={compForm.name} fullWidth
                                onChange={e => setCompForm(p => ({ ...p, name: e.target.value }))} />
                            <TextField label="Species" value={compForm.species} sx={{ flex: 1 }}
                                onChange={e => setCompForm(p => ({ ...p, species: e.target.value }))}
                                placeholder="e.g. Wolf, Hawk, Imp" />
                        </Box>
                        <FormControl size="small" fullWidth>
                            <InputLabel>Type</InputLabel>
                            <Select label="Type" value={compForm.companionType}
                                onChange={e => setCompForm(p => ({ ...p, companionType: e.target.value }))}>
                                {COMP_TYPES.map(t => <MenuItem key={t} value={t} sx={{ textTransform: "capitalize" }}>{t}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <Divider />
                        <Grid container spacing={1.5}>
                            <Grid size={4}><TextField size="small" label="Max HP" type="number" fullWidth value={compForm.maxHp}
                                onChange={e => setCompForm(p => ({ ...p, maxHp: e.target.value }))} /></Grid>
                            <Grid size={4}><TextField size="small" label="Current HP" type="number" fullWidth value={compForm.currentHp}
                                onChange={e => setCompForm(p => ({ ...p, currentHp: e.target.value }))} /></Grid>
                            <Grid size={4}><TextField size="small" label="Temp HP" type="number" fullWidth value={compForm.tempHp}
                                onChange={e => setCompForm(p => ({ ...p, tempHp: e.target.value }))} /></Grid>
                            <Grid size={6}><TextField size="small" label="AC" type="number" fullWidth value={compForm.armorClass}
                                onChange={e => setCompForm(p => ({ ...p, armorClass: e.target.value }))} /></Grid>
                            <Grid size={6}><TextField size="small" label="Speed (ft.)" type="number" fullWidth value={compForm.speed}
                                onChange={e => setCompForm(p => ({ ...p, speed: e.target.value }))} /></Grid>
                        </Grid>
                        <Divider />
                        <Grid container spacing={1}>
                            {(["strength","dexterity","constitution","intelligence","wisdom","charisma"] as const).map(ab => (
                                <Grid key={ab} size={4}>
                                    <TextField size="small" label={ab.slice(0,3).toUpperCase()} type="number" fullWidth
                                        value={compForm[ab]}
                                        onChange={e => setCompForm(p => ({ ...p, [ab]: e.target.value }))} />
                                </Grid>
                            ))}
                        </Grid>
                        <TextField label="Notes" multiline minRows={2} fullWidth value={compForm.notes}
                            onChange={e => setCompForm(p => ({ ...p, notes: e.target.value }))} />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setCompOpen(false)}>Cancel</Button>
                        <Button variant="contained" onClick={saveComp} disabled={compSaving || !compForm.name.trim()}
                            sx={{ backgroundColor: "primary.main" }}>
                            {compSaving ? <CircularProgress size={16} /> : editComp ? "Save" : "Add"}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Companion delete confirmation */}
                <Dialog open={!!deleteComp} onClose={() => setDeleteComp(null)}>
                    <DialogTitle>Delete "{deleteComp?.name}"?</DialogTitle>
                    <DialogContent><Typography>This cannot be undone.</Typography></DialogContent>
                    <DialogActions>
                        <Button onClick={() => setDeleteComp(null)}>Cancel</Button>
                        <Button color="error" variant="contained" onClick={confirmDeleteComp}>Delete</Button>
                    </DialogActions>
                </Dialog>

                {/* Short rest dialog */}
                <Dialog open={shortRestOpen} onClose={() => setShortRestOpen(false)}>
                    <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Moon size={18} color="#1d4ed8" /> Short Rest
                    </DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
                            Spend hit dice to recover HP. Current HP: {num("currentHp")} / {num("maxHp")}.
                        </Typography>
                        <TextField
                            label="HP to recover" type="number" fullWidth autoFocus
                            value={shortRestHp}
                            onChange={e => setShortRestHp(e.target.value.replace(/\D/g, ""))}
                            onKeyDown={e => {
                                if (e.key === "Enter") {
                                    const n = parseInt(shortRestHp, 10) || 0;
                                    doShortRest(n);
                                    setShortRestOpen(false);
                                    setShortRestHp("");
                                }
                            }}
                            helperText={`Max gain: ${Math.max(0, num("maxHp") - num("currentHp"))} HP`}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShortRestOpen(false)}>Cancel</Button>
                        <Button variant="contained" sx={{ backgroundColor: "#1d4ed8" }}
                            onClick={() => {
                                const n = parseInt(shortRestHp, 10) || 0;
                                doShortRest(n);
                                setShortRestOpen(false);
                                setShortRestHp("");
                            }}>
                            Rest
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
