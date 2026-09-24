'use client';

import { useMemo } from 'react';
import { deleteMentorCase, updateMentorCase } from '@/app/(app)/mentor/actions';
import { RecordDrawer, type FieldGroup } from '@/components/records/RecordDrawer';
import { SectionShell, useShell } from '@/components/records/SectionShell';
import { MENTOR_COLOR, MENTOR_VALIDITY, QUARTERS, mentorLabel, yearQuarterOf, type MentorData } from '@/lib/mentor/types';

export function MentorShell({ data, title, subtitle, children }: {
  data: MentorData; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <SectionShell
      data={data}
      title={title}
      subtitle={subtitle}
      rangeKey="eh.mentor.range"
      hasSample={data.cases.some((c) => c.is_sample)}
      renderDrawer={(id, close) => <MentorDrawer id={id} onClose={close} />}
    >
      {children}
    </SectionShell>
  );
}

export function useMentor() {
  const shell = useShell<MentorData>();
  const names = useMemo(() => {
    const mentors = new Map(shell.data.mentors.map((m) => [m.id, m.name]));
    const courses = new Map(shell.data.courses.map((c) => [c.id, c.name]));
    return {
      mentorName: (id: string | null) => (id ? mentors.get(id) ?? 'Unknown mentor' : ''),
      courseName: (id: string | null) => (id ? courses.get(id) ?? 'Unknown course' : ''),
    };
  }, [shell.data.mentors, shell.data.courses]);
  return { ...shell, ...names };
}

function MentorDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, adding } = useMentor();
  const c = data.cases.find((x) => x.id === id) ?? null;
  const o = (k: string) => data.options[k] ?? [];

  const groups: FieldGroup[] = [
    {
      title: 'Case',
      fields: [
        { key: 'case_date', label: 'Date', kind: 'date' },
        { key: 'year', label: 'Year', kind: 'number' },
        { key: 'quarter', label: 'Quarter', kind: 'select', options: QUARTERS },
        { key: 'customer_name', label: 'Customer', kind: 'text' },
        { key: 'mentor_id', label: 'Mentor', kind: 'lookup', options: data.mentors },
        { key: 'course_id', label: 'Course', kind: 'lookup', options: data.courses },
      ],
    },
    {
      title: 'Complaint',
      fields: [
        { key: 'complaint_type', label: 'Complaint type', kind: 'select', options: o('mentor_complaint_type') },
        { key: 'complaint_sub_type', label: 'Sub type', kind: 'select', options: o('mentor_complaint_sub_type') },
        { key: 'complaint_analysis', label: 'Complaint analysis', kind: 'select', options: MENTOR_VALIDITY },
      ],
    },
    {
      title: 'Outcome',
      fields: [
        { key: 'status', label: 'Status', kind: 'select', options: o('mentor_status') },
        { key: 'case_closed_by', label: 'Case closed by', kind: 'select', options: o('mentor_case_closed_by') },
      ],
    },
    {
      title: 'Outreach',
      fields: [
        { key: 'email_sent', label: 'Email sent', kind: 'bool' },
        { key: 'email_sms_preview', label: 'Email / SMS preview', kind: 'textarea' },
      ],
    },
    { title: 'Record', fields: [{ key: 'case_link', label: 'Case link', kind: 'url' }] },
  ];

  return (
    <RecordDrawer
      record={c}
      loadingText={adding ? 'Creating the new case…' : undefined}
      kindLabel="Mentor complaint"
      color={MENTOR_COLOR}
      title={c ? mentorLabel(c) : ''}
      isSample={c?.is_sample}
      groups={groups}
      canEdit={data.canEdit}
      readOnlyText="Read only. You can’t edit Mentor cases."
      onSave={(patch) => updateMentorCase(id, patch)}
      onDelete={() => deleteMentorCase(id)}
      deleteQuestion={c ? `Delete ${mentorLabel(c)}?` : ''}
      onClose={onClose}
      // Changing the date updates year and quarter to match.
      derive={(draft, key) => {
        if (key !== 'case_date') return draft;
        const yq = yearQuarterOf(draft.case_date as string | null);
        return yq ? { ...draft, ...yq } : draft;
      }}
    />
  );
}
