'use client';

import { useEffect, useRef, useState } from 'react';

// Closes on outside click and on Escape.
export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const triggerClass =
  'flex h-9 cursor-pointer items-center gap-2 rounded-[10px] border border-lilac-200 bg-white px-3 text-sm whitespace-nowrap hover:border-secondary';
const panelClass =
  'absolute top-[52px] left-0 z-30 flex max-h-80 w-60 flex-col gap-0.5 overflow-y-auto rounded-xl border border-lilac-200 bg-white p-2 shadow-[0_12px_32px_rgba(45,21,89,0.16)]';

// Single-choice filter: "Analyst  All analysts ▾"
export function FilterSelect({
  label, allLabel, options, value, onChange,
}: { label: string; allLabel: string; options: string[]; value: string | null; onChange: (v: string | null) => void }) {
  const { open, setOpen, ref } = usePopover();
  const choose = (v: string | null) => { onChange(v); setOpen(false); };
  return (
    <div ref={ref} className="relative">
      <button type="button" className={triggerClass} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="text-ink-muted">{label}</span>
        <span className="font-medium">{value ?? allLabel}</span>
        <Chevron />
      </button>
      {open && (
        <div role="listbox" aria-label={label} className={panelClass}>
          {[null, ...options].map((o) => (
            <button
              key={o ?? '__all'}
              type="button"
              role="option"
              aria-selected={value === o}
              onClick={() => choose(o)}
              className={`min-h-9 cursor-pointer rounded-lg px-3 text-left text-sm ${value === o ? 'bg-lilac-100 font-semibold' : 'hover:bg-lilac-50'}`}
            >
              {o ?? allLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Multi-choice filter with checkboxes: "Source  Instructor, Survey ▾"
export function FilterMulti({
  label, allLabel, options, value, onChange, align = 'left',
}: {
  label: string; allLabel: string; options: string[]; value: string[];
  onChange: (v: string[]) => void; align?: 'left' | 'right';
}) {
  const { open, setOpen, ref } = usePopover();
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div ref={ref} className="relative">
      <button type="button" className={triggerClass} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="text-ink-muted">{label}</span>
        <span className="max-w-56 truncate font-medium">{value.length ? value.join(', ') : allLabel}</span>
        <Chevron />
      </button>
      {open && (
        <div role="listbox" aria-multiselectable="true" aria-label={label} className={`${panelClass} ${align === 'right' ? 'right-0 left-auto' : ''}`}>
          {options.map((o) => (
            <CheckOption key={o} label={o} checked={value.includes(o)} onToggle={() => toggle(o)} />
          ))}
          <div className="mt-1 flex gap-1.5">
            {value.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="h-9 flex-1 cursor-pointer rounded-md border border-lilac-200 text-[13px]">
                Clear
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="h-9 flex-1 cursor-pointer rounded-md bg-ink text-[13px] font-semibold text-white">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CheckOption({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={checked}
      onClick={onToggle}
      className={`flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 text-left text-sm ${checked ? 'bg-lilac-50 font-semibold' : 'hover:bg-lilac-50'}`}
    >
      <span
        className={`flex size-4 shrink-0 items-center justify-center rounded border-[1.5px] ${checked ? 'border-ink bg-ink' : 'border-lilac-200 bg-white'}`}
        aria-hidden="true"
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span>{label}</span>
    </button>
  );
}

// Pill-shaped toggle buttons, e.g. Month / Quarter.
export function Segmented<T extends string>({
  options, value, onChange, label,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`h-9 cursor-pointer rounded-full border px-4 text-sm ${on ? 'border-ink bg-ink font-semibold text-white' : 'border-lilac-200 bg-white hover:border-secondary'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
