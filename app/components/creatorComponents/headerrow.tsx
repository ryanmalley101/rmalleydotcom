"use client"

import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControl,
    IconButton,
    InputAdornment,
    InputLabel,
    ListSubheader,
    MenuItem,
    Select,
    Snackbar,
    TextField,
    Toolbar,
    Typography,
} from "@mui/material";
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import type { SelectChangeEvent } from '@mui/material/Select';
import { useTheme } from '@mui/material/styles';
import { generateClient } from 'aws-amplify/data';
import React, { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AiOutlineSearch } from "react-icons/ai";
import { MdOutlineMenu } from "react-icons/md";
import { type Schema } from '@/amplify/data/resource';
import { cleanMonster } from "@/app/components/creatorComponents/monsterSheet";
import { calculateDependentStats } from "@/5eReference/converters";
import { createDefaultKnightStatblock } from "@/5eReference/monsterStatblockGenerator";

const client = generateClient<Schema>();
type MyMonsterStatblock = Schema['MonsterStatblock']['type'];

interface MonsterListItem {
    id: string;
    publisher: string;
    name: string;
}

interface HeaderRowProps {
    monster: MyMonsterStatblock;
    setMonster: React.Dispatch<React.SetStateAction<MyMonsterStatblock>>;
    downloadFile: () => void;
}

const HeaderRow: React.FC<HeaderRowProps> = ({ monster, setMonster, downloadFile }) => {
    const theme = useTheme();

    // Monster list
    const [monsterList, setMonsterList] = useState<MonsterListItem[]>([]);
    const [selectedOption, setSelectedOption] = useState<string>('');
    const [searchText, setSearchText] = useState<string>('');

    // New monster dialog
    const [newMonsterDialogOpen, setNewMonsterDialogOpen] = useState(false);
    const [newMonsterName, setNewMonsterName] = useState('');

    // Load monster confirmation dialog
    const [loadConfirmOpen, setLoadConfirmOpen] = useState(false);
    const [pendingLoadId, setPendingLoadId] = useState<string | null>(null);
    const [pendingLoadName, setPendingLoadName] = useState<string | null>(null);

    // Save feedback
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
    const [saveError, setSaveError] = useState<string>('');
    const [isDirty, setIsDirty] = useState(false);

    const isFirstRender = useRef(true);
    // Prevents the auto-save from firing when a monster is freshly loaded or created
    const skipNextSaveRef = useRef(false);

    const containsText = (text: string, query: string): boolean =>
        text.toLowerCase().includes(query.toLowerCase()) || query === '';

    const displayedOptions = useMemo(
        () => monsterList.filter(opt => containsText(opt.name, searchText)),
        [searchText, monsterList]
    );

    // observeQuery keeps the list live without a hard limit
    useEffect(() => {
        const sub = (client.models.MonsterStatblock as any).observeQuery({
            selectionSet: ['id', 'publisher', 'name'],
        }).subscribe({
            next: ({ items }: { items: MonsterListItem[] }) =>
                setMonsterList([...items].sort((a, b) => a.name.localeCompare(b.name))),
            error: (err: unknown) => console.error('Monster list subscription error:', err),
        });
        return () => sub.unsubscribe();
    }, []);

    // Debounced auto-save: 3 seconds after the last change
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (skipNextSaveRef.current) {
            skipNextSaveRef.current = false;
            setIsDirty(false);
            return;
        }
        setIsDirty(true);
        const timer = setTimeout(() => saveMonster(monster), 3000);
        return () => clearTimeout(timer);
    }, [monster]);

    const saveMonster = async (monsterToSave: MyMonsterStatblock) => {
        const { __typename, ...input } = monsterToSave as any;

        if (input.publisher === 'wotc-srd') {
            setSaveError("Can't overwrite official SRD monsters.");
            setSaveStatus('error');
            return;
        }

        if (!input.id) {
            setSaveError("Monster has no ID — create it first with the New button.");
            setSaveStatus('error');
            return;
        }

        try {
            await client.models.MonsterStatblock.update(input);
            setIsDirty(false);
            setSaveStatus('saved');
        } catch (e: any) {
            setSaveError(e?.message ?? 'Save failed. Check your connection and try again.');
            setSaveStatus('error');
        }
    };

    const handleCreateNewMonster = async () => {
        const name = newMonsterName.trim();
        if (!name) return;

        if (monsterList.some(m => m.name === name)) {
            setSaveError('A monster with that name already exists.');
            setSaveStatus('error');
            setNewMonsterDialogOpen(false);
            setNewMonsterName('');
            return;
        }

        try {
            const input = createDefaultKnightStatblock(name, 'homebrew');
            const { data: response, errors } = await client.models.MonsterStatblock.create({ ...input });
            if (errors?.length) throw new Error(errors[0].message);
            skipNextSaveRef.current = true;
            setMonster(cleanMonster(response));
            setSelectedOption(name);
        } catch (e: any) {
            setSaveError(e?.message ?? 'Failed to create monster.');
            setSaveStatus('error');
        } finally {
            setNewMonsterDialogOpen(false);
            setNewMonsterName('');
        }
    };

    const handleSelectionChange = (e: SelectChangeEvent<string>) => {
        const name = e.target.value;
        setSelectedOption(name);
        const selected = displayedOptions.find(opt => opt.name === name);
        if (selected) {
            setPendingLoadId(selected.id);
            setPendingLoadName(selected.name);
            setLoadConfirmOpen(true);
        }
    };

    const confirmLoadMonster = async () => {
        setLoadConfirmOpen(false);
        if (!pendingLoadId) return;
        try {
            const { data: existing, errors } = await client.models.MonsterStatblock.get({ id: pendingLoadId });
            if (errors?.length) throw new Error(errors[0].message);
            skipNextSaveRef.current = true;
            setMonster(cleanMonster({ ...existing, ...calculateDependentStats(existing as MyMonsterStatblock) }));
        } catch (e: any) {
            setSaveError(e?.message ?? 'Failed to load monster.');
            setSaveStatus('error');
        } finally {
            setPendingLoadId(null);
            setPendingLoadName(null);
        }
    };

    const exportJSON = (name: string | undefined) => {
        const fileName = name ?? 'monster';
        const json = JSON.stringify(monster, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = fileName + '.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
    };

    return (
        <>
            <Box sx={{ flexGrow: 1 }}>
                <AppBar>
                    <Toolbar>
                        <IconButton size="large" edge="start" color="inherit" aria-label="menu" sx={{ mr: 2 }}>
                            <MdOutlineMenu />
                        </IconButton>
                        <Button variant="contained" sx={{ mr: 1 }} onClick={() => setNewMonsterDialogOpen(true)} color="secondary">New</Button>
                        <Button variant="contained" sx={{ mr: 1 }} onClick={() => saveMonster(monster)} color="secondary">Save</Button>
                        <Button variant="contained" sx={{ mr: 1 }} onClick={() => exportJSON(monster.name)} color="secondary">Export JSON</Button>
                        <Button variant="contained" sx={{ mr: 1 }} onClick={downloadFile} color="secondary">Download PNG</Button>
                        {isDirty && (
                            <Typography variant="caption" sx={{ mr: 2, color: 'warning.light', fontStyle: 'italic' }}>
                                Unsaved changes
                            </Typography>
                        )}
                        <FormControl sx={{ ml: 'auto', minWidth: '200px' }}>
                            <InputLabel id="search-select-label" style={{ color: 'black' }}>Monster Name</InputLabel>
                            <Select
                                MenuProps={{ autoFocus: false }}
                                labelId="search-select-label"
                                id="search-select"
                                value={selectedOption}
                                label="Monsters"
                                onChange={handleSelectionChange}
                                onClose={() => setSearchText('')}
                                renderValue={() => selectedOption}
                                style={{ backgroundColor: theme.palette.secondary.main, color: '#000000' }}
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
                                            if (e.key !== 'Escape') e.stopPropagation();
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
            </Box>

            {/* New Monster Dialog */}
            <Dialog open={newMonsterDialogOpen} onClose={() => { setNewMonsterDialogOpen(false); setNewMonsterName(''); }}>
                <DialogTitle>New Monster</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Creating a new monster will reset the current statblock.
                    </DialogContentText>
                    <TextField
                        autoFocus
                        label="Monster Name"
                        fullWidth
                        value={newMonsterName}
                        onChange={(e) => setNewMonsterName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNewMonster(); }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setNewMonsterDialogOpen(false); setNewMonsterName(''); }}>Cancel</Button>
                    <Button onClick={handleCreateNewMonster} variant="contained" disabled={!newMonsterName.trim()}>Create</Button>
                </DialogActions>
            </Dialog>

            {/* Load Monster Confirmation Dialog */}
            <Dialog open={loadConfirmOpen} onClose={() => setLoadConfirmOpen(false)}>
                <DialogTitle>Load Monster</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Load <strong>{pendingLoadName}</strong>? Any unsaved changes to the current monster will be lost.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLoadConfirmOpen(false)}>Cancel</Button>
                    <Button onClick={confirmLoadMonster} variant="contained" color="warning">Load</Button>
                </DialogActions>
            </Dialog>

            {/* Save success */}
            <Snackbar open={saveStatus === 'saved'} autoHideDuration={2000} onClose={() => setSaveStatus('idle')}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="success" onClose={() => setSaveStatus('idle')}>Saved</Alert>
            </Snackbar>

            {/* Save error */}
            <Snackbar open={saveStatus === 'error'} autoHideDuration={5000} onClose={() => setSaveStatus('idle')}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity="error" onClose={() => setSaveStatus('idle')}>{saveError}</Alert>
            </Snackbar>
        </>
    );
};

export default HeaderRow;
