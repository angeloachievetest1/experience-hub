'use client';

import { useState } from 'react';
import { LinkCell } from '@/components/ui/LinkCell';
import { formatDate } from '@/lib/qa/stats';
import { caseIssue, caseLabel, type QaCase } from '@/lib/qa/types';
import { FollowBadge, SampleTag, SourceTag, ValidityBadge } from './Badges';
import { useQa } from './QaShell';

export type CaseColumn = 'date' | 'source' | 'course' | 'instructor' | 'analyst' | 'issue' | 'validity' | 'follow' | 'needs';

const HEAD: Record<CaseColumn, string> = {
  date: 'Date', source: 'Source', course: 'Course', instructor: 'Instructor', analyst: 'Analyst',
  issue: 'Type or reason', validity: 'Validity', follow: 'Follow-up', needs: 'Needs',
};

// Clickable case table; each row opens the case panel.
export function CaseTable({
  cases, columns, empty = 'No cases match these filters.', needs,
}: { cases: QaCase[]; columns: CaseColumn[]; empty?: string; needs?: (c: QaCase) => string[] }) {
  const { openCase, courseNames, instructorName } = useQa();
  const [limit, setLimit] = useState(100);
  const shown = cases.slice(0, limit);

  const cell = (c: QaCase, col: CaseColumn) => {
    switch (col) {
      case 'date': return <span className="whitespace-nowrap">{formatDate(c.case_date) || '—'}</span>;
      case 'source': return <SourceTag source={c.source} />;
      case 'course': return courseNames(c) || '—';
      case 'instructor': return instructorName(c.instructor_id) || '—';
      case 'analyst': return c.analyst || '—';
      case 'issue': return caseIssue(c) || '—';
      case 'validity': return <ValidityBadge value={c.validity} />;
      case 'follow': return <FollowBadge c={c} />;
      case 'needs':
        return (
          <div className="flex flex-wrap gap-1.5">
            {(needs?.(c) ?? []).map((n) => (
              <span key={n} className="rounded-full bg-peach-200 px-2.5 py-1 text-[13px] whitespace-nowrap">{n}</span>
            ))}
          </div>
        );
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-peach-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="bg-lilac-50">
            <tr>
              <th scope="col" className="px-6 py-3.5 text-left text-xs font-normal tracking-wide text-ink-muted uppercase">Case</th>
              <th scope="col" className="px-2.5 py-3.5 text-left text-xs font-normal tracking-wide text-ink-muted uppercase">Link</th>
              {columns.map((col) => (
                <th key={col} scope="col" className="px-2.5 py-3.5 text-left text-xs font-normal tracking-wide text-ink-muted uppercase">{HEAD[col]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} onClick={() => openCase(c.id)} className="cursor-pointer border-t border-lilac-50 align-middle hover:bg-peach-50">
                <td className="px-6 py-3">
                  <button type="button" onClick={(e) => { e.stopPropagation(); openCase(c.id); }}
                    className="cursor-pointer p-0 py-1 text-left font-semibold underline decoration-primary underline-offset-[3px]">
                    {caseLabel(c)}
                  </button>
                  <div className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                    <span className="max-w-40 truncate">{c.customer_name || 'No customer'}</span>
                    {c.is_sample && <SampleTag />}
                  </div>
                </td>
                <td className="px-2.5 py-3"><LinkCell url={c.case_link} /></td>
                {columns.map((col) => <td key={col} className="px-2.5 py-3">{cell(c, col)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cases.length === 0 && <div className="p-6 text-sm text-ink-muted">{empty}</div>}
      {cases.length > limit && (
        <div className="border-t border-lilac-50 p-4 text-center">
          <button type="button" onClick={() => setLimit(limit + 100)} className="h-11 cursor-pointer rounded-[10px] border border-lilac-200 px-5 text-sm">
            Show more ({cases.length - limit} left)
          </button>
        </div>
      )}
    </div>
  );
}
