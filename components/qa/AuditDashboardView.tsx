'use client';

import { BarList, Empty, HeatTable, Kpi, Panel, type BarItem } from '@/components/ui/Charts';
import {
  AUDIT_LISTS, auditMonth, categoryColor, categoryShort, auditResult, monthAccuracy, monthName,
  pctText, quarterAccuracy, weeksOf, withTypedIn, type AuditCase,
} from '@/lib/qa/audits';
import { average, formatDate, monthLabel, pct, quarterOf } from '@/lib/qa/stats';
import { useAudits } from './AuditShell';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const quarterName = (month: string) => quarterOf(month).replace(/^(\d+) (Q\d)$/, '$2 $1'); // "Q4 2026"

export function AuditDashboardView() {
  const { inDates: cases, data, list } = useAudits();

  if (!cases.length) {
    return (
      <Panel title="No cases in these dates">
        <Empty>{data.cases.length ? 'Pick other dates, or All time.' : 'Add a case on the Task Log page to see the numbers here.'}</Empty>
      </Panel>
    );
  }

  const weeks = weeksOf(cases);
  const noError = cases.filter((c) => c.no_error).length;
  const notSet = cases.filter((c) => auditResult(c) === 'Not set').length;
  const errors = cases.filter((c) => auditResult(c) === 'Error');
  const accuracy = average(weeks.map((w) => w.accuracy));
  const months = [...new Set(cases.map(auditMonth).filter((m): m is string => Boolean(m)))].sort();
  const quarters = [...new Set(months.map(quarterName))];

  // Every category is listed, even at 0 (as in the Summary tab).
  const categories = withTypedIn(list(AUDIT_LISTS.category), errors.map((c) => c.error_category));
  const byCategory: BarItem[] = categories.map((cat, i) => ({
    name: cat, value: errors.filter((c) => c.error_category === cat).length, color: categoryColor(i),
  }));
  const noCategory = errors.filter((c) => !c.error_category).length;
  if (noCategory) byCategory.push({ name: 'Category not set', value: noCategory, color: '#EAE2FF' });

  // Per person, by "Handled by" (the sheet's E-Learning Representative).
  const people = withTypedIn(list(AUDIT_LISTS.person), cases.map((c) => c.handled_by)).filter((p) => cases.some((c) => c.handled_by === p));
  const repAccuracy = (group: AuditCase[], person: string) => {
    const mine = group.filter((c) => c.handled_by === person);
    return mine.length ? mine.filter((c) => c.no_error).length / mine.length : null;
  };

  // Weekly rows with each month's average after its last week, as in the VTO tracker.
  const weekRows: React.ReactNode[][] = [];
  weeks.forEach((w, i) => {
    weekRows.push([formatDate(w.week), w.noErrors, w.cases, <Meter key="m" value={w.accuracy} />]);
    const month = w.week.slice(0, 7);
    if (weeks[i + 1]?.week.slice(0, 7) !== month) {
      weekRows.push([<span key="n" className="text-ink-muted">{monthName(month)} average</span>, '', '', <strong key="a">{pctText(monthAccuracy(cases, month))}</strong>]);
    }
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Cases audited" value={cases.length} note={notSet ? `${notSet} without a result yet` : `In ${plural(weeks.length, 'week')}`} />
        <Kpi label="No error" value={noError} note={`${pct(noError, cases.length)}% of cases`} />
        <Kpi label="With errors" value={errors.length} note={`${pct(errors.length, cases.length)}% of cases`} />
        <Kpi label="Accuracy" value={pctText(accuracy)} note={`Average of ${plural(weeks.length, 'week')}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Weekly accuracy" aside="No-error cases ÷ cases audited">
          <SimpleTable head={['Week ending', 'No error', 'Cases', 'Accuracy']} rows={weekRows} />
        </Panel>
        <Panel title="Monthly and quarterly accuracy" aside="Month = average of its weeks; quarter = average of its months">
          <SimpleTable
            head={['Period', 'Based on', 'Accuracy']}
            rows={[
              ...months.map((m) => [
                monthName(m), plural(weeks.filter((w) => w.week.startsWith(m)).length, 'week'), <Meter key="m" value={monthAccuracy(cases, m) ?? 0} />,
              ]),
              ...quarters.map((q) => {
                const qMonths = months.filter((m) => quarterName(m) === q);
                return [<strong key="q">{q}</strong>, plural(qMonths.length, 'month'), <Meter key="m" value={quarterAccuracy(cases, qMonths) ?? 0} />];
              }),
            ]}
          />
        </Panel>

        <Panel title="Errors by category" aside={plural(errors.length, 'case')}>
          {errors.length ? <BarList items={byCategory} /> : <Empty>No errors in these dates.</Empty>}
        </Panel>
        <Panel title="By representative" aside="No-error cases ÷ cases handled">
          <SimpleTable
            head={['Handled by', 'Cases', 'No error', 'Errors', 'Accuracy']}
            rows={people.map((p) => {
              const mine = cases.filter((c) => c.handled_by === p);
              const ok = mine.filter((c) => c.no_error).length;
              return [p, mine.length, ok, mine.filter((c) => auditResult(c) === 'Error').length, <Meter key="m" value={ok / mine.length} />];
            })}
          />
        </Panel>
      </div>

      <Panel title="Errors by type and category">
        {errors.length ? (
          <HeatTable
            rowHeader="Error"
            rows={withTypedIn(list(AUDIT_LISTS.error), errors.map((c) => c.error_type)).filter((e) => errors.some((c) => c.error_type === e))}
            cols={categories.map((cat) => ({ key: cat, label: cat.replace(/^Case /, '') }))}
            value={(e, cat) => errors.filter((c) => c.error_type === e && c.error_category === cat).length}
          />
        ) : <Empty>No errors in these dates.</Empty>}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Errors by representative">
          {errors.length ? (
            <HeatTable
              rowHeader="Handled by"
              rows={people.filter((p) => errors.some((c) => c.handled_by === p))}
              cols={categories.map((cat) => ({ key: cat, label: categoryShort(cat) }))}
              value={(p, cat) => errors.filter((c) => c.handled_by === p && c.error_category === cat).length}
            />
          ) : <Empty>No errors in these dates.</Empty>}
        </Panel>
        <Panel title="Representatives by month" aside="No-error cases ÷ cases handled">
          <SimpleTable
            head={['Handled by', ...months.map((m) => monthLabel(m)), 'Average']}
            rows={people.map((p) => {
              const byMonth = months.map((m) => repAccuracy(cases.filter((c) => auditMonth(c) === m), p));
              return [p, ...byMonth.map((v) => pctText(v)), <strong key="a">{pctText(average(byMonth))}</strong>];
            })}
          />
        </Panel>
      </div>
    </div>
  );
}

function Meter({ value }: { value: number }) {
  return (
    <span className="flex items-center justify-end gap-2.5">
      <span className="hidden h-2 w-20 rounded-md bg-lilac-50 sm:block" aria-hidden="true">
        <span className="block h-2 rounded-md" style={{ width: `${value * 100}%`, background: value >= 0.8 ? '#9F7DFF' : '#FF4500' }} />
      </span>
      <span className="w-16 text-right tabular-nums">{pctText(value)}</span>
    </span>
  );
}

// First column is text, the rest are numbers (right-aligned).
function SimpleTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <Empty>No cases in these dates.</Empty>;
  const cell = (i: number) => (i === 0 ? 'py-2 pr-3 text-left' : 'px-2 py-2 text-right tabular-nums');
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={`${cell(i)} text-xs font-normal tracking-wide text-ink-muted uppercase`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-lilac-50">
              {r.map((v, i) => (i === 0
                ? <th key={i} scope="row" className={`${cell(i)} font-normal`}>{v}</th>
                : <td key={i} className={cell(i)}>{v}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
