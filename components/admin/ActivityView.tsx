'use client';

import { Fragment, useMemo, useState } from 'react';
import { useShell } from '@/components/records/SectionShell';
import { FilterMulti, FilterSelect, Segmented } from '@/components/ui/Dropdowns';
import { SearchBox, matches } from '@/components/ui/SearchBox';
import { actorLabel, formatDateTime, localDate, type ActivityRow } from '@/lib/admin/types';
import { downloadCsv, today } from '@/lib/csv';
import { inRange } from '@/lib/qa/stats';
import { SECTION_NAMES, type SectionKey } from '@/lib/sections';
import { ExportButton } from './bits';

export type ActivityData = { rows: ActivityRow[]; names: Record<string, string> };

type Tab = 'all' | SectionKey;
const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'quality_analyst', label: 'Quality Analyst' },
  { value: 'curriculum', label: 'Curriculum' },
  { value: 'mentor', label: 'Mentor' },
];

const FIELD_LABELS: Record<string, string> = {
  case_no: 'Case number', customer_name: 'Customer', course_id: 'Course', course_ids: 'Courses', instructor_id: 'Instructor',
  mentor_id: 'Mentor', case_date: 'Date', is_sample: 'Sample record', field_notes: 'Field notes',
  is_super_admin: 'Super-admin', full_name: 'Full name', resolution_tat_days: 'Resolution TAT (days)',
};
const fieldLabel = (k: string) => FIELD_LABELS[k] ?? k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function ActivityView() {
  const { data, range } = useShell<ActivityData>();
  const [tab, setTab] = useState<Tab>('all');
  const [user, setUser] = useState<string | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const users = useMemo(() => [...new Set(data.rows.map(actorLabel))].sort(), [data.rows]);
  const actionTypes = useMemo(() => [...new Set(data.rows.map((r) => r.action))].sort(), [data.rows]);

  const show = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (Array.isArray(v)) return v.length ? v.map(show).join(', ') : '—';
    if (typeof v === 'object') return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${fieldLabel(k)}: ${show(x)}`).join('; ') || '—';
    const s = String(v);
    return data.names[s] ?? SECTION_NAMES[s as SectionKey] ?? s;
  };

  const rows = data.rows.filter((r) =>
    (tab === 'all' || r.section === tab) &&
    inRange(localDate(r.occurred_at), range) &&
    (!user || actorLabel(r) === user) &&
    (!actions.length || actions.includes(r.action)) &&
    matches(query, [actorLabel(r), r.action, r.record_label, r.summary]));

  const exportCsv = () => downloadCsv(`experience-hub-activity-${today()}.csv`,
    ['When', 'User', 'Action', 'Section', 'Record', 'Detail', 'Changes'],
    rows.map((r) => [formatDateTime(r.occurred_at), actorLabel(r), r.action, r.section ? SECTION_NAMES[r.section] : '',
      r.record_label, r.summary,
      Object.entries(r.changes).map(([k, c]) => `${fieldLabel(k)}: ${show(c.before)} → ${show(c.after)}`).join(' | ')]));

  const th = 'px-3 py-3.5 text-left text-xs font-normal tracking-wide text-ink-muted uppercase';

  return (
    <div className="flex flex-col gap-5">
      <Segmented label="Section" value={tab} onChange={(v) => { setTab(v); setExpanded(null); }} options={TABS} />
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect label="User" allLabel="All users" options={users} value={user} onChange={setUser} />
        <FilterMulti label="Action" allLabel="All actions" options={actionTypes} value={actions} onChange={setActions} />
        <SearchBox value={query} onChange={setQuery} placeholder="Search user, action, record" label="Search activity log" />
        <ExportButton onClick={exportCsv} disabled={!rows.length} />
        <span className="ml-auto text-sm text-ink-muted">Showing {rows.length} of {data.rows.length} entries</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-peach-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="bg-lilac-50">
              <tr>
                <th scope="col" className={`${th} pl-6`}>When</th>
                <th scope="col" className={th}>User</th>
                <th scope="col" className={th}>Action</th>
                <th scope="col" className={th}>Section</th>
                <th scope="col" className={th}>Record</th>
                <th scope="col" className={th}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((r) => {
                const open = expanded === r.id;
                const changes = Object.entries(r.changes);
                return (
                  <Fragment key={r.id}>
                    <tr className="border-t border-lilac-50 align-top">
                      <td className="py-3 pr-3 pl-6 whitespace-nowrap">{formatDateTime(r.occurred_at)}</td>
                      <td className="px-3 py-3">{actorLabel(r)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{r.action}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{r.section ? SECTION_NAMES[r.section] : <span className="text-ink-muted">Users</span>}</td>
                      <td className="px-3 py-3 font-semibold whitespace-nowrap">{r.record_label || '—'}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-ink-muted">{r.summary || (changes.length ? `${changes.length} field${changes.length > 1 ? 's' : ''}` : '—')}</span>
                          {changes.length > 0 && (
                            <button type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : r.id)}
                              className="cursor-pointer rounded-md border border-lilac-200 px-2 py-0.5 text-xs hover:bg-lilac-50">
                              {open ? 'Hide details' : 'Show details'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={6} className="bg-lilac-50/60 px-6 pt-1 pb-4">
                          <table className="w-full text-[13px]">
                            <thead>
                              <tr className="text-left text-ink-muted">
                                <th className="py-1.5 pr-3 font-normal">Field</th>
                                <th className="py-1.5 pr-3 font-normal">Before</th>
                                <th className="py-1.5 font-normal">After</th>
                              </tr>
                            </thead>
                            <tbody>
                              {changes.map(([k, c]) => (
                                <tr key={k} className="border-t border-lilac-100 align-top">
                                  <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">{fieldLabel(k)}</td>
                                  <td className="py-1.5 pr-3 break-words">{show(c.before)}</td>
                                  <td className="py-1.5 break-words">{show(c.after)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <div className="p-6 text-sm text-ink-muted">No activity matches these filters.</div>}
        {rows.length > 500 && (
          <div className="border-t border-lilac-50 p-4 text-center text-sm text-ink-muted">
            Showing the latest 500. Narrow the filters or use Export CSV to see all {rows.length}.
          </div>
        )}
      </div>
    </div>
  );
}
