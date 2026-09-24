'use client';

import { useMemo, useState } from 'react';
import { createRequest } from '@/app/(app)/curriculum/actions';
import { RecordTable } from '@/components/records/RecordTable';
import { FilterSelect } from '@/components/ui/Dropdowns';
import { AddButton, SearchBox, matches } from '@/components/ui/SearchBox';
import { formatDate, inRange } from '@/lib/qa/stats';
import { requestLabel, type CurRequest } from '@/lib/curriculum/types';
import { reqKey, useCur, withKey } from './useCur';

const distinct = (values: (string | null)[]) => [...new Set(values.filter(Boolean) as string[])].sort();

// Instructor requests, with continuation lines grouped under their request.
export function RequestsView() {
  const { data, range, open, add, adding, courseName } = useCur();
  const [status, setStatus] = useState<string>('All');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tm, setTm] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const linesOf = useMemo(() => {
    const map = new Map<string, CurRequest[]>();
    for (const r of data.requests) if (r.parent_id) map.set(r.parent_id, [...(map.get(r.parent_id) ?? []), r]);
    for (const list of map.values()) list.sort((a, b) => a.line_order - b.line_order);
    return map;
  }, [data.requests]);

  const parents = data.requests.filter((r) => !r.parent_id && inRange(r.date_submitted, range));
  const statuses = ['All', ...(data.options.cur_request_status ?? [])];
  const count = (s: string) => (s === 'All' ? parents.length : parents.filter((p) => p.status === s).length);

  const text = (r: CurRequest) => [requestLabel(r), r.requester_name, courseName(r.course_id), r.comments, r.notes, r.base_material];
  const shown = parents.filter((p) =>
    (status === 'All' || p.status === status) &&
    (!feedback || p.feedback_type === feedback) &&
    (!tm || p.ticket_manager === tm || (linesOf.get(p.id) ?? []).some((l) => l.ticket_manager === tm)) &&
    [p, ...(linesOf.get(p.id) ?? [])].some((r) => matches(query, text(r))));
  const rows = shown.flatMap((p) => [p, ...(linesOf.get(p.id) ?? [])]);
  const parentOf = new Map(data.requests.map((r) => [r.id, r]));

  const label = (r: CurRequest) => {
    if (!r.parent_id) return requestLabel(r);
    const parent = parentOf.get(r.parent_id);
    const n = (linesOf.get(r.parent_id) ?? []).findIndex((l) => l.id === r.id) + 2;
    return parent ? `${requestLabel(parent)} · line ${n}` : 'Line';
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {statuses.map((s) => {
          const on = status === s;
          return (
            <button key={s} type="button" aria-pressed={on} onClick={() => setStatus(s)}
              className={`flex cursor-pointer flex-col items-start gap-1 rounded-2xl border px-5 py-4 text-left ${on ? 'border-ink bg-ink text-white' : 'border-peach-200 bg-white hover:border-secondary'}`}>
              <span className="text-sm">{s === 'All' ? 'All requests' : s}</span>
              <span className="font-display text-[40px] leading-[1.1] font-light">{count(s)}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect label="Feedback type" allLabel="All types" value={feedback} onChange={setFeedback}
          options={distinct([...(data.options.cur_feedback_type ?? []), ...parents.map((p) => p.feedback_type)])} />
        <FilterSelect label="Ticket manager" allLabel="All ticket managers" value={tm} onChange={setTm}
          options={distinct(data.requests.map((r) => r.ticket_manager))} />
        <SearchBox value={query} onChange={setQuery} placeholder="Search requester, course, comment" label="Search instructor requests" />
        {data.canEdit && <AddButton label="Add request" busy={adding} onClick={() => add(() => withKey(reqKey)(createRequest()))} />}
        <span className="ml-auto text-sm text-ink-muted">Showing {shown.length} of {parents.length} requests</span>
      </div>
      <RecordTable
        rows={rows}
        label={label}
        subLabel={(r) => (r.parent_id ? 'Continuation line' : r.requester_name || 'No requester')}
        indent={(r) => Boolean(r.parent_id)}
        onOpen={(id) => open(reqKey(id))}
        empty="No requests match these filters."
        columns={[
          { key: 'date', header: 'Date', render: (r) => (r.parent_id ? '' : <span className="whitespace-nowrap">{formatDate(r.date_submitted) || '—'}</span>) },
          { key: 'course', header: 'Course', render: (r) => (r.parent_id ? '' : courseName(r.course_id) || '—') },
          { key: 'feedback', header: 'Feedback type', render: (r) => (r.parent_id ? '' : r.feedback_type || '—') },
          { key: 'material', header: 'Material', render: (r) => r.base_material || '—' },
          { key: 'status', header: 'Status', render: (r) => r.status || '—' },
          { key: 'tm', header: 'Ticket manager', render: (r) => r.ticket_manager || '—' },
          { key: 'comments', header: 'Comments', render: (r) => <span className="line-clamp-2 max-w-64 text-ink-muted">{r.comments || '—'}</span> },
        ]}
      />
    </div>
  );
}
