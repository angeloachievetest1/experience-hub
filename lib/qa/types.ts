// Shared Quality Analyst types, labels and colours (used on server and client).

export const QA_SOURCES = ['Instructor', 'Course', 'Survey', 'Returned'] as const;
export type QaSource = (typeof QA_SOURCES)[number];

export const VALIDITY_VALUES = ['Valid', 'Partially Valid', 'Not Valid', 'N/A'] as const;

export type QaCase = {
  id: string;
  source: QaSource;
  case_date: string | null;
  customer_name: string | null;
  course_id: string | null;
  course_ids: string[]; // Returned cases only
  instructor_id: string | null;
  case_link: string | null;
  analyst: string | null;
  category: string | null;
  complaint_types: string[];
  validity: string | null;
  followup_email: string | null;
  followup_sms: string | null;
  followup_call: string | null;
  customer_reached: string | null;
  resolution: string | null;
  notes: string | null;
  attendance_pct: number | null;
  participation_pct: number | null;
  moodle_pct: number | null;
  course_end_date: string | null;
  case_closed_by: string | null;
  survey_type: string | null;
  survey_id: string | null;
  rating: number | null;
  customer_comment: string | null;
  reason_type: string | null;
  reassign_reason: string | null;
  field_notes: Record<string, string>; // { field_name: note } from "+ Add note"
  updated_at: string;
};

export type Named = { id: string; name: string };

export type DataGap = { source: QaSource; start: string; end: string; note: string | null }; // YYYY-MM

export type QaData = {
  cases: QaCase[];
  courses: Named[];
  instructors: Named[];
  options: Record<string, string[]>;
  optionNames: Record<string, Record<string, string>>; // list -> value -> meaning, e.g. MCS -> Mid Course Survey
  gaps: DataGap[];
  canEdit: boolean;
};

// Editable fields and how the server should read them.
export const QA_TEXT_FIELDS = [
  'customer_name', 'case_link', 'analyst', 'category', 'validity', 'followup_email', 'followup_sms',
  'followup_call', 'customer_reached', 'resolution', 'notes', 'case_closed_by', 'survey_type',
  'survey_id', 'customer_comment', 'reason_type', 'reassign_reason',
] as const;
export const QA_DATE_FIELDS = ['case_date', 'course_end_date'] as const;
export const QA_PCT_FIELDS = ['attendance_pct', 'participation_pct', 'moodle_pct'] as const;
export const QA_ID_FIELDS = ['course_id', 'instructor_id'] as const;

export type QaPatch = Partial<Pick<QaCase,
  | (typeof QA_TEXT_FIELDS)[number] | (typeof QA_DATE_FIELDS)[number] | (typeof QA_PCT_FIELDS)[number]
  | (typeof QA_ID_FIELDS)[number] | 'rating' | 'complaint_types' | 'course_ids' | 'field_notes'>>;

// Colours follow the prototype.
export const SOURCE_COLORS: Record<QaSource, string> = {
  Instructor: '#FF4500',
  Course: '#9F7DFF',
  Survey: '#2D1559',
  Returned: '#FFB199',
};

export const VALIDITY_COLORS: Record<string, string> = {
  'Valid': '#9F7DFF',
  'Partially Valid': '#DDD1FF',
  'Not Valid': '#FFB199',
  'N/A': '#EAE2FF',
};

export const VALIDITY_BADGE: Record<string, string> = {
  'Valid': '#DDD1FF',
  'Partially Valid': '#EAE2FF',
  'Not Valid': '#FFE3D9',
  'N/A': '#F6F3FF',
};

export const SURVEY_TYPE_COLORS: Record<string, string> = {
  MCS: '#FF4500',
  ECS: '#9F7DFF',
  AFCS: '#2D1559',
  PES: '#DDD1FF',
  PTS: '#DDFF7D',
};

export const EXTRA_COLORS = ['#FF4500', '#9F7DFF', '#2D1559', '#FFB199', '#DDD1FF', '#DDFF7D', '#5B4A7D', '#EAE2FF'];

// "Type or reason" column: what the case is about, whatever its source.
export function caseIssue(c: QaCase) {
  if (c.source === 'Survey') return c.reason_type ?? '';
  if (c.source === 'Returned') return c.reassign_reason ?? '';
  return c.complaint_types.join(', ');
}

export type FollowState = 'Urgent action' | 'Not reached' | 'Reached' | null;

// "Reached" and variants such as "Reached by DA" (dedicated advisor) count as reached.
export const isReached = (v: string | null) => Boolean(v && /^reached\b/i.test(v));
export const isNotReached = (v: string | null) => v === 'Not Reached';

export function followState(c: QaCase): FollowState {
  if (c.resolution === 'Urgent Action') return 'Urgent action';
  if (isNotReached(c.customer_reached)) return 'Not reached';
  if (isReached(c.customer_reached)) return 'Reached';
  return null;
}

export const FOLLOW_STYLE: Record<Exclude<FollowState, null>, { bg: string; dot: string }> = {
  'Urgent action': { bg: '#FFE3D9', dot: '#FF4500' },
  'Not reached': { bg: '#DDD1FF', dot: '#9F7DFF' },
  'Reached': { bg: '#F6F3FF', dot: '#2D1559' },
};
