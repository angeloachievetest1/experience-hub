// "Link" column: opens the case link (Kustomer, Salesforce, ...) in a new tab
// without opening the case panel.
// compact: just the ↗ icon (for tables that must fit the screen width).
export function LinkCell({ url, compact = false }: { url: string | null; compact?: boolean }) {
  if (!url || !/^https?:\/\/\S+$/i.test(url.trim())) return <span className="text-ink-muted">—</span>;
  return (
    <a
      href={url.trim()}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={compact ? `Open case link: ${url}` : url}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-lilac-200 bg-white ${compact ? 'min-w-8 justify-center px-0' : 'px-2.5'} text-[13px] font-medium whitespace-nowrap no-underline hover:border-secondary hover:bg-lilac-50`}
    >
      {!compact && 'Open'}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
      </svg>
      <span className="sr-only">case link (opens in a new tab)</span>
    </a>
  );
}
