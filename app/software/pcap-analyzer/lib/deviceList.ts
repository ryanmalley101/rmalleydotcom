/**
 * Parser for a Verkada Command-exported device list (CSV).
 *
 * The MAC Address column has four different encodings in the wild:
 *   1. Single MAC:           E0:A7:00:71:5C:D9
 *   2. Semicolon-separated:  e0:a7:00:8d:11:ee;e0:a7:00:8d:11:ea;...
 *   3. Comma-separated:      "8c:26:aa:eb:a4:a4,8c:26:aa:e6:63:38"
 *   4. JSON object:          "{""eth0"":""..."",""eth1"":""...""}"
 *
 * All four are normalized into a flat list of canonicalized MACs (lowercase,
 * colon-separated), each pointing at the same device record.
 */

export interface CsvDeviceInfo {
    name: string;
    model: string;
    site: string;
    serial: string;
    status: string;
    /** True when the device is flagged as a non-Verkada (third-party) product in the CSV. */
    thirdParty: boolean;
    /** All MAC addresses listed for this device row (canonicalized). */
    macs: string[];
}

const MAC_RE = /^[0-9a-f]{2}(?::[0-9a-f]{2}){5}$/;

function normalizeMac(mac: string): string {
    return mac.replace(/-/g, ":").trim().toLowerCase();
}

function extractMacs(field: string): string[] {
    if (!field) return [];
    const trimmed = field.trim();
    if (!trimmed) return [];

    let candidates: string[];
    if (trimmed.startsWith("{")) {
        // JSON object — interface → MAC mapping.
        try {
            const obj = JSON.parse(trimmed) as Record<string, unknown>;
            candidates = Object.values(obj).filter((v): v is string => typeof v === "string");
        } catch {
            return [];
        }
    } else {
        candidates = trimmed.split(/[;,]/);
    }
    const out: string[] = [];
    for (const raw of candidates) {
        const m = normalizeMac(raw);
        if (MAC_RE.test(m)) out.push(m);
    }
    return out;
}

/** Parse a CSV string into rows of fields, honoring quoted values and escaped quotes. */
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    let i = 0;
    const n = text.length;

    while (i < n) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
                inQuotes = false;
                i++;
            } else {
                field += c;
                i++;
            }
        } else {
            if (c === '"') {
                inQuotes = true;
                i++;
            } else if (c === ",") {
                row.push(field);
                field = "";
                i++;
            } else if (c === "\r" && text[i + 1] === "\n") {
                row.push(field);
                rows.push(row);
                row = [];
                field = "";
                i += 2;
            } else if (c === "\n" || c === "\r") {
                row.push(field);
                rows.push(row);
                row = [];
                field = "";
                i++;
            } else {
                field += c;
                i++;
            }
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

export interface DeviceListLoad {
    /** MAC → metadata; a single device may appear under multiple MACs. */
    macIndex: Map<string, CsvDeviceInfo>;
    /** Distinct devices found in the CSV (deduplicated by row, not by MAC). */
    deviceCount: number;
    /** Total MAC addresses extracted across all rows. */
    macCount: number;
}

/**
 * Build the MAC → device-metadata index from a CSV string.
 *
 * Returns an empty load when the CSV doesn't have the expected header or no
 * row contains a valid MAC. Rows without MACs are skipped silently.
 */
export function loadDeviceList(csvText: string): DeviceListLoad {
    const rows = parseCsv(csvText);
    if (rows.length < 2) return { macIndex: new Map(), deviceCount: 0, macCount: 0 };
    const header = rows[0].map(h => h.trim().toLowerCase());

    const col = (name: string) => {
        const idx = header.indexOf(name.toLowerCase());
        return idx >= 0 ? idx : -1;
    };

    const iName = col("Name");
    const iModel = col("Model");
    const iSite = col("Site");
    const iSerial = col("Serial Number");
    const iStatus = col("Status");
    const iMac = col("MAC Address");
    const iThirdParty = col("non-Verkada model");

    if (iMac < 0) return { macIndex: new Map(), deviceCount: 0, macCount: 0 };

    const macIndex = new Map<string, CsvDeviceInfo>();
    let deviceCount = 0;
    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const macField = iMac < row.length ? row[iMac] : "";
        const macs = extractMacs(macField);
        if (macs.length === 0) continue;
        const info: CsvDeviceInfo = {
            name: iName >= 0 ? (row[iName] ?? "").trim() : "",
            model: iModel >= 0 ? (row[iModel] ?? "").trim() : "",
            site: iSite >= 0 ? (row[iSite] ?? "").trim() : "",
            serial: iSerial >= 0 ? (row[iSerial] ?? "").trim() : "",
            status: iStatus >= 0 ? (row[iStatus] ?? "").trim() : "",
            thirdParty: iThirdParty >= 0
                ? (row[iThirdParty] ?? "").trim().toLowerCase() === "true"
                : false,
            macs,
        };
        deviceCount++;
        for (const mac of macs) {
            // First-write-wins for ambiguous MACs (the same MAC accidentally listed
            // against two different devices — rare but possible).
            if (!macIndex.has(mac)) macIndex.set(mac, info);
        }
    }
    return { macIndex, deviceCount, macCount: macIndex.size };
}
