'use client';

import { useState } from 'react';
import { RecordTable } from '@/components/records/RecordTable';
import { useShell } from '@/components/records/SectionShell';
import { Kpi } from '@/components/ui/Charts';
import { FilterMulti, FilterSelect } from '@/components/ui/Dropdowns';
import { AddButton, SearchBox, matches } from '@/components/ui/SearchBox';
import { ROLE_LABELS, STATUS_LABELS, formatDateTime, type AdminUser } from '@/lib/admin/types';
import { downloadCsv, today } from '@/lib/csv';
import { SECTION_KEYS, SECTION_NAMES } from '@/lib/sections';
import { AddUserDialog } from './AddUserDialog';
import { ExportButton, HoverNote } from './bits';
import type { UsersData } from './UserDrawer';

const sectionList = (u: AdminUser) => (u.role === 'admin' ? u.sections.map((s) => SECTION_NAMES[s]).join(', ') : '');

export function UsersView() {
  const { data, open, adding } = useShell<UsersData>();
  const [sections, setSections] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const users = data.users;
  const rows = users.filter((u) =>
    (!sections.length || sections.some((s) => u.role === 'admin' && u.sections.some((k) => SECTION_NAMES[k] === s))) &&
    (!statuses.length || statuses.includes(STATUS_LABELS[u.status])) &&
    (!role || ROLE_LABELS[u.role] === role) &&
    matches(query, [u.full_name, u.email, u.department]));

  const exportCsv = () => downloadCsv(`experience-hub-users-${today()}.csv`,
    ['Name', 'Email', 'Department', 'Role', 'Sections', 'Super-admin', 'Status', 'Deactivation note', 'Last sign-in'],
    rows.map((u) => [u.full_name, u.email, u.department, ROLE_LABELS[u.role], sectionList(u),
      u.is_super_admin ? 'Yes' : 'No', STATUS_LABELS[u.status], u.deactivation_note,
      u.last_sign_in ? formatDateTime(u.last_sign_in) : '']));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total users" value={users.length} />
        <Kpi label="Admins" value={users.filter((u) => u.role === 'admin').length} />
        <Kpi label="Viewers" value={users.filter((u) => u.role === 'viewer').length} />
        <Kpi label="Deactivated" value={users.filter((u) => u.status === 'deactivated').length} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterMulti label="Section" allLabel="All sections" options={SECTION_KEYS.map((k) => SECTION_NAMES[k])} value={sections} onChange={setSections} />
        <FilterMulti label="Status" allLabel="All statuses" options={['Active', 'Deactivated']} value={statuses} onChange={setStatuses} />
        <FilterSelect label="Role" allLabel="All roles" options={['Viewer', 'Admin']} value={role} onChange={setRole} />
        <SearchBox value={query} onChange={setQuery} placeholder="Search name, email, department" label="Search users" />
        <AddButton label="Add user" busy={adding} onClick={() => setAddOpen(true)} />
        <ExportButton onClick={exportCsv} disabled={!rows.length} />
        <span className="ml-auto text-sm text-ink-muted">Showing {rows.length} of {users.length} users</span>
      </div>

      <RecordTable
        firstHeader="Name"
        rows={rows}
        label={(u) => (u.full_name || u.email) + (u.id === data.meId ? ' (you)' : '')}
        subLabel={(u) => u.email}
        onOpen={open}
        empty="No users match these filters."
        columns={[
          { key: 'department', header: 'Department', render: (u) => u.department || '—' },
          { key: 'role', header: 'Role', render: (u) => ROLE_LABELS[u.role] },
          { key: 'sections', header: 'Sections', render: (u) => sectionList(u) || <span className="text-ink-muted">—</span> },
          {
            key: 'super', header: 'Super-admin',
            render: (u) => (u.is_super_admin
              ? <span className="rounded-full bg-highlight px-2.5 py-1 text-[13px] font-semibold">Yes</span>
              : <span className="text-ink-muted">No</span>),
          },
          {
            key: 'status', header: 'Status',
            render: (u) => (
              <span className="inline-flex items-center gap-2">
                <span className="rounded-full px-2.5 py-1 text-[13px] whitespace-nowrap"
                  style={{ background: u.status === 'active' ? '#F6F3FF' : '#FFE3D9' }}>
                  {STATUS_LABELS[u.status]}
                </span>
                {u.status === 'deactivated' && u.deactivation_note && <HoverNote label="Deactivation note" note={u.deactivation_note} />}
              </span>
            ),
          },
          { key: 'last', header: 'Last sign-in', render: (u) => <span className="whitespace-nowrap">{u.last_sign_in ? formatDateTime(u.last_sign_in) : '—'}</span> },
        ]}
      />
      {addOpen && <AddUserDialog onClose={() => setAddOpen(false)} />}
    </div>
  );
}
