'use client';

import { useState } from 'react';
import { RecordTable } from '@/components/records/RecordTable';
import { FilterSelect } from '@/components/ui/Dropdowns';
import { AddButton, LogToolbar, SearchBox, matches } from '@/components/ui/SearchBox';
import { AUDIT_LISTS, auditResult, withTypedIn, type AuditCase } from '@/lib/qa/audits';
import { formatDate } from '@/lib/qa/stats';
import { customerLabel } from '@/lib/records/labels';
import { useAudits } from './AuditShell';

const RESULTS = ['No error', 'Error', 'Not set'] as const;

function ResultBadge({ c }: { c: AuditCase }) {
  const result = auditResult(c);
  if (result === 'Not set') return <span className="text-ink-muted">Not audited yet</span>;
  const ok = result === 'No error';
  return (
    <span className="inline-block max-w-56 rounded-full px-2.5 py-1 text-[13px]" style={{ background: ok ? '#EAE2FF' : '#FFE3D9' }}>
      {ok ? 'No error' : c.error_type ?? 'Error (type not set)'}
    </span>
  );
}

export function AuditLogView() {
  const { data, open, addCase, adding, inDates, list } = useAudits();
  const [type, setType] = useState<string | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const rows = inDates
    .filter((c) =>
      (!type || c.case_type === type) &&
      (!person || c.handled_by === person) &&
      (!result || auditResult(c) === result) &&
      (!category || c.error_category === category) &&
      (!error || c.error_type === error) &&
      matches(query, [c.customer_name, c.subject, c.call_outs, c.handled_by, c.manager]))
    .sort((a, b) => (b.closed_at ?? b.date_closed ?? '').localeCompare(a.closed_at ?? a.date_closed ?? ''));

  return (
    <div className="flex flex-col gap-4">
      <LogToolbar
        filters={<>
          <FilterSelect label="Type" allLabel="All types" value={type} onChange={setType} options={withTypedIn(list(AUDIT_LISTS.type), data.cases.map((c) => c.case_type))} />
          <FilterSelect label="Handled by" allLabel="Everyone" value={person} onChange={setPerson} options={withTypedIn(list(AUDIT_LISTS.person), data.cases.map((c) => c.handled_by))} />
          <FilterSelect label="Result" allLabel="All results" value={result} onChange={setResult} options={[...RESULTS]} />
          <FilterSelect label="Category" allLabel="All categories" value={category} onChange={setCategory} options={withTypedIn(list(AUDIT_LISTS.category), data.cases.map((c) => c.error_category))} />
          <FilterSelect label="Error" allLabel="All errors" value={error} onChange={setError} options={withTypedIn(list(AUDIT_LISTS.error), data.cases.map((c) => c.error_type))} />
        </>}
        add={data.canEdit && <AddButton label="Add case" busy={adding} onClick={addCase} />}
        search={<SearchBox value={query} onChange={setQuery} placeholder="Search customer, subject, call outs" label="Search the task log" width="sm:w-96" />}
        count={`Showing ${rows.length} of ${inDates.length} cases`}
      />
      <RecordTable
        rows={rows}
        minWidth={1180}
        leading={{ key: 'week', header: 'Week ending', render: (c) => <span className="whitespace-nowrap">{formatDate(c.week_ending) || '—'}</span> }}
        label={customerLabel}
        subLabel={(c) => c.subject ?? ''}
        link={(c) => c.case_link}
        onOpen={open}
        columns={[
          { key: 'closed', header: 'Date closed', render: (c) => <span className="whitespace-nowrap">{formatDate(c.date_closed) || '—'}</span> },
          { key: 'handled', header: 'Handled by', render: (c) => c.handled_by || '—' },
          { key: 'result', header: 'Result', render: (c) => <ResultBadge c={c} /> },
          { key: 'category', header: 'Category', render: (c) => c.error_category || '—' },
          { key: 'cycle', header: 'Case cycle', render: (c) => <span className="whitespace-nowrap">{c.case_cycle || '—'}</span> },
          { key: 'auditor', header: 'Auditor', render: (c) => c.auditor || '—' },
        ]}
      />
    </div>
  );
}
