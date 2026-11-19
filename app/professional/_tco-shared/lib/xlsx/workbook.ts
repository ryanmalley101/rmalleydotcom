// An in-memory workbook for the spreadsheet exports: sheets of cells (values
// or formulas), a fixed set of named cell styles, list dropdowns, and native
// charts. write.ts turns it into an .xlsx file; computeCachedValues fills in
// every formula's current value first, using formula.ts.
import { XlError, colName, evaluateFormula, parseAddress, type Scalar } from "./formula";

export { colName, parseAddress } from "./formula";

// Named cell styles, defined once in write.ts. Input styles follow the usual
// financial-model convention: blue text on a pale fill is a value to edit;
// black is a formula; gray is fixed by the export's structure.
export type StyleName =
  | "text" | "bold" | "title" | "subtitle" | "section" | "note" | "wrap"
  | "header" | "headerRight"
  | "usd" | "usdCents" | "usdBold" | "num" | "int" | "factor" | "flag"
  | "inUsd" | "inNum" | "inText"
  | "fixed" | "fixedNum";

export interface Cell {
  value?: Scalar;
  // Without the leading "=".
  formula?: string;
  style: StyleName;
  // A formula's value, filled in by computeCachedValues.
  cached?: Scalar | XlError;
}

export type Content = Scalar | { f: string };

export interface ChartSeries {
  name: string;
  // A range on any sheet, e.g. "'Year by year'!$C$5:$C$15".
  values: string;
  color: string;
}

export interface ChartSpec {
  kind: "line" | "column" | "bar";
  title: string;
  categories: string;
  series: ChartSeries[];
  // Top-left and bottom-right cells the chart is drawn over (0-based).
  from: { col: number; row: number };
  to: { col: number; row: number };
}

export class Sheet {
  readonly cells = new Map<string, Cell>();
  readonly colWidths = new Map<number, number>();
  readonly validations: { sqref: string; options: string[] }[] = [];
  readonly charts: ChartSpec[] = [];
  // Number of frozen columns and rows.
  freeze: { cols: number; rows: number } | null = null;
  showGridLines = true;

  constructor(readonly name: string) {
    if (name.length > 31 || /[[\]:*?/\\]/.test(name)) throw new Error(`Invalid sheet name: ${name}`);
  }

  set(address: string, content: Content, style: StyleName = "text"): void {
    const key = address.replace(/\$/g, "").toUpperCase();
    if (content !== null && typeof content === "object") {
      this.cells.set(key, { formula: content.f.replace(/^=/, ""), style });
    } else {
      if (typeof content === "number" && !Number.isFinite(content)) throw new Error(`Non-finite number at ${this.name}!${key}`);
      this.cells.set(key, { value: content, style });
    }
  }

  get(address: string): Cell | undefined {
    return this.cells.get(address.replace(/\$/g, "").toUpperCase());
  }

  width(col: number, chars: number): void {
    this.colWidths.set(col, chars);
  }

  dropdown(address: string, options: string[]): void {
    this.validations.push({ sqref: address.replace(/\$/g, ""), options });
  }
}

export class Workbook {
  sheets: Sheet[] = [];

  add(name: string): Sheet {
    if (this.sheets.some((s) => s.name.toLowerCase() === name.toLowerCase())) throw new Error(`Duplicate sheet ${name}`);
    const sheet = new Sheet(name);
    this.sheets.push(sheet);
    return sheet;
  }

  sheet(name: string): Sheet {
    const s = this.sheets.find((x) => x.name === name);
    if (!s) throw new Error(`No sheet ${name}`);
    return s;
  }

  // Puts the named sheets first, in this order; the rest keep theirs.
  order(names: string[]): void {
    const first = names.map((n) => this.sheet(n));
    this.sheets = [...first, ...this.sheets.filter((s) => !first.includes(s))];
  }
}

// ---------------------------------------------------------------------------
// References

export const cellAt = (col: number, row: number) => `${colName(col)}${row + 1}`;
export const abs = (address: string) => {
  const { col, row } = parseAddress(address);
  return `$${colName(col)}$${row + 1}`;
};
export const quoteSheet = (name: string) => `'${name.replace(/'/g, "''")}'`;
// A cross-sheet reference, absolute: 'Model A'!$B$5.
export const xref = (sheet: string, address: string) => `${quoteSheet(sheet)}!${abs(address)}`;
export const xrange = (sheet: string, from: string, to: string) => `${quoteSheet(sheet)}!${abs(from)}:${abs(to)}`;
// A text literal for use inside a formula.
export const lit = (s: string) => `"${s.replace(/"/g, '""')}"`;

// ---------------------------------------------------------------------------
// Cached values

// Evaluates every formula cell once (dependencies first, on demand) and
// stores the result as its cached value. Throws on a circular reference or
// an unsupported formula, both of which are bugs in an export.
export function computeCachedValues(wb: Workbook): void {
  const byName = new Map(wb.sheets.map((s) => [s.name, s]));
  const done = new Map<string, Scalar | XlError>();
  const active = new Set<string>();

  const resolve = (sheetName: string, col: number, row: number): Scalar => {
    const v = valueOf(sheetName, col, row);
    if (v instanceof XlError) throw v;
    return v;
  };

  function valueOf(sheetName: string, col: number, row: number): Scalar | XlError {
    const sheet = byName.get(sheetName);
    if (!sheet) throw new Error(`Formula refers to missing sheet ${sheetName}`);
    const address = cellAt(col, row);
    const cell = sheet.cells.get(address);
    if (!cell) return null;
    if (cell.formula === undefined) return cell.value ?? null;
    const key = `${sheetName}!${address}`;
    if (done.has(key)) return done.get(key)!;
    if (active.has(key)) throw new Error(`Circular reference at ${key}`);
    active.add(key);
    let v: Scalar | XlError;
    try {
      v = evaluateFormula(cell.formula, sheetName, resolve);
    } catch (e) {
      throw new Error(`${key} (=${cell.formula}): ${(e as Error).message}`);
    }
    active.delete(key);
    done.set(key, v);
    cell.cached = v;
    return v;
  }

  for (const sheet of wb.sheets) {
    for (const address of Array.from(sheet.cells.keys())) {
      const { col, row } = parseAddress(address);
      valueOf(sheet.name, col, row);
    }
  }
}

// A cell's current value: its literal value, or its cached formula result.
export function valueAt(wb: Workbook, sheet: string, address: string): Scalar | XlError {
  const cell = wb.sheet(sheet).get(address);
  if (!cell) return null;
  return cell.formula !== undefined ? cell.cached ?? null : cell.value ?? null;
}
