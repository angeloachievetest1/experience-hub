'use server';

import { getCurrentProfile } from '@/lib/auth';
import type { ActionResult } from '@/lib/records/sanitize';
import { SECTION_KEYS, type SectionKey } from '@/lib/sections';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

// User management for the Admin Dashboard.
// - Every action first checks the caller is an active super-admin.
// - Profile changes (role, sections, status, ...) run as the signed-in user,
//   so row-level security and the audit trigger see who made them.
// - Only account-level operations (create, email, password, delete) use the
//   secret key, and only here on the server.

const NOT_ALLOWED = 'Only super-admins can manage users.';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

async function superAdmin() {
  const me = await getCurrentProfile();
  return me && me.status === 'active' && me.is_super_admin ? me : null;
}

function cleanSections(value: unknown): SectionKey[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((s) => SECTION_KEYS.includes(s as SectionKey))) return null;
  return [...new Set(value as SectionKey[])];
}

function authError(message: string) {
  if (/already (been )?registered|already exists/i.test(message)) return 'A user with this email already exists.';
  if (/password/i.test(message)) return `Password problem: ${message}`;
  return `Something went wrong: ${message}`;
}

export type NewUser = {
  full_name: string;
  email: string;
  password: string;
  department: string;
  role: 'viewer' | 'admin';
  sections: SectionKey[];
  is_super_admin: boolean;
};

export async function createUser(input: NewUser): Promise<ActionResult> {
  if (!(await superAdmin())) return { ok: false, error: NOT_ALLOWED };
  const full_name = input.full_name?.trim();
  const email = input.email?.trim().toLowerCase();
  const sections = cleanSections(input.sections);
  if (!full_name) return { ok: false, error: 'Enter the person’s full name.' };
  if (!email || !EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (!input.password || input.password.length < MIN_PASSWORD) return { ok: false, error: `The password must be at least ${MIN_PASSWORD} characters.` };
  if (!['viewer', 'admin'].includes(input.role)) return { ok: false, error: 'Choose a role.' };
  if (!sections) return { ok: false, error: 'Invalid sections.' };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name, department: input.department?.trim() || null },
    app_metadata: {
      eh_approved: true,
      eh_role: input.role,
      eh_sections: input.role === 'admin' ? sections : [],
      eh_super_admin: Boolean(input.is_super_admin),
    },
  });
  if (error || !data.user) return { ok: false, error: authError(error?.message ?? 'No user returned.') };

  const supabase = await createClient();
  await supabase.rpc('admin_claim_event', { p_record_id: data.user.id, p_action: 'Created a user' });
  return { ok: true, id: data.user.id };
}

export async function updateUser(id: string, patch: Record<string, unknown>): Promise<ActionResult> {
  if (!(await superAdmin())) return { ok: false, error: NOT_ALLOWED };
  const values: Record<string, unknown> = {};
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  for (const [key, raw] of Object.entries(patch)) {
    switch (key) {
      case 'full_name':
        if (!text(raw)) return { ok: false, error: 'The name can’t be empty.' };
        values.full_name = text(raw);
        break;
      case 'department':
      case 'deactivation_note':
        values[key] = text(raw);
        break;
      case 'role':
        if (raw !== 'viewer' && raw !== 'admin') return { ok: false, error: 'Choose a role.' };
        values.role = raw;
        break;
      case 'status':
        if (raw !== 'active' && raw !== 'deactivated') return { ok: false, error: 'Choose a status.' };
        values.status = raw;
        break;
      case 'is_super_admin':
        if (typeof raw !== 'boolean') return { ok: false, error: 'Invalid super-admin value.' };
        values.is_super_admin = raw;
        break;
      case 'sections': {
        const s = cleanSections(raw ?? []);
        if (!s) return { ok: false, error: 'Invalid sections.' };
        values.sections = s;
        break;
      }
      case 'email':
        break; // handled below
      default:
        return { ok: false, error: `The field “${key}” can’t be changed here.` };
    }
  }

  // Email lives in Supabase Auth; the profile copy follows automatically.
  if ('email' in patch) {
    const email = text(patch.email)?.toLowerCase();
    if (!email || !EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' };
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
    if (error) return { ok: false, error: authError(error.message) };
    const supabase = await createClient();
    await supabase.rpc('admin_claim_event', { p_record_id: id, p_action: 'Edited a user' });
  }

  if (Object.keys(values).length) {
    const supabase = await createClient();
    const { data, error } = await supabase.from('profiles').update(values).eq('id', id).select('id');
    if (error) {
      if (/At least one active super-admin/.test(error.message)) {
        return { ok: false, error: 'At least one active super-admin is required. Give someone else the super-admin flag first.' };
      }
      return { ok: false, error: `Something went wrong: ${error.message}` };
    }
    if (!data?.length) return { ok: false, error: NOT_ALLOWED };
  }
  return { ok: true };
}

export async function setUserPassword(id: string, password: string): Promise<ActionResult> {
  if (!(await superAdmin())) return { ok: false, error: NOT_ALLOWED };
  if (!password || password.length < MIN_PASSWORD) return { ok: false, error: `The password must be at least ${MIN_PASSWORD} characters.` };
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return { ok: false, error: authError(error.message) };
  const supabase = await createClient();
  const label = (data.user?.user_metadata?.full_name as string | undefined) || data.user?.email || null;
  await supabase.rpc('admin_log_event', { p_action: 'Set a new password', p_record_id: id, p_label: label, p_summary: null });
  return { ok: true };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const me = await superAdmin();
  if (!me) return { ok: false, error: NOT_ALLOWED };
  if (me.id === id) return { ok: false, error: 'You can’t delete your own account. Ask another super-admin.' };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    if (/super-admin/i.test(error.message)) return { ok: false, error: 'At least one active super-admin is required.' };
    return { ok: false, error: `Something went wrong: ${error.message}` };
  }
  const supabase = await createClient();
  await supabase.rpc('admin_claim_event', { p_record_id: id, p_action: 'Deleted a user' });
  return { ok: true };
}
