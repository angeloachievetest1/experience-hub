// One-time import of the Curriculum spreadsheet (data/import/curriculum.xlsx).
//
//   npm run import:curriculum              practice run (undone), report in data/import/report-curriculum.md
//   npm run import:curriculum -- --write   the real import; also removes the Curriculum sample records
//
// Owner decisions (2026-09-30):
//   - Customer Cases tab → customer cases; "Instructors Cases" tab → instructor
//     requests, one row = one request (no continuation lines)
//   - "Data 2026" and "Yearly" are tallies: used only to cross-check the counts
//     (the sheet no longer has the older rows the Yearly tab counts)
//   - keep Type, Source of case, Case Resolution and Case Status in SF
//   - "Science" category added; "Spanish" → course "Spanish 1 & 2"
//   - requester names unified; unsure ones are listed for confirmation
//   - brief rule: suspected miscategorisations are reported, never changed
import { writeFile } from 'node:fs/promises';
import { connect } from '../db.mjs';
import { Report, cellText, distance, makeMatcher, openWorkbook, parseDate, readTab, readThreadedComments, simplify } from './lib.mjs';

const FILE = 'data/import/curriculum.xlsx';
const REPORT = 'data/import/report-curriculum.md';
const WRITE = process.argv.includes('--write');

const CASE_HEADERS = {
  date: ['date'],
  link: ['link to sf case'],
  source: ['source of case'],
  customer: ['cx name', 'customer name'],
  tm: ['tm on sf'],
  category: (h) => h.replace(/\s/g, '') === 'category/subject' || h === 'category',
  course: ['course'],
  type: ['type'],
  material: ['achieve material'],
  comments: ['comments / complaints', 'comments/complaints'],
  sme: ['curriculum sme'],
  resolved: ['date resolved'],
  feedback: (h) => h.startsWith('feedback / progress') || h.startsWith('feedback/progress'),
  tat: (h) => h.startsWith('resolution tat'),
  resolution: ['case resolution'],
  sf_status: ['case status in sf'],
};
const REQUEST_HEADERS = {
  requester: ['requester name'],
  date: ['date submitted'],
  course: ['course'],
  feedback_type: ['feedback type'],
  base_material: ['base material'],
  comments: ['comments'],
  status: ['status'],
  notes: ['notes'],
  completed: ['date completed'],
  tm: ['ticket manager'],
};
// Sheet column → field that shows a "Notes" hover in the app (for cell comments).
const CASE_NOTE_FIELD = {
  course: 'course_id', category: 'category', type: 'issue_type', material: 'material_type', source: 'case_source',
  resolution: 'case_resolution', sf_status: 'case_status_in_sf',
};
const REQUEST_NOTE_FIELD = { course: 'course_id', feedback_type: 'feedback_type', base_material: 'base_material', status: 'status' };

// Course names in the sheet → the app's course list.
const COURSE_VARIANTS = {
  'Nursing Entrance Exam Preparation': 'Nursing Entrance Exam Prep',
  'Nursing Entrance Exam Preparation (NEEP)': 'Nursing Entrance Exam Prep',
  'NEEP': 'Nursing Entrance Exam Prep',
  'NEEP Science part1': 'Nursing Entrance Exam Prep',
  'NEEP Maths part 2': 'Nursing Entrance Exam Prep',
  'NEEP Maths part 3': 'Nursing Entrance Exam Prep',
  'DEEP': 'Dental Hygiene Entrance Exam Prep',
  'History of the US 1': 'History of the United States 1',
  'US History I': 'History of the United States 1',
  'US History 1': 'History of the United States 1',
  'U.S. Hist. 1': 'History of the United States 1',
  'NCLEX-PN': 'Next Gen NCLEX PN Prep',
  'NCLEX-LPN': 'Next Gen NCLEX PN Prep',
  'NCLEX-RN': 'Next Gen NCLEX RN Prep',
  'Developmental Psychology': 'Human Growth and Development',
  'HESI Mobility': 'HESI Mobility/Challenge Prep',
  'Spanish': 'Spanish 1 & 2',
  'Spanish I': 'Spanish 1',
  'English Comp': 'College Composition',
  'College Comp': 'College Composition',
  "American Gov't": 'American Government',
  'World Religion': 'World Religions',
  'Ethics': 'Ethics in America',
  'Introduction to Sociology': 'Sociology',
};
const ASSUMED_COURSES = {}; // abbreviations worth confirming (DEEP confirmed by the owner)

// Owner-confirmed fixes (2026-09-30).
const DATE_FIXES = { '2020-01-18': '2024-01-18' };          // Date completed typo (rows 24–26)
const CATEGORY_BY_RAW_COURSE = { DEEP: 'Dental Exam' };     // the DEEP case was filed under Nursing Exam

// Requester spellings → one name. `sure: false` ones are listed for confirmation.
const REQUESTERS = [
  { from: ['Dr. Ifrah Naaz', 'Dr.Ifrah Naaz'], to: 'Ifrah Naaz', sure: true },
  { from: ['Albert F'], to: 'Albert Ferkl', sure: true },
  { from: ['Dr. Wolff'], to: 'Daniel Wolff', sure: true },
  { from: ['Dr. Ford', 'Dwedor M. Ford Massaquoi'], to: 'Dwedor Ford', sure: true },
  { from: ['Lilian C'], to: 'Lilian Chukwuemeka', sure: true },
  { from: ['D.Richards'], to: 'Dolores Richards', sure: true },
];

const EMPTY = new Set(['', '-', 'n/a', 'na', 'none', 'all']);
const isEmpty = (s) => EMPTY.has((s ?? '').trim().toLowerCase());
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const readableDate = (iso) => { const [y, m, d] = iso.split('-'); return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`; };
// Dates typed as text are read, and each correction is listed in the report.
const noteTyped = (raw, parsed, label, where) => {
  // Text typed into the cell, or a formula whose result is text (Google Sheets exports).
  const typed = typeof raw === 'string' ? raw : raw && typeof raw === 'object' && typeof raw.result === 'string' ? raw.result : null;
  if (parsed && typed && typed.trim() !== parsed) report.problem('Dates typed as text — please confirm how they were read', `${where}: ${label} “${typed.trim()}” read as ${readableDate(parsed)}`);
};
const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Groups spellings that differ only in capitals/spaces/punctuation (and, when
// allowed, one typo); the most common spelling wins, first letter capitalised.
function unifier(values, { typos = false, known = [] } = {}) {
  const counts = new Map();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [];
  for (const [v, n] of [...known.map((k) => [k, Infinity]), ...[...counts].sort((a, b) => b[1] - a[1])]) {
    const s = simplify(v);
    const g = groups.find((x) => x.key === s || (typos && s.length > 4 && distance(x.key, s) <= 1));
    if (g) g.members.push(v); else groups.push({ key: s, canonical: n === Infinity ? v : capitalise(v), members: [v] });
  }
  const map = new Map();
  for (const g of groups) for (const m of g.members) map.set(m, g.canonical);
  return (v) => (v ? map.get(v) ?? v : v);
}

// Ticket managers: "Chasen T", "Chasen T.", "Chsen T." → "Chasen T."
function ticketManager(v) {
  const m = v.trim().match(/^([A-Za-z]+)\s+([A-Za-z])\.?$/);
  return m ? `${capitalise(m[1].toLowerCase())} ${m[2].toUpperCase()}.` : v.trim();
}

const report = new Report(`Curriculum import report (${WRITE ? 'REAL IMPORT' : 'practice run — nothing saved'})`);
const client = await connect();
const q = (sql, params) => client.query(sql, params);

try {
  const wb = await openWorkbook(FILE);
  const comments = await readThreadedComments(FILE);
  const hidden = wb.worksheets.filter((ws) => ws.state !== 'visible').map((ws) => ws.name);
  const caseWs = wb.worksheets.find((ws) => ws.name.trim() === 'Customer Cases' && ws.state === 'visible');
  const reqWs = wb.worksheets.find((ws) => ws.name.trim() === 'Instructors Cases' && ws.state === 'visible');
  if (!caseWs || !reqWs) throw new Error('Could not find the visible “Customer Cases” and “Instructors Cases” tabs.');

  const courses = (await q('select id, name from public.courses where is_active')).rows;
  const courseId = new Map(courses.map((c) => [c.name, c.id]));
  const matchCourse = makeMatcher(courses.map((c) => c.name), COURSE_VARIANTS, 1);
  const options = (await q(`select list_key, value from public.option_values where list_key like 'cur\\_%'`)).rows;
  const listed = (key) => options.filter((o) => o.list_key === key).map((o) => o.value);
  const newOptions = new Map();
  const useOption = (list, value) => {
    if (!value || value.length > 60 || listed(list).includes(value)) return;
    newOptions.set(`${list}|${value}`, (newOptions.get(`${list}|${value}`) ?? 0) + 1);
  };
  const unmatchedCourses = new Map();
  const course = (raw, where) => {
    if (isEmpty(raw)) return null;
    const m = matchCourse(raw);
    if (m.name) {
      report.change('Course', raw, m.name);
      if (ASSUMED_COURSES[raw]) report.problem('Course abbreviations to confirm', `“${raw}” was read as ${m.name} (${where})`);
      return m.name;
    }
    unmatchedCourses.set(raw, [...(unmatchedCourses.get(raw) ?? []), where]);
    return null;
  };
  const commentsFor = (tab, rowNumber, fieldOfColumn, noteFields) => {
    const fieldNotes = {};
    const extra = [];
    for (const [ref, list] of comments.get(tab) ?? []) {
      const m = ref.match(/^([A-Z]+)(\d+)$/);
      if (!m || Number(m[2]) !== rowNumber) continue;
      const text = list.map((x) => `${x.text} — ${x.author}${x.date ? `, ${readableDate(x.date)}` : ''}`).join('\n');
      const field = noteFields[fieldOfColumn[m[1]]];
      if (field) fieldNotes[field] = fieldNotes[field] ? `${fieldNotes[field]}\n${text}` : text;
      else extra.push(`Comment on column ${m[1]}: ${text}`);
    }
    return { fieldNotes, extra };
  };

  // --- Customer Cases -----------------------------------------------------------
  const caseTab = readTab(caseWs, CASE_HEADERS);
  const caseRows = caseTab.rows.filter((r) => ['customer', 'link', 'course', 'comments'].some((f) => !isEmpty(r.get(f))));
  const fixType = unifier(caseRows.map((r) => r.get('type')), { known: listed('cur_issue_type') });
  const fixMaterial = unifier(caseRows.map((r) => r.get('material')), { known: [...listed('cur_material_type'), 'H5P'] });
  const fixCategory = unifier(caseRows.map((r) => r.get('category')), { known: listed('cur_category') });
  const fixResolution = unifier(caseRows.map((r) => r.get('resolution')), { known: listed('cur_case_resolution') });
  const fixSfStatus = unifier(caseRows.map((r) => r.get('sf_status')), { known: listed('cur_sf_status') });
  const fixSource = unifier(caseRows.map((r) => r.get('source')), { known: listed('cur_case_source') });

  const cases = [];
  for (const r of caseRows) {
    const where = `Customer Cases row ${r.rowNumber}`;
    const date = parseDate(r.raw('date'));
    noteTyped(r.raw('date'), date, 'Date', where);
    if (!date) report.problem('Rows with no usable date (imported without a date)', `${where}${r.get('date') ? `: “${r.get('date')}”` : ''}`);
    const resolved = parseDate(r.raw('resolved'));
    noteTyped(r.raw('resolved'), resolved, 'Date resolved', where);
    if (!resolved && !isEmpty(r.get('resolved'))) report.problem('Values that could not be read (left blank)', `${where}: Date resolved “${r.get('resolved')}”`);
    if (date && resolved && resolved < date) report.problem('Date resolved is before the case date (kept as is)', `${where}: ${date} → ${resolved}`);
    const tatRaw = r.get('tat');
    const tat = isEmpty(tatRaw) ? null : Number(tatRaw);
    if (tatRaw && !Number.isFinite(tat)) report.problem('Values that could not be read (left blank)', `${where}: TAT “${tatRaw}”`);

    const pick = (fixer, field, list, label) => {
      const raw = r.get(field);
      if (isEmpty(raw)) return null;
      const v = fixer(raw);
      report.change(label, raw, v);
      useOption(list, v);
      return v;
    };
    const { fieldNotes, extra } = commentsFor(caseWs.name, r.rowNumber, caseTab.fieldOfColumn, CASE_NOTE_FIELD);
    if (extra.length) report.problem('Comments with no matching field (not imported)', `${where}: ${extra.length}`);

    cases.push({
      case_date: date,
      case_link: r.link('link') ?? (/^https?:\/\//i.test(r.get('link')) ? r.get('link') : null),
      case_source: pick(fixSource, 'source', 'cur_case_source', 'Source of case'),
      customer_name: r.get('customer') || null,
      tm_on_sf: r.get('tm') || null,
      category: CATEGORY_BY_RAW_COURSE[r.get('course')]
        ? (report.change('Category (owner-confirmed)', r.get('category'), CATEGORY_BY_RAW_COURSE[r.get('course')]), CATEGORY_BY_RAW_COURSE[r.get('course')])
        : pick(fixCategory, 'category', 'cur_category', 'Category'),
      course_name: course(r.get('course'), where),
      issue_type: pick(fixType, 'type', 'cur_issue_type', 'Type'),
      material_type: pick(fixMaterial, 'material', 'cur_material_type', 'Achieve material'),
      comments: r.get('comments') || null,
      curriculum_sme: r.get('sme') || null,
      date_resolved: resolved,
      feedback_progress: r.get('feedback') || null,
      resolution_tat_days: Number.isFinite(tat) ? tat : null,
      case_resolution: pick(fixResolution, 'resolution', 'cur_case_resolution', 'Case resolution'),
      case_status_in_sf: pick(fixSfStatus, 'sf_status', 'cur_sf_status', 'Case status in SF'),
      field_notes: fieldNotes,
      import_ref: `curriculum.xlsx / Customer Cases / row ${r.rowNumber}`,
      where,
    });
  }

  // Suspected miscategorisations (brief: report, don't change).
  const EXPECTED = [
    [/nursing|nclex|teas|hesi/i, 'Nursing Exam'], [/dental/i, 'Dental Exam'], [/spanish|esl/i, 'Language'],
    [/algebra|mathematics|math|statistics/i, 'Mathematics'], [/chemistry|biology|microbiology/i, 'Science'],
  ];
  for (const c of cases) {
    if (!c.course_name || !c.category) continue;
    const rule = EXPECTED.find(([re]) => re.test(c.course_name));
    if (rule && rule[1] !== c.category) {
      report.problem('Suspected miscategorisations (not changed — please review)', `${c.where}: ${c.course_name} is under “${c.category}” (expected ${rule[1]})`);
    }
  }

  // --- Instructor requests -------------------------------------------------------
  const reqTab = readTab(reqWs, REQUEST_HEADERS);
  const reqRows = reqTab.rows.filter((r) => ['requester', 'date', 'course', 'comments', 'base_material', 'notes', 'status']
    .some((f) => !isEmpty(r.get(f))));
  const skippedOnlyType = reqTab.rows.length - reqRows.length;
  const requesterMap = new Map(REQUESTERS.flatMap((x) => x.from.map((f) => [f, x])));
  const fixTm = unifier(reqRows.map((r) => ticketManager(r.get('tm'))), { typos: true });
  const fixBase = unifier(reqRows.map((r) => r.get('base_material')), { known: listed('cur_base_material') });
  const fixStatus = unifier(reqRows.map((r) => r.get('status')), { known: listed('cur_request_status') });
  const fixFeedback = unifier(reqRows.map((r) => r.get('feedback_type')), { known: listed('cur_feedback_type') });
  const requesterChanges = new Map();

  const requests = [];
  for (const r of reqRows) {
    const where = `Instructors Cases row ${r.rowNumber}`;
    const notes = [];
    const date = parseDate(r.raw('date'));
    noteTyped(r.raw('date'), date, 'Date submitted', where);
    if (!date && !isEmpty(r.get('date'))) report.problem('Values that could not be read (left blank)', `${where}: Date submitted “${r.get('date')}”`);
    let completed = parseDate(r.raw('completed'));
    if (completed && DATE_FIXES[completed]) { report.change('Date completed (owner-confirmed typo)', completed, DATE_FIXES[completed]); completed = DATE_FIXES[completed]; }
    noteTyped(r.raw('completed'), completed, 'Date completed', where);
    const completedText = r.get('completed');
    if (!completed && !isEmpty(completedText)) {
      notes.push(`Date completed in sheet: ${completedText}`);
      report.problem('Values that could not be read (kept in Notes)', `${where}: Date completed “${completedText.slice(0, 60)}”`);
    }
    if (date && completed && completed < date) report.problem('Date completed is before the date submitted (kept as is)', `${where}: submitted ${date}, completed ${completed}`);

    const rawRequester = r.get('requester');
    let requester = rawRequester || null;
    const rule = requesterMap.get(rawRequester);
    if (rule) {
      requester = rule.to;
      requesterChanges.set(`${rawRequester}|${rule.to}|${rule.sure}`, (requesterChanges.get(`${rawRequester}|${rule.to}|${rule.sure}`) ?? 0) + 1);
    }
    const rawCourse = r.get('course');
    const courseName = course(rawCourse, where);
    if (courseName && /part|science|math/i.test(rawCourse) && /^neep/i.test(rawCourse)) notes.push(`Course in sheet: ${rawCourse}`);

    const val = (fixer, field, list, label) => {
      const raw = r.get(field);
      if (isEmpty(raw)) return null;
      const v = fixer(raw);
      report.change(label, raw, v);
      useOption(list, v);
      return v;
    };
    const tmRaw = r.get('tm');
    const tm = isEmpty(tmRaw) ? null : fixTm(ticketManager(tmRaw));
    if (tm) report.change('Ticket manager', tmRaw, tm);

    const { fieldNotes, extra } = commentsFor(reqWs.name, r.rowNumber, reqTab.fieldOfColumn, REQUEST_NOTE_FIELD);
    notes.push(...extra);
    const sheetNotes = r.get('notes');
    requests.push({
      requester_name: requester,
      date_submitted: date,
      course_name: courseName,
      feedback_type: val(fixFeedback, 'feedback_type', 'cur_feedback_type', 'Feedback type'),
      base_material: val(fixBase, 'base_material', 'cur_base_material', 'Base material'),
      comments: r.get('comments') || null,
      status: val(fixStatus, 'status', 'cur_request_status', 'Status'),
      notes: [sheetNotes, ...notes].filter(Boolean).join('\n') || null,
      date_completed: completed,
      ticket_manager: tm,
      field_notes: fieldNotes,
      import_ref: `curriculum.xlsx / Instructors Cases / row ${r.rowNumber}`,
    });
  }

  for (const [raw, wheres] of unmatchedCourses) {
    report.problem('Courses not on the course list (left blank)', `“${raw}” — ${wheres.length} row(s), e.g. ${wheres.slice(0, 3).join('; ')}`);
  }

  // --- Cross-checks against the tally tabs -------------------------------------
  const tally = (ws, labelCol, countCol, fromRow) => {
    const out = [];
    for (let r = fromRow; r <= ws.rowCount; r++) {
      const label = cellText(ws.getRow(r).getCell(labelCol).value);
      if (!label || /grand total/i.test(label)) break;
      out.push({ label, n: Number(cellText(ws.getRow(r).getCell(countCol).value)) || 0 });
    }
    return out;
  };
  const table = (title, rows) => [
    title, '', '| | Tally tab | This import | |', '|---|---|---|---|',
    ...rows.map((x) => `| ${x.label} | ${x.tally} | ${x.ours} | ${x.tally === x.ours ? '✓' : '≠'} |`),
    '', `${rows.filter((x) => x.tally === x.ours).length} of ${rows.length} match.`, '',
  ];
  const cases2026 = cases.filter((c) => c.case_date?.startsWith('2026'));
  const d26 = wb.worksheets.find((ws) => ws.name.trim() === 'Data 2026');
  const checks = [];
  if (d26) {
    const byCourse = new Map();
    for (const t of tally(d26, 1, 2, 3)) {
      const name = matchCourse(t.label).name ?? t.label;
      byCourse.set(name, (byCourse.get(name) ?? 0) + t.n);
    }
    checks.push(...table('**2026 by course** (Data 2026 tab)', [...byCourse].map(([label, n]) => ({
      label, tally: n, ours: cases2026.filter((c) => c.course_name === label).length,
    }))));
    checks.push(...table('**2026 by Achieve material** (Data 2026 tab)', tally(d26, 5, 6, 3).map((t) => ({
      label: t.label, tally: t.n, ours: cases2026.filter((c) => simplify(c.material_type ?? '') === simplify(fixMaterial(t.label))).length,
    }))));
    checks.push(...table('**2026 by category** (Data 2026 tab)', tally(d26, 5, 6, 19).map((t) => ({
      label: t.label, tally: t.n, ours: cases2026.filter((c) => c.category === fixCategory(t.label)).length,
    }))));
  }
  const yearly = wb.worksheets.find((ws) => ws.name.trim() === 'Yearly');
  if (yearly) {
    checks.push(...table('**Cases by year** (Yearly tab — an older tally that also counts rows no longer in the sheet, so differences are expected)',
      tally(yearly, 1, 2, 3).map((t) => ({ label: t.label, tally: t.n, ours: cases.filter((c) => c.case_date?.startsWith(t.label)).length }))));
  }

  // --- Summary -----------------------------------------------------------------------
  const years = {};
  for (const c of cases) { const y = c.case_date?.slice(0, 4) ?? 'no date'; years[y] = (years[y] ?? 0) + 1; }
  report.section('Summary', [
    `File: ${FILE}`,
    `Hidden tabs ignored: ${hidden.length ? hidden.join(', ') : 'none'}`,
    '',
    `- **Customer Cases** → **${cases.length} customer cases** (${Object.entries(years).sort().map(([y, n]) => `${y}: ${n}`).join(', ')}); ${caseTab.rows.length - caseRows.length} empty rows skipped`,
    `- **Instructors Cases** → **${requests.length} instructor requests** (one per row; ${requests.filter((x) => !x.requester_name).length} without a requester); ${skippedOnlyType} empty rows skipped (only “Feedback Type” was filled in)`,
    '- “Data 2026” and “Yearly” are tallies: used only for the checks below, not imported',
  ]);
  report.section('Requester names unified', requesterChanges.size ? [...requesterChanges].map(([k, n]) => {
    const [from, to, sure] = k.split('|');
    return `- “${from}” → **${to}** (${n}×)${sure === 'true' ? '' : ' — **please confirm**'}`;
  }) : ['None.']);
  report.section('Checks against the tally tabs', checks);
  report.section('New dropdown values that will be added', newOptions.size
    ? [...newOptions].map(([k, n]) => { const [list, value] = k.split('|'); return `- ${list}: “${value}” (${n}×)`; })
    : ['None.']);

  // --- Database (always in a transaction; kept only with --write) ------------
  await q('begin');
  await q(`set local app.skip_audit = 'on'`);
  const removedCases = await q(`delete from public.curriculum_customer_cases where import_ref like 'curriculum.xlsx / %' or is_sample`);
  const removedReqs = await q(`delete from public.curriculum_instructor_requests where import_ref like 'curriculum.xlsx / %' or is_sample`);
  let order = 100;
  for (const k of newOptions.keys()) {
    const [list, value] = k.split('|');
    await q('insert into public.option_values (list_key, value, sort_order) values ($1, $2, $3) on conflict do nothing', [list, value, order++]);
  }
  const caseCols = ['case_date', 'case_link', 'case_source', 'customer_name', 'tm_on_sf', 'category', 'course_id', 'issue_type', 'material_type',
    'comments', 'curriculum_sme', 'date_resolved', 'feedback_progress', 'resolution_tat_days', 'case_resolution', 'case_status_in_sf', 'field_notes', 'import_ref'];
  for (const c of cases) {
    c.course_id = c.course_name ? courseId.get(c.course_name) : null;
    await q(`insert into public.curriculum_customer_cases (${caseCols.join(', ')}) values (${caseCols.map((_, i) => `$${i + 1}`).join(', ')})`,
      caseCols.map((k) => (k === 'field_notes' ? JSON.stringify(c[k]) : c[k])));
  }
  const reqCols = ['requester_name', 'date_submitted', 'course_id', 'feedback_type', 'base_material', 'comments', 'status', 'notes',
    'date_completed', 'ticket_manager', 'field_notes', 'import_ref'];
  for (const x of requests) {
    x.course_id = x.course_name ? courseId.get(x.course_name) : null;
    await q(`insert into public.curriculum_instructor_requests (${reqCols.join(', ')}) values (${reqCols.map((_, i) => `$${i + 1}`).join(', ')})`,
      reqCols.map((k) => (k === 'field_notes' ? JSON.stringify(x[k]) : x[k])));
  }
  await q('reset app.skip_audit');
  await q(`insert into public.activity_log (section, action, record_type, record_label, summary)
           values ('curriculum', 'Imported data', 'import', 'curriculum.xlsx', $1)`,
    [`Imported ${cases.length} Curriculum customer cases and ${requests.length} instructor requests from the spreadsheet.`]);

  const summary = `${cases.length} customer cases and ${requests.length} instructor requests; ${removedCases.rowCount + removedReqs.rowCount} earlier or sample rows replaced.`;
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
  const result = report.sections.find((s) => s.heading === 'Result')?.lines.join(' ');
  const problems = [...report.problems].map(([h, l]) => `  - ${h}: ${l.length}`).join('\n');
  console.log(`\n${report.title}\n${result}\n\nNeeds attention:\n${problems || '  nothing'}\n\nFull report: ${REPORT}\n`);
}
