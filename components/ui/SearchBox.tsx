'use client';

// width: classes for wider screens; pass '' to fill the space it's in.
export function SearchBox({ value, onChange, placeholder, label, width = 'sm:w-72' }: {
  value: string; onChange: (v: string) => void; placeholder: string; label: string; width?: string;
}) {
  return (
    <label className={`flex h-9 w-full items-center gap-2 rounded-[10px] border border-lilac-200 bg-white px-3.5 ${width}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4" />
      </svg>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        aria-label={label} className="w-full border-0 bg-transparent text-sm outline-none" />
    </label>
  );
}

export function AddButton({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) {
  return (
    <button type="button" disabled={busy} onClick={onClick}
      className="flex h-9 cursor-pointer items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold disabled:cursor-wait disabled:opacity-60">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14 M5 12h14" /></svg>
      {busy ? 'Adding…' : label}
    </button>
  );
}

// Toolbar above a log table: filters on top; search, the Add button and the
// "Showing …" count on the row below.
export function LogToolbar({ filters, add, search, count }: {
  filters: React.ReactNode; add?: React.ReactNode; search: React.ReactNode; count: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">{filters}</div>
      <div className="flex flex-wrap items-center gap-3">
        {search}
        {add}
        <span className="ml-auto text-sm text-ink-muted">{count}</span>
      </div>
    </div>
  );
}

export const matches =(q: string, values: (string | null | undefined)[]) =>
  !q.trim() || values.some((v) => v?.toLowerCase().includes(q.trim().toLowerCase()));
