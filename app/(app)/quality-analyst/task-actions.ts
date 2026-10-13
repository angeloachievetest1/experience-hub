'use server';

import { friendlyError, sanitize, type ActionResult, type Spec } from '@/lib/records/sanitize';
import { createClient } from '@/lib/supabase/server';

// Task Log (Operation Tasks). All writes run as the signed-in user, so
// row-level security has the final say: only active admins with the Quality
// Analyst section can change anything.

const NO_PERMISSION = 'You don’t have permission to change Quality Analyst cases.';

// Dropdowns are free text on purpose: the lists live on Case options, and Type
// and Error 1 also take a typed-in value ("Others").
const SPEC: Spec = {
  customer_name: 'text', case_link: 'url', subject: 'text', case_type: 'text', record_type: 'text', manager: 'text',
  opened_at: 'datetime', first_touch_at: 'datetime', closed_at: 'datetime', date_closed: 'date',
  handled_by: 'text', no_error: 'bool', error_type: 'text', error_category: 'text', auditor: 'text', call_outs: 'text',
};

// New case: closed today, with any starting values the Task Log suggests.
export async function createTaskCase(preset: Record<string, unknown> = {}): Promise<ActionResult> {
  const clean = sanitize(preset, SPEC);
  if ('error' in clean) return { ok: false, error: clean.error };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('qa_task_cases')
    .insert({ date_closed: new Date().toISOString().slice(0, 10), ...clean.values })
    .select('id').single();
  if (error) return { ok: false, error: friendlyError(error, NO_PERMISSION) };
  return { ok: true, id: data.id };
}

export async function updateTaskCase(id: string, patch: Record<string, unknown>): Promise<ActionResult> {
  const clean = sanitize(patch, SPEC);
  if ('error' in clean) return { ok: false, error: clean.error };
  if (!Object.keys(clean.values).length) return { ok: true };
  const supabase = await createClient();
  const { data, error } = await supabase.from('qa_task_cases').update(clean.values).eq('id', id).select('id');
  if (error) return { ok: false, error: friendlyError(error, NO_PERMISSION) };
  if (!data?.length) return { ok: false, error: NO_PERMISSION };
  return { ok: true };
}

export async function deleteTaskCase(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('qa_task_cases').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: friendlyError(error, NO_PERMISSION) };
  if (!data?.length) return { ok: false, error: NO_PERMISSION };
  return { ok: true };
}
