'use client';

import { useState } from 'react';
import { ALL_TIME, formatDate, type DateRange } from '@/lib/qa/stats';
import { Chevron, usePopover } from './Dropdowns';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function presets(): { label: string; range: DateRange }[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = iso(now);
  return [
    { label: 'All time', range: ALL_TIME },
    { label: 'This month', range: { from: iso(new Date(y, m, 1)), to: today } },
    { label: 'Last 3 months', range: { from: iso(new Date(y, m - 2, 1)), to: today } },
    { label: 'Last 12 months', range: { from: iso(new Date(y, m - 11, 1)), to: today } },
    { label: 'This year', range: { from: `${y}-01-01`, to: today } },
    { label: 'Last year', range: { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` } },
  ];
}

export function rangeLabel(r: DateRange) {
  if (!r.from && !r.to) return 'All time';
  if (r.from && r.to) return `${formatDate(r.from)} – ${formatDate(r.to)}`;
  return r.from ? `From ${formatDate(r.from)}` : `Until ${formatDate(r.to)}`;
}

export function DateRangeButton({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const { open, setOpen, ref } = usePopover();
  const [from, setFrom] = useState(value.from ?? '');
  const [to, setTo] = useState(value.to ?? '');
  const valid = !from || !to || from <= to;

  const apply = (r: DateRange) => { onChange(r); setOpen(false); };
  const toggle = () => { setFrom(value.from ?? ''); setTo(value.to ?? ''); setOpen(!open); };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-9 cursor-pointer items-center gap-2.5 rounded-[10px] border border-ink bg-white px-4 text-sm font-medium"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4" />
        </svg>
        <span>{rangeLabel(value)}</span>
        <Chevron />
      </button>
      {open && (
        <div role="dialog" aria-label="Choose a date range" className="absolute top-[52px] right-0 z-30 flex w-[min(92vw,500px)] flex-col overflow-hidden rounded-2xl border border-lilac-200 bg-white shadow-[0_12px_32px_rgba(45,21,89,0.16)] sm:flex-row">
          <div className="flex flex-col gap-1 border-b border-lilac-50 p-3 sm:w-44 sm:border-r sm:border-b-0">
            <div className="px-2 pb-2 text-xs tracking-wide text-ink-muted uppercase">Quick ranges</div>
            {presets().map((p) => {
              const on = p.range.from === value.from && p.range.to === value.to;
              return (
                <button key={p.label} type="button" onClick={() => apply(p.range)}
                  className={`min-h-9 cursor-pointer rounded-[10px] px-3 text-left text-sm ${on ? 'bg-lilac-100 font-semibold' : 'hover:bg-lilac-50'}`}>
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            <div className="text-xs tracking-wide text-ink-muted uppercase">Custom range</div>
            <label className="flex flex-col gap-1.5 text-sm">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-[10px] border border-lilac-200 px-3" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-[10px] border border-lilac-200 px-3" />
            </label>
            {!valid && <div className="text-[13px] text-primary">“From” must be before “To”.</div>}
            <div className="mt-auto flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="h-9 cursor-pointer rounded-[10px] border border-lilac-200 px-4 text-sm">Cancel</button>
              <button type="button" disabled={!valid} onClick={() => apply({ from: from || null, to: to || null })}
                className="h-9 cursor-pointer rounded-[10px] bg-primary px-5 text-sm font-semibold disabled:opacity-50">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
