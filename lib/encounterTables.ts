import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

export interface EncounterEntry {
    roll: number;
    description: string;
}

export interface EncounterTable {
    name: string;
    slug: string;
    entries: EncounterEntry[];
}

export function slugify(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function getAllTables(): EncounterTable[] {
    const filePath = path.join(process.cwd(), 'public', 'Random Encounter Tables.xlsx');
    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: 'buffer' });

    return wb.SheetNames.map(name => {
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json<[number | string, string]>(ws, { header: 1 });

        const entries: EncounterEntry[] = rows
            .slice(1)
            .filter((row): row is [number, string] => !!row[0] && !!row[1])
            .map(row => ({
                roll: Number(row[0]),
                description: String(row[1]),
            }));

        return { name, slug: slugify(name), entries };
    });
}

export function getTableBySlug(slug: string): EncounterTable | undefined {
    return getAllTables().find(t => t.slug === slug);
}
