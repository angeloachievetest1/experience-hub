'use client';

import { useState } from 'react';
import { LinkCell } from '@/components/ui/LinkCell';

export type TableColumn<T> = { key: string; header: string; render: (row: T) => React.ReactNode };

// Clickable table used by every case log. First column: record number + a
// second line (customer); then an optional one-click Link column.
export function RecordTable<T extends { id: string; is_sample?: boolean }>({
  rows, label, subLabel, link, columns, onOpen, empty = 'No records match these filters.', minWidth = 980,
}: {
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
  const th = 'px-2.5 py-3.5 text-left text-xs font-normal tracking-wide text-ink-muted uppercase';

  return (
    <div className="overflow-hidden rounded-2xl border border-peach-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth }}>
          <thead className="bg-lilac-50">
            <tr>
              <th scope="col" className={`${th} pl-6`}>Case</th>
              {link && <th scope="col" className={th}>Link</th>}
              {columns.map((c) => <th key={c.key} scope="col" className={th}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              return (
                <tr key={row.id} onClick={() => onOpen(row.id)}
                  className="cursor-pointer border-t border-lilac-50 align-middle hover:bg-peach-50">
                  <td className="py-3 pr-2.5 pl-6">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(row.id); }}
                      className="cursor-pointer p-0 py-1 text-left font-semibold underline decoration-primary underline-offset-[3px]">
                      {label(row)}
                    </button>
                    {(subLabel || row.is_sample) && (
                      <div className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                        {subLabel && <span className="max-w-44 truncate">{subLabel(row)}</span>}
                        {row.is_sample && <span className="rounded-full bg-highlight px-2 py-0.5 text-[11px] font-semibold tracking-wide text-ink uppercase">Sample</span>}
                      </div>
                    )}
                  </td>
                  {link && <td className="px-2.5 py-3"><LinkCell url={link(row)} /></td>}
                  {columns.map((c) => <td key={c.key} className="px-2.5 py-3">{c.render(row)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="p-6 text-sm text-ink-muted">{empty}</div>}
      {rows.length > limit && (
        <div className="border-t border-lilac-50 p-4 text-center">
          <button type="button" onClick={() => setLimit(limit + 100)} className="h-11 cursor-pointer rounded-[10px] border border-lilac-200 px-5 text-sm">
            Show more ({rows.length - limit} left)
          </button>
        </div>
      )}
    </div>
  );
}
