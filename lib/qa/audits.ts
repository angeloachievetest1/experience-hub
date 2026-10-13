// E-learning case audits (Quality Analyst › Operation Tasks / Task Log): types,
// choices and the numbers the "Case Audits: E-learning" sheet calculates
// (Summary tab and VTO tracker). Pure helpers, no React here.
import { average, inRange, monthKey, type DateRange } from './stats';

export type AuditCase = {
  id: string;
  customer_name: string | null;   // sheet: Account Name
  case_link: string | null;       // sheet: Case Number (Kustomer link)
  subject: string | null;
  case_type: string | null;       // Tutoring
  record_type: string | null;     // eLearning
  manager: string | null;
  opened_at: string | null;       // YYYY-MM-DDTHH:mm
  first_touch_at: string | null;
  closed_at: string | null;
  date_closed: string | null;     // YYYY-MM-DD
  week_ending: string | null;     // calculated from date_closed
  case_cycle: string | null;      // calculated: first touch to closed, as in the sheet
  handled_by: string | null;
  no_error: boolean | null;
  error_type: string | null;      // sheet: Error 1
  error_category: string | null;  // sheet: Error 1 Category
  auditor: string | null;
  call_outs: string | null;
  updated_at: string;
};

// The dropdown lists, managed on Case options (Operation Tasks group).
// Type and Error 1 also offer "Others" (typed in by hand) after the list.
export const AUDIT_LISTS = {
  recordType: 'qa_task_record_type',
  type: 'qa_task_type',
  error: 'qa_task_error',
  category: 'qa_task_error_category',
  person: 'qa_task_person',   // Manager and Handled by
  auditor: 'qa_task_auditor',
} as const;

export type AuditData = {
  cases: AuditCase[];
  options: Record<string, string[]>; // by list key (AUDIT_LISTS)
  canEdit: boolean;
};

export const AUDIT_COLOR = '#5B4A7D';

// The list plus any values found on cases that aren’t in it (typed in with
// "Others", or hidden since), for filters and charts.
export function withTypedIn(list: readonly string[], values: (string | null)[]) {
  const extra = [...new Set(values.filter((v): v is string => Boolean(v) && !list.includes(v!)))].sort((a, b) => a.localeCompare(b));
  return [...list, ...extra];
}

// For narrow tables: "Case Accuracy & Completeness" → "Accuracy".
export const categoryShort = (name: string) => name.replace(/^Case /, '').split(' ')[0];

const CATEGORY_PALETTE = ['#FF4500', '#9F7DFF', '#FFB199', '#2D1559', '#DDD1FF', '#5B4A7D', '#DDFF7D', '#EAE2FF'];
export const categoryColor = (index: number) => CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];

export type AuditResult = 'No error' | 'Error' | 'Not set';

export function auditResult(c: AuditCase): AuditResult {
  if (c.no_error) return 'No error';
  if (c.no_error === false || c.error_type) return 'Error';
  return 'Not set';
}

// ---------------------------------------------------------------------------
// Calculated fields
// ---------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, '0');

// The Saturday on or after the date closed (the sheet's "Week ending").
function weekEnding(date: string | null) {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + (6 - t.getUTCDay()));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

const minutesOf = (dt: string) => {
  const [date, time = '00:00'] = dt.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, min) / 60000;
};

// "158 hrs and 50 mins", measured from first touch to closed like the sheet.
function caseCycle(firstTouch: string | null, closed: string | null) {
  if (!firstTouch || !closed) return null;
  const mins = minutesOf(closed) - minutesOf(firstTouch);
  if (mins < 0) return 'Closed before first touch: check the times';
  return `${Math.floor(mins / 60)} hrs and ${mins % 60} mins`;
}

// Fills the calculated fields after any change.
export function withCalculated<T extends Partial<AuditCase>>(c: T): T {
  return {
    ...c,
    week_ending: weekEnding(c.date_closed ?? null),
    case_cycle: caseCycle(c.first_touch_at ?? null, c.closed_at ?? null),
  };
}

// ---------------------------------------------------------------------------
// Accuracy, as in the VTO tracker
// ---------------------------------------------------------------------------
// A case belongs to the month of its week ending (the sheet puts the week
// ending 3 Oct in October).
export const auditMonth = (c: AuditCase) => (c.week_ending ? monthKey(c.week_ending) : null);

// "2026-10" → "October 2026"
export function monthName(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export type Week = { week: string; noErrors: number; cases: number; accuracy: number };

// Each week: cases with no error ÷ cases audited.
export function weeksOf(cases: AuditCase[]): Week[] {
  const byWeek = new Map<string, AuditCase[]>();
  for (const c of cases) {
    if (!c.week_ending) continue;
    byWeek.set(c.week_ending, [...(byWeek.get(c.week_ending) ?? []), c]);
  }
  return [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, list]) => {
    const noErrors = list.filter((c) => c.no_error).length;
    return { week, noErrors, cases: list.length, accuracy: noErrors / list.length };
  });
}

// The month is the average of its weeks, not of its cases (as in the sheet).
export function monthAccuracy(cases: AuditCase[], month: string) {
  return average(weeksOf(cases.filter((c) => auditMonth(c) === month)).map((w) => w.accuracy));
}

// The quarter is the average of its months.
export function quarterAccuracy(cases: AuditCase[], months: string[]) {
  return average(months.map((m) => monthAccuracy(cases, m)));
}

const isMonthEnd = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate() === d;
};

// Date filter by week ending, like the sheet: picking October shows the weeks
// ending in October (from 3 Oct). A range that stops mid-month keeps the whole
// week that day falls in, so "This month" includes the current week.
export function inAuditRange(c: AuditCase, range: DateRange) {
  if (!range.from && !range.to) return true;
  if (!c.week_ending) return false;
  const to = range.to && !isMonthEnd(range.to) ? weekEnding(range.to) : range.to;
  return inRange(c.week_ending, { from: range.from, to });
}

export const pctText = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(2)}%`);
