// Checks and cleans edits sent from a case panel before they reach the
// database. Only fields listed in the spec can be changed.

export type FieldType =
  | 'text' | 'date' | 'url' | 'uuid' | 'bool' | 'notes'
  | { number: { min: number; max: number; integer?: boolean } }
  | { oneOf: readonly string[] };

export type Spec = Record<string, FieldType>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const URL = /^https?:\/\/\S+$/i;

export function sanitize(patch: Record<string, unknown>, spec: Spec): { values: Record<string, unknown> } | { error: string } {
  const values: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(patch)) {
    const type = spec[key];
    if (!type) return { error: `The field “${key}” can’t be changed here.` };
    const text = typeof raw === 'string' ? raw.trim() : raw;
    const empty = text === null || text === undefined || text === '';

    if (type === 'text') values[key] = empty ? null : String(text);
    else if (type === 'date') {
      if (!empty && !DATE.test(String(text))) return { error: 'Please enter dates as a full date.' };
      values[key] = empty ? null : text;
    } else if (type === 'url') {
      if (!empty && !URL.test(String(text))) return { error: 'Links must be a full web address starting with https://' };
      values[key] = empty ? null : text;
    } else if (type === 'uuid') {
      if (!empty && !UUID.test(String(text))) return { error: 'Invalid selection.' };
      values[key] = empty ? null : text;
    } else if (type === 'bool') {
      if (!empty && typeof raw !== 'boolean') return { error: 'Invalid yes/no value.' };
      values[key] = empty ? null : raw;
    } else if (type === 'notes') {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Invalid field notes.' };
      const notes: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (!/^[a-z_]{1,40}$/.test(k) || typeof v !== 'string') return { error: 'Invalid field notes.' };
        if (v.trim().length > 2000) return { error: 'Field notes can be at most 2000 characters.' };
        if (v.trim()) notes[k] = v.trim();
      }
      values[key] = notes;
    } else if ('number' in type) {
      if (empty) { values[key] = null; continue; }
      const n = Number(text);
      const { min, max, integer } = type.number;
      if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
        return { error: `Please enter a ${integer ? 'whole ' : ''}number from ${min} to ${max}.` };
      }
      values[key] = n;
    } else if ('oneOf' in type) {
      if (!empty && !type.oneOf.includes(String(text))) return { error: 'One of the values isn’t allowed.' };
      values[key] = empty ? null : text;
    }
  }
  return { values };
}

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export function friendlyError(error: { code?: string; message: string }, noPermission: string) {
  if (error.code === '42501') return noPermission;
  if (error.code === '23514') return 'One of the values isn’t allowed. Please check the fields and try again.';
  return `Something went wrong: ${error.message}`;
}
