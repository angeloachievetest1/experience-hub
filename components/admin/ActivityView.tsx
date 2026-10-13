'use client';

import { Fragment, useMemo, useState } from 'react';
import { useShell } from '@/components/records/SectionShell';
import { useColumnWidths } from '@/components/ui/ColumnResize';
import { ScrollX } from '@/components/ui/ScrollX';
import { FilterMulti, FilterSelect, Segmented } from '@/components/ui/Dropdowns';
import { SearchBox, matches } from '@/components/ui/SearchBox';
import { CASE_OPTION_RECORD_TYPES } from '@/lib/admin/lists';
import { actorLabel, formatDateTime, localDate, type ActivityRow } from '@/lib/admin/types';
import { downloadCsv, today } from '@/lib/csv';
import { inRange } from '@/lib/qa/stats';
import { SECTION_NAMES, type SectionKey } from '@/lib/sections';
import { ExportButton } from './bits';

export type ActivityData = { rows: ActivityRow[]; names: Record<string, string> };

const ACTIVITY_COLUMNS = [
  ['when', 'When'], ['user', 'User'], ['action', 'Action'], ['section', 'Section'], ['record', 'Record'], ['detail', 'Detail'],
] as const;

type Tab = 'all' | SectionKey | 'case_options';
const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'quality_analyst', label: 'Quality Analyst' },
  { value: 'curriculum', label: 'Curriculum' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'case_options', label: 'Case options' },
];

// Case options changes show in their section's tab too; shared ones (courses) have no section.
const isCaseOption = (r: ActivityRow) => CASE_OPTION_RECORD_TYPES.includes(r.record_type);
const sectionText = (r: ActivityRow) => (r.section ? SECTION_NAMES[r.section] : isCaseOption(r) ? 'Shared' : 'Users');

const FIELD_LABELS: Record<string, string> = {
  customer_name: 'Customer', course_id: 'Course', course_ids: 'Courses', instructor_id: 'Instructor',
  mentor_id: 'Mentor', case_date: 'Date', is_sample: 'Sample record', field_notes: 'Field notes',
  is_super_admin: 'Super-admin', full_name: 'Full name', resolution_tat_days: 'Resolution TAT (days)',
  // Task Log
  record_type: 'Case record type', opened_at: 'Opened', first_touch_at: 'First touch', closed_at: 'Closed',
  error_type: 'Error 1', error_category: 'Error 1 category',
  // Case options
  value: 'Name', is_active: 'In dropdown', sort_order: 'Position', position: 'Position', aliases: 'Other spellings', list_key: 'List',
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
    (tab === 'all' || (tab === 'case_options' ? isCaseOption(r) : r.section === tab)) &&
    inRange(localDate(r.occurred_at), range) &&
    (!user || actorLabel(r) === user) &&
    (!actions.length || actions.includes(r.action)) &&
    matches(query, [actorLabel(r), r.action, r.record_label, r.summary]));

  const exportCsv = () => downloadCsv(`experience-hub-activity-${today()}.csv`,
    ['When', 'User', 'Action', 'Section', 'Record', 'Detail', 'Changes'],
    rows.map((r) => [formatDateTime(r.occurred_at), actorLabel(r), r.action, sectionText(r),
      r.record_label, r.summary,
      Object.entries(r.changes).map(([k, c]) => `${fieldLabel(k)}: ${show(c.before)} → ${show(c.after)}`).join(' | ')]));

  const th = 'px-3 py-3.5 text-left text-xs font-normal tracking-wide text-ink-muted uppercase';
  const cols = useColumnWidths('activity-log', ACTIVITY_COLUMNS.map(([key]) => key));

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
        <ScrollX>
          <table ref={cols.tableRef} className={`${cols.resized ? '' : 'w-full min-w-[900px]'} border-collapse text-sm ${cols.tableClass}`} style={cols.tableStyle}>
            {cols.colgroup}
            <thead className="bg-lilac-50">
              <tr>
                {ACTIVITY_COLUMNS.map(([key, header], i) => (
                  <th key={key} data-col={key} scope="col" className={`relative ${th} ${i === 0 ? 'pl-6' : ''}`}>
                    {header}
                    {cols.handle(key, header)}
                  </th>
                ))}
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
                      <td className="px-3 py-3 whitespace-nowrap">{r.section ? SECTION_NAMES[r.section] : <span className="text-ink-muted">{sectionText(r)}</span>}</td>
                      <td className="px-3 py-3 font-semibold whitespace-nowrap" title={r.record_label ?? undefined}>{r.record_label || '—'}</td>
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
        </ScrollX>
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
