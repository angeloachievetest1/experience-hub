'use client';

import { useMemo, useState } from 'react';
import { BAR_LIMIT, BarList, Empty, Kpi, Panel } from '@/components/ui/Charts';
import { average, countBy, inOrder, inRange } from '@/lib/qa/stats';
import { VALIDITY_COLORS, VALIDITY_VALUES, type QaCase } from '@/lib/qa/types';
import { CaseTable } from './CaseTable';
import { useQa } from './QaShell';

// Instructor view and Course view: complaints and low scores grouped by one
// instructor or course.
export function EntityView({ kind }: { kind: 'instructor' | 'course' }) {
  const { data, range, courseName, instructorName } = useQa();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const idsOf = (c: QaCase): string[] =>
    kind === 'instructor'
      ? (c.instructor_id ? [c.instructor_id] : [])
      : (c.source === 'Returned' ? c.course_ids : c.course_id ? [c.course_id] : []);
  const nameOf = kind === 'instructor' ? instructorName : courseName;

  const inDates = useMemo(() => data.cases.filter((c) => inRange(c.case_date, range)), [data.cases, range]);
  const entities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of inDates) for (const id of idsOf(c)) counts.set(id, (counts.get(id) ?? 0) + 1);
    return [...counts.entries()]
      .map(([id, count]) => ({ id, name: nameOf(id), count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [inDates, kind, nameOf]); // idsOf depends only on kind

  const visible = entities.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()));
  const current = entities.find((e) => e.id === selected) ?? entities[0] ?? null;
  const cases = current ? inDates.filter((c) => idsOf(c).includes(current.id)) : [];

  const complaints = cases.filter((c) => c.source === 'Instructor' || c.source === 'Course');
  const surveys = cases.filter((c) => c.source === 'Survey');
  const issues = countBy(cases, (c) => (c.source === 'Survey' ? c.reason_type : c.source === 'Returned' ? c.reassign_reason : c.complaint_types));
  const validity = inOrder(countBy(cases.filter((c) => c.validity), (c) => c.validity), VALIDITY_VALUES)
    .map((v) => ({ ...v, color: VALIDITY_COLORS[v.name] }));
  const instructorCases = cases.filter((c) => c.source === 'Instructor');
  const avgText = (vals: (number | null)[]) => {
    const a = average(vals);
    return a === null ? '—' : `${Math.round(a)}%`;
  };
  const heading = kind === 'instructor' ? 'Instructors' : 'Courses';

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <section className="flex flex-col gap-1.5 rounded-2xl border border-peach-200 bg-white p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto">
        <div className="px-2.5 pt-1 pb-2 text-xs tracking-wide text-ink-muted uppercase">{heading} with cases</div>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${heading.toLowerCase()}`}
          aria-label={`Search ${heading.toLowerCase()}`} className="mb-1 h-10 rounded-lg border border-lilac-200 px-3 text-sm" />
        {visible.map((e) => {
          const on = current?.id === e.id;
          return (
            <button key={e.id} type="button" aria-pressed={on} onClick={() => setSelected(e.id)}
              className={`flex min-h-9 cursor-pointer items-center justify-between gap-2 rounded-[10px] px-3 text-left text-sm ${on ? 'bg-lilac-100 font-semibold' : 'hover:bg-lilac-50'}`}>
              <span>{e.name}</span>
              <span className="text-[13px] text-ink-muted">{e.count}</span>
            </button>
          );
        })}
        {!entities.length && <div className="px-2.5 py-2 text-sm text-ink-muted">No cases in this date range.</div>}
      </section>

      {current ? (
        <div className="flex min-w-0 flex-col gap-4">
          <h2 className="m-0 font-display text-[22px] font-semibold">{current.name}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi label="All cases" value={cases.length} />
            <Kpi label="Complaints" value={complaints.length} note="Instructor and Course cases" />
            <Kpi label="Low survey scores" value={surveys.length} />
          </div>
          {kind === 'instructor' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Kpi label="Avg attendance" value={avgText(instructorCases.map((c) => c.attendance_pct))} note="From instructor complaints" />
              <Kpi label="Avg participation" value={avgText(instructorCases.map((c) => c.participation_pct))} note="From instructor complaints" />
              <Kpi label="Avg Moodle activity" value={avgText(instructorCases.map((c) => c.moodle_pct))} note="From instructor complaints" />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title="Most common issues" aside="Complaint types and survey reasons">
              {/* key: picking another instructor or course folds the list back to the top 7 */}
              <BarList key={current.id} items={issues} limit={BAR_LIMIT} compact />
            </Panel>
            <Panel title="Validity split">
              <BarList items={validity} compact empty="No validity recorded for these cases." />
            </Panel>
          </div>
          <CaseTable cases={cases} columns={['date', 'source', kind === 'instructor' ? 'course' : 'instructor', 'issue', 'validity', 'follow']} />
        </div>
      ) : (
        <Empty>{kind === 'instructor' ? 'No cases with an instructor in this date range.' : 'No cases with a course in this date range.'}</Empty>
      )}
    </div>
  );
}
