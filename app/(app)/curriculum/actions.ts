'use server';

import { friendlyError, sanitize, type ActionResult, type Spec } from '@/lib/records/sanitize';
import { createClient } from '@/lib/supabase/server';

// All writes run as the signed-in user, so row-level security has the final
// say: only active admins with the Curriculum section can change anything.

const NO_PERMISSION = 'You don’t have permission to change Curriculum records.';

const CASE_SPEC: Spec = {
  case_date: 'date', customer_name: 'text', course_id: 'uuid', category: 'text', material_type: 'text', issue_type: 'text', case_source: 'text',
  case_resolution: 'text', case_status_in_sf: 'text', curriculum_sme: 'text', tm_on_sf: 'text', comments: 'text', feedback_progress: 'text',
  resolution_tat_days: { number: { min: 0, max: 9999 } }, date_resolved: 'date', case_link: 'url', field_notes: 'notes',
};

const REQUEST_SPEC: Spec = {
  requester_name: 'text', date_submitted: 'date', course_id: 'uuid', feedback_type: 'text', base_material: 'text',
  comments: 'text', status: 'text', notes: 'text', date_completed: 'date', ticket_manager: 'text', field_notes: 'notes',
};

// Saves a new record (nothing is created until the panel's Save button is clicked).
async function insert(table: string, fields: Record<string, unknown>, spec: Spec): Promise<ActionResult> {
  const clean = sanitize(fields, spec);
  if ('error' in clean) return { ok: false, error: clean.error };
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).insert(clean.values).select('id').single();
  if (error) return { ok: false, error: friendlyError(error, NO_PERMISSION) };
  return { ok: true, id: data.id };
}

async function update(table: string, id: string, patch: Record<string, unknown>, spec: Spec): Promise<ActionResult> {
  const clean = sanitize(patch, spec);
  if ('error' in clean) return { ok: false, error: clean.error };
  if (!Object.keys(clean.values).length) return { ok: true };
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).update(clean.values).eq('id', id).select('id');
  if (error) return { ok: false, error: friendlyError(error, NO_PERMISSION) };
  if (!data?.length) return { ok: false, error: NO_PERMISSION };
  return { ok: true };
}

async function remove(table: string, id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).delete().eq('id', id).select('id');
  if (error) return { ok: false, error: friendlyError(error, NO_PERMISSION) };
  if (!data?.length) return { ok: false, error: NO_PERMISSION };
  return { ok: true };
}

// Customer Cases
export async function createCustomerCase(fields: Record<string, unknown>) {
  return insert('curriculum_customer_cases', fields, CASE_SPEC);
}
export async function updateCustomerCase(id: string, patch: Record<string, unknown>) {
  return update('curriculum_customer_cases', id, patch, CASE_SPEC);
}
export async function deleteCustomerCase(id: string) {
  return remove('curriculum_customer_cases', id);
}

// Instructor requests
export async function createRequest(fields: Record<string, unknown>) {
  return insert('curriculum_instructor_requests', fields, REQUEST_SPEC);
}
export async function updateRequest(id: string, patch: Record<string, unknown>) {
  return update('curriculum_instructor_requests', id, patch, REQUEST_SPEC);
}
export async function deleteRequest(id: string) {
  return remove('curriculum_instructor_requests', id);
}
