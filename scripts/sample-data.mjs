// Adds or removes clearly marked sample records for testing.
//   npm run db:sample          add sample records (skips if they already exist)
//   npm run db:sample:remove   delete every sample record
// Every sample row has is_sample = true and a customer name starting "Sample".
import { connect } from './db.mjs';

const mode = process.argv[2] ?? 'add';
const client = await connect();
const q = (sql, params) => client.query(sql, params);

// Small deterministic random generator so the sample set is always the same.
let seed = 20260925;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (list) => list[Math.floor(rand() * list.length)];
const pickSome = (list, max) => {
  const n = 1 + Math.floor(rand() * max);
  return [...new Set(Array.from({ length: n }, () => pick(list)))];
};
const maybe = (p, value) => (rand() < p ? value : null);

function randomDate(excludeCourseGap) {
  // Between Jan 2025 and Sep 2026.
  for (;;) {
    const start = Date.UTC(2025, 0, 5);
    const end = Date.UTC(2026, 8, 20);
    const d = new Date(start + rand() * (end - start));
    const iso = d.toISOString().slice(0, 10);
    // Course Complaints have no rows Jul 2025 – Jan 2026 (a known gap).
    if (excludeCourseGap && iso >= '2025-07-01' && iso < '2026-02-01') continue;
    return iso;
  }
}

async function options(listKey) {
  const { rows } = await q(
    'select value from public.option_values where list_key = $1 and is_active order by sort_order', [listKey]);
  return rows.map((r) => r.value);
}

async function hasSamples(table) {
  const { rows } = await q(`select count(*)::int as n from public.${table} where is_sample`);
  if (rows[0].n > 0) console.log(`${table}: ${rows[0].n} sample rows already exist. Skipped.`);
  return rows[0].n > 0;
}

async function add() {
  if (!(await hasSamples('qa_cases'))) await addQa();
  if (!(await hasSamples('curriculum_customer_cases'))) await addCurriculumCases();
  if (!(await hasSamples('curriculum_instructor_requests'))) await addCurriculumRequests();
  if (!(await hasSamples('mentor_cases'))) await addMentor();
}

async function courseIds() {
  return (await q(`select id from public.courses where is_active order by sort_order`)).rows.map((r) => r.id);
}

async function insertRow(table, row) {
  const cols = Object.keys(row);
  const { rows } = await q(
    `insert into public.${table} (${cols.join(', ')}, is_sample)
     values (${cols.map((_, i) => `$${i + 1}`).join(', ')}, true) returning id`,
    cols.map((c) => row[c]));
  return rows[0].id;
}

async function addCurriculumCases() {
  const courses = await courseIds();
  const categories = await options('cur_category');
  const materials = await options('cur_material_type');
  const smes = ['Sample SME 1', 'Sample SME 2', 'Sample SME 3'];
  for (let n = 1; n <= 24; n++) {
    const caseDate = randomDate(false);
    const resolved = maybe(0.8, (() => {
      const d = new Date(caseDate);
      d.setUTCDate(d.getUTCDate() + Math.floor(rand() * 6));
      return d.toISOString().slice(0, 10);
    })());
    await insertRow('curriculum_customer_cases', {
      case_date: caseDate,
      customer_name: `Sample Customer ${String(n).padStart(2, '0')}`,
      course_id: pick(courses),
      category: pick(categories),
      material_type: pick(materials),
      curriculum_sme: pick(smes),
      tm_on_sf: maybe(0.5, 'Sample TM'),
      comments: 'Sample complaint about course content.',
      feedback_progress: maybe(0.7, 'Sample progress note.'),
      date_resolved: resolved,
      resolution_tat_days: resolved ? Math.round((Date.parse(resolved) - Date.parse(caseDate)) / 86400000) : null,
      case_link: maybe(0.7, `https://example.com/sample-curriculum/${n}`),
    });
  }
  console.log('Added 24 sample Curriculum customer cases.');
}

async function addCurriculumRequests() {
  const courses = await courseIds();
  const feedback = await options('cur_feedback_type');
  const materials = await options('cur_base_material');
  const statuses = await options('cur_request_status');
  const tms = ['Sample Ticket Manager 1', 'Sample Ticket Manager 2'];
  for (let n = 1; n <= 10; n++) {
    const status = pick(statuses);
    const submitted = randomDate(false);
    await insertRow('curriculum_instructor_requests', {
      requester_name: `Sample Requester ${String(n).padStart(2, '0')}`,
      date_submitted: submitted,
      course_id: pick(courses),
      feedback_type: pick(feedback),
      base_material: pick(materials),
      comments: 'Sample content error reported by an instructor.',
      status,
      date_completed: status === 'Complete' ? submitted : null,
      ticket_manager: pick(tms),
    });
  }
  console.log('Added 10 sample instructor requests.');
}

async function addMentor() {
  const courses = await courseIds();
  const mentors = (await q('select id from public.mentors where is_active')).rows.map((r) => r.id);
  const types = await options('mentor_complaint_type');
  const subTypes = await options('mentor_complaint_sub_type');
  const statuses = await options('mentor_status');
  const closedBy = await options('mentor_case_closed_by');
  for (let n = 1; n <= 30; n++) {
    const status = pick(statuses);
    await insertRow('mentor_cases', {
      case_date: randomDate(false),
      customer_name: `Sample Customer ${String(n).padStart(2, '0')}`,
      mentor_id: pick(mentors),
      course_id: pick(courses),
      complaint_type: pick(types),
      complaint_sub_type: pick(subTypes),
      complaint_analysis: pick(['Valid', 'Valid', 'Partially Valid', 'Not Valid']),
      status,
      case_closed_by: status === 'Closed' ? pick(closedBy) : null,
      email_sent: rand() < 0.6,
      email_sms_preview: maybe(0.5, 'Sample message sent to the customer.'),
      case_link: maybe(0.8, `https://example.com/sample-mentor/${n}`),
    });
  }
  console.log('Added 30 sample Mentor cases.');
}

async function addQa() {

  const instructorNames = ['Sample Instructor A', 'Sample Instructor B', 'Sample Instructor C', 'Sample Instructor D', 'Sample Instructor E'];
  for (const name of instructorNames) {
    await q(`insert into public.instructors (full_name, is_sample) values ($1, true) on conflict (full_name) do nothing`, [name]);
  }
  const instructors = (await q(`select id from public.instructors where is_sample`)).rows.map((r) => r.id);
  const courses = (await q(`select id from public.courses where is_active order by sort_order`)).rows.map((r) => r.id);

  const o = {
    catInstr: await options('qa_category_instructor'),
    catCourse: await options('qa_category_course'),
    typeInstr: await options('qa_type_instructor'),
    typeCourse: await options('qa_type_course'),
    surveyType: await options('qa_survey_type'),
    reason: await options('qa_survey_reason'),
    sent: await options('qa_followup_sent'),
    closedBy: await options('qa_case_closed_by'),
    reassign: await options('qa_reassign_reason'),
    resolution: await options('qa_resolution'),
  };
  const validity = ['Valid', 'Valid', 'Partially Valid', 'Not Valid', 'N/A'];
  const analysts = ['Sample Analyst 1', 'Sample Analyst 2', 'Sample Analyst 3'];
  const plan = [
    ...Array(16).fill('Instructor'),
    ...Array(10).fill('Course'),
    ...Array(18).fill('Survey'),
    ...Array(6).fill('Returned'),
  ];

  let n = 0;
  for (const source of plan) {
    n++;
    const label = String(n).padStart(2, '0');
    const row = {
      source,
      case_date: randomDate(source === 'Course'),
      customer_name: `Sample Customer ${label}`,
      course_id: source === 'Returned' ? null : pick(courses),
      instructor_id: source === 'Returned' ? null : maybe(0.9, pick(instructors)),
      case_link: maybe(0.8, `https://example.com/sample-case/${label}`),
      analyst: pick(analysts),
      category: null,
      complaint_types: [],
      validity: pick(validity),
      followup_email: pick(o.sent),
      followup_sms: pick(o.sent),
      followup_call: pick(o.sent),
      customer_reached: pick(['Reached', 'Reached', 'Not Reached', 'N/A']),
      resolution: null,
      notes: 'SAMPLE RECORD for testing. Safe to delete.',
      attendance_pct: null, participation_pct: null, moodle_pct: null, course_end_date: null,
      case_closed_by: null,
      survey_type: null, survey_id: null, rating: null, customer_comment: null, reason_type: null,
      reassign_reason: null,
    };
    if (source === 'Instructor') {
      Object.assign(row, {
        category: pick(o.catInstr),
        complaint_types: pickSome(o.typeInstr, 2),
        resolution: pick(o.resolution),
        attendance_pct: Math.round(50 + rand() * 50),
        participation_pct: Math.round(40 + rand() * 60),
        moodle_pct: Math.round(30 + rand() * 70),
      });
      const end = new Date(row.case_date);
      end.setUTCDate(end.getUTCDate() + 30);
      row.course_end_date = end.toISOString().slice(0, 10);
    } else if (source === 'Course') {
      Object.assign(row, {
        category: pick(o.catCourse),
        complaint_types: pickSome(o.typeCourse, 2),
        resolution: pick(o.resolution),
        case_closed_by: pick(o.closedBy),
      });
    } else if (source === 'Survey') {
      Object.assign(row, {
        survey_type: pick(o.surveyType),
        survey_id: `SAMPLE-${1000 + n}`,
        rating: pick([1, 1, 2, 2, 3, 3, 4]),
        customer_comment: 'Sample survey comment.',
        reason_type: pick(o.reason),
      });
    } else {
      Object.assign(row, { reassign_reason: pick(o.reassign), validity: null });
    }

    const cols = Object.keys(row);
    const { rows } = await q(
      `insert into public.qa_cases (${cols.join(', ')}, is_sample)
       values (${cols.map((_, i) => `$${i + 1}`).join(', ')}, true) returning id`,
      cols.map((c) => row[c]));
    if (source === 'Returned') {
      for (const courseId of pickSome(courses, 2)) {
        await q('insert into public.qa_case_courses (case_id, course_id) values ($1, $2) on conflict do nothing', [rows[0].id, courseId]);
      }
    }
  }
  console.log(`Added ${plan.length} sample Quality Analyst cases and ${instructorNames.length} sample instructors.`);
}

async function remove() {
  const tables = ['qa_cases', 'curriculum_instructor_requests', 'curriculum_customer_cases', 'mentor_cases'];
  for (const table of tables) {
    const r = await q(`delete from public.${table} where is_sample`);
    console.log(`Removed ${r.rowCount} sample rows from ${table}.`);
  }
  const i = await q('delete from public.instructors where is_sample');
  console.log(`Removed ${i.rowCount} sample instructors.`);
}

try {
  await q('begin');
  if (mode === 'remove') await remove(); else await add();
  await q('commit');
} catch (err) {
  await q('rollback');
  console.error(`\n✖ ${err.message}\nNothing was changed.\n`);
  process.exitCode = 1;
} finally {
  await client.end();
}
