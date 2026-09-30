// Every dropdown list the Admin "Case options" page manages: what it's called,
// where it appears, and which case fields use its values.

export type ListGroup = 'Shared' | 'Quality Analyst' | 'Curriculum' | 'Mentor';
export const LIST_GROUPS: ListGroup[] = ['Shared', 'Quality Analyst', 'Curriculum', 'Mentor'];

export type CaseTable = 'qa_cases' | 'curriculum_customer_cases' | 'curriculum_instructor_requests' | 'mentor_cases';

// Case fields that store a list's values (as text). source limits Quality Analyst to one source.
export type ListUse = { table: CaseTable; columns: string[]; source?: string };

export type ListDef = {
  key: string;            // option_values.list_key, or 'courses' / 'instructors' / 'mentors'
  label: string;
  group: ListGroup;
  usedIn: string;
  // linked: cases point at the row, so a new name shows everywhere by itself.
  // text: cases store the value, so renaming must also update those cases.
  kind: 'linked' | 'text';
  uses?: ListUse[];
  locked?: string;        // why these values can't be renamed or hidden
};

const qa = (columns: string[], source?: string): ListUse[] => [{ table: 'qa_cases', columns, source }];
const cur = (columns: string[]): ListUse[] => [{ table: 'curriculum_customer_cases', columns }];
const req = (columns: string[]): ListUse[] => [{ table: 'curriculum_instructor_requests', columns }];
const men = (columns: string[]): ListUse[] => [{ table: 'mentor_cases', columns }];
const COUNTED = 'Dashboards and charts count these exact values, so they can’t be renamed or hidden.';

export const LIST_DEFS: ListDef[] = [
  { key: 'courses', label: 'Courses', group: 'Shared', usedIn: 'Course dropdown in all three sections', kind: 'linked' },

  { key: 'instructors', label: 'Instructors', group: 'Quality Analyst', usedIn: 'Instructor on Quality Analyst cases', kind: 'linked' },
  { key: 'qa_source', label: 'Case sources', group: 'Quality Analyst', usedIn: 'Instructor, Course, Survey and Returned cases', kind: 'text', uses: qa(['source']),
    locked: 'The Quality Analyst pages are built around these four sources.' },
  { key: 'qa_category_instructor', label: 'Instructor case categories', group: 'Quality Analyst', usedIn: 'Category on Instructor cases', kind: 'text', uses: qa(['category'], 'Instructor') },
  { key: 'qa_type_instructor', label: 'Instructor complaint types', group: 'Quality Analyst', usedIn: 'Complaint type on Instructor cases', kind: 'text', uses: qa(['complaint_types'], 'Instructor') },
  { key: 'qa_category_course', label: 'Course case categories', group: 'Quality Analyst', usedIn: 'Category on Course cases', kind: 'text', uses: qa(['category'], 'Course') },
  { key: 'qa_type_course', label: 'Course complaint types', group: 'Quality Analyst', usedIn: 'Complaint type on Course cases', kind: 'text', uses: qa(['complaint_types'], 'Course') },
  { key: 'qa_survey_type', label: 'Survey types', group: 'Quality Analyst', usedIn: 'Survey type on low survey scores', kind: 'text', uses: qa(['survey_type']) },
  { key: 'qa_survey_reason', label: 'Survey reasons', group: 'Quality Analyst', usedIn: 'Reason type on low survey scores', kind: 'text', uses: qa(['reason_type']) },
  { key: 'qa_returned_type', label: 'Returned case types', group: 'Quality Analyst', usedIn: 'Complaint type on Returned cases', kind: 'text', uses: qa(['complaint_types'], 'Returned') },
  { key: 'qa_reassign_reason', label: 'Reassign reasons', group: 'Quality Analyst', usedIn: 'Reassign reason on Returned cases', kind: 'text', uses: qa(['reassign_reason']) },
  { key: 'qa_validity', label: 'Validity', group: 'Quality Analyst', usedIn: 'Validity on every case', kind: 'text', uses: qa(['validity']), locked: COUNTED },
  { key: 'qa_resolution', label: 'Resolutions', group: 'Quality Analyst', usedIn: 'Resolution on every case', kind: 'text', uses: qa(['resolution']) },
  { key: 'qa_case_closed_by', label: 'Case closed by', group: 'Quality Analyst', usedIn: 'Case closed by on Course and Survey cases', kind: 'text', uses: qa(['case_closed_by']) },
  { key: 'qa_followup_sent', label: 'Follow-up sent', group: 'Quality Analyst', usedIn: 'Email sent, SMS sent and Call made', kind: 'text', uses: qa(['followup_email', 'followup_sms', 'followup_call']) },
  { key: 'qa_reached', label: 'Customer reached', group: 'Quality Analyst', usedIn: 'Customer reached on every case', kind: 'text', uses: qa(['customer_reached']) },

  { key: 'cur_category', label: 'Categories', group: 'Curriculum', usedIn: 'Category on customer cases', kind: 'text', uses: cur(['category']) },
  { key: 'cur_issue_type', label: 'Types', group: 'Curriculum', usedIn: 'Type on customer cases', kind: 'text', uses: cur(['issue_type']) },
  { key: 'cur_material_type', label: 'Achieve material', group: 'Curriculum', usedIn: 'Achieve material on customer cases', kind: 'text', uses: cur(['material_type']) },
  { key: 'cur_case_source', label: 'Source of case', group: 'Curriculum', usedIn: 'Source of case on customer cases', kind: 'text', uses: cur(['case_source']) },
  { key: 'cur_case_resolution', label: 'Case resolution', group: 'Curriculum', usedIn: 'Case resolution on customer cases', kind: 'text', uses: cur(['case_resolution']) },
  { key: 'cur_sf_status', label: 'Case status in SF', group: 'Curriculum', usedIn: 'Case status in SF on customer cases', kind: 'text', uses: cur(['case_status_in_sf']) },
  { key: 'cur_feedback_type', label: 'Feedback types', group: 'Curriculum', usedIn: 'Feedback type on instructor requests', kind: 'text', uses: req(['feedback_type']) },
  { key: 'cur_base_material', label: 'Base material', group: 'Curriculum', usedIn: 'Base material on instructor requests', kind: 'text', uses: req(['base_material']) },
  { key: 'cur_request_status', label: 'Request status', group: 'Curriculum', usedIn: 'Status on instructor requests', kind: 'text', uses: req(['status']) },

  { key: 'mentors', label: 'Mentors', group: 'Mentor', usedIn: 'Mentor on Mentor cases', kind: 'linked' },
  { key: 'mentor_complaint_type', label: 'Complaint types', group: 'Mentor', usedIn: 'Complaint type on Mentor cases', kind: 'text', uses: men(['complaint_type']) },
  { key: 'mentor_complaint_sub_type', label: 'Complaint sub types', group: 'Mentor', usedIn: 'Sub type on Mentor cases', kind: 'text', uses: men(['complaint_sub_type']) },
  { key: 'mentor_case_type', label: 'Case types', group: 'Mentor', usedIn: 'Case type on Mentor cases', kind: 'text', uses: men(['case_type']) },
  { key: 'mentor_case_closed_by', label: 'Case closed by', group: 'Mentor', usedIn: 'Case closed by on Mentor cases', kind: 'text', uses: men(['case_closed_by']) },
  { key: 'mentor_status', label: 'Status', group: 'Mentor', usedIn: 'Status on Mentor cases', kind: 'text', uses: men(['status']), locked: COUNTED },
  { key: 'mentor_validity', label: 'Complaint analysis', group: 'Mentor', usedIn: 'Complaint analysis on Mentor cases', kind: 'text', uses: men(['complaint_analysis']), locked: COUNTED },
];

// Activity Log record types that belong to the Case options page.
export const CASE_OPTION_RECORD_TYPES = ['courses', 'instructors', 'mentors', 'option_values'];

export type ListItem ={ id: string; name: string; hidden: boolean; uses: number; aliases?: string[] };
export type ListData = ListDef & { items: ListItem[] };
