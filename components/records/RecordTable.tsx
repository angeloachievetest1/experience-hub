'use client';

import { useState } from 'react';
import { LinkCell } from '@/components/ui/LinkCell';

export type TableColumn<T> = { key: string; header: string; render: (row: T) => React.ReactNode };

// Clickable table used by every case log. Columns: an optional leading column
// (Date), the clickable name (Case = customer name), an optional one-click Link,
// then the rest.
export function RecordTable<T extends { id: string }>({
  rows, label, subLabel, link, columns, onOpen, empty = 'No records match these filters.', minWidth = 980, firstHeader = 'Case', leading, fit = false,
}: {
  // Fit the screen width: smaller text, tighter spacing, text wraps (no sideways scrolling).
  fit?: boolean;
  firstHeader?: string;
  leading?: TableColumn<T>; // shown before the name column, e.g. Date
  rows: T[];
  label: (row: T) => string;
  subLabel?: (row: T) => string;
  link?: (row: T) => string | null;
  columns: TableColumn<T>[];
  onOpen: (id: string) => void;
  empty?: string;
  minWidth?: number;
}) {
  const [limit, setLimit] = useState(100);
  const shown = rows.slice(0, limit);
  const pad = fit ? 'px-1.5' : 'px-2.5';
  const edge = fit ? 'pl-3' : 'pl-6';
  const th = `${pad} py-2.5 text-left text-xs font-normal tracking-wide text-ink-muted uppercase ${fit ? 'align-bottom' : ''}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-peach-200 bg-white">
      <div className="overflow-x-auto">
        <table className={`w-full border-collapse ${fit ? 'text-[13px]' : 'text-sm'}`} style={fit ? undefined : { minWidth }}>
          <thead className="bg-lilac-50">
            <tr>
              {leading && <th scope="col" className={`${th} ${edge}`}>{leading.header}</th>}
              <th scope="col" className={`${th} ${leading ? '' : edge}`}>{firstHeader}</th>
              {link && <th scope="col" className={th}>Link</th>}
              {columns.map((c) => <th key={c.key} scope="col" className={th}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              return (
                <tr key={row.id} onClick={() => onOpen(row.id)}
                  className="cursor-pointer border-t border-lilac-50 align-middle hover:bg-peach-50">
                  {leading && <td className={`py-2 ${fit ? 'pr-2' : 'pr-2.5'} ${edge}`}>{leading.render(row)}</td>}
                  <td className={`py-2 ${fit ? 'pr-2' : 'pr-2.5'} ${leading ? (fit ? 'pl-2' : 'pl-2.5') : edge}`}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(row.id); }}
                      className="cursor-pointer p-0 py-1 text-left font-semibold underline decoration-primary underline-offset-[3px]">
                      {label(row)}
                    </button>
                    {subLabel && (
                      <div className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                        <span className="max-w-44 truncate">{subLabel(row)}</span>
                      </div>
                    )}
                  </td>
                  {link && <td className={`${pad} py-2`}><LinkCell url={link(row)} compact={fit} /></td>}
                  {columns.map((c) => <td key={c.key} className={`${pad} py-2`}>{c.render(row)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="p-5 text-sm text-ink-muted">{empty}</div>}
      {rows.length > limit && (
        <div className="border-t border-lilac-50 p-4 text-center">
          <button type="button" onClick={() => setLimit(limit + 100)} className="h-9 cursor-pointer rounded-[10px] border border-lilac-200 px-5 text-sm">
            Show more ({rows.length - limit} left)
          </button>
        </div>
      )}
    </div>
  );
}
