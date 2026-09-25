'use client';

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex h-9 cursor-pointer items-center gap-2 rounded-[10px] border border-ink bg-white px-4 text-sm font-medium disabled:cursor-default disabled:opacity-50">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 4v11 M7 10l5 5 5-5 M5 20h14" />
      </svg>
      Export CSV
    </button>
  );
}

// Note shown on hover (and keyboard focus), not inline — e.g. deactivation notes.
export function HoverNote({ label, note }: { label: string; note: string }) {
  return (
    <span className="group relative inline-flex" onClick={(e) => e.stopPropagation()} title={note}>
      <button type="button" aria-label={`${label}: ${note}`}
        className="inline-flex cursor-default items-center gap-1 border-0 bg-transparent p-0 text-xs text-secondary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4h16v12H8l-4 4z" />
        </svg>
        <span className="underline decoration-dotted underline-offset-2">Note</span>
      </button>
      <span role="tooltip"
        className="pointer-events-none invisible absolute top-full right-0 z-50 mt-1.5 w-max max-w-[260px] min-w-[180px] rounded-lg bg-ink px-2.5 py-2 text-xs leading-snug whitespace-pre-wrap text-white opacity-0 shadow-[0_8px_20px_rgba(45,21,89,0.25)] transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        {note}
      </span>
    </span>
  );
}
