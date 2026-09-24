'use client';

import { useMemo, useState } from 'react';
import { BarList, ColumnChart, Kpi, Panel, type Column } from '@/components/ui/Charts';
import { Segmented } from '@/components/ui/Dropdowns';
import { average, countBy, inRange, periods } from '@/lib/qa/stats';
import { resolutionDays } from '@/lib/curriculum/types';
import { useCur } from './useCur';

const fmtDays = (d: number | null) => (d === null ? '—' : `${d.toFixed(1)} days`);

export function CurDashboardView() {
  const { data, range } = useCur();
  const [by, setBy] = useState<'month' | 'quarter'>('month');
  const cases = useMemo(() => data.cases.filter((c) => inRange(c.case_date, range)), [data.cases, range]);
  const requests = data.requests.filter((r) => inRange(r.date_submitted, range));

  const columns: Column[] = periods(cases.map((c) => c.case_date), range, by).map((p) => ({
    key: p.key,
    label: p.label,
    segments: [{ name: 'Cases', color: '#FF4500', value: cases.filter((c) => c.case_date && p.months.includes(c.case_date.slice(0, 7))).length }],
  }));

  // 5-year trend: this year and the four before, from all case rows (not the date range).
  const thisYear = new Date().getFullYear();
  const years: Column[] = [4, 3, 2, 1, 0].map((back) => {
    const y = String(thisYear - back);
    return {
      key: y,
      label: back === 0 ? `${y} (so far)` : y,
      segments: [{ name: 'Cases', color: '#9F7DFF', value: data.cases.filter((c) => c.case_date?.startsWith(y)).length }],
    };
  });

  const categories = countBy(cases, (c) => c.category ?? 'Not set');
  const avgByCategory = categories.map((cat) => {
    const avg = average(cases.filter((c) => (c.category ?? 'Not set') === cat.name).map(resolutionDays));
    return { name: cat.name, value: avg === null ? 0 : Math.round(avg * 10) / 10 };
  }).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Customer cases" value={cases.length} note="In the selected date range" />
        <Kpi label="Avg resolution time" value={fmtDays(average(cases.map(resolutionDays)))} note="From TAT, or case date to date resolved" />
        <Kpi label="Top category" value={categories[0]?.value ?? '—'} note={categories[0]?.name ?? 'No cases'} />
        <Kpi label="Instructor requests" value={requests.length} note="Submitted in the date range" />
      </div>

      <Panel
        title={by === 'month' ? 'Cases per month' : 'Cases per quarter'}
        aside={<Segmented label="Group by" value={by} onChange={setBy} options={[{ value: 'month', label: 'Month' }, { value: 'quarter', label: 'Quarter' }]} />}
      >
        <ColumnChart columns={columns} />
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="By category"><BarList items={categories} color="#FF4500" /></Panel>
        <Panel title="By material type"><BarList items={countBy(cases, (c) => c.material_type ?? 'Not set')} /></Panel>
        <Panel title="Avg resolution time by category" aside="Days">
          <BarList items={avgByCategory} color="#2D1559" empty="No resolution times recorded in this date range." />
        </Panel>
        <Panel title="5-year trend" aside="All customer cases, by year">
          <ColumnChart columns={years} height={180} />
        </Panel>
      </div>
    </div>
  );
}
