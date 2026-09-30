import 'server-only';
import { canWriteSection, requireActiveProfile } from '@/lib/auth';
import { fetchAll, loadCourses, loadOptions } from '@/lib/records/load';
import { createClient } from '@/lib/supabase/server';
import type { MentorCase, MentorData } from './types';

// Everything the Mentor pages need, read as the signed-in user.
export async function loadMentorData(): Promise<MentorData> {
  const profile = await requireActiveProfile();
  const supabase = await createClient();

  const [cases, mentors, courses, { options }] = await Promise.all([
    fetchAll<MentorCase>(supabase, 'mentor_cases', '*', [
      { column: 'case_date', ascending: false }, { column: 'created_at', ascending: false },
    ]),
    supabase.from('mentors').select('id, full_name, is_active').order('full_name'), // hidden too, for older cases
    loadCourses(supabase),
    loadOptions(supabase, 'mentor_'),
  ]);
  if (mentors.error) throw new Error(`Could not load mentors: ${mentors.error.message}`);

  return {
    cases: cases.map((c) => ({ ...c, field_notes: c.field_notes ?? {} })),
    mentors: (mentors.data ?? []).map((m) => ({ id: m.id, name: m.full_name, hidden: !m.is_active })),
    courses,
    options,
    canEdit: canWriteSection(profile, 'mentor'),
  };
}
