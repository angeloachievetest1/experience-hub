'use client';

import { useMemo } from 'react';
import { createTaskCase, deleteTaskCase, updateTaskCase } from '@/app/(app)/quality-analyst/task-actions';
import { RecordDrawer, type FieldGroup } from '@/components/records/RecordDrawer';
import { SectionShell, useShell } from '@/components/records/SectionShell';
import { NEW_RECORD, useNewRecord } from '@/components/records/useNewRecord';
import { AUDIT_COLOR, AUDIT_LISTS, inAuditRange, withCalculated, type AuditCase, type AuditData } from '@/lib/qa/audits';
import { customerLabel } from '@/lib/records/labels';

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
    // A blank case, saved only by its Save case button.
    addCase: () => shell.open(NEW_RECORD),
  };
}

function AuditDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, list } = useAudits();
  // A new case starts as Tutoring / eLearning when those are on the lists.
  const record = useNewRecord<AuditCase>({
    id, rows: data.cases, create: createTaskCase, update: updateTaskCase,
    start: {
      case_type: list(AUDIT_LISTS.type).includes('Tutoring') ? 'Tutoring' : null,
      record_type: list(AUDIT_LISTS.recordType).includes('eLearning') ? 'eLearning' : null,
    },
  });
  const c = record.record;
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
      title={record.isNew ? 'New case' : c ? customerLabel(c) : ''}
      groups={groups}
      canEdit={data.canEdit}
      readOnlyText="Read only. You can’t edit Quality Analyst cases."
      // Week ending, case cycle and date closed are worked out, not saved as typed.
      onSave={({ week_ending: _w, case_cycle: _c, date_closed: _d, ...patch }) => record.save(patch)}
      onDelete={record.remove(deleteTaskCase)}
      {...record.drawer}
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
