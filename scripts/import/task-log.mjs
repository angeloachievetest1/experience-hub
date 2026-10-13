// Import of the Task Log (Operation Tasks) from the "Case Audits: E-learning"
// sheet's month tab, saved as CSV in data/import/task-log.csv (File › Download ›
// Comma-separated values, on the month's tab). Owner decision 2026-10-13: start
// with October 2026, when the audit set-up changed.
//
//   npm run import:tasklog              practice run (undone), report in data/import/report-task-log.md
//   npm run import:tasklog -- --write   the real import
//
// Re-running is safe: each sheet row is imported once (import_ref).
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { connect } from '../db.mjs';

const FILE = 'data/import/task-log.csv';
const REPORT = 'data/import/report-task-log.md';

// Sheet column → table column. The first-touch column has its title in the row above.
const COLUMNS = {
  'Date Closed': 'date_closed', 'Case Record Type': 'record_type', 'Manager': 'manager', 'Subject': 'subject',
  'Type': 'case_type', 'Account Name': 'customer_name', 'Case Number': 'case_link',
  'Date/Time Opened': 'opened_at', 'Date/Time Closed': 'closed_at', 'Handled by': 'handled_by',
  'First touch timestamp': 'first_touch_at', 'No Error': 'no_error', 'Error 1': 'error_type',
  'Error 1 Category': 'error_category', 'Auditor': 'auditor', 'Call Outs': 'call_outs',
};
const LISTS = {
  record_type: 'qa_task_record_type', case_type: 'qa_task_type', manager: 'qa_task_person', handled_by: 'qa_task_person',
  error_type: 'qa_task_error', error_category: 'qa_task_error_category', auditor: 'qa_task_auditor',
};

// Plain CSV reader (quoted fields, doubled quotes, line breaks inside quotes).
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (s) => (s ?? '').replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim();
const pad = (n) => String(n).padStart(2, '0');

// "9/30/2026" → "2026-09-30"
function toDate(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  return m ? `${m[3]}-${pad(m[1])}-${pad(m[2])}` : null;
}

// "9/28/2026 2:13 PM" (or "9/28/2026 14:13:00") → "2026-09-28T14:13"
function toDateTime(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?$/i.exec(s);
  if (!m) return null;
  let h = Number(m[4]);
  if (m[6]) h = (h % 12) + (m[6].toUpperCase() === 'PM' ? 12 : 0);
  return `${m[3]}-${pad(m[1])}-${pad(m[2])}T${pad(h)}:${m[5]}`;
}

// Turns the sheet rows into Task Log records, plus notes for the report.
export function readTaskLog(text) {
  const rows = parseCsv(text);
  const top = rows[0] ?? [];
  const head = (rows[1] ?? []).map((h, i) => clean(h) || clean(top[i]));
  const at = Object.fromEntries(Object.keys(COLUMNS).map((h) => [h, head.indexOf(h)]));
  const missing = Object.keys(COLUMNS).filter((h) => at[h] < 0);
  if (missing.includes('Case Number') || missing.includes('Date Closed')) {
    throw new Error(`This doesn't look like the Task Log tab: no ${missing.join(', ')} column.`);
  }

  const records = [];
  const problems = [];
  rows.slice(2).forEach((cells, i) => {
    const sheetRow = i + 3;
    const get = (h) => (at[h] >= 0 ? clean(cells[at[h]]) : '');
    if (!get('Case Number') && !get('Account Name')) return; // empty template row
    const r = {};
    for (const [h, col] of Object.entries(COLUMNS)) {
      const v = get(h);
      if (col === 'date_closed') r[col] = toDate(v);
      else if (col.endsWith('_at')) r[col] = toDateTime(v);
      else if (col === 'no_error') r[col] = /^true$/i.test(v);
      else r[col] = v || null;
      if (v && (col === 'date_closed' || col.endsWith('_at')) && !r[col]) problems.push(`Row ${sheetRow}: “${h}” isn’t a date the import can read.`);
    }
    if (r.case_link && !/^https?:\/\/\S+$/i.test(r.case_link)) { problems.push(`Row ${sheetRow}: the case link isn’t a web address; left blank.`); r.case_link = null; }
    if (r.no_error && r.error_type) problems.push(`Row ${sheetRow}: “No Error” is ticked and an error is filled in; both kept.`);
    // Every field counts: the sheet can hold the same case twice (e.g. a different
    // manager or first touch), and both rows are kept, as the sheet counts both.
    r.import_ref = 'task-log:' + createHash('sha256')
      .update(Object.values(COLUMNS).map((c) => String(r[c] ?? '')).join('|')).digest('hex').slice(0, 24);
    records.push({ ...r, sheetRow });
  });
  const sameCase = new Map();
  for (const r of records) {
    if (!r.case_link) continue;
    const key = [r.case_link, r.opened_at, r.closed_at].join('|');
    sameCase.set(key, [...(sameCase.get(key) ?? []), r.sheetRow]);
  }
  for (const rowsOfCase of sameCase.values()) {
    if (rowsOfCase.length > 1) problems.push(`Rows ${rowsOfCase.join(' and ')} are the same case (same link and times); all kept, as the sheet counts each. Delete extras in the Task Log if they're duplicates.`);
  }
  return { records, problems, missing };
}

// The Saturday on or after the date closed, as in the sheet.
function weekEnding(date) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + (6 - t.getUTCDay()));
  return t.toISOString().slice(0, 10);
}

// Writes the records in the current transaction. Returns the report lines.
export async function importTaskLog(client, records, problems) {
  const q = (sql, params) => client.query(sql, params);
  const options = (await q(`select list_key, value from public.option_values where list_key like 'qa\\_task\\_%' and is_active`)).rows;
  const onList = (key, v) => options.some((o) => o.list_key === key && o.value === v);

  const offList = new Map();
  for (const r of records) {
    for (const [col, key] of Object.entries(LISTS)) {
      if (r[col] && !onList(key, r[col])) offList.set(`${col}: ${r[col]}`, (offList.get(`${col}: ${r[col]}`) ?? 0) + 1);
    }
  }

  await q(`set local app.skip_audit = 'on'`); // an import isn't a person's change: keep it out of the Activity Log
  let added = 0;
  for (const { sheetRow: _row, ...r } of records) {
    const cols = Object.keys(r);
    const res = await q(
      `insert into public.qa_task_cases (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})
       on conflict (import_ref) do nothing`, cols.map((c) => r[c]));
    added += res.rowCount;
  }

  const weeks = new Map();
  for (const r of records) {
    if (!r.date_closed) continue;
    const w = weekEnding(r.date_closed);
    const s = weeks.get(w) ?? { cases: 0, ok: 0 };
    s.cases++; if (r.no_error) s.ok++;
    weeks.set(w, s);
  }
  return [
    `Rows read: ${records.length} · added now: ${added} · already there: ${records.length - added}`,
    '',
    '| Week ending | No error | Cases | Accuracy |', '|---|---|---|---|',
    ...[...weeks.entries()].sort().map(([w, s]) => `| ${w} | ${s.ok} | ${s.cases} | ${((s.ok / s.cases) * 100).toFixed(2)}% |`),
    '',
    offList.size ? 'Values not on the Case options lists (imported as typed):' : 'Every dropdown value is on its Case options list.',
    ...[...offList.entries()].map(([v, n]) => `- ${v} (${n})`),
    '',
    problems.length ? 'Notes:' : 'No problems found.',
    ...problems.map((p) => `- ${p}`),
  ];
}

// Run directly: npm run import:tasklog [-- --write]
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const write = process.argv.includes('--write');
  const { records, problems, missing } = readTaskLog(await readFile(FILE, 'utf8'));
  if (missing.length) problems.unshift(`Columns not found (left blank): ${missing.join(', ')}`);
  const client = await connect();
  try {
    await client.query('begin');
    const lines = await importTaskLog(client, records, problems);
    await client.query(write ? 'commit' : 'rollback');
    const title = `Task Log import (${write ? 'REAL IMPORT' : 'practice run, nothing saved'})`;
    await writeFile(REPORT, [`# ${title}`, '', ...lines, ''].join('\n'));
    console.log([title, ...lines].join('\n'));
  } catch (err) {
    await client.query('rollback').catch(() => {});
    console.error(`✖ ${err.message}\n  Nothing was saved.`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
