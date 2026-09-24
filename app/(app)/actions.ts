'use server';

import { createClient } from '@/lib/supabase/server';
import type { SectionKey } from '@/lib/sections';

export type AccessCheckResult =
  | { ok: true; access: Record<SectionKey, boolean> }
  | { ok: false; error: string };

// Asks the database (not the app) whether this user may add cases in each
// section. The test insert is always undone; see migration 005.
export async function runAccessCheck(): Promise<AccessCheckResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('check_write_access');
  if (error) return { ok: false, error: error.message };
  return { ok: true, access: data as Record<SectionKey, boolean> };
}
