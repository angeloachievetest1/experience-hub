import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE = 1000; // Supabase returns at most 1000 rows per request

// Reads every row of a table, 1000 at a time, as the signed-in user.
export async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  order: { column: string; ascending?: boolean }[],
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select(select);
    for (const o of order) query = query.order(o.column, { ascending: o.ascending ?? true, nullsFirst: false });
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not load ${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

// Dropdown lists and their meanings, for list keys starting with a prefix.
export async function loadOptions(supabase: SupabaseClient, prefix: string) {
  const { data, error } = await supabase
    .from('option_values')
    .select('list_key, value, description')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw new Error(`Could not load lookup lists: ${error.message}`);
  const options: Record<string, string[]> = {};
  const names: Record<string, Record<string, string>> = {};
  for (const o of data ?? []) {
    if (!o.list_key.startsWith(prefix)) continue;
    (options[o.list_key] ??= []).push(o.value);
    if (o.description) (names[o.list_key] ??= {})[o.value] = o.description;
  }
  return { options, names };
}

export async function loadCourses(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('courses').select('id, name').eq('is_active', true).order('sort_order');
  if (error) throw new Error(`Could not load courses: ${error.message}`);
  return (data ?? []).map((c) => ({ id: c.id as string, name: c.name as string }));
}
