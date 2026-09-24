'use client';

import { useMemo } from 'react';
import { BarList, ColumnChart, HeatTable, Kpi, Legend, Panel, type Column } from '@/components/ui/Charts';
import { average, countBy, gapStatus, inOrder, inRange, periods } from '@/lib/qa/stats';
import { EXTRA_COLORS, SURVEY_TYPE_COLORS } from '@/lib/qa/types';
import { useQa } from './QaShell';

export function SurveyInsightsView() {
  const { data, range } = useQa();
  const surveys = useMemo(
    () => data.cases.filter((c) => c.source === 'Survey' && inRange(c.case_date, range)),
    [data.cases, range],
  );

  const listedTypes = data.options.qa_survey_type ?? [];
  const types = inOrder(countBy(surveys, (c) => c.survey_type ?? 'Not set'), [...listedTypes, 'Not set']);
  const typeColor = (t: string, i: number) => SURVEY_TYPE_COLORS[t] ?? EXTRA_COLORS[(i + 3) % EXTRA_COLORS.length];
  const typeNames = types.map((t) => t.name);
  const meaning = data.optionNames.qa_survey_type ?? {};
  const withMeaning = (t: string) => (meaning[t] ? `${t} · ${meaning[t]}` : t);

  const months = periods(surveys.map((c) => c.case_date), range, 'month');
  const gapMonths = months.filter((p) => gapStatus(data.gaps, 'Survey', p.months) === 'missing').map((p) => p.key);
  const columns: Column[] = months.map((p) => ({
    key: p.key,
    label: p.label,
    missing: gapMonths.includes(p.key) ? 'Survey data missing' : null,
    segments: typeNames.map((t, i) => ({
      name: t,
      color: typeColor(t, i),
      value: surveys.filter((c) => (c.survey_type ?? 'Not set') === t && c.case_date?.startsWith(p.key)).length,
    })),
  }));

  const reasons = countBy(surveys, (c) => c.reason_type ?? 'Not set');
  const reasonNames = reasons.map((r) => r.name);
  const matrix = (key: (c: (typeof surveys)[number]) => string) => {
    const m = new Map<string, number>();
    for (const c of surveys) {
      const k = `${c.reason_type ?? 'Not set'}|${key(c)}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return (row: string, col: string) => m.get(`${row}|${col}`) ?? 0;
  };
  const byMonth = matrix((c) => c.case_date?.slice(0, 7) ?? '');
  const byType = matrix((c) => c.survey_type ?? 'Not set');

  const ratings = [1, 2, 3, 4, 5, 6].map((n) => ({ name: `Rating ${n}`, value: surveys.filter((c) => c.rating === n).length }));
  const avg = average(surveys.map((c) => c.rating));
  const topReason = reasons.find((r) => r.name !== 'Not set');

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Survey records" value={surveys.length} note="In the selected date range" />
        <Kpi label="Average rating" value={avg === null ? '—' : avg.toFixed(1)} note="Out of 6" />
        <Kpi label="Most common reason" value={topReason ? topReason.value : '—'} note={topReason?.name ?? 'No reasons recorded'} />
      </div>

      <Panel title="Surveys per month by type">
        <Legend items={types.map((t, i) => ({ name: withMeaning(t.name), color: typeColor(t.name, i) }))} />
        <ColumnChart columns={columns} />
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Total by survey type">
          <BarList items={types.map((t, i) => ({ ...t, name: withMeaning(t.name), color: typeColor(t.name, i) }))} empty="No survey records in this date range." />
        </Panel>
        <Panel title="Rating distribution">
          <BarList items={surveys.length ? ratings : []} color="#FF4500" empty="No survey records in this date range." />
        </Panel>
      </div>

      <Panel title="Reason type by month">
        <HeatTable rowHeader="Reason" rows={reasonNames} cols={months.map((m) => ({ key: m.key, label: m.label }))}
          value={byMonth} missingCols={gapMonths} />
      </Panel>

      <Panel title="Reason type by survey type">
        <HeatTable rowHeader="Reason" rows={reasonNames} cols={typeNames.map((t) => ({ key: t, label: t, sub: meaning[t] }))} value={byType} />
      </Panel>
    </div>
  );
}
