// A small evaluator for the subset of Excel formulas the spreadsheet exports
// write. It fills in each formula cell's cached value, which Excel shows
// until it recalculates and which previews (Quick Look, mail attachments,
// Numbers before it recalculates) show as the only value. Not a general
// spreadsheet engine: it covers the operators and functions listed in
// FUNCTIONS below and throws on anything else, so an export that starts
// using something new fails loudly in the tests instead of writing a wrong
// cached value. The tests also check every formula against HyperFormula, an
// independent engine, so this file can't quietly disagree with Excel.

export type Scalar = number | string | boolean | null; // null is a blank cell

export class XlError extends Error {
  constructor(public code: "#DIV/0!" | "#VALUE!" | "#N/A" | "#REF!" | "#NAME?" | "#NUM!") {
    super(code);
  }
}

type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "ref"; sheet?: string; c1: number; r1: number; c2: number; r2: number }
  | { t: "un"; op: "-" | "+"; a: Node }
  | { t: "bin"; op: string; a: Node; b: Node }
  | { t: "fn"; name: string; args: Node[] };

type Grid = Scalar[][];
type Val = Scalar | Grid;

// ---------------------------------------------------------------------------
// Addresses

export function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function colName(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function parseAddress(a: string): { col: number; row: number } {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(a);
  if (!m) throw new Error(`Bad cell address: ${a}`);
  return { col: colIndex(m[1]), row: Number(m[2]) - 1 };
}

// ---------------------------------------------------------------------------
// Parsing

type Tok =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "ref"; sheet?: string; a: string; b?: string }
  | { k: "fn"; v: string }
  | { k: "id"; v: string }
  | { k: "op"; v: string };

const CELL = /^\$?[A-Za-z]{1,3}\$?\d+/;

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    const rest = src.slice(i);
    let m: RegExpExecArray | null;
    if ((m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest))) {
      out.push({ k: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (ch === '"') {
      let j = i + 1, s = "";
      for (;;) {
        if (j >= src.length) throw new Error(`Unterminated string in ${src}`);
        if (src[j] === '"') {
          if (src[j + 1] === '"') { s += '"'; j += 2; continue; }
          break;
        }
        s += src[j++];
      }
      out.push({ k: "str", v: s });
      i = j + 1;
      continue;
    }
    if ((m = /^[A-Za-z_][A-Za-z0-9_.]*\(/.exec(rest))) {
      out.push({ k: "fn", v: m[0].slice(0, -1).toUpperCase() });
      i += m[0].length;
      continue;
    }
    // An optional sheet prefix ('Quoted name'! or Name!), then a cell or range.
    let sheet: string | undefined;
    let j = i;
    if (ch === "'") {
      let k = i + 1, s = "";
      for (;;) {
        if (k >= src.length) throw new Error(`Unterminated sheet name in ${src}`);
        if (src[k] === "'") {
          if (src[k + 1] === "'") { s += "'"; k += 2; continue; }
          break;
        }
        s += src[k++];
      }
      if (src[k + 1] !== "!") throw new Error(`Expected ! after sheet name in ${src}`);
      sheet = s;
      j = k + 2;
    } else if ((m = /^([A-Za-z_][A-Za-z0-9_]*)!/.exec(rest))) {
      sheet = m[1];
      j = i + m[0].length;
    }
    const cell = CELL.exec(src.slice(j));
    if (cell) {
      let end = j + cell[0].length;
      let b: string | undefined;
      if (src[end] === ":") {
        const cell2 = CELL.exec(src.slice(end + 1));
        if (!cell2) throw new Error(`Bad range in ${src}`);
        b = cell2[0];
        end += 1 + cell2[0].length;
      }
      out.push({ k: "ref", sheet, a: cell[0], b });
      i = end;
      continue;
    }
    if (sheet !== undefined) throw new Error(`Expected a cell after the sheet name in ${src}`);
    if ((m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest))) {
      out.push({ k: "id", v: m[0].toUpperCase() });
      i += m[0].length;
      continue;
    }
    if ((m = /^(<=|>=|<>|[-+*/^&=<>(),])/.exec(rest))) {
      out.push({ k: "op", v: m[0] });
      i += m[0].length;
      continue;
    }
    throw new Error(`Unexpected "${ch}" in ${src}`);
  }
  return out;
}

export function parseFormula(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peekOp = (...ops: string[]) => {
    const t = toks[p];
    return t && t.k === "op" && ops.includes(t.v) ? t.v : null;
  };
  const expectOp = (op: string) => {
    if (!peekOp(op)) throw new Error(`Expected ${op} in ${src}`);
    p++;
  };
  const binary = (next: () => Node, ops: string[]) => () => {
    let a = next();
    for (let op = peekOp(...ops); op; op = peekOp(...ops)) {
      p++;
      a = { t: "bin", op, a, b: next() };
    }
    return a;
  };
  function primary(): Node {
    const t = toks[p++];
    if (!t) throw new Error(`Unexpected end of ${src}`);
    if (t.k === "num") return { t: "num", v: t.v };
    if (t.k === "str") return { t: "str", v: t.v };
    if (t.k === "id") {
      if (t.v === "TRUE" || t.v === "FALSE") return { t: "bool", v: t.v === "TRUE" };
      throw new Error(`Unknown name ${t.v} in ${src}`);
    }
    if (t.k === "ref") {
      const a = parseAddress(t.a);
      const b = t.b ? parseAddress(t.b) : a;
      return {
        t: "ref", sheet: t.sheet,
        c1: Math.min(a.col, b.col), r1: Math.min(a.row, b.row), c2: Math.max(a.col, b.col), r2: Math.max(a.row, b.row),
      };
    }
    if (t.k === "fn") {
      const args: Node[] = [];
      if (!peekOp(")")) {
        args.push(expr());
        while (peekOp(",")) { p++; args.push(expr()); }
      }
      expectOp(")");
      return { t: "fn", name: t.v, args };
    }
    if (t.v === "(") {
      const e = expr();
      expectOp(")");
      return e;
    }
    throw new Error(`Unexpected ${t.v} in ${src}`);
  }
  // Excel binds negation tighter than ^ (-2^2 is 4), and ^ is left-associative.
  function unary(): Node {
    const op = peekOp("-", "+");
    if (op) { p++; return { t: "un", op: op as "-" | "+", a: unary() }; }
    return primary();
  }
  const power = binary(unary, ["^"]);
  const mult = binary(power, ["*", "/"]);
  const add = binary(mult, ["+", "-"]);
  const concat = binary(add, ["&"]);
  const expr = binary(concat, ["=", "<>", "<", ">", "<=", ">="]);
  const root = expr();
  if (p !== toks.length) throw new Error(`Unexpected trailing input in ${src}`);
  return root;
}

// ---------------------------------------------------------------------------
// Evaluation

// Resolves a cell to its value, evaluating its formula first if it has one.
export type CellResolver = (sheet: string, col: number, row: number) => Scalar;

const isGrid = (v: Val): v is Grid => Array.isArray(v);

function scalar(v: Val): Scalar {
  if (!isGrid(v)) return v;
  if (v.length === 1 && v[0].length === 1) return v[0][0];
  throw new XlError("#VALUE!");
}

function toNum(v: Val): number {
  const s = scalar(v);
  if (typeof s === "number") return s;
  if (typeof s === "boolean") return s ? 1 : 0;
  if (s === null || s === "") return 0;
  const n = Number(s);
  if (Number.isFinite(n)) return n;
  throw new XlError("#VALUE!");
}

function toBool(v: Val): boolean {
  const s = scalar(v);
  if (typeof s === "boolean") return s;
  if (typeof s === "string") {
    if (s.toUpperCase() === "TRUE") return true;
    if (s.toUpperCase() === "FALSE") return false;
    throw new XlError("#VALUE!");
  }
  return toNum(s) !== 0;
}

function toText(v: Val): string {
  const s = scalar(v);
  if (s === null) return "";
  if (typeof s === "boolean") return s ? "TRUE" : "FALSE";
  if (typeof s === "number") return String(Number(s.toPrecision(15)));
  return s;
}

// Excel orders numbers < text < booleans; blanks compare as the other side's empty value.
function compare(a: Scalar, b: Scalar): number {
  const empty = (other: Scalar): Scalar => (typeof other === "string" ? "" : typeof other === "boolean" ? false : 0);
  if (a === null) a = empty(b);
  if (b === null) b = empty(a);
  const rank = (x: Scalar) => (typeof x === "number" ? 0 : typeof x === "string" ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (typeof a === "string") {
    const x = a.toLowerCase(), y = (b as string).toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  const x = Number(a), y = Number(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

function flatten(args: Val[]): Scalar[] {
  return args.flatMap((a) => (isGrid(a) ? a.flat() : [a]));
}

// Numbers for SUM/MIN/MAX: direct arguments are coerced; text and booleans
// inside a range are skipped, as in Excel.
function numbersOf(args: Val[]): number[] {
  return args.flatMap((a) => (isGrid(a) ? a.flat().filter((x): x is number => typeof x === "number") : [toNum(a)]));
}

function grid(v: Val): Grid {
  if (isGrid(v)) return v;
  return [[v]];
}

// SUMIF/SUMIFS criteria: a number, or text with an optional comparison
// operator in front ("<0", ">=3", "upfront"). Numeric criteria only match
// numbers; text criteria match text case-insensitively (no wildcards).
function criteria(c: Scalar): (x: Scalar) => boolean {
  if (typeof c === "number") return (x) => typeof x === "number" && x === c;
  if (typeof c === "boolean") return (x) => x === c;
  const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(c ?? "")!;
  const op = m[1] ?? "=";
  const operand = m[2];
  const n = operand.trim() === "" ? NaN : Number(operand);
  if (Number.isFinite(n)) {
    return (x) => {
      if (typeof x !== "number") return op === "<>";
      switch (op) {
        case "<": return x < n;
        case ">": return x > n;
        case "<=": return x <= n;
        case ">=": return x >= n;
        case "<>": return x !== n;
        default: return x === n;
      }
    };
  }
  const want = operand.toLowerCase();
  if (op === "=") return (x) => (want === "" ? x === null || x === "" : typeof x === "string" && x.toLowerCase() === want);
  if (op === "<>") return (x) => !(typeof x === "string" && x.toLowerCase() === want);
  return (x) => typeof x === "string" && (op === "<" ? x.toLowerCase() < want : op === ">" ? x.toLowerCase() > want
    : op === "<=" ? x.toLowerCase() <= want : x.toLowerCase() >= want);
}

function sameShape(a: Grid, b: Grid) {
  if (a.length !== b.length || a[0]?.length !== b[0]?.length) throw new XlError("#VALUE!");
}

type Fn = (args: Node[], ev: (n: Node) => Val) => Val;

const eager = (f: (args: Val[]) => Val): Fn => (args, ev) => f(args.map(ev));

const FUNCTIONS: Record<string, Fn> = {
  SUM: eager((a) => numbersOf(a).reduce((s, x) => s + x, 0)),
  MIN: eager((a) => { const n = numbersOf(a); return n.length ? Math.min(...n) : 0; }),
  MAX: eager((a) => { const n = numbersOf(a); return n.length ? Math.max(...n) : 0; }),
  ABS: eager(([x]) => Math.abs(toNum(x))),
  SIGN: eager(([x]) => Math.sign(toNum(x))),
  POWER: eager(([x, y]) => Math.pow(toNum(x), toNum(y))),
  MOD: eager(([x, y]) => {
    const a = toNum(x), b = toNum(y);
    if (b === 0) throw new XlError("#DIV/0!");
    return a - b * Math.floor(a / b);
  }),
  ROUND: eager(([x, d]) => {
    const m = Math.pow(10, toNum(d ?? 0)), n = toNum(x);
    return (Math.sign(n) * Math.round(Math.abs(n) * m)) / m;
  }),
  ROUNDUP: eager(([x, d]) => {
    const m = Math.pow(10, toNum(d ?? 0)), n = toNum(x);
    return (Math.sign(n) * Math.ceil(Math.abs(n) * m)) / m;
  }),
  AND: eager((a) => flatten(a).filter((x) => x !== null).every((x) => toBool(x))),
  OR: eager((a) => flatten(a).filter((x) => x !== null).some((x) => toBool(x))),
  NOT: eager(([x]) => !toBool(x)),
  ISNUMBER: eager(([x]) => typeof scalar(x) === "number"),
  IF: (args, ev) => {
    if (toBool(ev(args[0]))) return ev(args[1]);
    return args.length > 2 ? ev(args[2]) : false;
  },
  IFERROR: (args, ev) => {
    try {
      return scalar(ev(args[0]));
    } catch (e) {
      if (e instanceof XlError) return ev(args[1]);
      throw e;
    }
  },
  SUMPRODUCT: eager((a) => {
    const grids = a.map(grid);
    grids.forEach((g) => sameShape(grids[0], g));
    let sum = 0;
    grids[0].forEach((row, r) => row.forEach((_, c) => {
      sum += grids.reduce((prod, g) => prod * (typeof g[r][c] === "number" ? (g[r][c] as number) : 0), 1);
    }));
    return sum;
  }),
  SUMIF: eager(([range, crit, sumRange]) => {
    const r = grid(range), s = sumRange === undefined ? r : grid(sumRange);
    sameShape(r, s);
    const test = criteria(scalar(crit));
    let sum = 0;
    r.forEach((row, i) => row.forEach((x, j) => { if (test(x) && typeof s[i][j] === "number") sum += s[i][j] as number; }));
    return sum;
  }),
  SUMIFS: eager(([sumRange, ...pairs]) => {
    const s = grid(sumRange);
    const tests: [Grid, (x: Scalar) => boolean][] = [];
    for (let k = 0; k < pairs.length; k += 2) {
      const r = grid(pairs[k]);
      sameShape(s, r);
      tests.push([r, criteria(scalar(pairs[k + 1]))]);
    }
    let sum = 0;
    s.forEach((row, i) => row.forEach((x, j) => {
      if (typeof x === "number" && tests.every(([r, t]) => t(r[i][j]))) sum += x;
    }));
    return sum;
  }),
  INDEX: eager(([range, i, j]) => {
    const g = grid(range);
    let r = toNum(i) - 1, c = j === undefined ? 0 : toNum(j) - 1;
    // INDEX(row_range, n) picks the nth column.
    if (j === undefined && g.length === 1) { c = r; r = 0; }
    if (r < 0 || c < 0 || r >= g.length || c >= g[0].length) throw new XlError("#REF!");
    return g[r][c];
  }),
  MATCH: eager(([want, range, type]) => {
    if (type === undefined || toNum(type) !== 0) throw new Error("Only exact MATCH (match_type 0) is supported");
    const w = scalar(want);
    const cells = grid(range).flat();
    const idx = cells.findIndex((x) => x !== null && (typeof x === typeof w) && compare(x, w) === 0);
    if (idx < 0) throw new XlError("#N/A");
    return idx + 1;
  }),
};

export function evaluateNode(node: Node, sheet: string, resolve: CellResolver): Val {
  const ev = (n: Node): Val => evaluateNode(n, sheet, resolve);
  switch (node.t) {
    case "num": return node.v;
    case "str": return node.v;
    case "bool": return node.v;
    case "ref": {
      const s = node.sheet ?? sheet;
      if (node.c1 === node.c2 && node.r1 === node.r2) return resolve(s, node.c1, node.r1);
      const rows: Grid = [];
      for (let r = node.r1; r <= node.r2; r++) {
        const row: Scalar[] = [];
        for (let c = node.c1; c <= node.c2; c++) row.push(resolve(s, c, r));
        rows.push(row);
      }
      return rows;
    }
    case "un": return node.op === "-" ? -toNum(ev(node.a)) : toNum(ev(node.a));
    case "bin": {
      const a = ev(node.a), b = ev(node.b);
      switch (node.op) {
        case "+": return toNum(a) + toNum(b);
        case "-": return toNum(a) - toNum(b);
        case "*": return toNum(a) * toNum(b);
        case "/": {
          const d = toNum(b);
          if (d === 0) throw new XlError("#DIV/0!");
          return toNum(a) / d;
        }
        case "^": return Math.pow(toNum(a), toNum(b));
        case "&": return toText(a) + toText(b);
        default: {
          const c = compare(scalar(a), scalar(b));
          switch (node.op) {
            case "=": return c === 0;
            case "<>": return c !== 0;
            case "<": return c < 0;
            case ">": return c > 0;
            case "<=": return c <= 0;
            default: return c >= 0;
          }
        }
      }
    }
    case "fn": {
      const f = FUNCTIONS[node.name];
      if (!f) throw new Error(`Unsupported function ${node.name}`);
      return f(node.args, ev);
    }
  }
}

// Evaluates a formula (without its leading "=") to a single value. Errors
// come back as an XlError value rather than being thrown.
export function evaluateFormula(src: string, sheet: string, resolve: CellResolver): Scalar | XlError {
  try {
    const v = scalar(evaluateNode(parseFormula(src), sheet, resolve));
    if (typeof v === "number" && !Number.isFinite(v)) return new XlError("#NUM!");
    return v;
  } catch (e) {
    if (e instanceof XlError) return e;
    throw e;
  }
}
