'use client';

import { useMemo, useState } from 'react';
import { createMentorCase } from '@/app/(app)/mentor/actions';
import { ValidityBadge } from '@/components/qa/Badges';
import { RecordTable } from '@/components/records/RecordTable';
import { FilterSelect } from '@/components/ui/Dropdowns';
import { AddButton, SearchBox, matches } from '@/components/ui/SearchBox';
import { formatDate, inRange } from '@/lib/qa/stats';
import { MENTOR_VALIDITY, periodDate } from '@/lib/mentor/types';
import { customerLabel } from '@/lib/records/labels';
import { useMentor } from './MentorShell';

const STATUS_STYLE: Record<string, string> = { 'New': '#FFE3D9', 'In-progress': '#DDD1FF', 'Closed': '#F6F3FF' };

export function MentorCaseLogView() {
  const { data, range, open, add, adding, mentorName, courseName } = useMentor();
  const [mentor, setMentor] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [subType, setSubType] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [validity, setValidity] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const inDates = useMemo(() => data.cases.filter((c) => inRange(periodDate(c), range)), [data.cases, range]);
  const rows = inDates.filter((c) =>
    (!mentor || mentorName(c.mentor_id) === mentor) &&
    (!type || c.complaint_type === type) &&
    (!subType || c.complaint_sub_type === subType) &&
    (!status || c.status === status) &&
    (!validity || c.complaint_analysis === validity) &&
    matches(query, [c.customer_name, mentorName(c.mentor_id), courseName(c.course_id), c.email_sms_preview]));

  const o = (k: string) => data.options[k] ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect label="Mentor" allLabel="All mentors" value={mentor} onChange={setMentor} options={data.mentors.map((m) => m.name)} />
        <FilterSelect label="Complaint type" allLabel="All types" value={type} onChange={setType} options={o('mentor_complaint_type')} />
        <FilterSelect label="Sub type" allLabel="All sub types" value={subType} onChange={setSubType} options={o('mentor_complaint_sub_type')} />
        <FilterSelect label="Status" allLabel="All statuses" value={status} onChange={setStatus} options={o('mentor_status')} />
        <FilterSelect label="Validity" allLabel="All validity" value={validity} onChange={setValidity} options={[...MENTOR_VALIDITY]} />
        <SearchBox value={query} onChange={setQuery} placeholder="Search customer, mentor, course" label="Search mentor complaints" />
        {data.canEdit && <AddButton label="Add case" busy={adding} onClick={() => add(createMentorCase)} />}
        <span className="ml-auto text-sm text-ink-muted">Showing {rows.length} of {inDates.length} cases</span>
      </div>
      <RecordTable
        rows={rows}
        leading={{ key: 'date', header: 'Date', render: (c) => <span className="whitespace-nowrap">{formatDate(c.case_date) || (c.year ? `${c.year} ${c.quarter ?? ''}` : '—')}</span> }}
        label={customerLabel}
        link={(c) => c.case_link}
        onOpen={open}
        columns={[
          { key: 'mentor', header: 'Mentor', render: (c) => mentorName(c.mentor_id) || '—' },
          { key: 'course', header: 'Course', render: (c) => courseName(c.course_id) || '—' },
          { key: 'type', header: 'Complaint type', render: (c) => c.complaint_type || '—' },
          { key: 'sub', header: 'Sub type', render: (c) => c.complaint_sub_type || '—' },
          { key: 'validity', header: 'Validity', render: (c) => <ValidityBadge value={c.complaint_analysis} /> },
          {
            key: 'status', header: 'Status',
            render: (c) => c.status
              ? <span className="rounded-full px-2.5 py-1 text-[13px] whitespace-nowrap" style={{ background: STATUS_STYLE[c.status] ?? '#F6F3FF' }}>{c.status}</span>
              : <span className="text-ink-muted">—</span>,
          },
        ]}
      />
    </div>
  );
}
