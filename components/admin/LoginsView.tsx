'use client';

import { useMemo, useState } from 'react';
import { useShell } from '@/components/records/SectionShell';
import { FilterSelect } from '@/components/ui/Dropdowns';
import { formatDateTime, localDate, type LoginRow } from '@/lib/admin/types';
import { downloadCsv, today } from '@/lib/csv';
import { inRange } from '@/lib/qa/stats';
import { ExportButton } from './bits';

const who = (r: LoginRow) => r.user_name || r.user_email || 'Deleted user';

export function LoginsView() {
  const { data, range } = useShell<LoginRow[]>();
  const [user, setUser] = useState<string | null>(null);
  const users = useMemo(() => [...new Set(data.map(who))].sort(), [data]);
  const rows = data.filter((r) => inRange(localDate(r.signed_in_at), range) && (!user || who(r) === user));

  const exportCsv = () => downloadCsv(`experience-hub-logins-${today()}.csv`, ['When', 'User', 'Email'],
    rows.map((r) => [formatDateTime(r.signed_in_at), who(r), r.user_email]));

  const th = 'px-3 py-3.5 text-left text-xs font-normal tracking-wide text-ink-muted uppercase';
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect label="User" allLabel="All users" options={users} value={user} onChange={setUser} />
        <ExportButton onClick={exportCsv} disabled={!rows.length} />
        <span className="ml-auto text-sm text-ink-muted">Showing {rows.length} of {data.length} sign-ins</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-peach-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-lilac-50">
            <tr>
              <th scope="col" className={`${th} pl-6`}>When</th>
              <th scope="col" className={th}>User</th>
              <th scope="col" className={th}>Email</th>
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
