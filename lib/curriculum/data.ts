import 'server-only';
import { canWriteSection, requireActiveProfile } from '@/lib/auth';
import { fetchAll, loadCourses, loadOptions } from '@/lib/records/load';
import { createClient } from '@/lib/supabase/server';
import type { CurCase, CurData, CurRequest } from './types';

// Everything the Curriculum pages need, read as the signed-in user.
export async function loadCurriculumData(): Promise<CurData> {
  const profile = await requireActiveProfile();
  const supabase = await createClient();

  const [cases, requests, courses, { options }] = await Promise.all([
    fetchAll<CurCase>(supabase, 'curriculum_customer_cases', '*', [
      { column: 'case_date', ascending: false }, { column: 'case_no', ascending: false },
    ]),
    fetchAll<CurRequest>(supabase, 'curriculum_instructor_requests', '*', [
      { column: 'date_submitted', ascending: false }, { column: 'case_no', ascending: false },
    ]),
    loadCourses(supabase),
    loadOptions(supabase, 'cur_'),
  ]);

  return {
    cases: cases.map((c) => ({
      ...c,
      resolution_tat_days: c.resolution_tat_days === null ? null : Number(c.resolution_tat_days),
      field_notes: c.field_notes ?? {},
    })),
    requests: requests.map((r) => ({ ...r, field_notes: r.field_notes ?? {} })),
    courses,
    options,
    canEdit: canWriteSection(profile, 'curriculum'),
  };
}
