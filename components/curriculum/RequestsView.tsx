'use client';

import { useState } from 'react';
import { createRequest } from '@/app/(app)/curriculum/actions';
import { RecordTable } from '@/components/records/RecordTable';
import { FilterSelect } from '@/components/ui/Dropdowns';
import { AddButton, SearchBox, matches } from '@/components/ui/SearchBox';
import { formatDate, inRange } from '@/lib/qa/stats';
import { requestLabel } from '@/lib/curriculum/types';
import { requesterLabel } from '@/lib/records/labels';
import { reqKey, useCur, withKey } from './useCur';

const distinct = (values: (string | null)[]) => [...new Set(values.filter(Boolean) as string[])].sort();

// Instructor requests: one row per request, as in the prototype.
export function RequestsView() {
  const { data, range, open, add, adding, courseName } = useCur();
  const [status, setStatus] = useState<string>('All');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tm, setTm] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const inDates = data.requests.filter((r) => inRange(r.date_submitted, range));
  const statuses = ['All', ...(data.options.cur_request_status ?? [])];
  const count = (s: string) => (s === 'All' ? inDates.length : inDates.filter((r) => r.status === s).length);

  const rows = inDates.filter((r) =>
    (status === 'All' || r.status === status) &&
    (!feedback || r.feedback_type === feedback) &&
    (!tm || r.ticket_manager === tm) &&
    matches(query, [requestLabel(r), r.requester_name, courseName(r.course_id), r.comments, r.notes, r.base_material]));

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
          options={distinct([...(data.options.cur_feedback_type ?? []), ...inDates.map((r) => r.feedback_type)])} />
        <FilterSelect label="Ticket manager" allLabel="All ticket managers" value={tm} onChange={setTm}
          options={distinct(data.requests.map((r) => r.ticket_manager))} />
        <SearchBox value={query} onChange={setQuery} placeholder="Search requester, course, comment" label="Search instructor requests" />
        {data.canEdit && <AddButton label="Add request" busy={adding} onClick={() => add(() => withKey(reqKey)(createRequest()))} />}
        <span className="ml-auto text-sm text-ink-muted">Showing {rows.length} of {inDates.length} requests</span>
      </div>
      <RecordTable
        rows={rows}
        leading={{ key: 'date', header: 'Date', render: (r) => <span className="whitespace-nowrap">{formatDate(r.date_submitted) || '—'}</span> }}
        label={requesterLabel}
        onOpen={(id) => open(reqKey(id))}
        empty="No requests match these filters."
        columns={[
          { key: 'course', header: 'Course', render: (r) => courseName(r.course_id) || '—' },
          { key: 'feedback', header: 'Feedback type', render: (r) => r.feedback_type || '—' },
          { key: 'material', header: 'Material', render: (r) => r.base_material || '—' },
          { key: 'status', header: 'Status', render: (r) => r.status || '—' },
          { key: 'tm', header: 'Ticket manager', render: (r) => r.ticket_manager || '—' },
          { key: 'comments', header: 'Comments', render: (r) => <span className="line-clamp-2 max-w-64 text-ink-muted">{r.comments || '—'}</span> },
        ]}
      />
    </div>
  );
}
