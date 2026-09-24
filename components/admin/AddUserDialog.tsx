'use client';

import { useEffect, useRef, useState } from 'react';
import { createUser, type NewUser } from '@/app/(app)/admin/actions';
import { Icon } from '@/components/Icon';
import { useShell } from '@/components/records/SectionShell';
import { SECTION_KEYS, SECTION_NAMES, type SectionKey } from '@/lib/sections';

const EMPTY: NewUser = { full_name: '', email: '', password: '', department: '', role: 'viewer', sections: [], is_super_admin: false };

// "Add user" form. On success the new user's panel opens.
export function AddUserDialog({ onClose }: { onClose: () => void }) {
  const { add, adding } = useShell();
  const [form, setForm] = useState<NewUser>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => { first.current?.focus(); }, []);
  useEffect(() => {
    document.documentElement.classList.add('panel-open');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.classList.remove('panel-open');
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const set = <K extends keyof NewUser>(k: K, v: NewUser[K]) => { setForm((f) => ({ ...f, [k]: v })); setError(null); };
  const toggleSection = (s: SectionKey) =>
    set('sections', form.sections.includes(s) ? form.sections.filter((x) => x !== s) : [...form.sections, s]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    add(async () => {
      const r = await createUser(form);
      if (!r.ok) setError(r.error); else onClose();
      return r.ok ? r : { ok: true }; // errors are shown inside this form
    });
  };

  const input = 'h-11 w-full rounded-[10px] border border-lilac-200 px-3 text-sm font-normal';
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/20 px-4 py-10">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label="Add user"
        className="flex w-full max-w-[520px] flex-col gap-5 rounded-2xl border border-peach-200 bg-white p-7 shadow-[0_12px_32px_rgba(45,21,89,0.16)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 font-display text-[26px] font-semibold">Add user</h2>
            <p className="mt-1 mb-0 text-[13px] text-ink-muted">They can sign in straight away with this email and password. No email is sent.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-lilac-200">
            <Icon name="cross" size={18} />
          </button>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium">Full name
          <input ref={first} required value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">Email
          <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={input} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">Department
          <input value={form.department} onChange={(e) => set('department', e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">Password (at least 8 characters)
          <input required minLength={8} type="text" value={form.password} onChange={(e) => set('password', e.target.value)} className={input} autoComplete="new-password" />
        </label>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1.5 text-sm font-medium">Role</legend>
          {(['viewer', 'admin'] as const).map((r) => (
            <label key={r} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border border-lilac-200 px-3 text-sm">
              <input type="radio" name="role" checked={form.role === r}
                onChange={() => { set('role', r); if (r === 'viewer') { set('sections', []); set('is_super_admin', false); } }} />
              <span><strong>{r === 'admin' ? 'Admin' : 'Viewer'}</strong> — {r === 'admin' ? 'views everything, edits only the sections ticked below' : 'view only, can’t edit anything'}</span>
            </label>
          ))}
        </fieldset>

        {form.role === 'admin' && (
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1.5 text-sm font-medium">Sections they can edit</legend>
            {SECTION_KEYS.map((s) => (
              <label key={s} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border border-lilac-200 px-3 text-sm">
                <input type="checkbox" checked={form.sections.includes(s)} onChange={() => toggleSection(s)} />
                {SECTION_NAMES[s]}
              </label>
            ))}
          </fieldset>
        )}

        {form.role === 'admin' && (
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border border-lilac-200 px-3 text-sm">
            <input type="checkbox" checked={form.is_super_admin} onChange={(e) => set('is_super_admin', e.target.checked)} />
            <span><strong>Super-admin</strong> — can open this dashboard and manage users</span>
          </label>
        )}

        {error && <p role="alert" className="m-0 rounded-[10px] border border-primary bg-peach-100 px-4 py-3 text-sm">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 cursor-pointer rounded-[10px] border border-lilac-200 px-4 text-sm">Cancel</button>
          <button type="submit" disabled={adding} className="h-11 cursor-pointer rounded-[10px] bg-primary px-5 text-sm font-semibold disabled:opacity-60">
            {adding ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>
    </div>
  );
}
