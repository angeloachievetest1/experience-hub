// Small, pure helpers for filtering and counting cases. No React here.
import type { DataGap, QaSource } from './types';

export type DateRange = { from: string | null; to: string | null }; // YYYY-MM-DD, inclusive
export const ALL_TIME: DateRange = { from: null, to: null };

export function inRange(date: string | null, range: DateRange) {
  if (!range.from && !range.to) return true;
  if (!date) return false;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

export type Count = { name: string; value: number };

export function countBy<T>(items: T[], key: (item: T) => string | string[] | null | undefined): Count[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    const keys = Array.isArray(k) ? k : k ? [k] : [];
    for (const one of keys) map.set(one, (map.get(one) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

// Keep a fixed order (e.g. validity values) and add any unexpected values at the end.
export function inOrder(counts: Count[], order: readonly string[]): Count[] {
  const byName = new Map(counts.map((c) => [c.name, c.value]));
  const known = order.filter((n) => byName.has(n)).map((n) => ({ name: n, value: byName.get(n)! }));
  const extra = counts.filter((c) => !order.includes(c.name));
  return [...known, ...extra];
}

export function average(values: (number | null)[]) {
  const nums = values.filter((v): v is number => v !== null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

// ---------------------------------------------------------------------------
// Months and quarters
// ---------------------------------------------------------------------------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

export function monthLabel(key: string, withYear = true) {
  const [y, m] = key.split('-');
  return withYear ? `${MONTHS[Number(m) - 1]} ${y.slice(2)}` : MONTHS[Number(m) - 1];
}

export function quarterOf(month: string) {
  const [y, m] = month.split('-').map(Number);
  return `${y} Q${Math.ceil(m / 3)}`;
}

export type Period = { key: string; label: string; months: string[] };

// The months (or quarters) a chart should show: the selected range, or the
// span of the data when no range is chosen.
export function periods(dates: (string | null)[], range: DateRange, by: 'month' | 'quarter'): Period[] {
  const known = dates.filter((d): d is string => Boolean(d)).sort();
  const start = range.from ?? known[0];
  const end = range.to ?? known[known.length - 1];
  if (!start || !end) return [];
  const months = monthsBetween(monthKey(start), monthKey(end));
  if (by === 'month') return months.map((m) => ({ key: m, label: monthLabel(m), months: [m] }));
  const quarters = new Map<string, string[]>();
  for (const m of months) {
    const q = quarterOf(m);
    quarters.set(q, [...(quarters.get(q) ?? []), m]);
  }
  return [...quarters.entries()].map(([key, ms]) => ({ key, label: key, months: ms }));
}

// Is this source's data missing for the whole period ('missing') or part of it ('partial')?
export function gapStatus(gaps: DataGap[], source: QaSource, months: string[]): 'missing' | 'partial' | null {
  const covered = months.filter((m) => gaps.some((g) => g.source === source && m >= g.start && m <= g.end));
  if (covered.length === 0) return null;
  return covered.length === months.length ? 'missing' : 'partial';
}

export function formatDate(date: string | null) {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

// Today's date on this computer, "YYYY-MM-DD" (e.g. the starting date of a new case).
export function localToday() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

// "YYYY-MM-DDTHH:mm" → "30 Sep 2026, 8:55 AM"
export function formatDateTime(dt: string | null) {
  if (!dt) return '';
  const [date, time = '00:00'] = dt.split('T');
  const [h, min] = time.split(':').map(Number);
  return `${formatDate(date)}, ${h % 12 || 12}:${String(min).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// A pasted or typed date and time → "YYYY-MM-DDTHH:mm", or null if it can't be read.
// Reads "9/28/2026 2:13 PM" (the sheet), "2026-09-28 14:13", "Sep 28, 2026 at 2:13 PM"
// and "28 Sep 2026, 2:13 PM" (how the site shows it); seconds are ignored.
export function parseDateTime(input: string): string | null {
  const s = input.trim()
    .replace(/\b([ap])\.?\s?m\.?(?=\s|$)/gi, (_, x: string) => `${x.toUpperCase()}M`)
    .replace(/\s+at\s+/i, ' ').replace(/,/g, ' ').replace(/\s+/g, ' ');
  const time = String.raw`(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(AM|PM)?`;
  const month = (name: string) => MONTHS.findIndex((m) => name.slice(0, 3).toLowerCase() === m.toLowerCase()) + 1;
  let y: number, mo: number, d: number, hh: string, mm: string, ap: string | undefined;
  let m: RegExpExecArray | null;
  if ((m = new RegExp(String.raw`^(\d{4})-(\d{1,2})-(\d{1,2})[T ]${time}$`, 'i').exec(s))) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]; [hh, mm, ap] = [m[4], m[5], m[6]];
  } else if ((m = new RegExp(String.raw`^(\d{1,2})/(\d{1,2})/(\d{2}|\d{4}) ${time}$`, 'i').exec(s))) {
    [mo, d, y] = [Number(m[1]), Number(m[2]), Number(m[3].length === 2 ? `20${m[3]}` : m[3])]; [hh, mm, ap] = [m[4], m[5], m[6]];
  } else if ((m = new RegExp(String.raw`^([a-z]{3,})\.? (\d{1,2}) (\d{4}) ${time}$`, 'i').exec(s))) {
    [mo, d, y] = [month(m[1]), Number(m[2]), Number(m[3])]; [hh, mm, ap] = [m[4], m[5], m[6]];
  } else if ((m = new RegExp(String.raw`^(\d{1,2}) ([a-z]{3,})\.? (\d{4}) ${time}$`, 'i').exec(s))) {
    [d, mo, y] = [Number(m[1]), month(m[2]), Number(m[3])]; [hh, mm, ap] = [m[4], m[5], m[6]];
  } else return null;

  let h = Number(hh);
  const min = Number(mm);
  if (ap) { if (h < 1 || h > 12) return null; h = (h % 12) + (ap.toUpperCase() === 'PM' ? 12 : 0); }
  const real = new Date(Date.UTC(y, mo - 1, d));
  if (mo < 1 || real.getUTCMonth() !== mo - 1 || real.getUTCDate() !== d || h > 23 || min > 59) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${y}-${p(mo)}-${p(d)}T${p(h)}:${p(min)}`;
}

// For chart titles: "all time", "in 2026" (a whole year, or this year so far), or the chosen dates.
export function periodText(r: DateRange) {
  if (!r.from && !r.to) return 'all time';
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const year = r.from?.slice(0, 4);
  if (r.from === `${year}-01-01` && (r.to === `${year}-12-31` || (r.to === today && today.startsWith(year!)))) return `in ${year}`;
  if (r.from && r.to) return `${formatDate(r.from)} – ${formatDate(r.to)}`;
  return r.from ? `since ${formatDate(r.from)}` : `until ${formatDate(r.to)}`;
}

export function pct(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

