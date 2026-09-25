// Shared helpers for the one-time spreadsheet import.
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Reading workbooks
// ---------------------------------------------------------------------------

// Cell value → plain text (handles links, rich text, formulas, dates).
export function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return isoDate(v);
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('').trim();
    if (v.text !== undefined) return cellText(v.text);
    if (v.result !== undefined) return cellText(v.result);
    if (v.error) return '';
    return '';
  }
  return String(v).replace(/\s+/g, ' ').trim();
}

export function cellLink(v) {
  return v && typeof v === 'object' && typeof v.hyperlink === 'string' ? v.hyperlink.trim() : null;
}

export const isoDate = (d) => d.toISOString().slice(0, 10);

// Google Sheets comments are "threaded comments", which exceljs can't read;
// read them straight from the file. Returns Map(tabName → Map(cellRef → [comment])).
export async function readThreadedComments(file) {
  const zip = await JSZip.loadAsync(await readFile(file));
  const text = async (p) => (await zip.file(p)?.async('string')) ?? '';
  const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

  const people = new Map();
  for (const m of (await text('xl/persons/person.xml')).matchAll(/<x18tc:person ([^>]*)\/?>/g)) {
    const id = m[1].match(/id="([^"]+)"/)?.[1];
    const name = m[1].match(/displayName="([^"]*)"/)?.[1];
    if (id) people.set(id, unescape(name ?? ''));
  }

  const wbXml = await text('xl/workbook.xml');
  const wbRels = await text('xl/_rels/workbook.xml.rels');
  const result = new Map();
  for (const s of wbXml.matchAll(/<sheet ([^>]*)\/>/g)) {
    const name = unescape(s[1].match(/name="([^"]+)"/)[1]);
    const rid = s[1].match(/r:id="([^"]+)"/)[1];
    const rel = [...wbRels.matchAll(/<Relationship ([^>]*)\/>/g)].map((r) => r[1]).find((r) => r.includes(`Id="${rid}"`));
    const target = rel?.match(/Target="([^"]+)"/)?.[1];
    if (!target) continue;
    const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    const relXml = await text(sheetPath.replace('worksheets/', 'worksheets/_rels/') + '.rels');
    const tc = relXml.match(/Target="([^"]*threadedComment[^"]*)"/)?.[1];
    if (!tc) continue;
    const tcPath = tc.startsWith('/') ? tc.slice(1) : `xl/${tc.replace(/^\.\.\//, '')}`;
    const byCell = new Map();
    for (const m of (await text(tcPath)).matchAll(/<x18tc:threadedComment ([^>]*)>([\s\S]*?)<\/x18tc:threadedComment>/g)) {
      const ref = m[1].match(/ref="([^"]+)"/)?.[1];
      const when = m[1].match(/dT="([^"]+)"/)?.[1];
      const person = m[1].match(/personId="([^"]+)"/)?.[1];
      const body = m[2].match(/<x18tc:text[^>]*>([\s\S]*?)<\/x18tc:text>/)?.[1];
      if (!ref || !body) continue;
      const list = byCell.get(ref) ?? [];
      list.push({ text: unescape(body).trim(), author: people.get(person) || 'Unknown', date: when?.slice(0, 10) ?? null });
      byCell.set(ref, list);
    }
    result.set(name, byCell);
  }
  return result;
}

export async function openWorkbook(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  return wb;
}

export function columnLetter(n) {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// Rows of a tab as { rowNumber, get(field), link(field), cellOf(field), columnOf(field) },
// with columns found by header name (so reordered columns still work).
export function readTab(ws, headerAliases, headerRow = 1) {
  const norm = (h) => h.toLowerCase().replace(/\s+/g, ' ').trim();
  const colOf = {};
  const headers = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    const h = norm(cellText(ws.getRow(headerRow).getCell(c).value));
    headers.push(h);
    for (const [field, test] of Object.entries(headerAliases)) {
      if (colOf[field]) continue;
      if (typeof test === 'function' ? test(h) : test.includes(h)) colOf[field] = c;
    }
  }
  const missing = Object.keys(headerAliases).filter((f) => !colOf[f]);
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n <= headerRow) return;
    rows.push({
      rowNumber: n,
      raw: (field) => (colOf[field] ? row.getCell(colOf[field]).value : null),
      get: (field) => (colOf[field] ? cellText(row.getCell(colOf[field]).value) : ''),
      link: (field) => (colOf[field] ? cellLink(row.getCell(colOf[field]).value) : null),
      cell: (c) => row.getCell(c).value,
    });
  });
  const fieldOfColumn = Object.fromEntries(Object.entries(colOf).map(([f, c]) => [columnLetter(c), f]));
  return { rows, colOf, missing, fieldOfColumn, headers };
}

// ---------------------------------------------------------------------------
// Cleaning values
// ---------------------------------------------------------------------------
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// Returns YYYY-MM-DD, or null when missing or impossible (e.g. a mistyped year).
export function parseDate(raw) {
  let d = parseDateLoose(raw);
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  let [y, m, day] = d.split('-').map(Number);
  // "2025-26-02" = 26 Feb 2025 typed day-before-month: swap when the month can't be a month.
  if (m > 12 && day <= 12) [m, day] = [day, m];
  d = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const real = new Date(Date.UTC(y, m - 1, day));
  const valid = real.getUTCFullYear() === y && real.getUTCMonth() === m - 1 && real.getUTCDate() === day;
  return valid && y >= 2000 && y <= 2100 ? d : null;
}

// A year typed with an extra digit, e.g. 20226 → 2026 (owner-approved fix).
export function fixTypedYear(year) {
  const s = String(year);
  return s.length === 5 && s.startsWith('20') ? Number(`20${s.slice(3)}`) : null;
}

function parseDateLoose(raw) {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    const y = raw.getUTCFullYear();
    if (y <= 9999) return isoDate(raw);
    const fixed = fixTypedYear(y);
    const mm = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(raw.getUTCDate()).padStart(2, '0');
    return fixed ? `${fixed}-${mm}-${dd}` : null;
  }
  if (typeof raw === 'number' && raw > 20000 && raw < 80000) {
    return isoDate(new Date(Date.UTC(1899, 11, 30) + raw * 86400000)); // Excel serial date
  }
  const s = cellText(raw);
  if (!s) return null;
  // MM/DD/YYYY, also tolerating typos like "4/11//2026" and "7/202026" (= 7/20/2026)
  let m = s.match(/^(\d{1,2})\s*\/+\s*(\d{1,2})\s*\/*\s*(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

export const isMonthLabel = (s) => MONTHS.includes(s.toLowerCase()) || /^febuary$/i.test(s) || /^\d{4}$/.test(s);

// Levenshtein distance, for "Daniel Wolf" vs "Daniel Wolff".
export function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

export const simplify = (s) => s.toLowerCase().replace(/^dr\.?\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Matches a name against a list: exact, known variant, or a close spelling.
export function makeMatcher(names, variants = {}, maxDistance = 2) {
  const bySimple = new Map(names.map((n) => [simplify(n), n]));
  const variantMap = new Map(Object.entries(variants).map(([k, v]) => [simplify(k), v]));
  return (raw) => {
    const s = simplify(raw);
    if (!s) return { name: null, how: 'empty' };
    if (bySimple.has(s)) return { name: bySimple.get(s), how: bySimple.get(s) === raw.trim() ? 'exact' : 'spelling' };
    if (variantMap.has(s)) return { name: variantMap.get(s), how: 'variant' };
    let best = null;
    for (const [simple, name] of bySimple) {
      const d = distance(s, simple);
      if (d <= maxDistance && s.length > 5 && (!best || d < best.d)) best = { name, d };
    }
    return best ? { name: best.name, how: 'spelling' } : { name: null, how: 'unmatched' };
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
export class Report {
  constructor(title) {
    this.title = title;
    this.sections = [];
    this.changes = new Map();     // "Field: from → to" → count
    this.problems = new Map();    // heading → [lines]
  }
  change(field, from, to) {
    if (from === to) return;
    const k = `${field}: “${from}” → “${to}”`;
    this.changes.set(k, (this.changes.get(k) ?? 0) + 1);
  }
  problem(heading, line) {
    const list = this.problems.get(heading) ?? [];
    list.push(line);
    this.problems.set(heading, list);
  }
  section(heading, lines) { this.sections.push({ heading, lines }); }
  toMarkdown() {
    const out = [`# ${this.title}`, ''];
    for (const s of this.sections) out.push(`## ${s.heading}`, '', ...s.lines, '');
    out.push('## Values cleaned up', '');
    if (!this.changes.size) out.push('None.', '');
    for (const [k, n] of [...this.changes.entries()].sort()) out.push(`- ${k} (${n}×)`);
    out.push('');
    out.push('## Needs your attention', '');
    if (!this.problems.size) out.push('Nothing. Everything matched.', '');
    for (const [h, lines] of this.problems) {
      out.push(`### ${h} (${lines.length})`, '', ...lines.slice(0, 200).map((l) => `- ${l}`));
      if (lines.length > 200) out.push(`- …and ${lines.length - 200} more`);
      out.push('');
    }
    return out.join('\n');
  }
}
