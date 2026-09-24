// Checks the database security rules end to end.
// Creates temporary test users inside a transaction, tries things as each of
// them, then ROLLS EVERYTHING BACK — nothing is left in your database.
// Usage: npm run db:test
import { randomUUID } from 'node:crypto';
import { connect } from './db.mjs';

const client = await connect();
const q = (sql, params) => client.query(sql, params);
let passed = 0;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) passed++; else failed++;
  console.log(`${ok ? '  ✔' : '  ✖'} ${label}${!ok && detail ? `  (${detail})` : ''}`);
}

// Runs fn as the given user (or anon) and undoes whatever it did afterwards.
async function as(userId, fn) {
  await q('savepoint attempt');
  try {
    if (userId === 'anon') {
      await q('set local role anon');
    } else {
      await q(`select set_config('request.jwt.claims', $1, true)`,
        [JSON.stringify({ sub: userId, role: 'authenticated' })]);
      await q('set local role authenticated');
    }
    const res = await fn();
    return { ok: true, ...res };
  } catch (err) {
    return { ok: false, code: err.code, message: err.message };
  } finally {
    await q('rollback to savepoint attempt');
  }
}

const run = (sql, params) => async () => {
  const r = await q(sql, params);
  return { rows: r.rows, rowCount: r.rowCount };
};
const denied = (r) => !r.ok && r.code === '42501';
const sameAccess = (r, expected) => r.ok &&
  Object.keys(expected).every((k) => r.rows[0].a[k] === expected[k]) &&
  Object.keys(r.rows[0].a).length === Object.keys(expected).length;

await q('begin');
try {
  // ---------------------------------------------------------------------------
  // Temporary users
  // ---------------------------------------------------------------------------
  const users = {
    viewer: randomUUID(),
    mentorAdmin: randomUUID(),
    deactivated: randomUUID(),
    superAdmin: randomUUID(),
    qaAdmin: randomUUID(),
    curAdmin: randomUUID(),
  };
  const addAuthUser = (id, key, approved) => q(
    `insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
     values ($1, 'authenticated', 'authenticated', $2, jsonb_build_object('full_name', $3::text), $4::jsonb, now(), now())`,
    [id, `rls-test-${key}-${id.slice(0, 8)}@example.invalid`, `RLS test ${key}`,
      JSON.stringify(approved ? { eh_approved: true } : {})]);
  for (const [key, id] of Object.entries(users)) await addAuthUser(id, key, true);
  const stranger = randomUUID();
  await addAuthUser(stranger, 'stranger', false);

  console.log('\nSetup');
  const prof = await q(`select count(*)::int as n from public.profiles where id = any($1) and status = 'active'`, [Object.values(users)]);
  check('A profile is created automatically for each new Auth user', prof.rows[0].n === Object.keys(users).length);

  console.log('\nAccount created outside the Admin Dashboard (e.g. public sign-up)');
  const strangerProfile = await q('select status from public.profiles where id = $1', [stranger]);
  check('Starts deactivated until a super-admin activates it', strangerProfile.rows[0]?.status === 'deactivated');

  await q(`update public.profiles set role = 'admin', sections = '{mentor}' where id = $1`, [users.mentorAdmin]);
  await q(`update public.profiles set role = 'admin', sections = '{mentor}' where id = $1`, [users.deactivated]);
  await q(`update public.profiles set status = 'deactivated', deactivation_note = 'test' where id = $1`, [users.deactivated]);
  await q(`update public.profiles set role = 'admin', sections = '{}', is_super_admin = true where id = $1`, [users.superAdmin]);
  await q(`update public.profiles set role = 'admin', sections = '{quality_analyst}' where id = $1`, [users.qaAdmin]);
  await q(`update public.profiles set role = 'admin', sections = '{curriculum}' where id = $1`, [users.curAdmin]);

  const [course] = (await q(`select id from public.courses order by sort_order limit 1`)).rows;
  const [mentor] = (await q(`select id from public.mentors limit 1`)).rows;
  check('Courses and mentors are seeded', Boolean(course && mentor));

  const qaCase = (await q(`insert into public.qa_cases (source, customer_name, is_sample)
    values ('Survey', 'RLS test', true) returning id`)).rows[0].id;
  const mentorCase = (await q(`insert into public.mentor_cases (customer_name, mentor_id, status, is_sample)
    values ('RLS test', $1, 'New', true) returning id`, [mentor.id])).rows[0].id;

  // ---------------------------------------------------------------------------
  console.log('\nSigned-out visitor');
  check('Cannot read any cases', denied(await as('anon', run('select * from public.qa_cases'))));

  // ---------------------------------------------------------------------------
  console.log('\nViewer');
  let r = await as(users.viewer, run('select id from public.qa_cases where id = $1', [qaCase]));
  check('Can read Quality Analyst cases', r.ok && r.rowCount === 1, r.message);
  check('Cannot add a Quality Analyst case', denied(await as(users.viewer,
    run(`insert into public.qa_cases (source) values ('Survey')`))));
  check('Cannot add a Curriculum case', denied(await as(users.viewer,
    run(`insert into public.curriculum_customer_cases (customer_name) values ('x')`))));
  check('Cannot add a Mentor case', denied(await as(users.viewer,
    run(`insert into public.mentor_cases (customer_name) values ('x')`))));
  check('Cannot add an Instructor request', denied(await as(users.viewer,
    run(`insert into public.curriculum_instructor_requests (requester_name) values ('x')`))));
  r = await as(users.viewer, run(`update public.qa_cases set notes = 'x' where id = $1`, [qaCase]));
  check('Cannot edit a case (0 rows changed)', r.ok && r.rowCount === 0, r.message);
  r = await as(users.viewer, run(`delete from public.qa_cases where id = $1`, [qaCase]));
  check('Cannot delete a case (0 rows deleted)', r.ok && r.rowCount === 0, r.message);
  r = await as(users.viewer, run('select public.check_write_access() as a'));
  check('"Test my write access" reports no sections',
    sameAccess(r, { quality_analyst: false, curriculum: false, mentor: false }),
    r.message ?? JSON.stringify(r.rows?.[0]?.a));
  r = await as(users.viewer, run(`update public.profiles set role = 'admin' where id = $1`, [users.viewer]));
  check('Cannot promote themselves', r.ok && r.rowCount === 0, r.message);
  check('Cannot change their email in the profile table', denied(await as(users.viewer,
    run(`update public.profiles set email = 'x@example.invalid' where id = $1`, [users.viewer]))));
  r = await as(users.viewer, run('select id from public.profiles'));
  check('Sees only their own profile', r.ok && r.rowCount === 1, r.message);
  r = await as(users.viewer, run('select id from public.activity_log'));
  check('Cannot read the activity log', r.ok && r.rowCount === 0, r.message);
  check('Cannot write to the activity log', denied(await as(users.viewer,
    run(`insert into public.activity_log (action, record_type) values ('x', 'x')`))));
  check('Cannot change the course list', denied(await as(users.viewer,
    run(`insert into public.courses (name) values ('RLS test course')`))));

  // ---------------------------------------------------------------------------
  console.log('\nAdmin with the Mentor section only');
  r = await as(users.mentorAdmin, async () => {
    await q(`insert into public.mentor_cases (customer_name, case_date) values ('RLS test', '2026-05-10')`);
    await q('reset role');
    const period = await q(`select year, quarter from public.mentor_cases where customer_name = 'RLS test' and case_date = '2026-05-10'`);
    const log = await q(`select section from public.activity_log where actor_id = $1 and action = 'Added a case'`, [users.mentorAdmin]);
    return { period: period.rows[0], log: log.rows };
  });
  check('Can add a Mentor case', r.ok, r.message);
  check('Year and quarter are filled from the date', r.period?.year === 2026 && r.period?.quarter === 'Q2');
  check('Adding is recorded in the activity log', r.log?.length === 1 && r.log[0].section === 'mentor');
  r = await as(users.mentorAdmin, async () => {
    const u = await q(`update public.mentor_cases set status = 'Closed' where id = $1`, [mentorCase]);
    await q('reset role');
    const log = await q(`select summary, changes from public.activity_log where record_id = $1 and action = 'Edited a case'`, [mentorCase]);
    return { rowCount: u.rowCount, log: log.rows };
  });
  check('Can edit a Mentor case', r.ok && r.rowCount === 1, r.message);
  check('Edit is logged with before/after values',
    r.log?.[0]?.changes?.status?.before === 'New' && r.log?.[0]?.changes?.status?.after === 'Closed');
  r = await as(users.mentorAdmin, run(`delete from public.mentor_cases where id = $1`, [mentorCase]));
  check('Can delete a Mentor case', r.ok && r.rowCount === 1, r.message);
  check('Cannot add a Quality Analyst case', denied(await as(users.mentorAdmin,
    run(`insert into public.qa_cases (source) values ('Survey')`))));
  check('Cannot add a Curriculum customer case', denied(await as(users.mentorAdmin,
    run(`insert into public.curriculum_customer_cases (customer_name) values ('x')`))));
  check('Cannot add a Curriculum instructor request', denied(await as(users.mentorAdmin,
    run(`insert into public.curriculum_instructor_requests (requester_name) values ('x')`))));
  r = await as(users.mentorAdmin, run(`update public.qa_cases set notes = 'x' where id = $1`, [qaCase]));
  check('Cannot edit a Quality Analyst case', r.ok && r.rowCount === 0, r.message);
  r = await as(users.mentorAdmin, run('select public.check_write_access() as a'));
  check('"Test my write access" reports Mentor only',
    sameAccess(r, { quality_analyst: false, curriculum: false, mentor: true }),
    r.message ?? JSON.stringify(r.rows?.[0]?.a));
  const probeLeft = await q(`select count(*)::int as n from public.mentor_cases where customer_name like 'Write access check%'`);
  check('The write test leaves nothing behind', probeLeft.rows[0].n === 0);

  // ---------------------------------------------------------------------------
  // Each admin edits only their own section and can still view the others.
  const INSERTS = {
    quality_analyst: `insert into public.qa_cases (source) values ('Survey')`,
    curriculum: `insert into public.curriculum_customer_cases (customer_name) values ('x')`,
    mentor: `insert into public.mentor_cases (customer_name) values ('x')`,
  };
  const TABLES = { quality_analyst: 'qa_cases', curriculum: 'curriculum_customer_cases', mentor: 'mentor_cases' };
  const NAMES = { quality_analyst: 'Quality Analyst', curriculum: 'Curriculum', mentor: 'Mentor' };
  for (const [key, own] of [['qaAdmin', 'quality_analyst'], ['curAdmin', 'curriculum']]) {
    console.log(`\nAdmin with the ${NAMES[own]} section only`);
    check(`Can add a ${NAMES[own]} case`, (await as(users[key], run(INSERTS[own]))).ok);
    for (const other of Object.keys(INSERTS).filter((k) => k !== own)) {
      const blocked = denied(await as(users[key], run(INSERTS[other])));
      const canView = (await as(users[key], run(`select id from public.${TABLES[other]} limit 1`))).ok;
      check(`Can view ${NAMES[other]} but cannot add to it`, blocked && canView);
    }
    r = await as(users[key], run('select public.check_write_access() as a'));
    check('The database reports only their own section as editable',
      sameAccess(r, { quality_analyst: own === 'quality_analyst', curriculum: own === 'curriculum', mentor: false }),
      r.message ?? JSON.stringify(r.rows?.[0]?.a));
  }

  console.log('\nViewers are view-only');
  for (const [what, sql] of [['sections', `update public.profiles set sections = '{mentor}' where id = $1`],
    ['super-admin', `update public.profiles set is_super_admin = true where id = $1`]]) {
    await q('savepoint viewer_rule');
    try {
      await q(sql, [users.viewer]);
      check(`A Viewer can't be given ${what}`, false, 'update was allowed');
    } catch (err) {
      check(`A Viewer can't be given ${what}`, /profiles_viewer_read_only/.test(err.message), err.message);
    }
    await q('rollback to savepoint viewer_rule');
  }

  // ---------------------------------------------------------------------------
  console.log('\nDeactivated user');
  const ban = await q('select banned_until from auth.users where id = $1', [users.deactivated]);
  check('Is banned in Supabase Auth (cannot sign in)', ban.rows[0].banned_until !== null);
  r = await as(users.deactivated, run('select id from public.qa_cases'));
  check('Cannot read any cases', r.ok && r.rowCount === 0, r.message);
  r = await as(stranger, run('select id from public.qa_cases'));
  check('A not-yet-activated account cannot read any cases either', r.ok && r.rowCount === 0, r.message);
  check('Cannot add a Mentor case even though the section is assigned', denied(await as(users.deactivated,
    run(`insert into public.mentor_cases (customer_name) values ('x')`))));

  // ---------------------------------------------------------------------------
  console.log('\nSuper-admin (Admin role, no sections)');
  r = await as(users.superAdmin, run('select id from public.activity_log'));
  check('Can read the activity log', r.ok && r.rowCount > 0, r.message);
  r = await as(users.superAdmin, run('select id from public.profiles where id = any($1)', [Object.values(users)]));
  check('Can see all profiles', r.ok && r.rowCount === Object.keys(users).length, r.message);
  check('Cannot add cases (role and sections still apply)', denied(await as(users.superAdmin,
    run(`insert into public.qa_cases (source) values ('Survey')`))));
  r = await as(users.superAdmin, async () => {
    const u = await q(`update public.profiles set role = 'admin', sections = '{curriculum}' where id = $1`, [users.viewer]);
    await q('reset role');
    const log = await q(`select action from public.activity_log where record_id = $1 and actor_id = $2`, [users.viewer, users.superAdmin]);
    return { rowCount: u.rowCount, actions: log.rows.map((x) => x.action) };
  });
  check('Can change another user\'s role and sections', r.ok && r.rowCount === 1, r.message);
  check('Role change is logged', r.actions?.includes('Changed a role'));
  r = await as(users.superAdmin, async () => {
    await q(`update public.profiles set status = 'deactivated' where id = $1`, [users.viewer]);
    await q('reset role');
    const ban2 = await q('select banned_until from auth.users where id = $1', [users.viewer]);
    const log = await q(`select action from public.activity_log where record_id = $1 and actor_id = $2`, [users.viewer, users.superAdmin]);
    return { banned: ban2.rows[0].banned_until !== null, actions: log.rows.map((x) => x.action) };
  });
  check('Deactivating a user bans them in Auth', r.ok && r.banned, r.message);
  check('Deactivation is logged', r.actions?.includes('Deactivated a user'));

  // ---------------------------------------------------------------------------
  console.log('\nSafety rules');
  await q('savepoint guard');
  await q(`update public.profiles set is_super_admin = false where is_super_admin and id <> $1`, [users.superAdmin]);
  try {
    await q(`update public.profiles set is_super_admin = false where id = $1`, [users.superAdmin]);
    check('The last super-admin cannot be removed', false, 'update was allowed');
  } catch (err) {
    check('The last super-admin cannot be removed', /At least one active super-admin/.test(err.message), err.message);
  }
  await q('rollback to savepoint guard');

  await q('savepoint returned');
  try {
    await q(`insert into public.qa_cases (source, course_id) values ('Returned', $1)`, [course.id]);
    check('Returned cases use the multi-course list, not the single course field', false, 'insert was allowed');
  } catch {
    check('Returned cases use the multi-course list, not the single course field', true);
  }
  await q('rollback to savepoint returned');

  await q('savepoint multicourse');
  try {
    await q(`insert into public.qa_case_courses (case_id, course_id) values ($1, $2)`, [qaCase, course.id]);
    check('Only Returned cases can have several courses', false, 'insert was allowed');
  } catch {
    check('Only Returned cases can have several courses', true);
  }
  await q('rollback to savepoint multicourse');

  // ---------------------------------------------------------------------------
  console.log('\nAdmin Dashboard support');
  const invited = randomUUID();
  await q(
    `insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
     values ($1, 'authenticated', 'authenticated', $2, '{"full_name":"RLS test invited","department":"QA"}', $3::jsonb, now(), now())`,
    [invited, `rls-test-invited-${invited.slice(0, 8)}@example.invalid`,
      JSON.stringify({ eh_approved: true, eh_role: 'admin', eh_sections: ['curriculum', 'not_a_section'], eh_super_admin: false })]);
  const inv = (await q('select role, sections, is_super_admin, status, department from public.profiles where id = $1', [invited])).rows[0];
  check('A user created by the Admin Dashboard gets their role and sections straight away',
    inv?.role === 'admin' && JSON.stringify(inv.sections) === JSON.stringify(['curriculum']) && inv.status === 'active' && inv.department === 'QA',
    JSON.stringify(inv));
  check('A viewer cannot write to the log through the admin helper', denied(await as(users.viewer,
    run(`select public.admin_log_event('x', 'x', 'x', 'x')`))));
  check('A viewer cannot claim log entries', denied(await as(users.viewer,
    run(`select public.admin_claim_event('x', 'x')`))));
  r = await as(users.superAdmin, async () => {
    await q(`select public.admin_log_event('Set a new password', $1, 'RLS test viewer', null)`, [users.viewer]);
    await q('reset role');
    const log = await q(`select actor_id from public.activity_log where action = 'Set a new password' and record_id = $1`, [users.viewer]);
    return { actor: log.rows[0]?.actor_id };
  });
  check('A super-admin action with no table trigger is logged under their name', r.ok && r.actor === users.superAdmin, r.message);
  await q('savepoint skip');
  await q(`set local app.skip_audit = 'on'`);
  const skipped = (await q(`insert into public.mentor_cases (customer_name, is_sample) values ('RLS skip test', true) returning id`)).rows[0].id;
  const skipLog = await q('select count(*)::int as n from public.activity_log where record_id = $1', [skipped]);
  check('The one-time import can skip the activity log', skipLog.rows[0].n === 0);
  await q('rollback to savepoint skip');
  const label = await q(`select record_label from public.activity_log where record_id = $1 and action = 'Added a case' limit 1`, [mentorCase]);
  check('Log entries name the record by customer', label.rows[0]?.record_label === 'RLS test', label.rows[0]?.record_label);

  // ---------------------------------------------------------------------------
  console.log('\nLogin history');
  const sessionId = randomUUID();
  await q(`insert into auth.sessions (id, user_id, created_at, updated_at) values ($1, $2, now(), now())`,
    [sessionId, users.mentorAdmin]);
  const login = await q('select user_id from public.login_history where session_id = $1', [sessionId]);
  check('A new sign-in session writes a Login History row', login.rows[0]?.user_id === users.mentorAdmin);
} catch (err) {
  failed++;
  console.error(`\n✖ The test stopped early: ${err.message}`);
} finally {
  await q('rollback');
  await client.end();
}

console.log(`\n${passed} passed, ${failed} failed. All test data was rolled back.\n`);
process.exit(failed ? 1 : 0);
