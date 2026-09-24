'use server';

import { friendlyError, sanitize, type ActionResult, type Spec } from '@/lib/records/sanitize';
import { createClient } from '@/lib/supabase/server';

// All writes run as the signed-in user, so row-level security has the final
// say: only active admins with the Mentor section can change anything.

const NO_PERMISSION = 'You don’t have permission to change Mentor cases.';

const SPEC: Spec = {
  case_date: 'date',
  year: { number: { min: 2000, max: 2100, integer: true } },
  quarter: { oneOf: ['Q1', 'Q2', 'Q3', 'Q4'] },
  customer_name: 'text', mentor_id: 'uuid', course_id: 'uuid', complaint_type: 'text', complaint_sub_type: 'text',
  complaint_analysis: { oneOf: ['Valid', 'Partially Valid', 'Not Valid'] },
  status: 'text', case_closed_by: 'text', email_sent: 'bool', email_sms_preview: 'text', case_link: 'url', field_notes: 'notes',
};

export async function createMentorCase(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('mentor_cases')
    .insert({ case_date: new Date().toISOString().slice(0, 10), status: 'New' })
    .select('id').single();
  if (error) return { ok: false, error: friendlyError(error, NO_PERMISSION) };
  return { ok: true, id: data.id };
}

export async function updateMentorCase(id: string, patch: Record<string, unknown>): Promise<ActionResult> {
  const clean = sanitize(patch, SPEC);
  if ('error' in clean) return { ok: false, error: clean.error };
  if (!Object.keys(clean.values).length) return { ok: true };
  const supabase = await createClient();
  const { data, error } = await supabase.from('mentor_cases').update(clean.values).eq('id', id).select('id');
  if (error) return { ok: false, error: friendlyError(error, NO_PERMISSION) };
  if (!data?.length) return { ok: false, error: NO_PERMISSION };
  return { ok: true };
}

export async function deleteMentorCase(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('mentor_cases').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: friendlyError(error, NO_PERMISSION) };
  if (!data?.length) return { ok: false, error: NO_PERMISSION };
  return { ok: true };
}
