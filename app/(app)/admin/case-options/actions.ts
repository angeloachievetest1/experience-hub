'use server';

import { getCurrentProfile } from '@/lib/auth';
import { LIST_DEFS, type ListDef } from '@/lib/admin/lists';
import type { ActionResult } from '@/lib/records/sanitize';
import { createClient } from '@/lib/supabase/server';

// Case options (Admin Dashboard). Every change runs as the signed-in
// super-admin through database functions (migration 023) that check
// permissions, keep cases in step with a renamed option, and write the
// Activity Log.

const NOT_ALLOWED = 'Only super-admins can change case options.';
const MAX_NAME = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINKED = ['courses', 'instructors', 'mentors'];

type Target = { table: string; listKey: string | null; listLabel: string; def: ListDef };

// Which table a list lives in, and how it's named in the Activity Log.
function target(listKey: string): Target | null {
  const def = LIST_DEFS.find((d) => d.key === listKey);
  if (!def || def.locked) return null;
  const linked = LINKED.includes(def.key);
  return {
    table: linked ? def.key : 'option_values',
    listKey: linked ? null : def.key,
    listLabel: def.group === 'Shared' ? def.label : `${def.group} › ${def.label}`,
    def,
  };
}

async function superAdmin() {
  const me = await getCurrentProfile();
  return Boolean(me && me.status === 'active' && me.is_super_admin);
}

function cleanName(name: unknown): string | null {
  const v = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  return v && v.length <= MAX_NAME ? v : null;
}

function dbError(error: { code?: string; message: string }): string {
  if (error.code === '42501') return NOT_ALLOWED;
  if (error.code === '23505') return 'That name is already in this list.';
  if (error.code === '23503') return 'Cases still use this option, so it can’t be deleted. Hide it instead.';
  if (error.code === 'P0001') return error.message; // the database's own explanations
  return `Something went wrong: ${error.message}`;
}

async function call(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, id: typeof data === 'string' ? data : undefined };
}

async function change(action: 'add' | 'hide' | 'show' | 'delete', listKey: string, id: string | null, name: string | null): Promise<ActionResult> {
  if (!(await superAdmin())) return { ok: false, error: NOT_ALLOWED };
  const t = target(listKey);
  if (!t) return { ok: false, error: 'This list can’t be changed.' };
  if (id !== null && !UUID.test(id)) return { ok: false, error: 'Unknown option.' };
  return call('change_case_option', {
    p_action: action, p_table: t.table, p_list_key: t.listKey, p_id: id, p_name: name, p_list_label: t.listLabel,
  });
}

export async function addCaseOption(listKey: string, name: string): Promise<ActionResult> {
  const clean = cleanName(name);
  if (!clean) return { ok: false, error: `Enter a name of up to ${MAX_NAME} characters.` };
  return change('add', listKey, null, clean);
}

export async function setCaseOptionHidden(listKey: string, id: string, hidden: boolean): Promise<ActionResult> {
  return change(hidden ? 'hide' : 'show', listKey, id, null);
}

export async function deleteCaseOption(listKey: string, id: string): Promise<ActionResult> {
  return change('delete', listKey, id, null);
}

// Renaming a text option also updates every case that uses it (one log entry).
export async function renameCaseOption(listKey: string, id: string, name: string): Promise<ActionResult> {
  if (!(await superAdmin())) return { ok: false, error: NOT_ALLOWED };
  const t = target(listKey);
  const clean = cleanName(name);
  if (!t) return { ok: false, error: 'This list can’t be changed.' };
  if (!UUID.test(id)) return { ok: false, error: 'Unknown option.' };
  if (!clean) return { ok: false, error: `Enter a name of up to ${MAX_NAME} characters.` };
  return call('rename_case_option', { p_table: t.table, p_list_key: t.listKey, p_id: id, p_name: clean, p_list_label: t.listLabel });
}

// ids: the whole list in its new order; movedId: the option that was dragged.
export async function reorderCaseOptions(listKey: string, ids: string[], movedId: string): Promise<ActionResult> {
  if (!(await superAdmin())) return { ok: false, error: NOT_ALLOWED };
  const t = target(listKey);
  if (!t) return { ok: false, error: 'This list can’t be changed.' };
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string' && UUID.test(x)) || !UUID.test(movedId)) {
    return { ok: false, error: 'Unknown option.' };
  }
  return call('reorder_case_options', { p_table: t.table, p_list_key: t.listKey, p_ids: ids, p_moved: movedId, p_list_label: t.listLabel });
}
