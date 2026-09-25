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

