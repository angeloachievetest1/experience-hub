'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useColumnWidths } from '@/components/ui/ColumnResize';
import { ScrollX } from '@/components/ui/ScrollX';
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
  const th = `relative ${pad} py-2.5 text-left text-xs font-normal tracking-wide text-ink-muted uppercase ${fit ? 'align-bottom' : ''}`;

  const headers = [
    ...(leading ? [{ key: leading.key, header: leading.header }] : []),
    { key: '__name', header: firstHeader },
    ...(link ? [{ key: '__link', header: 'Link' }] : []),
    ...columns.map((c) => ({ key: c.key, header: c.header })),
  ];
  // Column widths can be dragged; remembered per page and set of columns.
  const pathname = usePathname();
  const cols = useColumnWidths(`${pathname}|${headers.map((h) => h.key).join(',')}`, headers.map((h) => h.key));

  return (
    <div className="overflow-hidden rounded-2xl border border-peach-200 bg-white">
      <ScrollX>
        <table ref={cols.tableRef} className={`${cols.resized ? '' : 'w-full'} border-collapse ${fit ? 'text-[13px]' : 'text-sm'} ${cols.tableClass}`}
          style={cols.tableStyle ?? (fit ? undefined : { minWidth })}>
          {cols.colgroup}
          <thead className="bg-lilac-50">
            <tr>
              {headers.map((h, i) => (
                <th key={h.key} data-col={h.key} scope="col" className={`${th} ${i === 0 ? edge : ''}`}>
                  {h.header}
                  {cols.handle(h.key, h.header)}
                </th>
              ))}
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
                        {/* Cut off at a set width until the column is resized, then at the column's width. */}
                        <span className={`${cols.resized ? 'min-w-0' : 'max-w-44'} truncate`} title={subLabel(row)}>{subLabel(row)}</span>
                      </div>
                    )}
                  </td>
                  {link && <td className={`${pad} py-2`}><LinkCell url={link(row)} /></td>}
                  {columns.map((c) => <td key={c.key} className={`${pad} py-2`}>{c.render(row)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollX>
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
