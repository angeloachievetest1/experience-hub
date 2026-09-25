// Curriculum section types (used on server and client).
import type { Named } from '@/components/records/RecordDrawer';

// A. Customer Cases: customer complaints about course content.
export type CurCase = {
  id: string;
  case_date: string | null;
  customer_name: string | null;
  course_id: string | null;
  category: string | null;
  material_type: string | null;        // sheet column "Achieve Material"
  issue_type: string | null;           // sheet column "Type"
  case_source: string | null;          // sheet column "Source of case"
  case_resolution: string | null;
  case_status_in_sf: string | null;
  curriculum_sme: string | null;
  tm_on_sf: string | null;
  comments: string | null;
  feedback_progress: string | null;
  resolution_tat_days: number | null;
  date_resolved: string | null;
  case_link: string | null;
  field_notes: Record<string, string>;
  is_sample: boolean;
  updated_at: string;
};

// B. Instructors Cases ("Instructor requests"). Every sheet row is its own
// request; a blank requester or course simply stays blank.
export type CurRequest = {
  id: string;
  requester_name: string | null;
  date_submitted: string | null;
  course_id: string | null;
  feedback_type: string | null;
  base_material: string | null;
  comments: string | null;
  status: string | null;
  notes: string | null;
  date_completed: string | null;
  ticket_manager: string | null;
  field_notes: Record<string, string>;
  is_sample: boolean;
  updated_at: string;
};

export type CurData = {
  cases: CurCase[];
  requests: CurRequest[];
  courses: Named[];
  options: Record<string, string[]>;
  canEdit: boolean;
};

export const CURRICULUM_COLOR = '#9F7DFF';

// Days between two YYYY-MM-DD dates (null if either is missing or order is wrong).
export function daysBetween(from: string | null, to: string | null) {
  if (!from || !to) return null;
  const d = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  return Number.isFinite(d) && d >= 0 ? Math.round(d) : null;
}

// Resolution time: the recorded TAT, or the days between case date and date resolved.
export function resolutionDays(c: CurCase) {
  return c.resolution_tat_days ?? daysBetween(c.case_date, c.date_resolved);
}
