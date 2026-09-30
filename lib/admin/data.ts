import 'server-only';
import { requireSuperAdmin } from '@/lib/auth';
import { fetchAll } from '@/lib/records/load';
import { createClient } from '@/lib/supabase/server';
import { LIST_DEFS, type CaseTable, type ListData, type ListItem, type ListUse } from './lists';
import type { ActivityRow, AdminUser, LoginRow } from './types';

// All reads go through row-level security: only super-admins get rows back.

export async function loadUsers(): Promise<{ users: AdminUser[]; meId: string }> {
  const me = await requireSuperAdmin();
  const supabase = await createClient();
  const [profiles, logins] = await Promise.all([
    fetchAll<Omit<AdminUser, 'last_sign_in'>>(supabase, 'profiles',
      'id, email, full_name, department, role, sections, is_super_admin, status, deactivation_note, created_at, updated_at',
      [{ column: 'full_name' }]),
    fetchAll<{ user_id: string; signed_in_at: string }>(supabase, 'login_history', 'user_id, signed_in_at',
      [{ column: 'signed_in_at', ascending: false }]),
  ]);
  const last = new Map<string, string>();
  for (const l of logins) if (!last.has(l.user_id)) last.set(l.user_id, l.signed_in_at);
  return {
    users: profiles.map((p) => ({ ...p, last_sign_in: last.get(p.id) ?? null })),
    meId: me.id,
  };
}

export async function loadActivity(): Promise<{ rows: ActivityRow[]; names: Record<string, string> }> {
  await requireSuperAdmin();
  const supabase = await createClient();
  const [rows, courses, instructors, mentors] = await Promise.all([
    fetchAll<ActivityRow>(supabase, 'activity_log', '*', [{ column: 'id', ascending: false }]),
    fetchAll<{ id: string; name: string }>(supabase, 'courses', 'id, name', [{ column: 'name' }]),
    fetchAll<{ id: string; full_name: string }>(supabase, 'instructors', 'id, full_name', [{ column: 'full_name' }]),
    fetchAll<{ id: string; full_name: string }>(supabase, 'mentors', 'id, full_name', [{ column: 'full_name' }]),
  ]);
  // Lets the log show "Biology" instead of a course's internal id.
  const names: Record<string, string> = {};
  for (const c of courses) names[c.id] = c.name;
  for (const i of [...instructors, ...mentors]) names[i.id] = i.full_name;
  return { rows: rows.map((r) => ({ ...r, changes: r.changes ?? {} })), names };
}

type Row = Record<string, unknown>;

// Every dropdown list (hidden values included) and how many cases use each value.
export async function loadLists(): Promise<ListData[]> {
  await requireSuperAdmin();
  const supabase = await createClient();
  const byId = [{ column: 'id' }];
  const [courses, instructors, mentors, options, qa, qaCourses, curCases, curRequests, mentorCases] = await Promise.all([
    fetchAll<{ id: string; name: string; is_active: boolean }>(supabase, 'courses', 'id, name, is_active', [{ column: 'sort_order' }, { column: 'name' }]),
    fetchAll<{ id: string; full_name: string; aliases: string[]; is_active: boolean }>(supabase, 'instructors', 'id, full_name, aliases, is_active', [{ column: 'full_name' }]),
    fetchAll<{ id: string; full_name: string; is_active: boolean }>(supabase, 'mentors', 'id, full_name, is_active', [{ column: 'full_name' }]),
    fetchAll<{ id: string; list_key: string; value: string; is_active: boolean }>(supabase, 'option_values', 'id, list_key, value, is_active', [{ column: 'sort_order' }, { column: 'value' }]),
    fetchAll<Row>(supabase, 'qa_cases', 'id, source, course_id, instructor_id, category, complaint_types, validity, followup_email, followup_sms, followup_call, customer_reached, resolution, case_closed_by, survey_type, reason_type, reassign_reason', byId),
    fetchAll<{ case_id: string; course_id: string }>(supabase, 'qa_case_courses', 'case_id, course_id', [{ column: 'case_id' }]),
    fetchAll<Row>(supabase, 'curriculum_customer_cases', 'id, course_id, category, issue_type, material_type, case_source, case_resolution, case_status_in_sf', byId),
    fetchAll<Row>(supabase, 'curriculum_instructor_requests', 'id, course_id, feedback_type, base_material, status', byId),
    fetchAll<Row>(supabase, 'mentor_cases', 'id, mentor_id, course_id, complaint_type, complaint_sub_type, case_type, case_closed_by, status, complaint_analysis', byId),
  ]);
  const tables: Record<CaseTable, Row[]> = {
    qa_cases: qa, curriculum_customer_cases: curCases, curriculum_instructor_requests: curRequests, mentor_cases: mentorCases,
  };

  const tally = (map: Map<string, number>, key: unknown) => {
    if (typeof key === 'string' && key) map.set(key, (map.get(key) ?? 0) + 1);
  };
  // Courses: each case counts once per course (Returned cases can have several).
  const courseUses = new Map<string, number>();
  const returned = new Map<string, Set<string>>();
  for (const l of qaCourses) returned.set(l.case_id, (returned.get(l.case_id) ?? new Set()).add(l.course_id));
  for (const c of qa) for (const id of new Set([c.course_id, ...(returned.get(c.id as string) ?? [])])) tally(courseUses, id);
  for (const c of [...curCases, ...curRequests, ...mentorCases]) tally(courseUses, c.course_id);
  const instructorUses = new Map<string, number>();
  for (const c of qa) tally(instructorUses, c.instructor_id);
  const mentorUses = new Map<string, number>();
  for (const c of mentorCases) tally(mentorUses, c.mentor_id);

  // Text lists: a case counts once if any of the list's fields holds the value.
  const textUses = (uses: ListUse[]) => {
    const map = new Map<string, number>();
    for (const u of uses) {
      for (const row of tables[u.table]) {
        if (u.source && row.source !== u.source) continue;
        const values = new Set(u.columns.flatMap((col) => (Array.isArray(row[col]) ? row[col] as string[] : [row[col]])));
        for (const v of values) tally(map, v);
      }
    }
    return map;
  };

  return LIST_DEFS.map((def) => {
    let items: ListItem[];
    if (def.key === 'courses') {
      items = courses.map((c) => ({ id: c.id, name: c.name, hidden: !c.is_active, uses: courseUses.get(c.id) ?? 0 }));
    } else if (def.key === 'instructors') {
      items = instructors.map((i) => ({ id: i.id, name: i.full_name, hidden: !i.is_active, uses: instructorUses.get(i.id) ?? 0, aliases: i.aliases }));
    } else if (def.key === 'mentors') {
      items = mentors.map((m) => ({ id: m.id, name: m.full_name, hidden: !m.is_active, uses: mentorUses.get(m.id) ?? 0 }));
    } else {
      const counts = textUses(def.uses ?? []);
      items = options.filter((o) => o.list_key === def.key)
        .map((o) => ({ id: o.id, name: o.value, hidden: !o.is_active, uses: counts.get(o.value) ?? 0 }));
    }
    return { ...def, items };
  });
}

export async function loadLogins(): Promise<LoginRow[]> {
  await requireSuperAdmin();
  const supabase = await createClient();
  return fetchAll<LoginRow>(supabase, 'login_history', 'id, signed_in_at, user_id, user_email, user_name',
    [{ column: 'signed_in_at', ascending: false }]);
}
