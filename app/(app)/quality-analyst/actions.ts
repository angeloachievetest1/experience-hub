'use server';

import { createClient } from '@/lib/supabase/server';
import {
  QA_DATE_FIELDS, QA_ID_FIELDS, QA_PCT_FIELDS, QA_SOURCES, QA_TEXT_FIELDS,
  type QaPatch, type QaSource,
} from '@/lib/qa/types';

// All writes run as the signed-in user, so row-level security has the final
// say: only active admins with the Quality Analyst section can change anything.

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const NO_PERMISSION = 'You don’t have permission to change Quality Analyst cases.';

export async function createQaCase(source: QaSource): Promise<ActionResult> {
  if (!QA_SOURCES.includes(source)) return { ok: false, error: 'Unknown source.' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('qa_cases')
    .insert({ source, case_date: new Date().toISOString().slice(0, 10) })
    .select('id')
    .single();
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, id: data.id };
}

export async function updateQaCase(id: string, patch: QaPatch): Promise<ActionResult> {
  const clean = sanitize(patch);
  if ('error' in clean) return { ok: false, error: clean.error };
  const { values, courseIds } = clean;
  const supabase = await createClient();

  if (Object.keys(values).length > 0) {
    const { data, error } = await supabase.from('qa_cases').update(values).eq('id', id).select('id');
    if (error) return { ok: false, error: friendly(error) };
    if (!data?.length) return { ok: false, error: NO_PERMISSION };
  }

  if (courseIds) {
    const { data: current, error } = await supabase.from('qa_case_courses').select('course_id').eq('case_id', id);
    if (error) return { ok: false, error: friendly(error) };
    const have = new Set((current ?? []).map((r) => r.course_id));
    const want = new Set(courseIds);
    const remove = [...have].filter((c) => !want.has(c));
    const add = [...want].filter((c) => !have.has(c));
    if (remove.length) {
      const r = await supabase.from('qa_case_courses').delete().eq('case_id', id).in('course_id', remove).select('course_id');
      if (r.error) return { ok: false, error: friendly(r.error) };
      if ((r.data?.length ?? 0) !== remove.length) return { ok: false, error: NO_PERMISSION };
    }
    if (add.length) {
      const r = await supabase.from('qa_case_courses').insert(add.map((course_id) => ({ case_id: id, course_id })));
      if (r.error) return { ok: false, error: friendly(r.error) };
    }
  }
  return { ok: true };
}

export async function deleteQaCase(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('qa_cases').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: friendly(error) };
  if (!data?.length) return { ok: false, error: NO_PERMISSION };
  return { ok: true };
}

// ---------------------------------------------------------------------------

type Clean = { values: Record<string, unknown>; courseIds: string[] | null } | { error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function sanitize(patch: QaPatch): Clean {
  const values: Record<string, unknown> = {};
  const p = patch as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  for (const f of QA_TEXT_FIELDS) if (f in p) values[f] = text(p[f]);
  for (const f of QA_DATE_FIELDS) {
    if (!(f in p)) continue;
    const v = text(p[f]);
    if (v && !DATE.test(v)) return { error: 'Please enter dates as a full date.' };
    values[f] = v;
  }
  for (const f of QA_PCT_FIELDS) {
    if (!(f in p)) continue;
    const v = p[f];
    if (v === null || v === '') { values[f] = null; continue; }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) return { error: 'Percentages must be between 0 and 100.' };
    values[f] = n;
  }
  for (const f of QA_ID_FIELDS) {
    if (!(f in p)) continue;
    const v = text(p[f]);
    if (v && !UUID.test(v)) return { error: 'Invalid selection.' };
    values[f] = v;
  }
  if ('rating' in p) {
    const v = p.rating;
    if (v === null || v === '') values.rating = null;
    else {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 6) return { error: 'Rating must be a whole number from 1 to 6.' };
      values.rating = n;
    }
  }
  if ('complaint_types' in p) {
    const list = Array.isArray(p.complaint_types) ? p.complaint_types : [];
    values.complaint_types = [...new Set(list.map(text).filter(Boolean))];
  }
  if ('field_notes' in p) {
    const raw = p.field_notes;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Invalid field notes.' };
    const notes: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!/^[a-z_]{1,40}$/.test(k) || typeof v !== 'string') return { error: 'Invalid field notes.' };
      const t = v.trim();
      if (t.length > 2000) return { error: 'Field notes can be at most 2000 characters.' };
      if (t) notes[k] = t;
    }
    values.field_notes = notes;
  }
  if (typeof values.case_link === 'string' && !/^https?:\/\/\S+$/i.test(values.case_link)) {
    return { error: 'The case link must be a full web address starting with https://' };
  }

  let courseIds: string[] | null = null;
  if ('course_ids' in p) {
    const list = Array.isArray(p.course_ids) ? p.course_ids : [];
    if (!list.every((v) => typeof v === 'string' && UUID.test(v))) return { error: 'Invalid course selection.' };
    courseIds = [...new Set(list as string[])];
  }
  return { values, courseIds };
}

function friendly(error: { code?: string; message: string }) {
  if (error.code === '42501') return NO_PERMISSION;
  if (error.code === '23514') return 'One of the values isn’t allowed. Please check the fields and try again.';
  return `Something went wrong: ${error.message}`;
}
