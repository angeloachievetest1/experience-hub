'use client';

import { RecordTable, type TableColumn } from '@/components/records/RecordTable';
import { formatDate } from '@/lib/qa/stats';
import { customerLabel } from '@/lib/records/labels';
import { caseIssue, type QaCase } from '@/lib/qa/types';
import { FollowBadge, SourceTag, ValidityBadge } from './Badges';
import { useQa } from './QaShell';

export type CaseColumn = 'date' | 'source' | 'course' | 'instructor' | 'analyst' | 'issue' | 'validity' | 'follow' | 'needs';

// Quality Analyst case table; each row opens the case panel.
export function CaseTable({
  cases, columns, empty = 'No cases match these filters.', needs,
}: { cases: QaCase[]; columns: CaseColumn[]; empty?: string; needs?: (c: QaCase) => string[] }) {
  const { openCase, courseNames, instructorName } = useQa();

  const all: Record<CaseColumn, TableColumn<QaCase>> = {
    date: { key: 'date', header: 'Date', render: (c) => <span className="whitespace-nowrap">{formatDate(c.case_date) || '—'}</span> },
    source: { key: 'source', header: 'Source', render: (c) => <SourceTag source={c.source} /> },
    course: { key: 'course', header: 'Course', render: (c) => courseNames(c) || '—' },
    instructor: { key: 'instructor', header: 'Instructor', render: (c) => instructorName(c.instructor_id) || '—' },
    analyst: { key: 'analyst', header: 'Analyst', render: (c) => c.analyst || '—' },
    issue: { key: 'issue', header: 'Type or reason', render: (c) => caseIssue(c) || '—' },
    validity: { key: 'validity', header: 'Validity', render: (c) => <ValidityBadge value={c.validity} /> },
    follow: { key: 'follow', header: 'Resolution', render: (c) => <FollowBadge c={c} /> },
    needs: {
      key: 'needs', header: 'Needs',
      render: (c) => (
        <div className="flex flex-wrap gap-1.5">
          {(needs?.(c) ?? []).map((n) => (
            <span key={n} className="rounded-full bg-peach-200 px-2.5 py-1 text-[13px] whitespace-nowrap">{n}</span>
          ))}
        </div>
      ),
    },
  };

  // Order: Date, Case (customer name), Link, then the rest.
  return (
    <RecordTable
      rows={cases}
      leading={all.date}
      label={customerLabel}
      link={(c) => c.case_link}
      columns={columns.filter((c) => c !== 'date').map((c) => all[c])}
      onOpen={openCase}
      empty={empty}
    />
  );
}
