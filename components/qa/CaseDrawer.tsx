'use client';

import { useMemo } from 'react';
import { deleteQaCase, updateQaCase } from '@/app/(app)/quality-analyst/actions';
import { RecordDrawer, type FieldDef, type FieldGroup } from '@/components/records/RecordDrawer';
import { customerLabel } from '@/lib/records/labels';
import { SOURCE_COLORS, VALIDITY_VALUES, type QaCase, type QaData, type QaPatch } from '@/lib/qa/types';
import { useQa } from './QaShell';

function groupsFor(c: QaCase, data: QaData): FieldGroup[] {
  const o = (k: string) => data.options[k] ?? [];
  const analysts = [...new Set(data.cases.map((x) => x.analyst).filter(Boolean) as string[])].sort();
  const caseFields: FieldDef[] = [
    { key: 'case_date', label: 'Date', kind: 'date' },
    { key: 'customer_name', label: 'Customer', kind: 'text' },
    c.source === 'Returned'
      ? { key: 'course_ids', label: 'Courses', kind: 'multiLookup', options: data.courses }
      : { key: 'course_id', label: 'Course', kind: 'lookup', options: data.courses },
  ];
  if (c.source !== 'Returned') {
    caseFields.push({
      key: 'instructor_id', label: 'Instructor', kind: 'lookup', options: data.instructors,
      emptyHint: 'The instructor list is empty until the master list is loaded.',
    });
  }
  // Survey and Returned records have no analyst (owner decisions 2026-09-30).
  if (c.source === 'Instructor' || c.source === 'Course') caseFields.push({ key: 'analyst', label: 'Analyst', kind: 'suggest', suggestions: analysts });

  if (c.source === 'Instructor' || c.source === 'Course') {
    const s = c.source === 'Instructor' ? 'instructor' : 'course';
    caseFields.push(
      { key: 'category', label: 'Category', kind: 'select', options: o(`qa_category_${s}`) },
      { key: 'complaint_types', label: 'Complaint types', kind: 'multi', options: o(`qa_type_${s}`) },
    );
  }
  if (c.source === 'Survey') {
    caseFields.push(
      { key: 'survey_type', label: 'Survey type', kind: 'select', options: o('qa_survey_type'), names: data.optionNames.qa_survey_type },
      { key: 'survey_id', label: 'Survey ID', kind: 'text' },
      { key: 'rating', label: 'Rating (1–6)', kind: 'rating' },
      { key: 'reason_type', label: 'Reason type', kind: 'select', options: o('qa_survey_reason') },
      { key: 'customer_comment', label: 'Customer comment', kind: 'textarea' },
    );
  }
  if (c.source === 'Returned') {
    caseFields.push(
      { key: 'complaint_types', label: 'Complaint type', kind: 'multi', options: o('qa_returned_type') },
      { key: 'reassign_reason', label: 'Reassign reason', kind: 'select', options: o('qa_reassign_reason') },
    );
  }

  const groups: FieldGroup[] = [{ title: 'Case', fields: caseFields }];
  if (c.source === 'Instructor') {
    groups.push({
      title: 'Learner engagement',
      fields: [
        { key: 'course_end_date', label: 'Course end date', kind: 'date' },
        { key: 'attendance_pct', label: 'Attendance %', kind: 'pct' },
        { key: 'participation_pct', label: 'Participation %', kind: 'pct' },
        { key: 'moodle_pct', label: 'Moodle %', kind: 'pct' },
      ],
    });
  }
  // Returned cases have no validity or follow-up (owner decision 2026-09-30).
  const outcome: FieldDef[] = c.source === 'Returned' ? [] : [{ key: 'validity', label: 'Validity', kind: 'select', options: VALIDITY_VALUES }];
  if (c.source !== 'Survey') outcome.push({ key: 'resolution', label: 'Resolution', kind: 'select', options: o('qa_resolution') });
  if (c.source === 'Course' || c.source === 'Survey') {
    outcome.push({ key: 'case_closed_by', label: 'Case closed by', kind: 'select', options: o('qa_case_closed_by') });
  }
  groups.push({ title: 'Outcome', fields: outcome });
  if (c.source !== 'Returned') groups.push({
    title: 'Follow-up',
    fields: [
      { key: 'followup_email', label: 'Email sent', kind: 'select', options: o('qa_followup_sent') },
      { key: 'followup_sms', label: 'SMS sent', kind: 'select', options: o('qa_followup_sent') },
      { key: 'followup_call', label: 'Call made', kind: 'select', options: o('qa_followup_sent') },
      { key: 'customer_reached', label: 'Customer reached', kind: 'select', options: o('qa_reached') },
    ],
  });
  groups.push({
    title: 'Record',
    fields: [
      { key: 'case_link', label: 'Case link', kind: 'url' },
      { key: 'notes', label: 'Notes', kind: 'textarea' },
    ],
  });
  return groups;
}

export function CaseDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, adding } = useQa();
  const c = data.cases.find((x) => x.id === id) ?? null;
  const groups = useMemo(() => (c ? groupsFor(c, data) : []), [c, data]);

  return (
    <RecordDrawer
      record={c}
      loadingText={adding ? 'Creating the new case…' : undefined}
      kindLabel={c ? `${c.source} record` : ''}
      color={c ? SOURCE_COLORS[c.source] : '#DDD1FF'}
      title={c ? customerLabel(c) : ''}
      groups={groups}
      canEdit={data.canEdit}
      readOnlyText="Read only. You can’t edit Quality Analyst cases."
      onSave={(patch) => updateQaCase(id, patch as QaPatch)}
      onDelete={() => deleteQaCase(id)}
      deleteQuestion={c ? `Delete the case for ${customerLabel(c)}?` : ''}
      onClose={onClose}
    />
  );
}
