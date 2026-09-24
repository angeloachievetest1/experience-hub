import 'server-only';
import { requireSuperAdmin } from '@/lib/auth';
import { fetchAll } from '@/lib/records/load';
import { createClient } from '@/lib/supabase/server';
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

export async function loadLogins(): Promise<LoginRow[]> {
  await requireSuperAdmin();
  const supabase = await createClient();
  return fetchAll<LoginRow>(supabase, 'login_history', 'id, signed_in_at, user_id, user_email, user_name',
    [{ column: 'signed_in_at', ascending: false }]);
}
