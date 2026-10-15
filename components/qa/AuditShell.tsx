'use client';

import { useMemo, useState } from 'react';
import { createTaskCase, deleteTaskCase, updateTaskCase } from '@/app/(app)/quality-analyst/task-actions';
import { RecordDrawer, type FieldGroup } from '@/components/records/RecordDrawer';
import { SectionShell, useShell } from '@/components/records/SectionShell';
import { AUDIT_COLOR, AUDIT_LISTS, inAuditRange, withCalculated, type AuditCase, type AuditData } from '@/lib/qa/audits';
import { customerLabel } from '@/lib/records/labels';

// The panel id for a new case that hasn't been saved yet.
const NEW_CASE = 'new';

// Operation Tasks pages: the shared section frame plus the Task Log panel.
export function AuditShell({ data, title, subtitle, children }: {
  data: AuditData; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <SectionShell
      data={data}
      title={title}
      subtitle={subtitle}
      rangeKey="eh.qa.range"
      renderDrawer={(id, close) => <AuditDrawer id={id} onClose={close} />}
    >
      {children}
    </SectionShell>
  );
}

export function useAudits() {
  const shell = useShell<AuditData>();
  const { data, range } = shell;
  const inDates = useMemo(() => data.cases.filter((c) => inAuditRange(c, range)), [data.cases, range]);
  return {
    ...shell,
    inDates,
    // A Case options list (AUDIT_LISTS), in its Case options order.
    list: (key: string) => data.options[key] ?? [],
    // Opens an empty case; nothing is saved until its "Save case" button is clicked.
    addCase: () => shell.open(NEW_CASE),
  };
}

// A new case starts as Tutoring / eLearning when those are on the lists.
function blankCase(options: AuditData['options']): AuditCase {
  return withCalculated({
    id: NEW_CASE, customer_name: null, case_link: null, subject: null,
    case_type: options[AUDIT_LISTS.type]?.includes('Tutoring') ? 'Tutoring' : null,
    record_type: options[AUDIT_LISTS.recordType]?.includes('eLearning') ? 'eLearning' : null,
    manager: null, opened_at: null, first_touch_at: null, closed_at: null, date_closed: null,
    week_ending: null, case_cycle: null, handled_by: null, no_error: null, error_type: null,
    error_category: null, auditor: null, call_outs: null, updated_at: '',
  });
}

function AuditDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, list } = useAudits();
  // A new case: the panel shows a blank case until the first save creates it;
  // after that it is the saved case (even before the page has refreshed).
  const [draft] = useState(() => blankCase(data.options));
  const [createdId, setCreatedId] = useState<string | null>(null);
  const savedId = id === NEW_CASE ? createdId : id;
  const saved = savedId ? data.cases.find((x) => x.id === savedId) ?? null : null;
  const c = saved ?? (id === NEW_CASE ? draft : null);
  const hasError = (d: Record<string, unknown>) => d.no_error === false;

  const groups: FieldGroup[] = [
    {
      title: 'Case',
      fields: [
        { key: 'customer_name', label: 'Customer', kind: 'text' },
        { key: 'case_link', label: 'Case link', kind: 'url' },
        { key: 'subject', label: 'Subject', kind: 'text' },
        { key: 'case_type', label: 'Type', kind: 'selectOther', options: list(AUDIT_LISTS.type) },
        { key: 'record_type', label: 'Case record type', kind: 'select', options: list(AUDIT_LISTS.recordType) },
        { key: 'manager', label: 'Manager', kind: 'select', options: list(AUDIT_LISTS.person) },
      ],
    },
    {
      title: 'Dates',
      fields: [
        { key: 'opened_at', label: 'Opened', kind: 'datetime' },
        { key: 'first_touch_at', label: 'First touch', kind: 'datetime' },
        { key: 'closed_at', label: 'Closed', kind: 'datetime' },
        { key: 'date_closed', label: 'Date closed', kind: 'date', readOnly: 'Copied from Closed (the date only).' },
        { key: 'week_ending', label: 'Week ending', kind: 'date', readOnly: 'Calculated: the Saturday on or after the date closed.' },
        { key: 'case_cycle', label: 'Case cycle', kind: 'text', readOnly: 'Calculated from first touch to closed, as in the sheet.' },
      ],
    },
    {
      title: 'Audit',
      fields: [
        { key: 'handled_by', label: 'Handled by', kind: 'select', options: list(AUDIT_LISTS.person) },
        { key: 'no_error', label: 'No error', kind: 'bool' },
        { key: 'error_type', label: 'Error 1', kind: 'selectOther', options: list(AUDIT_LISTS.error), visible: hasError },
        { key: 'error_category', label: 'Error 1 category', kind: 'select', options: list(AUDIT_LISTS.category), visible: hasError },
        { key: 'auditor', label: 'Auditor', kind: 'select', options: list(AUDIT_LISTS.auditor) },
        { key: 'call_outs', label: 'Call outs', kind: 'textarea' },
      ],
    },
  ];

  return (
    <RecordDrawer
      record={c}
      kindLabel="Operation task"
      color={AUDIT_COLOR}
      title={saved ? customerLabel(saved) : id === NEW_CASE ? 'New case' : ''}
      groups={groups}
      canEdit={data.canEdit}
      readOnlyText="Read only. You can’t edit Quality Analyst cases."
      // Week ending, case cycle and date closed are worked out, not saved as typed.
      onSave={async ({ week_ending: _w, case_cycle: _c, date_closed: _d, ...patch }) => {
        if (savedId) return updateTaskCase(savedId, patch);
        // First save of a new case: its starting values plus what was filled in.
        const result = await createTaskCase({ case_type: draft.case_type, record_type: draft.record_type, ...patch });
        if (result.ok && result.id) setCreatedId(result.id);
        return result;
      }}
      canDelete={Boolean(savedId)}
      saveLabel={savedId ? undefined : 'Save case'}
      onDelete={() => deleteTaskCase(savedId!)}
      deleteQuestion={c ? `Delete the task for ${customerLabel(c)}?` : ''}
      onClose={onClose}
      derive={(values, key) => {
        let next = values;
        // The date closed follows the closed time; "No error" clears the error.
        if (key === 'closed_at') next = { ...next, date_closed: typeof values.closed_at === 'string' ? values.closed_at.slice(0, 10) : null };
        if (key === 'no_error' && values.no_error !== false) next = { ...next, error_type: null, error_category: null };
        return withCalculated(next as Partial<AuditCase>) as Record<string, unknown>;
      }}
    />
  );
}
