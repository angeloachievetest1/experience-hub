'use client';

import {
  createCustomerCase, createRequest, deleteCustomerCase, deleteRequest, updateCustomerCase, updateRequest,
} from '@/app/(app)/curriculum/actions';
import { RecordDrawer, type FieldGroup } from '@/components/records/RecordDrawer';
import { useNewRecord } from '@/components/records/useNewRecord';
import { CURRICULUM_COLOR, daysBetween, type CurCase, type CurData, type CurRequest } from '@/lib/curriculum/types';
import { localToday } from '@/lib/qa/stats';
import { customerLabel, requesterLabel } from '@/lib/records/labels';
import { useCur } from './useCur';

const READ_ONLY = 'Read only. You can’t edit Curriculum records.';
const distinct = (values: (string | null)[]) => [...new Set(values.filter(Boolean) as string[])].sort();

export function CustomerCaseDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useCur();
  // "Add case": a blank case, saved only by its Save case button.
  const record = useNewRecord<CurCase>({
    id, rows: data.cases, create: createCustomerCase, update: updateCustomerCase,
    start: { case_date: localToday(), field_notes: {} },
  });
  const c = record.record;
  const o = (k: string) => data.options[k] ?? [];

  const groups: FieldGroup[] = [
    {
      title: 'Case',
      fields: [
        { key: 'case_date', label: 'Date', kind: 'date' },
        { key: 'customer_name', label: 'Customer', kind: 'text' },
        { key: 'course_id', label: 'Course', kind: 'lookup', options: data.courses },
        { key: 'case_source', label: 'Source of case', kind: 'select', options: o('cur_case_source') },
        { key: 'category', label: 'Category', kind: 'select', options: o('cur_category') },
        { key: 'issue_type', label: 'Type', kind: 'select', options: o('cur_issue_type') },
        { key: 'material_type', label: 'Achieve material', kind: 'select', options: o('cur_material_type') },
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
        { key: 'case_resolution', label: 'Case resolution', kind: 'select', options: o('cur_case_resolution') },
        { key: 'case_status_in_sf', label: 'Case status in SF', kind: 'select', options: o('cur_sf_status') },
      ],
    },
    { title: 'Record', fields: [{ key: 'case_link', label: 'Case link', kind: 'url' }] },
  ];

  return (
    <RecordDrawer
      record={c}
      kindLabel="Curriculum customer case"
      color={CURRICULUM_COLOR}
      title={record.isNew ? 'New case' : c ? customerLabel(c) : ''}
      groups={groups}
      canEdit={data.canEdit}
      readOnlyText={READ_ONLY}
      onSave={record.save}
      onDelete={record.remove(deleteCustomerCase)}
      {...record.drawer}
      deleteQuestion={c ? `Delete the case for ${customerLabel(c)}?` : ''}
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
  const { data } = useCur();
  // "Add request": a blank request, saved only by its Save request button.
  const record = useNewRecord<CurRequest>({
    id, rows: data.requests, create: createRequest, update: updateRequest, saveLabel: 'Save request',
    start: { date_submitted: localToday(), field_notes: {} },
  });
  const r = record.record;
  const title = record.isNew ? 'New request' : r ? requesterLabel(r) : '';

  return (
    <RecordDrawer
      record={r}
      kindLabel="Instructor request"
      color={CURRICULUM_COLOR}
      title={title}
      groups={requestGroups(data)}
      canEdit={data.canEdit}
      readOnlyText={READ_ONLY}
      onSave={record.save}
      onDelete={record.remove(deleteRequest)}
      {...record.drawer}
      deleteQuestion={`Delete the request from ${title}?`}
      deleteLabel="Delete request"
      onClose={onClose}
    />
  );
}
