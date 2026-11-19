// Serializes a Workbook (workbook.ts) as an .xlsx file: the Office Open XML
// parts for sheets, styles, shared strings, and charts, packed into a zip.
// Hand-written rather than a library because the free spreadsheet libraries
// either don't write charts or don't write styles, and the subset needed here
// is small. Entries are stored uncompressed, which every spreadsheet app
// reads; the files are a few hundred KB at most.
import { XlError, type Scalar } from "./formula";
import {
  cellAt, computeCachedValues, parseAddress, valueAt,
  type Cell, type ChartSpec, type Sheet, type StyleName, type Workbook,
} from "./workbook";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    // Characters XML 1.0 doesn't allow at all.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

// ---------------------------------------------------------------------------
// Styles

const USD = '"$"#,##0;\\-"$"#,##0';
const USD_CENTS = '"$"#,##0.00;\\-"$"#,##0.00';
const CUSTOM_FORMATS: Record<number, string> = { 164: USD, 165: USD_CENTS, 166: "0.0000" };

// Font, fill, and border indexes refer to the lists in stylesXml.
interface Xf { font?: number; fill?: number; border?: number; fmt?: number; align?: "right" | "center"; wrap?: boolean }
const STYLES: Record<StyleName, Xf> = {
  text: {},
  bold: { font: 1 },
  title: { font: 2 },
  subtitle: { font: 3 },
  section: { font: 4 },
  note: { font: 3 },
  wrap: { wrap: true },
  // Headers wrap, so a long solution name grows the row instead of being cut off.
  header: { font: 1, fill: 3, border: 1, wrap: true },
  headerRight: { font: 1, fill: 3, border: 1, align: "right", wrap: true },
  usd: { fmt: 164 },
  usdCents: { fmt: 165 },
  usdBold: { font: 1, fmt: 164, border: 3 },
  num: { fmt: 4 },
  int: { fmt: 3 },
  factor: { fmt: 166 },
  flag: { fmt: 1, align: "center" },
  inUsd: { font: 5, fill: 2, border: 2, fmt: 165 },
  inNum: { font: 5, fill: 2, border: 2 },
  inText: { font: 5, fill: 2, border: 2 },
  fixed: { font: 6, fill: 4 },
  fixedNum: { font: 6, fill: 4, align: "right" },
};
const STYLE_NAMES = Object.keys(STYLES) as StyleName[];
const styleIndex = (s: StyleName) => STYLE_NAMES.indexOf(s);

function stylesXml(): string {
  const fmts = Object.entries(CUSTOM_FORMATS).map(([id, code]) => `<numFmt numFmtId="${id}" formatCode="${esc(code)}"/>`).join("");
  const font = (extra: string) => `<font>${extra}<sz val="11"/><name val="Calibri"/><family val="2"/></font>`;
  const fonts = [
    font(""),
    font("<b/>"),
    `<font><b/><sz val="16"/><color rgb="FF1F3864"/><name val="Calibri"/><family val="2"/></font>`,
    font('<i/><color rgb="FF595959"/>'),
    `<font><b/><sz val="12"/><color rgb="FF1F3864"/><name val="Calibri"/><family val="2"/></font>`,
    font('<color rgb="FF0000FF"/>'),
    font('<color rgb="FF7F7F7F"/>'),
  ];
  const solid = (rgb: string) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>', solid("FFF2CC"), solid("D9E1F2"), solid("F2F2F2")];
  const side = (name: string, rgb?: string) => (rgb ? `<${name} style="thin"><color rgb="FF${rgb}"/></${name}>` : `<${name}/>`);
  const border = (l?: string, r?: string, t?: string, b?: string) =>
    `<border>${side("left", l)}${side("right", r)}${side("top", t)}${side("bottom", b)}<diagonal/></border>`;
  const borders = [border(), border(undefined, undefined, undefined, "8EA9DB"), border("BFBFBF", "BFBFBF", "BFBFBF", "BFBFBF"), border(undefined, undefined, "000000")];
  const xfs = STYLE_NAMES.map((name) => {
    const x = STYLES[name];
    const attrs = [
      `numFmtId="${x.fmt ?? 0}"`, `fontId="${x.font ?? 0}"`, `fillId="${x.fill ?? 0}"`, `borderId="${x.border ?? 0}"`, 'xfId="0"',
      x.fmt ? 'applyNumberFormat="1"' : "", x.font ? 'applyFont="1"' : "", x.fill ? 'applyFill="1"' : "", x.border ? 'applyBorder="1"' : "",
      x.align || x.wrap ? 'applyAlignment="1"' : "",
    ].filter(Boolean).join(" ");
    const align = x.align || x.wrap
      ? `<alignment${x.align ? ` horizontal="${x.align}"` : ""}${x.wrap ? ` wrapText="1" vertical="${x.font ? "bottom" : "top"}"` : ""}/>`
      : "";
    return align ? `<xf ${attrs}>${align}</xf>` : `<xf ${attrs}/>`;
  });
  return XML_HEAD +
    `<styleSheet xmlns="${NS_MAIN}">` +
    `<numFmts count="${Object.keys(CUSTOM_FORMATS).length}">${fmts}</numFmts>` +
    `<fonts count="${fonts.length}">${fonts.join("")}</fonts>` +
    `<fills count="${fills.length}">${fills.join("")}</fills>` +
    `<borders count="${borders.length}">${borders.join("")}</borders>` +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>";
}

// ---------------------------------------------------------------------------
// Worksheets

class SharedStrings {
  readonly list: string[] = [];
  private readonly index = new Map<string, number>();
  add(s: string): number {
    let i = this.index.get(s);
    if (i === undefined) {
      i = this.list.length;
      this.list.push(s);
      this.index.set(s, i);
    }
    return i;
  }
  xml(): string {
    const items = this.list.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("");
    return XML_HEAD + `<sst xmlns="${NS_MAIN}" count="${this.list.length}" uniqueCount="${this.list.length}">${items}</sst>`;
  }
}

const num = (n: number) => String(Number.isFinite(n) ? n : 0);

function cellXml(address: string, cell: Cell, strings: SharedStrings): string {
  const s = ` s="${styleIndex(cell.style)}"`;
  if (cell.formula !== undefined) {
    const f = `<f>${esc(cell.formula)}</f>`;
    const v = cell.cached;
    if (v instanceof XlError) return `<c r="${address}"${s} t="e">${f}<v>${v.code}</v></c>`;
    if (typeof v === "string") return `<c r="${address}"${s} t="str">${f}<v>${esc(v)}</v></c>`;
    if (typeof v === "boolean") return `<c r="${address}"${s} t="b">${f}<v>${v ? 1 : 0}</v></c>`;
    return `<c r="${address}"${s}>${f}<v>${num(typeof v === "number" ? v : 0)}</v></c>`;
  }
  const v = cell.value;
  if (v === null || v === undefined) return `<c r="${address}"${s}/>`;
  if (typeof v === "number") return `<c r="${address}"${s}><v>${num(v)}</v></c>`;
  if (typeof v === "boolean") return `<c r="${address}"${s} t="b"><v>${v ? 1 : 0}</v></c>`;
  return `<c r="${address}"${s} t="s"><v>${strings.add(v)}</v></c>`;
}

function sheetXml(sheet: Sheet, selected: boolean, strings: SharedStrings, hasDrawing: boolean): string {
  const rows = new Map<number, { col: number; xml: string }[]>();
  sheet.cells.forEach((cell, address) => {
    const { col, row } = parseAddress(address);
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row)!.push({ col, xml: cellXml(address, cell, strings) });
  });
  const rowXml = Array.from(rows.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([row, cells]) => `<row r="${row + 1}">${cells.sort((a, b) => a.col - b.col).map((c) => c.xml).join("")}</row>`)
    .join("");

  let pane = "";
  if (sheet.freeze && (sheet.freeze.cols > 0 || sheet.freeze.rows > 0)) {
    const { cols, rows: frozenRows } = sheet.freeze;
    const active = cols && frozenRows ? "bottomRight" : frozenRows ? "bottomLeft" : "topRight";
    pane = `<pane${cols ? ` xSplit="${cols}"` : ""}${frozenRows ? ` ySplit="${frozenRows}"` : ""} topLeftCell="${cellAt(cols, frozenRows)}" activePane="${active}" state="frozen"/>` +
      `<selection pane="${active}"/>`;
  }
  const view = `<sheetViews><sheetView${sheet.showGridLines ? "" : ' showGridLines="0"'}${selected ? ' tabSelected="1"' : ""} workbookViewId="0">${pane}</sheetView></sheetViews>`;

  const cols = Array.from(sheet.colWidths.entries()).sort((a, b) => a[0] - b[0])
    .map(([c, w]) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join("");

  const validations = sheet.validations.length
    ? `<dataValidations count="${sheet.validations.length}">` +
      sheet.validations.map((v) => {
        for (const o of v.options) if (/[",]/.test(o)) throw new Error(`Dropdown option can't contain a comma or quote: ${o}`);
        return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${v.sqref}"><formula1>${esc(`"${v.options.join(",")}"`)}</formula1></dataValidation>`;
      }).join("") +
      "</dataValidations>"
    : "";

  return XML_HEAD +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}">` +
    view +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${rowXml}</sheetData>` +
    validations +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    (hasDrawing ? '<drawing r:id="rId1"/>' : "") +
    "</worksheet>";
}

// ---------------------------------------------------------------------------
// Charts

function rangeCells(range: string): { sheet: string; addresses: string[] } {
  const m = /^'((?:[^']|'')+)'!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(range);
  if (!m) throw new Error(`Chart range must be a quoted-sheet range: ${range}`);
  const sheet = m[1].replace(/''/g, "'");
  const a = parseAddress(`${m[2]}${m[3]}`), b = parseAddress(`${m[4]}${m[5]}`);
  const addresses: string[] = [];
  for (let r = a.row; r <= b.row; r++) for (let c = a.col; c <= b.col; c++) addresses.push(cellAt(c, r));
  return { sheet, addresses };
}

const display = (v: Scalar | XlError): string => (v instanceof XlError ? v.code : v === null ? "" : String(v));

function strRef(wb: Workbook, range: string): string {
  const { sheet, addresses } = rangeCells(range);
  const pts = addresses.map((a, i) => `<c:pt idx="${i}"><c:v>${esc(display(valueAt(wb, sheet, a)))}</c:v></c:pt>`).join("");
  return `<c:strRef><c:f>${esc(range)}</c:f><c:strCache><c:ptCount val="${addresses.length}"/>${pts}</c:strCache></c:strRef>`;
}

function numRef(wb: Workbook, range: string): string {
  const { sheet, addresses } = rangeCells(range);
  const pts = addresses.map((a, i) => {
    const v = valueAt(wb, sheet, a);
    return typeof v === "number" ? `<c:pt idx="${i}"><c:v>${num(v)}</c:v></c:pt>` : "";
  }).join("");
  return `<c:numRef><c:f>${esc(range)}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${addresses.length}"/>${pts}</c:numCache></c:numRef>`;
}

const hex = (color: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  return m ? m[1].toUpperCase() : "808080";
};

const richText = (text: string, size: number, bold: boolean) =>
  `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="${bold ? 1 : 0}"/></a:pPr><a:r><a:rPr lang="en-US" sz="${size}" b="${bold ? 1 : 0}"/><a:t>${esc(text)}</a:t></a:r></a:p></c:rich></c:tx>`;

const gridLine = '<c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>';
const axisLine = '<c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:ln></c:spPr>';

function chartXml(wb: Workbook, chart: ChartSpec): string {
  const horizontal = chart.kind === "bar";
  const series = chart.series.map((s, i) => {
    const color = hex(s.color);
    const head = `<c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx>`;
    const data = `<c:cat>${strRef(wb, chart.categories)}</c:cat><c:val>${numRef(wb, s.values)}</c:val>`;
    if (chart.kind === "line") {
      return `<c:ser>${head}` +
        `<c:spPr><a:ln w="31750" cap="rnd"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:round/></a:ln></c:spPr>` +
        `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:ln></c:spPr></c:marker>` +
        `${data}<c:smooth val="0"/></c:ser>`;
    }
    return `<c:ser>${head}<c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>${data}</c:ser>`;
  }).join("");

  const axIds = '<c:axId val="500000001"/><c:axId val="500000002"/>';
  const plot = chart.kind === "line"
    ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/>${axIds}</c:lineChart>`
    : `<c:barChart><c:barDir val="${horizontal ? "bar" : "col"}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${series}<c:gapWidth val="60"/>${axIds}</c:barChart>`;

  // A horizontal bar chart lists its first category at the top, which needs
  // the category axis reversed and the value axis moved back to the bottom.
  const catAx = `<c:catAx><c:axId val="500000001"/><c:scaling><c:orientation val="${horizontal ? "maxMin" : "minMax"}"/></c:scaling>` +
    `<c:delete val="0"/><c:axPos val="${horizontal ? "l" : "b"}"/><c:numFmt formatCode="General" sourceLinked="0"/>` +
    `<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/>${axisLine}` +
    `<c:crossAx val="500000002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
  const valAx = `<c:valAx><c:axId val="500000002"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
    `<c:delete val="0"/><c:axPos val="${horizontal ? "b" : "l"}"/>${gridLine}<c:numFmt formatCode="${esc(USD)}" sourceLinked="0"/>` +
    `<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>` +
    `<c:crossAx val="500000001"/><c:crosses val="${horizontal ? "max" : "autoZero"}"/><c:crossBetween val="between"/></c:valAx>`;

  return XML_HEAD +
    `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">` +
    '<c:roundedCorners val="0"/>' +
    `<c:chart><c:title>${richText(chart.title, 1300, true)}<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>` +
    `<c:plotArea><c:layout/>${plot}${catAx}${valAx}</c:plotArea>` +
    '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>' +
    '<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr>' +
    "</c:chartSpace>";
}

function drawingXml(charts: { spec: ChartSpec; rid: string; id: number }[]): string {
  const anchors = charts.map(({ spec, rid, id }) =>
    '<xdr:twoCellAnchor editAs="oneCell">' +
    `<xdr:from><xdr:col>${spec.from.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${spec.from.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>${spec.to.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${spec.to.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
    `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id + 1}" name="Chart ${id}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
    '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
    `<a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" r:id="${rid}"/></a:graphicData></a:graphic>` +
    "</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>").join("");
  return XML_HEAD +
    `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${NS_A}" xmlns:r="${NS_R}">${anchors}</xdr:wsDr>`;
}

const rels = (items: { id: string; type: string; target: string }[]) =>
  XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  items.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${esc(r.target)}"/>`).join("") +
  "</Relationships>";

// ---------------------------------------------------------------------------
// Package

export interface XlsxMeta {
  title: string;
  // Fixed in tests so the output is reproducible.
  created?: Date;
}

// The workbook as .xlsx bytes. Computes every formula's cached value first.
export function writeXlsx(wb: Workbook, meta: XlsxMeta): Uint8Array {
  computeCachedValues(wb);
  const strings = new SharedStrings();
  const files: [string, string][] = [];
  const overrides: [string, string][] = [];
  const CT = "application/vnd.openxmlformats-officedocument.";

  let chartCount = 0;
  wb.sheets.forEach((sheet, i) => {
    const n = i + 1;
    const hasDrawing = sheet.charts.length > 0;
    files.push([`xl/worksheets/sheet${n}.xml`, sheetXml(sheet, i === 0, strings, hasDrawing)]);
    overrides.push([`/xl/worksheets/sheet${n}.xml`, `${CT}spreadsheetml.worksheet+xml`]);
    if (!hasDrawing) return;
    files.push([`xl/worksheets/_rels/sheet${n}.xml.rels`, rels([{ id: "rId1", type: `${REL}/drawing`, target: `../drawings/drawing${n}.xml` }])]);
    const charts = sheet.charts.map((spec, j) => ({ spec, rid: `rId${j + 1}`, id: ++chartCount }));
    files.push([`xl/drawings/drawing${n}.xml`, drawingXml(charts)]);
    overrides.push([`/xl/drawings/drawing${n}.xml`, `${CT}drawing+xml`]);
    files.push([`xl/drawings/_rels/drawing${n}.xml.rels`, rels(charts.map((c) => ({ id: c.rid, type: `${REL}/chart`, target: `../charts/chart${c.id}.xml` })))]);
    for (const c of charts) {
      files.push([`xl/charts/chart${c.id}.xml`, chartXml(wb, c.spec)]);
      overrides.push([`/xl/charts/chart${c.id}.xml`, `${CT}drawingml.chart+xml`]);
    }
  });

  const sheetsXml = wb.sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("");
  files.push(["xl/workbook.xml", XML_HEAD +
    `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><bookViews><workbookView activeTab="0"/></bookViews>` +
    `<sheets>${sheetsXml}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`]);
  const n = wb.sheets.length;
  files.push(["xl/_rels/workbook.xml.rels", rels([
    ...wb.sheets.map((_, i) => ({ id: `rId${i + 1}`, type: `${REL}/worksheet`, target: `worksheets/sheet${i + 1}.xml` })),
    { id: `rId${n + 1}`, type: `${REL}/styles`, target: "styles.xml" },
    { id: `rId${n + 2}`, type: `${REL}/sharedStrings`, target: "sharedStrings.xml" },
  ])]);
  files.push(["xl/styles.xml", stylesXml()]);
  // After every sheet, so it holds all of their strings.
  files.push(["xl/sharedStrings.xml", strings.xml()]);

  const created = (meta.created ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
  files.push(["docProps/core.xml", XML_HEAD +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${esc(meta.title)}</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created></cp:coreProperties>`]);
  files.push(["docProps/app.xml", XML_HEAD +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>rmalley.com TCO calculator</Application></Properties>']);
  files.push(["_rels/.rels", rels([
    { id: "rId1", type: `${REL}/officeDocument`, target: "xl/workbook.xml" },
    { id: "rId2", type: "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", target: "docProps/core.xml" },
    { id: "rId3", type: `${REL}/extended-properties`, target: "docProps/app.xml" },
  ])]);
  overrides.push(
    ["/xl/workbook.xml", `${CT}spreadsheetml.sheet.main+xml`],
    ["/xl/styles.xml", `${CT}spreadsheetml.styles+xml`],
    ["/xl/sharedStrings.xml", `${CT}spreadsheetml.sharedStrings+xml`],
    ["/docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml"],
    ["/docProps/app.xml", `${CT}extended-properties+xml`],
  );
  const contentTypes = XML_HEAD +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    overrides.map(([part, type]) => `<Override PartName="${part}" ContentType="${type}"/>`).join("") +
    "</Types>";

  return zip([["[Content_Types].xml", contentTypes], ...files], meta.created ?? new Date());
}

// ---------------------------------------------------------------------------
// Zip (stored, no compression)

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(entries: [string, string][], date: Date): Uint8Array {
  const enc = new TextEncoder();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + end.length);
  let p = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}
