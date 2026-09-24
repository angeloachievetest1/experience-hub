'use client';

import { useMemo, useState } from 'react';
import { BarList, ColumnChart, HATCH, Kpi, Legend, Panel, type Column } from '@/components/ui/Charts';
import { FilterMulti, Segmented } from '@/components/ui/Dropdowns';
import { countBy, gapStatus, inOrder, inRange, monthLabel, periods } from '@/lib/qa/stats';
import { QA_SOURCES, SOURCE_COLORS, VALIDITY_COLORS, VALIDITY_VALUES, type QaSource } from '@/lib/qa/types';
import { useQa } from './QaShell';

export function DashboardView() {
  const { data, range } = useQa();
  const [picked, setPicked] = useState<string[]>([]);
  const [by, setBy] = useState<'month' | 'quarter'>('month');
  const sources = (picked.length ? picked : [...QA_SOURCES]) as QaSource[];

  const inDates = useMemo(() => data.cases.filter((c) => inRange(c.case_date, range)), [data.cases, range]);
  const shown = useMemo(() => inDates.filter((c) => sources.includes(c.source)), [inDates, sources]);

  const columns: Column[] = useMemo(() => {
    return periods(shown.map((c) => c.case_date), range, by).map((p) => {
      const status = sources.map((s) => ({ s, st: gapStatus(data.gaps, s, p.months) }));
      const missing = status.every((x) => x.st === 'missing');
      const partial = status.filter((x) => x.st).map((x) => `${x.s} data missing`);
      return {
        key: p.key,
        label: p.label,
        segments: sources.map((s) => ({
          name: s,
          color: SOURCE_COLORS[s],
          value: shown.filter((c) => c.source === s && c.case_date && p.months.includes(c.case_date.slice(0, 7))).length,
        })),
        missing: missing ? partial.join(', ') : null,
        partial: !missing && partial.length ? partial.join(', ') : null,
      };
    });
  }, [shown, range, by, sources, data.gaps]);

  const gapNotes = data.gaps.filter((g) =>
    sources.includes(g.source) && columns.some((c) => (c.missing ?? c.partial ?? '').includes(g.source)));
  const complaints = shown.filter((c) => c.source === 'Instructor' || c.source === 'Course');
  const validity = (list: typeof shown) =>
    inOrder(countBy(list, (c) => c.validity ?? 'Not set'), [...VALIDITY_VALUES, 'Not set'])
      .map((v) => ({ ...v, color: VALIDITY_COLORS[v.name] ?? '#F6F3FF' }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Total records" value={shown.length} note={picked.length ? picked.join(', ') : 'All sources'} />
        {QA_SOURCES.map((s) => {
          const gap = data.gaps.find((g) => g.source === s);
          return (
            <Kpi key={s} label={s} value={inDates.filter((c) => c.source === s).length}
              note={gap ? `No data ${monthLabel(gap.start)} – ${monthLabel(gap.end)}` : undefined} />
          );
        })}
      </div>

      <Panel
        title={by === 'month' ? 'Cases per month' : 'Cases per quarter'}
        aside={
          <div className="flex flex-wrap items-center gap-3">
            <FilterMulti label="Source" allLabel="All sources" options={[...QA_SOURCES]} value={picked} onChange={setPicked} align="right" />
            <Segmented label="Group by" value={by} onChange={setBy} options={[{ value: 'month', label: 'Month' }, { value: 'quarter', label: 'Quarter' }]} />
          </div>
        }
      >
        <Legend items={[
          ...sources.map((s) => ({ name: s, color: SOURCE_COLORS[s] })),
          ...(columns.some((c) => c.missing || c.partial) ? [{ name: 'No data (gap, not zero)', color: '', hatched: true }] : []),
        ]} />
        <ColumnChart columns={columns} />
        {gapNotes.length > 0 && (
          <div className="flex items-start gap-2 text-[13px] text-ink-muted">
            <span className="shrink-0 rounded-full px-2.5 py-0.5 font-semibold text-ink" style={{ background: HATCH }}>Gap</span>
            <span>
              {gapNotes.map((g) => g.note ?? `${g.source} data is missing ${monthLabel(g.start)} – ${monthLabel(g.end)}.`).join(' ')}{' '}
              Columns marked * are missing some of their data.
            </span>
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Validity split" aside={picked.length ? picked.join(', ') : 'All sources'}>
          {/* Returned cases have no validity (owner decision 2026-09-30). */}
          <BarList items={validity(shown.filter((c) => c.source !== 'Returned'))} />
        </Panel>
        <Panel title="Instructor & Course: validity" aside={`${complaints.length} complaints`}>
          <BarList items={validity(complaints)} empty="No Instructor or Course complaints in this selection." />
        </Panel>
        <Panel title="Instructor & Course: by category">
          <BarList items={countBy(complaints, (c) => c.category ?? 'Not set')} color="#FF4500"
            empty="No Instructor or Course complaints in this selection." />
        </Panel>
        <Panel title="Instructor & Course: by complaint type">
          <BarList items={countBy(complaints, (c) => (c.complaint_types.length ? c.complaint_types : 'Not set'))}
            empty="No Instructor or Course complaints in this selection." />
        </Panel>
      </div>
    </div>
  );
}
