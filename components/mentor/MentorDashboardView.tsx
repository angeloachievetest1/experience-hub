'use client';

import { useMemo } from 'react';
import { BarList, ColumnChart, Kpi, Panel, type Column } from '@/components/ui/Charts';
import { countBy, inOrder, inRange, pct } from '@/lib/qa/stats';
import { MENTOR_VALIDITY, QUARTERS, periodDate } from '@/lib/mentor/types';
import { VALIDITY_COLORS } from '@/lib/qa/types';
import { useMentor } from './MentorShell';

export function MentorDashboardView() {
  const { data, range, mentorName } = useMentor();
  const cases = useMemo(() => data.cases.filter((c) => inRange(periodDate(c), range)), [data.cases, range]);

  const closed = cases.filter((c) => c.status === 'Closed').length;
  const inProgress = cases.filter((c) => c.status === 'In-progress').length;
  const valid = cases.filter((c) => c.complaint_analysis === 'Valid').length;
  const note = (n: number) => (cases.length ? `${pct(n, cases.length)}% of complaints` : '—');

  const years = [...new Set(cases.map((c) => c.year).filter(Boolean) as number[])].sort();
  const byYear: Column[] = years.map((y) => ({
    key: String(y), label: String(y),
    segments: [{ name: 'Complaints', color: '#FF4500', value: cases.filter((c) => c.year === y).length }],
  }));
  const allQuarters: Column[] = years.flatMap((y) => QUARTERS.map((q) => ({
    key: `${y}-${q}`, label: `${y} ${q}`,
    segments: [{ name: 'Complaints', color: '#9F7DFF', value: cases.filter((c) => c.year === y && c.quarter === q).length }],
  })));
  // Start at the first quarter with a complaint and stop at the last one.
  const hasData = (c: Column) => c.segments[0].value > 0;
  const byQuarter = allQuarters.slice(allQuarters.findIndex(hasData), allQuarters.findLastIndex(hasData) + 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total complaints" value={cases.length} note="In the selected date range" />
        <Kpi label="Closed" value={closed} note={note(closed)} />
        <Kpi label="In progress" value={inProgress} note={note(inProgress)} />
        <Kpi label="Valid complaints" value={valid} note={note(valid)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Complaints by year"><ColumnChart columns={byYear} height={150} /></Panel>
        <Panel title="Complaints by quarter"><ColumnChart columns={byQuarter} height={150} /></Panel>
        <Panel title="By complaint type">
          <BarList items={countBy(cases, (c) => c.complaint_type ?? 'Not set')} color="#FF4500" empty="No complaints in this date range." />
        </Panel>
        <Panel title="By sub type">
          <BarList items={countBy(cases, (c) => c.complaint_sub_type ?? 'Not set')} empty="No complaints in this date range." />
        </Panel>
        <Panel title="By mentor">
          <BarList items={countBy(cases, (c) => mentorName(c.mentor_id) || 'Not set')} color="#2D1559" empty="No complaints in this date range." />
        </Panel>
        <Panel title="Validity split">
          <BarList
            items={inOrder(countBy(cases, (c) => c.complaint_analysis ?? 'Not set'), [...MENTOR_VALIDITY, 'Not set'])
              .map((v) => ({ ...v, color: VALIDITY_COLORS[v.name] ?? '#F6F3FF' }))}
            empty="No complaints in this date range."
          />
        </Panel>
      </div>
    </div>
  );
}
