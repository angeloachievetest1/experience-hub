// "Link" column: opens the case link (Kustomer, Salesforce, ...) in a new tab
// without opening the case panel.
export function LinkCell({ url }: { url: string | null }) {
  if (!url || !/^https?:\/\/\S+$/i.test(url.trim())) return <span className="text-ink-muted">—</span>;
  return (
    <a
      href={url.trim()}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={url}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-lilac-200 bg-white px-2.5 text-[13px] font-medium whitespace-nowrap no-underline hover:border-secondary hover:bg-lilac-50"
    >
      Open
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
      </svg>
      <span className="sr-only">case link (opens in a new tab)</span>
    </a>
  );
}
