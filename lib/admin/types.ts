import type { SectionKey } from '@/lib/sections';

export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  department: string | null;
  role: 'viewer' | 'admin';
  sections: SectionKey[];
  is_super_admin: boolean;
  status: 'active' | 'deactivated';
  deactivation_note: string | null;
  created_at: string;
  updated_at: string;
  last_sign_in: string | null;
};

export type ActivityRow = {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  section: SectionKey | null;
  action: string;
  record_type: string;
  record_id: string | null;
  record_label: string | null;
  summary: string | null;
  changes: Record<string, { before: unknown; after: unknown }>;
};

export type LoginRow = {
  id: number;
  signed_in_at: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
};

export const ROLE_LABELS: Record<AdminUser['role'], string> = { viewer: 'Viewer', admin: 'Admin' };
export const STATUS_LABELS: Record<AdminUser['status'], string> = { active: 'Active', deactivated: 'Deactivated' };

export const actorLabel = (r: Pick<ActivityRow, 'actor_name' | 'actor_email'>) =>
  r.actor_name || r.actor_email || 'System (import or database)';

// "25 Sep 2026, 14:03" in the viewer's own time zone.
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Local calendar date (YYYY-MM-DD) of a timestamp, for date-range filters.
export function localDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
