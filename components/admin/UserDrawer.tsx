'use client';

import { useState, useTransition } from 'react';
import { deleteUser, setUserPassword, updateUser } from '@/app/(app)/admin/actions';
import { RecordDrawer, type FieldGroup } from '@/components/records/RecordDrawer';
import { useShell } from '@/components/records/SectionShell';
import { ROLE_LABELS, STATUS_LABELS, type AdminUser } from '@/lib/admin/types';
import { SECTION_KEYS, SECTION_NAMES } from '@/lib/sections';

export type UsersData = { users: AdminUser[]; meId: string };

const SECTIONS = SECTION_KEYS.map((k) => ({ id: k, name: SECTION_NAMES[k] }));

const GROUPS: FieldGroup[] = [
  {
    title: 'Profile',
    fields: [
      { key: 'full_name', label: 'Full name', kind: 'text' },
      { key: 'email', label: 'Email', kind: 'text' },
      { key: 'department', label: 'Department', kind: 'text' },
    ],
  },
  {
    title: 'Access',
    fields: [
      { key: 'role', label: 'Role', kind: 'select', options: ['viewer', 'admin'], labels: ROLE_LABELS, required: true },
      // Viewers are view-only: no sections, no super-admin (owner decision 2026-09-30).
      { key: 'sections', label: 'Sections they can edit', kind: 'multiLookup', options: SECTIONS, visible: (d) => d.role === 'admin' },
      { key: 'is_super_admin', label: 'Super-admin', kind: 'bool', visible: (d) => d.role === 'admin' },
    ],
  },
  {
    title: 'Status',
    fields: [
      { key: 'status', label: 'Status', kind: 'select', options: ['active', 'deactivated'], labels: STATUS_LABELS, required: true },
      { key: 'deactivation_note', label: 'Deactivation note', kind: 'textarea' },
    ],
  },
];

export function UserDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, adding } = useShell<UsersData>();
  const u = data.users.find((x) => x.id === id) ?? null;
  const isMe = id === data.meId;
  const name = u ? u.full_name || u.email : '';

  const extra = u && (
    <>
      <div className="rounded-[10px] bg-lilac-50 px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
        <strong className="text-ink">How access works:</strong> Viewers can only view: they can’t edit anything and can’t
        be super-admins. Admins view every section and edit only the sections ticked above. Super-admins (Admins only)
        can also open this dashboard. Deactivated users can’t sign in at all.
      </div>
      <PasswordSection id={id} />
    </>
  );

  return (
    <RecordDrawer
      record={u as unknown as Parameters<typeof RecordDrawer>[0]['record']}
      loadingText={adding ? 'Creating the new user…' : undefined}
      kindLabel={isMe ? 'User (you)' : 'User'}
      color="#9F7DFF"
      title={name}
      groups={GROUPS}
      canEdit
      readOnlyText=""
      onSave={(patch) => updateUser(id, patch)}
      onDelete={() => deleteUser(id)}
      deleteQuestion={`Delete ${name}? They will no longer be able to sign in. Cases they entered are kept.`}
      deleteLabel="Delete user"
      onClose={onClose}
      extra={extra}
      // Switching to Viewer removes their sections and super-admin.
      derive={(draft, key) => (key === 'role' && draft.role === 'viewer' ? { ...draft, sections: [], is_super_admin: false } : draft)}
    />
  );
}

function PasswordSection({ id }: { id: string }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    const r = await setUserPassword(id, password);
    setMessage(r.ok ? { ok: true, text: 'New password set. Share it with the person privately.' } : { ok: false, text: r.error });
    if (r.ok) setPassword('');
  });

  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 font-display text-lg font-normal">Set a new password</h3>
      <p className="m-0 text-[13px] text-ink-muted">At least 8 characters. No email is sent: tell the person their new password yourself.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type={show ? 'text' : 'password'}
          value={password}
          onChange={(e) => { setPassword(e.target.value); setMessage(null); }}
          autoComplete="new-password"
          aria-label="New password"
          className="h-10 min-w-0 flex-1 rounded-lg border border-lilac-200 px-2.5 text-sm"
        />
        <button type="button" onClick={() => setShow(!show)} className="h-10 cursor-pointer rounded-lg border border-lilac-200 px-3 text-sm">
          {show ? 'Hide' : 'Show'}
        </button>
        <button type="button" disabled={password.length < 8 || pending} onClick={save}
          className="h-10 cursor-pointer rounded-lg bg-primary px-4 text-sm font-semibold disabled:cursor-default disabled:opacity-50">
          {pending ? 'Setting…' : 'Set password'}
        </button>
      </div>
      {message && (
        <p role={message.ok ? 'status' : 'alert'}
          className={`m-0 rounded-[10px] px-3.5 py-2.5 text-sm ${message.ok ? 'bg-highlight' : 'border border-primary bg-peach-100'}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
