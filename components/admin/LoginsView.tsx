'use client';

import { useMemo, useState } from 'react';
import { useShell } from '@/components/records/SectionShell';
import { useColumnWidths } from '@/components/ui/ColumnResize';
import { ScrollX } from '@/components/ui/ScrollX';
import { FilterSelect } from '@/components/ui/Dropdowns';
import { formatDateTime, localDate, type LoginRow } from '@/lib/admin/types';
import { downloadCsv, today } from '@/lib/csv';
import { inRange } from '@/lib/qa/stats';
import { ExportButton } from './bits';

const who = (r: LoginRow) => r.user_name || r.user_email || 'Deleted user';

const LOGIN_COLUMNS = [['when', 'When'], ['user', 'User'], ['email', 'Email']] as const;

export function LoginsView() {
  const { data, range } = useShell<LoginRow[]>();
  const [user, setUser] = useState<string | null>(null);
  const users = useMemo(() => [...new Set(data.map(who))].sort(), [data]);
  const rows = data.filter((r) => inRange(localDate(r.signed_in_at), range) && (!user || who(r) === user));

  const exportCsv = () => downloadCsv(`experience-hub-logins-${today()}.csv`, ['When', 'User', 'Email'],
    rows.map((r) => [formatDateTime(r.signed_in_at), who(r), r.user_email]));

  const th = 'px-3 py-3.5 text-left text-xs font-normal tracking-wide text-ink-muted uppercase';
  const cols = useColumnWidths('login-history', LOGIN_COLUMNS.map(([key]) => key));
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect label="User" allLabel="All users" options={users} value={user} onChange={setUser} />
        <ExportButton onClick={exportCsv} disabled={!rows.length} />
        <span className="ml-auto text-sm text-ink-muted">Showing {rows.length} of {data.length} sign-ins</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-peach-200 bg-white">
        <ScrollX>
          <table ref={cols.tableRef} className={`${cols.resized ? '' : 'w-full'} border-collapse text-sm ${cols.tableClass}`} style={cols.tableStyle}>
            {cols.colgroup}
            <thead className="bg-lilac-50">
              <tr>
                {LOGIN_COLUMNS.map(([key, header], i) => (
                  <th key={key} data-col={key} scope="col" className={`relative ${th} ${i === 0 ? 'pl-6' : ''}`}>
                    {header}
                    {cols.handle(key, header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((r) => (
                <tr key={r.id} className="border-t border-lilac-50">
                  <td className="py-3 pr-3 pl-6 whitespace-nowrap">{formatDateTime(r.signed_in_at)}</td>
                  <td className="px-3 py-3 font-semibold">{who(r)}</td>
                  <td className="px-3 py-3 text-ink-muted">{r.user_email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
        {rows.length === 0 && <div className="p-6 text-sm text-ink-muted">No sign-ins match these filters.</div>}
        {rows.length > 500 && (
          <div className="border-t border-lilac-50 p-4 text-center text-sm text-ink-muted">
            Showing the latest 500. Narrow the filters or use Export CSV to see all {rows.length}.
          </div>
        )}
      </div>
    </div>
  );
}
