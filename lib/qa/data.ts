import 'server-only';
import { canWriteSection, requireActiveProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { DataGap, QaCase, QaData } from './types';

const PAGE = 1000; // Supabase returns at most 1000 rows per request

// Loads everything the Quality Analyst pages need, as the signed-in user
// (row-level security decides what comes back).
export async function loadQaData(): Promise<QaData> {
  const profile = await requireActiveProfile();
  const supabase = await createClient();

  const cases: QaCase[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('qa_cases')
      .select('*, qa_case_courses(course_id)')
      .order('case_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not load Quality Analyst cases: ${error.message}`);
    for (const row of data ?? []) {
      const { qa_case_courses, ...rest } = row as Record<string, unknown> & { qa_case_courses: { course_id: string }[] };
      cases.push({
        ...(rest as unknown as QaCase),
        complaint_types: (rest.complaint_types as string[] | null) ?? [],
        field_notes: (rest.field_notes as Record<string, string> | null) ?? {},
        course_ids: (qa_case_courses ?? []).map((x) => x.course_id),
        attendance_pct: toNumber(rest.attendance_pct),
        participation_pct: toNumber(rest.participation_pct),
        moodle_pct: toNumber(rest.moodle_pct),
      });
    }
    if (!data || data.length < PAGE) break;
  }

  const [courses, instructors, options, gaps] = await Promise.all([
    supabase.from('courses').select('id, name').eq('is_active', true).order('sort_order'),
    supabase.from('instructors').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('option_values').select('list_key, value, description').eq('is_active', true).order('sort_order'),
    supabase.from('qa_data_gaps').select('source, start_month, end_month, note'),
  ]);
  for (const r of [courses, instructors, options, gaps]) {
    if (r.error) throw new Error(`Could not load lookup lists: ${r.error.message}`);
  }

  const optionMap: Record<string, string[]> = {};
  const optionNames: Record<string, Record<string, string>> = {};
  for (const o of options.data ?? []) {
    if (!o.list_key.startsWith('qa_')) continue;
    (optionMap[o.list_key] ??= []).push(o.value);
    if (o.description) (optionNames[o.list_key] ??= {})[o.value] = o.description;
  }

  return {
    cases,
    courses: (courses.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    instructors: (instructors.data ?? []).map((i) => ({ id: i.id, name: i.full_name })),
    options: optionMap,
    optionNames,
    gaps: (gaps.data ?? []).map((g) => ({
      source: g.source,
      start: String(g.start_month).slice(0, 7),
      end: String(g.end_month).slice(0, 7),
      note: g.note,
    })) as DataGap[],
    canEdit: canWriteSection(profile, 'quality_analyst'),
  };
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
