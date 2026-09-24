'use client';

import {
  addRequestLine, deleteCustomerCase, deleteRequest, updateCustomerCase, updateRequest,
} from '@/app/(app)/curriculum/actions';
import { RecordDrawer, type FieldGroup } from '@/components/records/RecordDrawer';
import { CURRICULUM_COLOR, caseLabel, daysBetween, requestLabel, type CurData } from '@/lib/curriculum/types';
import { reqKey, useCur, withKey } from './useCur';

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

function requestGroups(data: CurData, isLine: boolean): FieldGroup[] {
  const o = (k: string) => data.options[k] ?? [];
  const details: FieldGroup = {
    title: isLine ? 'Line details' : 'Details',
    fields: [
      { key: 'base_material', label: 'Base material', kind: 'select', options: o('cur_base_material') },
      { key: 'comments', label: 'Comments', kind: 'textarea' },
      { key: 'status', label: 'Status', kind: 'select', options: o('cur_request_status') },
      { key: 'notes', label: 'Notes', kind: 'textarea' },
      { key: 'date_completed', label: 'Date completed', kind: 'date' },
      { key: 'ticket_manager', label: 'Ticket manager', kind: 'suggest', suggestions: distinct(data.requests.map((r) => r.ticket_manager)) },
    ],
  };
  if (isLine) return [details];
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
  const { data, adding, open, add } = useCur();
  const r = data.requests.find((x) => x.id === id) ?? null;
  const parent = r?.parent_id ? data.requests.find((x) => x.id === r.parent_id) ?? null : null;
  const lines = r && !r.parent_id
    ? data.requests.filter((x) => x.parent_id === r.id).sort((a, b) => a.line_order - b.line_order)
    : [];
  const isLine = Boolean(r?.parent_id);
  const lineNo = parent ? data.requests.filter((x) => x.parent_id === parent.id).sort((a, b) => a.line_order - b.line_order).findIndex((x) => x.id === id) + 2 : 0;
  const title = r ? (isLine && parent ? `${requestLabel(parent)} · line ${lineNo}` : requestLabel(r)) : '';

  const extra = !r ? null : isLine ? (
    parent && (
      <button type="button" onClick={() => open(reqKey(parent.id))}
        className="h-11 cursor-pointer self-start rounded-[10px] border border-lilac-200 px-4 text-sm">
        ← Back to {requestLabel(parent)}
      </button>
    )
  ) : (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 font-display text-lg font-normal">Continuation lines</h3>
      <p className="m-0 text-[13px] text-ink-muted">Extra rows that belong to this request (they had a blank requester and course in the sheet).</p>
      {lines.length === 0 && <div className="text-sm text-ink-muted">No continuation lines.</div>}
      {lines.map((l, i) => (
        <button key={l.id} type="button" onClick={() => open(reqKey(l.id))}
          className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-lilac-200 px-3.5 py-2 text-left text-sm hover:bg-lilac-50">
          <span><strong>Line {i + 2}</strong> · {l.base_material || 'No material'}{l.comments ? ` · ${l.comments.slice(0, 50)}` : ''}</span>
          <span className="shrink-0 text-ink-muted">{l.status || '—'}</span>
        </button>
      ))}
      {data.canEdit && (
        <button type="button" disabled={adding} onClick={() => add(() => withKey(reqKey)(addRequestLine(r.id)))}
          className="h-11 cursor-pointer self-start rounded-[10px] border border-primary px-4 text-sm font-semibold disabled:opacity-60">
          {adding ? 'Adding…' : '+ Add continuation line'}
        </button>
      )}
    </section>
  );

  return (
    <RecordDrawer
      record={r}
      loadingText={adding ? 'Creating…' : undefined}
      kindLabel={isLine ? 'Continuation line' : 'Instructor request'}
      color={CURRICULUM_COLOR}
      title={title}
      isSample={r?.is_sample}
      groups={requestGroups(data, isLine)}
      canEdit={data.canEdit}
      readOnlyText={READ_ONLY}
      onSave={(patch) => updateRequest(id, patch)}
      onDelete={() => deleteRequest(id)}
      deleteQuestion={isLine ? `Delete ${title}?` : `Delete ${title}${lines.length ? ` and its ${lines.length} continuation line${lines.length > 1 ? 's' : ''}` : ''}?`}
      deleteLabel={isLine ? 'Delete line' : 'Delete request'}
      onClose={onClose}
      extra={extra}
    />
  );
}
