'use client';

import { deleteCustomerCase, deleteRequest, updateCustomerCase, updateRequest } from '@/app/(app)/curriculum/actions';
import { RecordDrawer, type FieldGroup } from '@/components/records/RecordDrawer';
import { CURRICULUM_COLOR, caseLabel, daysBetween, requestLabel, type CurData } from '@/lib/curriculum/types';
import { useCur } from './useCur';

const READ_ONLY = 'Read only. You can’t edit Curriculum records.';
const distinct = (values: (string | null)[]) => [...new Set(values.filter(Boolean) as string[])].sort();

export function CustomerCaseDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, adding } = useCur();
  const c = data.cases.find((x) => x.id === id) ?? null;
  const o = (k: string) => data.options[k] ?? [];

  const groups: FieldGroup[] = [
    {
      title: 'Case',
      fields: [
        { key: 'case_date', label: 'Date', kind: 'date' },
        { key: 'customer_name', label: 'Customer', kind: 'text' },
        { key: 'course_id', label: 'Course', kind: 'lookup', options: data.courses },
        { key: 'category', label: 'Category', kind: 'select', options: o('cur_category') },
        { key: 'material_type', label: 'Material type', kind: 'select', options: o('cur_material_type') },
        { key: 'curriculum_sme', label: 'Curriculum SME', kind: 'suggest', suggestions: distinct(data.cases.map((x) => x.curriculum_sme)) },
        { key: 'tm_on_sf', label: 'TM on SF', kind: 'text' },
      ],
    },
    {
      title: 'Complaint',
      fields: [
        { key: 'comments', label: 'Comments / complaints', kind: 'textarea' },
        { key: 'feedback_progress', label: 'Feedback / progress made', kind: 'textarea' },
      ],
    },
    {
      title: 'Resolution',
      fields: [
        { key: 'date_resolved', label: 'Date resolved', kind: 'date' },
        { key: 'resolution_tat_days', label: 'Resolution TAT (days)', kind: 'number' },
      ],
    },
    { title: 'Record', fields: [{ key: 'case_link', label: 'Case link', kind: 'url' }] },
  ];

  return (
    <RecordDrawer
      record={c}
      loadingText={adding ? 'Creating the new case…' : undefined}
      kindLabel="Curriculum customer case"
      color={CURRICULUM_COLOR}
      title={c ? caseLabel(c) : ''}
      isSample={c?.is_sample}
      groups={groups}
      canEdit={data.canEdit}
      readOnlyText={READ_ONLY}
      onSave={(patch) => updateCustomerCase(id, patch)}
      onDelete={() => deleteCustomerCase(id)}
      deleteQuestion={c ? `Delete ${caseLabel(c)}?` : ''}
      onClose={onClose}
      // Fill the TAT from the two dates when both are set.
      derive={(draft, key) => {
        if (key !== 'case_date' && key !== 'date_resolved') return draft;
        const days = daysBetween(draft.case_date as string | null, draft.date_resolved as string | null);
        return days === null ? draft : { ...draft, resolution_tat_days: days };
      }}
    />
  );
}

function requestGroups(data: CurData): FieldGroup[] {
  const o = (k: string) => data.options[k] ?? [];
  const details: FieldGroup = {
    title: 'Details',
    fields: [
      { key: 'base_material', label: 'Base material', kind: 'select', options: o('cur_base_material') },
      { key: 'comments', label: 'Comments', kind: 'textarea' },
      { key: 'status', label: 'Status', kind: 'select', options: o('cur_request_status') },
      { key: 'notes', label: 'Notes', kind: 'textarea' },
      { key: 'date_completed', label: 'Date completed', kind: 'date' },
      { key: 'ticket_manager', label: 'Ticket manager', kind: 'suggest', suggestions: distinct(data.requests.map((r) => r.ticket_manager)) },
    ],
  };
  return [
    {
      title: 'Request',
      fields: [
        { key: 'requester_name', label: 'Requester', kind: 'suggest', suggestions: distinct(data.requests.map((r) => r.requester_name)) },
        { key: 'date_submitted', label: 'Date submitted', kind: 'date' },
        { key: 'course_id', label: 'Course', kind: 'lookup', options: data.courses },
        { key: 'feedback_type', label: 'Feedback type', kind: 'select', options: o('cur_feedback_type') },
      ],
    },
    details,
  ];
}

export function RequestDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, adding } = useCur();
  const r = data.requests.find((x) => x.id === id) ?? null;
  const title = r ? requestLabel(r) : '';

  return (
    <RecordDrawer
      record={r}
      loadingText={adding ? 'Creating the new request…' : undefined}
      kindLabel="Instructor request"
      color={CURRICULUM_COLOR}
      title={title}
      isSample={r?.is_sample}
      groups={requestGroups(data)}
      canEdit={data.canEdit}
      readOnlyText={READ_ONLY}
      onSave={(patch) => updateRequest(id, patch)}
      onDelete={() => deleteRequest(id)}
      deleteQuestion={`Delete ${title}?`}
      deleteLabel="Delete request"
      onClose={onClose}
    />
  );
}
