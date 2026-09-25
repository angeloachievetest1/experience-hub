// Mentor section types (used on server and client).
import type { Named } from '@/components/records/RecordDrawer';

// Customer complaints about mentors.
export type MentorCase = {
  id: string;
  case_date: string | null;
  year: number | null;
  quarter: string | null;
  customer_name: string | null;
  case_type: string | null;          // Mentor Complaint / Complaint (from the sheet)
  mentor_id: string | null;
  course_id: string | null;
  complaint_type: string | null;
  complaint_sub_type: string | null;
  complaint_analysis: string | null; // Valid / Partially Valid / Not Valid
  status: string | null;             // New / In-progress / Closed
  case_closed_by: string | null;
  email_sent: boolean | null;
  email_sms_preview: string | null;
  case_link: string | null;
  field_notes: Record<string, string>;
  updated_at: string;
};

export type MentorData = {
  cases: MentorCase[];
  mentors: Named[];
  courses: Named[];
  options: Record<string, string[]>;
  canEdit: boolean;
};

export const MENTOR_COLOR = '#FF4500';
export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
export const MENTOR_VALIDITY = ['Valid', 'Partially Valid', 'Not Valid'] as const;

// Date used for date-range filters: the case date, or the start of its
// year/quarter when only those were recorded.
export function periodDate(c: MentorCase): string | null {
  if (c.case_date) return c.case_date;
  if (!c.year) return null;
  const q = c.quarter ? Number(c.quarter.slice(1)) : 1;
  return `${c.year}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`;
}

export function yearQuarterOf(date: string | null) {
  if (!date) return null;
  const [y, m] = date.split('-').map(Number);
  return { year: y, quarter: `Q${Math.ceil(m / 3)}` };
}
