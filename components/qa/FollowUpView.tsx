'use client';

import { useMemo, useState } from 'react';
import { BarList, Donut, Panel } from '@/components/ui/Charts';
import { inRange, pct } from '@/lib/qa/stats';
import { isNotReached, isReached, type QaCase } from '@/lib/qa/types';
import { CaseTable } from './CaseTable';
import { useQa } from './QaShell';

type Need = 'Not reached' | 'Urgent action' | 'No case link';
const NEEDS: Need[] = ['Not reached', 'Urgent action', 'No case link'];

function needsOf(c: QaCase): Need[] {
  const out: Need[] = [];
  if (isNotReached(c.customer_reached)) out.push('Not reached');
  if (c.resolution === 'Urgent Action') out.push('Urgent action');
  if (!c.case_link?.trim()) out.push('No case link');
  return out;
}

const CHANNELS: { key: 'followup_email' | 'followup_sms' | 'followup_call'; name: string }[] = [
  { key: 'followup_email', name: 'Email' },
  { key: 'followup_sms', name: 'SMS' },
  { key: 'followup_call', name: 'Call' },
];

export function FollowUpView() {
  const { data, range } = useQa();
  const [filter, setFilter] = useState<Need | 'All'>('All');
  const inDates = useMemo(() => data.cases.filter((c) => inRange(c.case_date, range)), [data.cases, range]);
  const open = inDates.filter((c) => needsOf(c).length > 0);
  const rows = filter === 'All' ? open : open.filter((c) => needsOf(c).includes(filter));

  // Reach rate: of the customers with a known outcome, how many were reached.
  const known = inDates.filter((c) => isReached(c.customer_reached) || isNotReached(c.customer_reached));
  const reached = known.filter((c) => isReached(c.customer_reached)).length;
  const channels = CHANNELS.map((ch) => {
    const tried = known.filter((c) => c[ch.key] === 'Yes');
    const ok = tried.filter((c) => isReached(c.customer_reached)).length;
    return { name: `${ch.name}: ${ok} of ${tried.length} reached`, value: pct(ok, tried.length) };
  });

  const tiles: { key: Need | 'All'; label: string; count: number }[] = [
    { key: 'All', label: 'All open items', count: open.length },
    ...NEEDS.map((n) => ({ key: n, label: n, count: inDates.filter((c) => needsOf(c).includes(n)).length })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => {
          const on = filter === t.key;
          return (
            <button key={t.key} type="button" aria-pressed={on} onClick={() => setFilter(t.key)}
              className={`flex cursor-pointer flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left ${on ? 'border-ink bg-ink text-white' : 'border-peach-200 bg-white hover:border-secondary'}`}>
              <span className="text-sm">{t.label}</span>
              <span className="font-display text-[30px] leading-[1.1] font-light">{t.count}</span>
            </button>
          );
        })}
      </div>

      <Panel title="Reached vs not reached" aside="Cases with a recorded outcome">
        {known.length === 0 ? (
          <div className="text-sm text-ink-muted">No reach outcomes recorded in this date range.</div>
        ) : (
          <div className="flex flex-wrap items-center gap-10">
            <Donut a={reached} b={known.length - reached} aLabel="Reached" bLabel="Not reached" />
            <div className="flex min-w-[260px] flex-1 flex-col gap-3.5">
              <div className="flex items-center gap-2.5 text-sm"><span className="size-3 rounded-[3px] bg-primary" /><span className="flex-1">Reached</span><span className="font-semibold">{reached}</span></div>
              <div className="flex items-center gap-2.5 text-sm"><span className="size-3 rounded-[3px] bg-secondary" /><span className="flex-1">Not reached</span><span className="font-semibold">{known.length - reached}</span></div>
              <div className="my-1 h-px bg-lilac-50" />
              <div className="text-xs tracking-wide text-ink-muted uppercase">Reach rate by channel (%)</div>
              <BarList items={channels} color="#FF4500" compact />
              <div className="text-[13px] text-ink-muted">Share of customers reached when that channel was used (marked “Yes”).</div>
            </div>
          </div>
        )}
      </Panel>

      <div className="flex items-center gap-3">
        <h2 className="m-0 font-display text-[18px] font-normal">{filter === 'All' ? 'Open items' : filter}</h2>
        <span className="text-sm text-ink-muted">{rows.length} cases</span>
      </div>
      <CaseTable cases={rows} columns={['date', 'source', 'course', 'instructor', 'analyst', 'issue', 'needs']} needs={needsOf}
        empty="Nothing needs follow-up in this date range." />
    </div>
  );
}
