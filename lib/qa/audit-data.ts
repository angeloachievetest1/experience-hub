import 'server-only';
import { canWriteSection, requireActiveProfile } from '@/lib/auth';
import { fetchAll, loadOptions } from '@/lib/records/load';
import { createClient } from '@/lib/supabase/server';
import { withCalculated, type AuditCase, type AuditData } from './audits';

// Postgres returns "2026-09-28T14:13:00"; the panel's date-time box uses "2026-09-28T14:13".
const toMinute = (v: string | null) => (v ? v.slice(0, 16) : null);

// Everything the Operation Tasks / Task Log pages need, read as the signed-in user.
export async function loadAuditData(): Promise<AuditData> {
  const profile = await requireActiveProfile();
  const supabase = await createClient();
  const [rows, { options }] = await Promise.all([
    fetchAll<AuditCase>(supabase, 'qa_task_cases',
      'id, customer_name, case_link, subject, case_type, record_type, manager, opened_at, first_touch_at, closed_at, date_closed, handled_by, no_error, error_type, error_category, auditor, call_outs, updated_at',
      [{ column: 'date_closed', ascending: false }, { column: 'closed_at', ascending: false }]),
    loadOptions(supabase, 'qa_task_'),
  ]);
  return {
    cases: rows.map((c) => withCalculated({
      ...c, opened_at: toMinute(c.opened_at), first_touch_at: toMinute(c.first_touch_at), closed_at: toMinute(c.closed_at),
    })),
    options,
    canEdit: canWriteSection(profile, 'quality_analyst'),
  };
}
