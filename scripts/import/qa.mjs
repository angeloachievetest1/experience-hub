// One-time import of the Quality Analyst spreadsheet (data/import/qa.xlsx).
//
//   npm run import:qa            practice run: does everything inside a
//                                transaction, then undoes it, and writes a
//                                report to data/import/report-qa.md
//   npm run import:qa -- --write  the real import (replaces rows from an
//                                earlier run of this import only)
//
// Owner decisions (2026-09-30): only the visible data tabs are imported
// (Instructor Complaints, Course Complaints, Low Survey Scores, Returned Cases);
// hidden tabs are ignored. "Instructor Trends" is used only as a cross-check.
//
// Cleanup rules (brief section 5 + owner decisions):
//   - the instructor list is built from the names in these tabs; close
//     spellings are unified to the most common one ("Tracey Stout" → "Tracey Stoute")
//   - course names matched to the course list (known variants + close spellings)
//   - validity: "Partially-See Feedback" → Partially Valid, "Invalid" → Not Valid
//   - survey types: FCS→AFCS, ECF→ECS, MCF→MCS, PEF→PES, Post Tutoring→PTS
//   - Google Sheets cell comments → notes on the matching field ("+ Add note"),
//     or into the case's Notes when the column has no matching field
//   - anything that can't be matched is kept in Notes and listed in the report
import { writeFile } from 'node:fs/promises';
import { connect } from '../db.mjs';
import {
  Report, cellText, isMonthLabel, makeMatcher, openWorkbook, parseDate, readTab, readThreadedComments, simplify,
} from './lib.mjs';

const FILE = 'data/import/qa.xlsx';
const REPORT = 'data/import/report-qa.md';
const WRITE = process.argv.includes('--write');

const TABS = [
  { tab: 'Instructor Complaints', source: 'Instructor' },
  { tab: 'Course Complaints', source: 'Course' },
  { tab: 'Low Survey Scores', source: 'Survey' },
  { tab: 'Returned Cases', source: 'Returned' },
];

const HEADERS = {
  date: ['date', 'date created'],
  course: ['course', 'course name'],
  instructor: ['instructor'],
  customer: ['customer name'],
  case: ['case'],
  analyst: ['complaint analyst'],
  types: ['complaint type', 'complaint sub type'],
  category: ['complaint category'],
  end_date: ['course end date'],
  attendance: ['attendance'],
  participation: ['participation'],
  moodle: ['moodle'],
  validity: (h) => h.startsWith('complaint analysis'),
  resolution: ['case resolution summary'],
  email: (h) => h.startsWith('email sent'),
  sms: ['sms sent'],
  call: ['call'],
  reached: ['reached/not reached'],
  closed_by: ['case closed by'],
  survey_type: ['survey'],
  survey_id: ['survey link'],
  rating: ['rating given'],
  comment: ['comment'],
  concern: ['reached - concern/comment'],
  reason: ['reason type'],
  reassign: ['rassign reason', 'reassign reason'],
  notes: ['notes'],
};

// Sheet column → case field that shows a "Notes" hover in the app.
const NOTE_FIELD = {
  course: 'course_id', instructor: 'instructor_id', category: 'category', validity: 'validity', resolution: 'resolution',
  closed_by: 'case_closed_by', email: 'followup_email', sms: 'followup_sms', call: 'followup_call',
  reached: 'customer_reached', survey_type: 'survey_type', reason: 'reason_type', rating: 'rating', reassign: 'reassign_reason',
};
const LABEL = {
  date: 'Date', attendance: 'Attendance', participation: 'Participation', moodle: 'Moodle', types: 'Complaint type',
  end_date: 'Course end date', customer: 'Customer', case: 'Case', analyst: 'Analyst', comment: 'Customer comment',
  concern: 'Reached / concern', survey_id: 'Survey ID', notes: 'Notes', course: 'Course', audit: 'Audit link',
};

const VALIDITY = { 'valid': 'Valid', 'partially valid': 'Partially Valid', 'partially see feedback': 'Partially Valid', 'not valid': 'Not Valid', 'invalid': 'Not Valid', 'n a': 'N/A', 'na': 'N/A' };
const SURVEY = { 'fcs': 'AFCS', 'afcs': 'AFCS', 'ecf': 'ECS', 'ecs': 'ECS', 'mcf': 'MCS', 'mcs': 'MCS', 'pef': 'PES', 'pes': 'PES', 'post tutoring': 'PTS', 'pts': 'PTS' };
const FIXES = {
  'N/A recently added': 'N/A', 'Customer Sucess': 'Customer Success', 'Perference': 'Preference', 'Backgroud Noise': 'Background Noise',
  'Good Comment/ Low Score - Mistake': 'Good Comment/Low Score - Mistake', 'Dupilicate': 'Duplicate', 'In progress': 'In Progress',
  'The declined all resolutions offered': 'Customer declined all resolutions offered',
};
const COURSE_VARIANTS = {
  'Nursing Entrance Exam Preparation': 'Nursing Entrance Exam Prep',
  'NCLEX - RN Next Gen': 'Next Gen NCLEX RN Prep',
  'NCLEX - LPN Next Gen': 'Next Gen NCLEX PN Prep',
  'NCLEX - PN Next Gen': 'Next Gen NCLEX PN Prep',
  'Dental Entrance Exam Preparation': 'Dental Hygiene Entrance Exam Prep',
  'Allegany College of Maryland': 'Allegany College of Maryland Entrance Exam Prep',
  'Allegany College of Maryland Entrance Exam Preparation': 'Allegany College of Maryland Entrance Exam Prep',
};
const EMPTY_WORDS = new Set(['', '-', 'n/a', 'na', 'none', 'not specified', '#value!']);
const isEmpty = (s) => EMPTY_WORDS.has(s.trim().toLowerCase());
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const readableDate = (iso) => { const [y, m, d] = iso.split('-'); return `${Number(d)} ${MONTH_NAMES[Number(m) - 1]} ${y}`; };
const fix = (s) => FIXES[s] ?? s;

const report = new Report(`Quality Analyst import report (${WRITE ? 'REAL IMPORT' : 'practice run — nothing saved'})`);
const client = await connect();
const q = (sql, params) => client.query(sql, params);

try {
  const wb = await openWorkbook(FILE);
  const comments = await readThreadedComments(FILE);

  // --- Reference lists ---------------------------------------------------------
  // Instructor list: every name used in the imported tabs. Close spellings are
  // grouped and the most common spelling wins.
  const nameCounts = new Map();
  for (const { tab } of TABS) {
    const ws = wb.getWorksheet(tab);
    if (!ws) continue;
    for (const r of readTab(ws, HEADERS).rows) {
      for (const part of r.get('instructor').split(/\s*,\s*/)) {
        const name = part.replace(/^dr\.?\s+/i, '').trim();
        if (!isEmpty(name)) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
      }
    }
  }
  const masterNames = [];
  for (const [name] of [...nameCounts.entries()].sort((a, b) => b[1] - a[1])) {
    if (!makeMatcher(masterNames)(name).name) masterNames.push(name);
  }
  masterNames.sort();
  const courses = (await q('select id, name from public.courses where is_active')).rows;
  const courseId = new Map(courses.map((c) => [c.name, c.id]));
  const matchCourse = makeMatcher(courses.map((c) => c.name), COURSE_VARIANTS);
  const matchInstructor = makeMatcher(masterNames);
  const optionRows = (await q(`select list_key, value from public.option_values where list_key like 'qa\\_%'`)).rows;
  const known = new Set(optionRows.map((o) => `${o.list_key}|${o.value}`));
  const newOptions = new Map(); // "list|value" → count
  const useOption = (list, value) => {
    if (!value || value.length > 60) return;
    const k = `${list}|${value}`;
    if (!known.has(k)) newOptions.set(k, (newOptions.get(k) ?? 0) + 1);
  };

  const instructorSpellings = new Map(); // master name → Set(sheet spellings)
  const unmatchedInstructors = new Map();
  const unmatchedCourses = new Map();
  const records = [];
  const tabStats = [];
  let fieldNotes = 0;
  let caseNotes = 0;

  const instructor = (raw, where, notes) => {
    const parts = raw.split(/\s*,\s*/).filter((p) => !isEmpty(p));
    if (!parts.length) return null;
    if (parts.length > 1) notes.push(`Instructors in sheet: ${raw}`);
    const m = matchInstructor(parts[0]);
    if (m.name) {
      if (m.how !== 'exact') {
        report.change('Instructor', parts[0], m.name);
        instructorSpellings.set(m.name, (instructorSpellings.get(m.name) ?? new Set()).add(parts[0]));
      }
      return m.name;
    }
    notes.push(`Instructor in sheet: ${parts[0]}`);
    const list = unmatchedInstructors.get(parts[0]) ?? [];
    list.push(where);
    unmatchedInstructors.set(parts[0], list);
    return null;
  };

  const course = (raw, where, notes) => {
    if (isEmpty(raw)) return null;
    const m = matchCourse(raw);
    if (m.name) {
      if (m.how !== 'exact') report.change('Course', raw, m.name);
      return m.name;
    }
    notes.push(`Course in sheet (not on the course list): ${raw}`);
    const list = unmatchedCourses.get(raw) ?? [];
    list.push(where);
    unmatchedCourses.set(raw, list);
    return null;
  };

  const pct = (raw, field, where) => {
    const s = cellText(raw).replace(/%/g, '').trim(); // "80%%" → "80", "-%" → "-"
    if (isEmpty(s)) return null;
    const n = typeof raw === 'number' ? raw : Number(s);
    if (!Number.isFinite(n)) { report.problem('Values that could not be read (left blank)', `${where}: ${field} “${s}”`); return null; }
    const v = n <= 1.5 ? Math.round(n * 10000) / 100 : n;
    return v >= 0 && v <= 100 ? v : null;
  };

  // --- Rows ------------------------------------------------------------------
  for (const { tab, source } of TABS) {
    const ws = wb.getWorksheet(tab);
    if (!ws) { report.problem('Missing tabs', tab); continue; }
    const { rows, fieldOfColumn, headers } = readTab(ws, HEADERS);
    const auditCols = headers.map((h, i) => (h === 'audit link' || h === 'audit' ? i + 1 : 0)).filter(Boolean);
    const tabComments = comments.get(tab) ?? new Map();
    let imported = 0;
    let skipped = 0;

    for (const r of rows) {
      const where = `${tab} row ${r.rowNumber}`;
      const meaningful = ['customer', 'case', 'course', 'instructor', 'survey_id'].some((f) => !isEmpty(r.get(f)));
      if (!meaningful) { skipped++; continue; }
      const notes = [];
      const noteMap = {};

      const date = parseDate(r.raw('date'));
      if (date && typeof r.raw('date') === 'string') report.change('Date typed as text', r.get('date'), date);
      if (date && r.raw('date') instanceof Date && r.raw('date').getUTCFullYear() > 9999) {
        report.change(`Date with a mistyped year (${where})`, `year ${r.raw('date').getUTCFullYear()}`, date);
      }
      if (!date) {
        const d = r.get('date');
        report.problem('Rows with no usable date (imported without a date)', `${where}${d && !isMonthLabel(d) ? `: “${d}”` : ''}`);
      }

      const rec = {
        source, case_date: date, customer_name: r.get('customer') || null,
        course_id: null, instructor_id: null, case_link: null,
        analyst: r.get('analyst') || null, category: r.get('category') || null, complaint_types: [],
        validity: null, followup_email: null, followup_sms: null, followup_call: null, customer_reached: null,
        resolution: null, attendance_pct: null, participation_pct: null, moodle_pct: null,
        course_end_date: null, case_closed_by: null,
        survey_type: null, survey_id: null, rating: null, customer_comment: null, reason_type: null, reassign_reason: null,
        import_ref: `qa.xlsx / ${tab} / row ${r.rowNumber}`,
      };

      const endRaw = r.raw('end_date');
      rec.course_end_date = parseDate(endRaw);
      if (!rec.course_end_date && !isEmpty(cellText(endRaw))) {
        const shown = endRaw instanceof Date ? `year ${endRaw.getUTCFullYear()}` : `“${cellText(endRaw)}”`;
        report.problem('Values that could not be read (left blank)', `${where}: Course end date ${shown}`);
        notes.push(`Course end date in sheet: ${endRaw instanceof Date ? endRaw.toISOString() : cellText(endRaw)}`);
      }

      // Courses (Returned cases can list several).
      if (source === 'Returned') {
        rec.course_names = r.get('course').split(/\s*,\s*/).map((c) => course(c, where, notes)).filter(Boolean);
      } else {
        rec.course_name = course(r.get('course'), where, notes);
      }
      rec.instructor_name = instructor(r.get('instructor'), where, notes);

      // Case link: a web address, or a case number kept in Notes.
      const caseText = r.get('case');
      const caseLink = r.link('case') ?? (/^https?:\/\//i.test(caseText) ? caseText : null);
      if (caseLink) rec.case_link = caseLink.trim();
      else if (!isEmpty(caseText)) notes.push(`Case: ${caseText}`);

      // Validity
      const v = r.get('validity');
      if (!isEmpty(v) || v === 'N/A') {
        rec.validity = VALIDITY[simplify(v)] ?? null;
        if (rec.validity) report.change('Validity', v, rec.validity);
        else if (v) { notes.push(`Validity in sheet: ${v}`); report.problem('Validity values not recognised', `${where}: “${v}”`); }
      }

      // Complaint types (split "Pace, Teaching Style")
      const typeList = source === 'Instructor' ? 'qa_type_instructor' : source === 'Course' ? 'qa_type_course' : source === 'Returned' ? 'qa_returned_type' : null;
      if (typeList) {
        rec.complaint_types = [...new Set(r.get('types').split(/\s*,\s*/).map((t) => t.trim()).filter((t) => !isEmpty(t)).map((t) => {
          const f = fix(t);
          report.change('Complaint type', t, f);
          useOption(typeList, f);
          return f;
        }))];
      }
      if (rec.category) useOption(source === 'Course' ? 'qa_category_course' : 'qa_category_instructor', rec.category);

      // Follow-up and outcome
      for (const [field, col, list] of [['followup_email', 'email', 'qa_followup_sent'], ['followup_sms', 'sms', 'qa_followup_sent'],
        ['followup_call', 'call', 'qa_followup_sent'], ['customer_reached', 'reached', 'qa_reached'], ['case_closed_by', 'closed_by', 'qa_case_closed_by']]) {
        const raw = r.get(col);
        if (!raw) continue;
        const val = fix(raw);
        report.change(LABEL[col] ?? col, raw, val);
        rec[field] = val;
        useOption(list, val);
      }
      const res = r.get('resolution');
      if (res) {
        if (res.length > 60) notes.push(`Case resolution summary: ${res}`);
        else { rec.resolution = fix(res); report.change('Resolution', res, rec.resolution); useOption('qa_resolution', rec.resolution); }
      }
      if (source !== 'Instructor') {
        rec.attendance_pct = null;
      } else {
        rec.attendance_pct = pct(r.raw('attendance'), 'Attendance', where);
        rec.participation_pct = pct(r.raw('participation'), 'Participation', where);
        rec.moodle_pct = pct(r.raw('moodle'), 'Moodle', where);
      }

      // Survey fields
      if (source === 'Survey') {
        const st = r.get('survey_type');
        rec.survey_type = SURVEY[simplify(st)] ?? (st || null);
        if (st) report.change('Survey type', st, rec.survey_type);
        if (st && !SURVEY[simplify(st)]) report.problem('Survey types not recognised', `${where}: “${st}”`);
        rec.survey_id = r.get('survey_id') || null;
        const surveyUrl = r.link('survey_id');
        if (surveyUrl) notes.push(`Survey link: ${surveyUrl}`);
        const rating = Number(r.get('rating'));
        rec.rating = Number.isInteger(rating) && rating >= 1 && rating <= 6 ? rating : null;
        const comment = r.get('comment');
        rec.customer_comment = isEmpty(comment) ? null : comment;
        const reason = r.get('reason');
        if (reason) { rec.reason_type = fix(reason); report.change('Reason type', reason, rec.reason_type); useOption('qa_survey_reason', rec.reason_type); }
        const concern = r.get('concern');
        if (!isEmpty(concern)) notes.push(`Reached / concern: ${concern}`);
      }

      if (source === 'Returned') {
        const reason = r.get('reassign');
        if (reason) { rec.reassign_reason = reason; useOption('qa_reassign_reason', reason); }
        const extra = r.get('notes');
        if (extra) notes.push(extra);
      }

      for (const c of auditCols) {
        const t = cellText(r.cell(c));
        const link = r.cell(c)?.hyperlink;
        if (t && !isEmpty(t)) notes.push(`Audit: ${t}${link ? ` (${link})` : ''}`);
      }

      // Cell comments → field notes, or Notes when the column has no field.
      for (const [ref, list] of tabComments) {
        const m = ref.match(/^([A-Z]+)(\d+)$/);
        if (!m || Number(m[2]) !== r.rowNumber) continue;
        const text = list.map((x) => `${x.text} — ${x.author}${x.date ? `, ${readableDate(x.date)}` : ''}`).join('\n');
        const col = fieldOfColumn[m[1]];
        const field = col && NOTE_FIELD[col];
        if (field && !(source === 'Returned' && col === 'course')) {
          noteMap[field] = noteMap[field] ? `${noteMap[field]}\n${text}` : text;
          fieldNotes += list.length;
        } else {
          notes.push(`Comment on ${LABEL[col] ?? `column ${m[1]}`}: ${text}`);
          caseNotes += list.length;
        }
      }

      rec.notes = notes.length ? notes.join('\n') : null;
      rec.field_notes = noteMap;
      records.push(rec);
      imported++;
    }
    tabStats.push(`- **${tab}** → ${source} cases: ${imported} rows imported, ${skipped} blank or month-heading rows skipped`);
  }

  // Duplicate survey IDs are worth a look.
  const seen = new Map();
  for (const r of records.filter((x) => x.survey_id)) seen.set(r.survey_id, [...(seen.get(r.survey_id) ?? []), r.import_ref]);
  for (const [id, refs] of seen) if (refs.length > 1) report.problem('Survey IDs that appear more than once', `${id}: ${refs.join('; ')}`);

  for (const [name, wheres] of unmatchedInstructors) {
    report.problem('Instructor names that could not be read (left blank, name kept in Notes)', `“${name}” — ${wheres.length} row(s), e.g. ${wheres.slice(0, 3).join('; ')}`);
  }

  // Cross-check against the "Instructor Trends" tab (a tally kept in the sheet).
  let trendCheck = null;
  const trends = wb.getWorksheet('Instructor Trends');
  if (trends) {
    let totalCol = 0;
    for (let c = 1; c <= trends.columnCount; c++) if (cellText(trends.getRow(2).getCell(c).value) === 'Grand Total') totalCol = c;
    const sheetTotals = [];
    trends.eachRow((row) => {
      const m = cellText(row.getCell(1).value).match(/^(.+) Total$/);
      if (m && totalCol && m[1] !== 'Grand') sheetTotals.push({ name: m[1].trim(), total: Number(cellText(row.getCell(totalCol).value)) || 0 });
    });
    const ours = (name, year) => records.filter((r) => r.source === 'Instructor' && r.instructor_name === (matchInstructor(name).name ?? name)
      && (!year || r.case_date?.startsWith(year))).length;
    // The tally may cover one year only: use whichever period matches best.
    const periods = [null, '2025', '2026'];
    const score = (p) => sheetTotals.filter((t) => ours(t.name, p) === t.total).length;
    const best = periods.reduce((a, b) => (score(b) > score(a) ? b : a));
    const lines = [`Compared with Instructor Complaints ${best ? `dated ${best}` : '(all dates)'}, the period that matches the tab best.`, '',
      '| Instructor | Instructor Trends tab | This import | |', '|---|---|---|---|'];
    for (const t of sheetTotals) {
      const n = ours(t.name, best);
      lines.push(`| ${t.name} | ${t.total} | ${n} | ${n === t.total ? '✓' : '≠'} |`);
    }
    lines.push('', `${score(best)} of ${sheetTotals.length} instructors match exactly.`);
    trendCheck = lines;
  }
  for (const [name, wheres] of unmatchedCourses) {
    report.problem('Courses not on the course list (left blank, name kept in Notes)', `“${name}” — ${wheres.length} row(s), e.g. ${wheres.slice(0, 3).join('; ')}`);
  }

  report.section('Summary', [
    `File: ${FILE}`,
    '',
    ...tabStats,
    '',
    `- **${records.length} cases** in total`,
    `- **${masterNames.length} instructors**, taken from the names in these tabs: ${masterNames.join(', ')}`,
    `- **${fieldNotes} cell comments** become notes on a field (hover “Notes” in the app); **${caseNotes}** go into the case’s Notes`,
  ]);
  if (trendCheck) report.section('Check against the “Instructor Trends” tab', trendCheck);
  report.section('New dropdown values that will be added', newOptions.size
    ? [...newOptions.entries()].map(([k, n]) => { const [list, value] = k.split('|'); return `- ${list}: “${value}” (${n}×)`; })
    : ['None.']);
  report.section('Instructor spellings unified', instructorSpellings.size
    ? [...instructorSpellings.entries()].map(([name, set]) => `- ${[...set].map((s) => `“${s}”`).join(', ')} → **${name}**`)
    : ['None.']);

  // --- Database (always inside a transaction; kept only with --write) ----------
  await q('begin');
  await q(`set local app.skip_audit = 'on'`);
  const removed = await q(`delete from public.qa_cases where import_ref like 'qa.xlsx / %'`);

  for (const name of masterNames) {
    const aliases = [...(instructorSpellings.get(name) ?? [])];
    await q(`insert into public.instructors (full_name, aliases) values ($1, $2)
             on conflict (full_name) do update set is_active = true,
               aliases = array(select distinct unnest(public.instructors.aliases || excluded.aliases))`, [name, aliases]);
  }
  const instructorId = new Map((await q('select id, full_name from public.instructors')).rows.map((i) => [i.full_name, i.id]));

  let order = 100;
  for (const k of newOptions.keys()) {
    const [list, value] = k.split('|');
    await q(`insert into public.option_values (list_key, value, sort_order) values ($1, $2, $3) on conflict do nothing`, [list, value, order++]);
  }

  const cols = ['source', 'case_date', 'customer_name', 'course_id', 'instructor_id', 'case_link', 'analyst', 'category', 'complaint_types',
    'validity', 'followup_email', 'followup_sms', 'followup_call', 'customer_reached', 'resolution', 'notes', 'attendance_pct',
    'participation_pct', 'moodle_pct', 'course_end_date', 'case_closed_by', 'survey_type', 'survey_id', 'rating', 'customer_comment',
    'reason_type', 'reassign_reason', 'field_notes', 'import_ref'];
  for (const rec of records) {
    rec.course_id = rec.course_name ? courseId.get(rec.course_name) : null;
    rec.instructor_id = rec.instructor_name ? instructorId.get(rec.instructor_name) : null;
    const { rows: [row] } = await q(
      `insert into public.qa_cases (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
      cols.map((c) => (c === 'field_notes' ? JSON.stringify(rec[c]) : rec[c])));
    for (const name of rec.course_names ?? []) {
      await q('insert into public.qa_case_courses (case_id, course_id) values ($1, $2) on conflict do nothing', [row.id, courseId.get(name)]);
    }
  }

  // Readable numbers: QA-0001 = the oldest case. Only done while every QA case
  // came from this import (numbers people already use are never changed).
  const handMade = (await q(`select count(*)::int as n from public.qa_cases where import_ref is null`)).rows[0].n;
  if (handMade === 0) {
    await q(`alter table public.qa_cases alter column case_no set generated by default`);
    await q(`update public.qa_cases q set case_no = n.rn from (
               select id, row_number() over (order by case_date nulls last, source, import_ref) as rn from public.qa_cases
             ) n where n.id = q.id`);
    await q(`alter table public.qa_cases alter column case_no set generated always`);
    await q(`select setval(pg_get_serial_sequence('public.qa_cases', 'case_no'), (select max(case_no) from public.qa_cases))`);
    report.section('Case numbers', ['Cases are numbered in date order: QA-0001 is the oldest.']);
  } else {
    report.section('Case numbers', [`${handMade} cases were added in the app, so existing numbers were left unchanged.`]);
  }

  await q(`reset app.skip_audit`);
  await q(`insert into public.activity_log (section, action, record_type, record_label, summary)
           values ('quality_analyst', 'Imported data', 'import', 'qa.xlsx', $1)`,
    [`Imported ${records.length} Quality Analyst cases from the spreadsheet${removed.rowCount ? ` (replacing ${removed.rowCount} from an earlier import)` : ''}.`]);

  if (WRITE) {
    await q('commit');
    report.section('Result', [`**Saved.** ${records.length} cases imported${removed.rowCount ? `, replacing ${removed.rowCount} from an earlier import` : ''}.`]);
  } else {
    await q('rollback');
    report.section('Result', ['**Practice run: nothing was saved.** The database accepted every row. Run with `--write` to import for real.']);
  }
} catch (err) {
  await q('rollback').catch(() => {});
  report.section('Result', [`**Stopped with an error, nothing was saved:** ${err.message}`]);
  process.exitCode = 1;
} finally {
  await client.end();
  await writeFile(REPORT, report.toMarkdown(), 'utf8');
  const problems = [...report.problems.entries()].map(([h, l]) => `  - ${h}: ${l.length}`).join('\n');
  console.log(`\n${report.title}\n${report.sections.find((s) => s.heading === 'Result')?.lines.join(' ')}\n\nNeeds attention:\n${problems || '  nothing'}\n\nFull report: ${REPORT}\n`);
}
