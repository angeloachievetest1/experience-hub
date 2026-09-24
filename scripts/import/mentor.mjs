// One-time import of the Mentor spreadsheet (data/import/mentor.xlsx).
//
//   npm run import:mentor              practice run (undone), report in data/import/report-mentor.md
//   npm run import:mentor -- --write   the real import; also removes the Mentor sample records
//
// Only visible tabs are used (owner rule). The sheet's "Year" column holds the
// complaint date; year and quarter are taken from it. Blank "Email / SMS
// Preview" cells stay blank (owner request, 2026-09-30).
import { writeFile } from 'node:fs/promises';
import { connect } from '../db.mjs';
import { Report, makeMatcher, openWorkbook, parseDate, readTab, readThreadedComments, simplify } from './lib.mjs';

const FILE = 'data/import/mentor.xlsx';
const REPORT = 'data/import/report-mentor.md';
const WRITE = process.argv.includes('--write');

const HEADERS = {
  date: ['year', 'date'],
  quarter: ['quarter'],
  customer: ['customer name'],
  case_type: ['case type'],
  type: ['complaint type'],
  sub_type: ['complaint sub type'],
  course: ['course name', 'course'],
  mentor: ['mentor name', 'mentor'],
  case: ['case'],
  validity: (h) => h.startsWith('complaint analysis'),
  email: (h) => h.startsWith('email sent'),
  preview: ['email / sms preview'],
  status: ['status'],
  closed_by: ['case closed by'],
};
const NOTE_FIELD = {
  mentor: 'mentor_id', course: 'course_id', case_type: 'case_type', type: 'complaint_type', sub_type: 'complaint_sub_type',
  validity: 'complaint_analysis', status: 'status', closed_by: 'case_closed_by', email: 'email_sent',
};
const VALIDITY = { 'valid': 'Valid', 'partially valid': 'Partially Valid', 'partially see feedback': 'Partially Valid', 'not valid': 'Not Valid', 'invalid': 'Not Valid' };
const STATUS = { 'new': 'New', 'in progress': 'In-progress', 'closed': 'Closed' };
const FIXES = { 'Customer Sucess': 'Customer Success' };
const COURSE_VARIANTS = {
  'Nursing Entrance Exam Preparation': 'Nursing Entrance Exam Prep',
  'Dental Entrance Exam Preparation': 'Dental Hygiene Entrance Exam Prep',
  'NCLEX - RN Next Gen': 'Next Gen NCLEX RN Prep',
  'NCLEX - LPN Next Gen': 'Next Gen NCLEX PN Prep',
  'Developmental Psychology': 'Human Growth and Development', // owner decision 2026-09-30
};
const EMPTY = new Set(['', '-', 'n/a', 'na', 'none']);
const isEmpty = (s) => EMPTY.has((s ?? '').trim().toLowerCase());
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const readableDate = (iso) => { const [y, m, d] = iso.split('-'); return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`; };

const report = new Report(`Mentor import report (${WRITE ? 'REAL IMPORT' : 'practice run — nothing saved'})`);
const client = await connect();
const q = (sql, params) => client.query(sql, params);

try {
  const wb = await openWorkbook(FILE);
  const comments = await readThreadedComments(FILE);
  const tabs = wb.worksheets.filter((ws) => ws.state === 'visible');
  const hidden = wb.worksheets.filter((ws) => ws.state !== 'visible').map((ws) => ws.name);

  const mentors = (await q('select id, full_name from public.mentors where is_active')).rows;
  const mentorId = new Map(mentors.map((m) => [m.full_name, m.id]));
  const matchMentor = makeMatcher(mentors.map((m) => m.full_name));
  const courses = (await q('select id, name from public.courses where is_active')).rows;
  const courseId = new Map(courses.map((c) => [c.name, c.id]));
  const matchCourse = makeMatcher(courses.map((c) => c.name), COURSE_VARIANTS);

  const records = [];
  const stats = [];
  const caseTypes = new Map();
  for (const ws of tabs) {
    const { rows, fieldOfColumn, missing } = readTab(ws, HEADERS);
    if (missing.includes('mentor') || missing.includes('customer')) {
      stats.push(`- **${ws.name}**: skipped (no Mentor Name / Customer Name columns)`);
      continue;
    }
    const tabComments = comments.get(ws.name) ?? new Map();
    let imported = 0;
    let skipped = 0;
    for (const r of rows) {
      const where = `${ws.name} row ${r.rowNumber}`;
      if (['customer', 'case', 'mentor', 'course'].every((f) => isEmpty(r.get(f)))) { skipped++; continue; }
      const noteMap = {};

      const date = parseDate(r.raw('date'));
      if (!date) report.problem('Rows with no usable date (imported without a date)', `${where}${r.get('date') ? `: “${r.get('date')}”` : ''}`);
      const quarterFromDate = date ? `Q${Math.ceil(Number(date.slice(5, 7)) / 3)}` : null;
      const sheetQuarter = r.get('quarter').toUpperCase() || null;
      if (sheetQuarter && quarterFromDate && sheetQuarter !== quarterFromDate) {
        report.problem('Quarter in the sheet doesn’t match the date (the date’s quarter is used)', `${where}: sheet ${sheetQuarter}, date ${date} is ${quarterFromDate}`);
      }

      const rec = {
        case_date: date,
        year: date ? Number(date.slice(0, 4)) : null,
        quarter: quarterFromDate ?? (/^Q[1-4]$/.test(sheetQuarter ?? '') ? sheetQuarter : null),
        customer_name: r.get('customer') || null,
        case_type: r.get('case_type') || null,
        mentor_id: null, course_id: null,
        complaint_type: r.get('type') || null,
        complaint_sub_type: r.get('sub_type') || null,
        complaint_analysis: null, status: null, case_closed_by: null, email_sent: null,
        email_sms_preview: isEmpty(r.get('preview')) ? null : r.get('preview'),
        case_link: null,
        import_ref: `mentor.xlsx / ${ws.name} / row ${r.rowNumber}`,
      };

      const m = matchMentor(r.get('mentor'));
      if (m.name) { rec.mentor_id = mentorId.get(m.name); if (m.how !== 'exact') report.change('Mentor', r.get('mentor'), m.name); }
      else if (!isEmpty(r.get('mentor'))) report.problem('Mentors not on the mentor list (left blank)', `${where}: “${r.get('mentor')}”`);

      const courseRaw = r.get('course');
      if (!isEmpty(courseRaw)) {
        const c = matchCourse(courseRaw);
        if (c.name) { rec.course_id = courseId.get(c.name); report.change('Course', courseRaw, c.name); }
        else report.problem('Courses not on the course list (left blank)', `${where}: “${courseRaw}”`);
      }

      const link = r.link('case') ?? (/^https?:\/\//i.test(r.get('case')) ? r.get('case') : null);
      rec.case_link = link?.trim() ?? null;
      if (!link && !isEmpty(r.get('case'))) report.problem('Case cells without a link (left blank)', `${where}`);

      const v = r.get('validity');
      if (!isEmpty(v)) {
        rec.complaint_analysis = VALIDITY[simplify(v)] ?? null;
        if (rec.complaint_analysis) report.change('Validity', v, rec.complaint_analysis);
        else report.problem('Validity values not recognised (left blank)', `${where}: “${v}”`);
      }
      const s = r.get('status');
      if (!isEmpty(s)) {
        rec.status = STATUS[simplify(s)] ?? s;
        report.change('Status', s, rec.status);
      }
      const cb = r.get('closed_by');
      if (!isEmpty(cb)) { rec.case_closed_by = FIXES[cb] ?? cb; report.change('Case closed by', cb, rec.case_closed_by); }
      const e = r.get('email').toLowerCase();
      rec.email_sent = e === 'yes' ? true : e === 'no' ? false : null;

      if (rec.case_type) caseTypes.set(rec.case_type, (caseTypes.get(rec.case_type) ?? 0) + 1);

      for (const [ref, list] of tabComments) {
        const mm = ref.match(/^([A-Z]+)(\d+)$/);
        if (!mm || Number(mm[2]) !== r.rowNumber) continue;
        const field = NOTE_FIELD[fieldOfColumn[mm[1]]] ?? 'status';
        const text = list.map((x) => `${x.text} — ${x.author}${x.date ? `, ${readableDate(x.date)}` : ''}`).join('\n');
        noteMap[field] = noteMap[field] ? `${noteMap[field]}\n${text}` : text;
      }
      rec.field_notes = noteMap;
      records.push(rec);
      imported++;
    }
    stats.push(`- **${ws.name}** → ${imported} Mentor cases imported, ${skipped} blank rows skipped`);
  }

  report.section('Summary', [
    `File: ${FILE}`,
    `Hidden tabs ignored: ${hidden.length ? hidden.join(', ') : 'none'}`,
    '',
    ...stats,
    '',
    `- **${records.length} cases** in total`,
    `- Blank “Email / SMS Preview” cells stay blank (${records.filter((x) => !x.email_sms_preview).length} cases)`,
    `- Case type kept (owner decision): ${[...caseTypes].map(([k, n]) => `“${k}” ×${n}`).join(', ') || 'none'}`,
  ]);

  // --- Database (always in a transaction; kept only with --write) ------------
  await q('begin');
  await q(`set local app.skip_audit = 'on'`);
  const removed = await q(`delete from public.mentor_cases where import_ref like 'mentor.xlsx / %'`);
  const samples = await q('delete from public.mentor_cases where is_sample');
  const cols = ['case_date', 'year', 'quarter', 'customer_name', 'case_type', 'mentor_id', 'course_id', 'complaint_type', 'complaint_sub_type',
    'complaint_analysis', 'status', 'case_closed_by', 'email_sent', 'email_sms_preview', 'case_link', 'field_notes', 'import_ref'];
  for (const rec of records) {
    await q(`insert into public.mentor_cases (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
      cols.map((c) => (c === 'field_notes' ? JSON.stringify(rec[c]) : rec[c])));
  }

  await q('reset app.skip_audit');
  await q(`insert into public.activity_log (section, action, record_type, record_label, summary)
           values ('mentor', 'Imported data', 'import', 'mentor.xlsx', $1)`,
    [`Imported ${records.length} Mentor cases from the spreadsheet${samples.rowCount ? ` and removed ${samples.rowCount} sample cases` : ''}.`]);

  const summary = `${records.length} cases${removed.rowCount ? ` (replacing ${removed.rowCount} from an earlier import)` : ''}; ${samples.rowCount} sample cases removed.`;
  if (WRITE) {
    await q('commit');
    report.section('Result', [`**Saved.** ${summary}`]);
  } else {
    await q('rollback');
    report.section('Result', [`**Practice run: nothing was saved.** The database accepted every row. With --write: ${summary}`]);
  }
} catch (err) {
  await q('rollback').catch(() => {});
  report.section('Result', [`**Stopped with an error, nothing was saved:** ${err.message}`]);
  process.exitCode = 1;
} finally {
  await client.end();
  await writeFile(REPORT, report.toMarkdown(), 'utf8');
  console.log(report.toMarkdown());
}
