'use client';

import { useMemo, useState } from 'react';
import { RecordTable } from '@/components/records/RecordTable';
import { BAR_LIMIT, BarList, ColumnChart, Empty, Kpi, Panel, type Column } from '@/components/ui/Charts';
import { average, countBy, formatDate, inRange, pct, periods } from '@/lib/qa/stats';
import { resolutionDays } from '@/lib/curriculum/types';
import { customerLabel } from '@/lib/records/labels';
import { caseKey, useCur } from './useCur';

const fmtDays = (d: number | null) => (d === null ? '—' : `${d.toFixed(1)} days`);

// Course view: Customer Cases grouped by course. Instructor requests are left out
// on purpose: they are instructors' own feedback, not customer complaints.
export function CurCourseView() {
  const { data, range, open, courseName } = useCur();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const inDates = useMemo(() => data.cases.filter((c) => inRange(c.case_date, range)), [data.cases, range]);
  const courses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of inDates) if (c.course_id) counts.set(c.course_id, (counts.get(c.course_id) ?? 0) + 1);
    return [...counts.entries()]
      .map(([id, count]) => ({ id, name: courseName(id), count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [inDates, courseName]);

  const visible = courses.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()));
  const current = courses.find((e) => e.id === selected) ?? courses[0] ?? null;
  const cases = current ? inDates.filter((c) => c.course_id === current.id) : [];

  const types = countBy(cases, (c) => c.issue_type ?? 'Not set');
  const materials = countBy(cases, (c) => c.material_type ?? 'Not set');
  const categories = countBy(cases, (c) => c.category).map((c) => c.name).join(', ');
  // Same time axis as the whole section, so courses are easy to compare.
  const quarters: Column[] = periods(inDates.map((c) => c.case_date), range, 'quarter').map((p) => ({
    key: p.key,
    label: p.label,
    segments: [{ name: 'Cases', color: '#FF4500', value: cases.filter((c) => c.case_date && p.months.includes(c.case_date.slice(0, 7))).length }],
  }));

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <section className="flex flex-col gap-1.5 [&>*]:shrink-0 rounded-2xl border border-peach-200 bg-white p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto">
        <div className="px-2.5 pt-1 pb-2 text-xs tracking-wide text-ink-muted uppercase">Courses with cases</div>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search courses"
          aria-label="Search courses" className="mb-1 h-10 rounded-lg border border-lilac-200 px-3 text-sm" />
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
        {!courses.length && <div className="px-2.5 py-2 text-sm text-ink-muted">No cases in this date range.</div>}
      </section>

      {current ? (
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <h2 className="m-0 font-display text-[22px] font-semibold">{current.name}</h2>
            {categories && <div className="text-sm text-ink-muted">{categories}</div>}
          </div>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Kpi label="Customer cases" value={cases.length} note={`${pct(cases.length, inDates.length)}% of all Curriculum cases`} />
            <Kpi label="Avg resolution time" value={fmtDays(average(cases.map(resolutionDays)))}
              note={`Section average: ${fmtDays(average(inDates.map(resolutionDays)))}`} />
            <Kpi label="Most common type" value={types[0]?.value ?? '—'} note={types[0]?.name} />
            <Kpi label="Most common material" value={materials[0]?.value ?? '—'} note={materials[0]?.name} />
          </div>
          {/* key: picking another course folds the lists back to the top 7 */}
          <div key={current.id} className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title="By type"><BarList items={types} color="#FF4500" limit={BAR_LIMIT} compact /></Panel>
            <Panel title="By Achieve material"><BarList items={materials} limit={BAR_LIMIT} compact /></Panel>
            <Panel title="Source of case"><BarList items={countBy(cases, (c) => c.case_source ?? 'Not set')} color="#2D1559" limit={BAR_LIMIT} compact /></Panel>
            <Panel title="Cases by quarter"><ColumnChart columns={quarters} height={150} /></Panel>
          </div>
          <RecordTable
            rows={cases}
            fit
            leading={{ key: 'date', header: 'Date', render: (c) => <span className="whitespace-nowrap">{formatDate(c.case_date) || '—'}</span> }}
            label={customerLabel}
            link={(c) => c.case_link}
            onOpen={(id) => open(caseKey(id))}
            columns={[
              { key: 'type', header: 'Type', render: (c) => c.issue_type || '—' },
              { key: 'material', header: 'Achieve material', render: (c) => c.material_type || '—' },
              { key: 'source', header: 'Source', render: (c) => c.case_source || '—' },
              { key: 'sme', header: 'Curriculum SME', render: (c) => c.curriculum_sme || '—' },
              {
                key: 'tat', header: 'TAT',
                render: (c) => { const d = resolutionDays(c); return d === null ? '—' : <span className="whitespace-nowrap">{d} {d === 1 ? 'day' : 'days'}</span>; },
              },
              { key: 'comment', header: 'Comment', render: (c) => <span className="line-clamp-2 w-44 text-ink-muted" title={c.comments ?? undefined}>{c.comments || '—'}</span> },
            ]}
          />
        </div>
      ) : (
        <Empty>No cases with a course in this date range.</Empty>
      )}
    </div>
  );
}
