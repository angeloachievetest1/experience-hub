'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteQaCase, updateQaCase } from '@/app/(app)/quality-analyst/actions';
import { Icon } from '@/components/Icon';
import { CheckOption, Chevron, usePopover } from '@/components/ui/Dropdowns';
import { formatDate } from '@/lib/qa/stats';
import { SOURCE_COLORS, VALIDITY_VALUES, caseLabel, type Named, type QaCase, type QaData, type QaPatch } from '@/lib/qa/types';
import { SampleTag } from './Badges';
import { useQa } from './QaShell';

type Field =
  | { key: keyof QaCase; label: string; kind: 'text' | 'textarea' | 'date' | 'url' | 'pct' | 'rating' | 'analyst' }
  | { key: keyof QaCase; label: string; kind: 'select'; options: readonly string[] }
  | { key: keyof QaCase; label: string; kind: 'lookup'; options: Named[] }
  | { key: keyof QaCase; label: string; kind: 'multi'; options: readonly string[] }
  | { key: keyof QaCase; label: string; kind: 'multiLookup'; options: Named[] };

type Group = { title: string; fields: Field[] };

function groupsFor(c: QaCase, data: QaData): Group[] {
  const o = (k: string) => data.options[k] ?? [];
  const caseFields: Field[] = [
    { key: 'case_date', label: 'Date', kind: 'date' },
    { key: 'customer_name', label: 'Customer', kind: 'text' },
    c.source === 'Returned'
      ? { key: 'course_ids', label: 'Courses', kind: 'multiLookup', options: data.courses }
      : { key: 'course_id', label: 'Course', kind: 'lookup', options: data.courses },
  ];
  if (c.source !== 'Returned') caseFields.push({ key: 'instructor_id', label: 'Instructor', kind: 'lookup', options: data.instructors });
  caseFields.push({ key: 'analyst', label: 'Analyst', kind: 'analyst' });

  if (c.source === 'Instructor' || c.source === 'Course') {
    const s = c.source === 'Instructor' ? 'instructor' : 'course';
    caseFields.push(
      { key: 'category', label: 'Category', kind: 'select', options: o(`qa_category_${s}`) },
      { key: 'complaint_types', label: 'Complaint types', kind: 'multi', options: o(`qa_type_${s}`) },
    );
  }
  if (c.source === 'Survey') {
    caseFields.push(
      { key: 'survey_type', label: 'Survey type', kind: 'select', options: o('qa_survey_type') },
      { key: 'survey_id', label: 'Survey ID', kind: 'text' },
      { key: 'rating', label: 'Rating (1–6)', kind: 'rating' },
      { key: 'reason_type', label: 'Reason type', kind: 'select', options: o('qa_survey_reason') },
      { key: 'customer_comment', label: 'Customer comment', kind: 'textarea' },
    );
  }
  if (c.source === 'Returned') {
    caseFields.push({ key: 'reassign_reason', label: 'Reassign reason', kind: 'select', options: o('qa_reassign_reason') });
  }

  const groups: Group[] = [{ title: 'Case', fields: caseFields }];
  if (c.source === 'Instructor') {
    groups.push({
      title: 'Learner engagement',
      fields: [
        { key: 'course_end_date', label: 'Course end date', kind: 'date' },
        { key: 'attendance_pct', label: 'Attendance %', kind: 'pct' },
        { key: 'participation_pct', label: 'Participation %', kind: 'pct' },
        { key: 'moodle_pct', label: 'Moodle %', kind: 'pct' },
      ],
    });
  }
  const outcome: Field[] = [{ key: 'validity', label: 'Validity', kind: 'select', options: VALIDITY_VALUES }];
  if (c.source !== 'Survey') outcome.push({ key: 'resolution', label: 'Resolution', kind: 'select', options: o('qa_resolution') });
  if (c.source === 'Course') outcome.push({ key: 'case_closed_by', label: 'Case closed by', kind: 'select', options: o('qa_case_closed_by') });
  groups.push({ title: 'Outcome', fields: outcome });
  groups.push({
    title: 'Follow-up',
    fields: [
      { key: 'followup_email', label: 'Email sent', kind: 'select', options: o('qa_followup_sent') },
      { key: 'followup_sms', label: 'SMS sent', kind: 'select', options: o('qa_followup_sent') },
      { key: 'followup_call', label: 'Call made', kind: 'select', options: o('qa_followup_sent') },
      { key: 'customer_reached', label: 'Customer reached', kind: 'select', options: o('qa_reached') },
    ],
  });
  groups.push({
    title: 'Record',
    fields: [
      { key: 'case_link', label: 'Case link', kind: 'url' },
      { key: 'notes', label: 'Notes', kind: 'textarea' },
    ],
  });
  return groups;
}

type Draft = Record<string, unknown>;
type Message = { kind: 'ok' | 'error'; text: string } | null;

export function CaseDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, adding } = useQa();
  const c = data.cases.find((x) => x.id === id) ?? null;
  const closeRef = useRef<HTMLButtonElement>(null);
  // Lives here so "Changes saved" survives the form reloading with fresh data.
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => { closeRef.current?.focus(); }, [id]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ink/20" aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={c ? `Case ${caseLabel(c)}` : 'Case details'}
        className="relative flex h-full w-full max-w-[480px] flex-col gap-6 overflow-y-auto border-l border-peach-200 bg-white px-7 pt-7 pb-10 shadow-[-12px_0_32px_rgba(45,21,89,0.12)]"
      >
        {c ? (
          <CaseForm key={`${c.id}:${c.updated_at}`} c={c} onClose={onClose} closeRef={closeRef} message={message} setMessage={setMessage} />
        ) : (
          <div className="flex items-start justify-between gap-3">
            <p className="m-0 text-sm text-ink-muted">{adding ? 'Creating the new case…' : 'Loading… If this doesn’t change, the case may have been deleted.'}</p>
            <CloseButton ref={closeRef} onClick={onClose} />
          </div>
        )}
      </aside>
    </div>
  );
}

function CloseButton({ onClick, ref }: { onClick: () => void; ref: React.Ref<HTMLButtonElement> }) {
  return (
    <button ref={ref} type="button" onClick={onClick} aria-label="Close case details"
      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-lilac-200 bg-white">
      <Icon name="cross" size={18} />
    </button>
  );
}

function CaseForm({ c, onClose, closeRef, message, setMessage }: {
  c: QaCase; onClose: () => void; closeRef: React.Ref<HTMLButtonElement>;
  message: Message; setMessage: (m: Message) => void;
}) {
  const router = useRouter();
  const { data } = useQa();
  const groups = useMemo(() => groupsFor(c, data), [c, data]);
  const keys = useMemo(() => groups.flatMap((g) => g.fields.map((f) => f.key as string)), [groups]);
  const original = useMemo(() => Object.fromEntries(keys.map((k) => [k, c[k as keyof QaCase]])), [c, keys]);
  const [draft, setDraft] = useState<Draft>(original);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const canEdit = data.canEdit;

  const changed = keys.filter((k) => JSON.stringify(draft[k] ?? null) !== JSON.stringify(original[k] ?? null));
  const dirty = changed.length > 0;

  const analysts = useMemo(
    () => [...new Set(data.cases.map((x) => x.analyst).filter(Boolean) as string[])].sort(),
    [data.cases],
  );

  const close = () => {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const save = () => {
    setMessage(null);
    const patch = Object.fromEntries(changed.map((k) => [k, draft[k]])) as QaPatch;
    startTransition(async () => {
      const result = await updateQaCase(c.id, patch);
      if (!result.ok) { setMessage({ kind: 'error', text: result.error }); return; }
      setMessage({ kind: 'ok', text: 'Changes saved.' });
      router.refresh();
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await deleteQaCase(c.id);
      if (!result.ok) { setMessage({ kind: 'error', text: result.error }); setConfirming(false); return; }
      onClose();
      router.refresh();
    });
  };

  const set = (k: string, v: unknown) => { setDraft((d) => ({ ...d, [k]: v })); setMessage(null); };

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[13px] text-ink-muted">
            <span className="size-2.5 rounded-[3px]" style={{ background: SOURCE_COLORS[c.source] }} aria-hidden="true" />
            <span>{c.source} record</span>
            {c.is_sample && <SampleTag />}
          </div>
          <h2 className="mt-1.5 mb-0 font-display text-[26px] font-semibold">{caseLabel(c)}</h2>
          {!canEdit && <p className="mt-1 mb-0 text-[13px] text-ink-muted">Read only. You can’t edit Quality Analyst cases.</p>}
        </div>
        <CloseButton ref={closeRef} onClick={close} />
      </div>

      {groups.map((g) => (
        <section key={g.title} className="flex flex-col gap-2">
          <h3 className="m-0 font-display text-lg font-normal">{g.title}</h3>
          <div className="flex flex-col">
            {g.fields.map((f) => (
              <div key={f.key} className="grid grid-cols-[130px_minmax(0,1fr)] items-start gap-3 border-t border-lilac-50 py-2 text-sm">
                <label htmlFor={`f-${f.key}`} className="pt-2.5 text-ink-muted">{f.label}</label>
                <div className="min-w-0">
                  {canEdit
                    ? <FieldInput f={f} value={draft[f.key]} onChange={(v) => set(f.key, v)} analysts={analysts} />
                    : <FieldValue f={f} value={draft[f.key]} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {canEdit && (
        <div className="flex flex-col gap-3 border-t border-lilac-50 pt-4">
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'}
              className={`m-0 rounded-[10px] px-3.5 py-2.5 text-sm ${message.kind === 'error' ? 'border border-primary bg-peach-100' : 'bg-highlight'}`}>
              {message.text}
            </p>
          )}
          {confirming ? (
            <div className="flex flex-col gap-2.5">
              <div className="text-sm">Delete {caseLabel(c)}? This can’t be undone. It will be recorded in the activity log.</div>
              <div className="flex gap-2">
                <button type="button" onClick={remove} disabled={pending}
                  className="h-11 cursor-pointer rounded-[10px] bg-primary px-4 text-sm font-semibold disabled:opacity-60">
                  {pending ? 'Deleting…' : 'Yes, delete case'}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="h-11 cursor-pointer rounded-[10px] border border-lilac-200 px-4 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={save} disabled={!dirty || pending}
                className="h-11 cursor-pointer rounded-[10px] bg-primary px-5 text-sm font-semibold disabled:cursor-default disabled:opacity-50">
                {pending ? 'Saving…' : 'Save changes'}
              </button>
              {dirty && (
                <button type="button" onClick={() => { setDraft(original); setMessage(null); }}
                  className="h-11 cursor-pointer rounded-[10px] border border-lilac-200 px-4 text-sm">
                  Undo changes
                </button>
              )}
              <button type="button" onClick={() => setConfirming(true)}
                className="ml-auto h-11 cursor-pointer rounded-[10px] border border-[#FFB199] bg-white px-4 text-sm font-semibold text-primary">
                Delete case
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

const inputClass = 'h-10 w-full rounded-lg border border-lilac-200 bg-white px-2.5 text-sm focus:border-secondary';

function withCurrent(options: readonly string[], current: unknown) {
  return typeof current === 'string' && current && !options.includes(current) ? [...options, current] : options;
}

function FieldInput({ f, value, onChange, analysts }: { f: Field; value: unknown; onChange: (v: unknown) => void; analysts: string[] }) {
  const id = `f-${f.key}`;
  const str = value === null || value === undefined ? '' : String(value);
  switch (f.kind) {
    case 'text':
      return <input id={id} type="text" value={str} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
    case 'url':
      return (
        <>
          <input id={id} type="url" value={str} placeholder="https://" onChange={(e) => onChange(e.target.value)} className={inputClass} />
          {/^https?:\/\/\S+$/i.test(str) && (
            <a href={str} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs underline decoration-primary underline-offset-2">
              Open case link
            </a>
          )}
        </>
      );
    case 'textarea':
      return <textarea id={id} rows={3} value={str} onChange={(e) => onChange(e.target.value)} className={`${inputClass} h-auto py-2`} />;
    case 'date':
      return <input id={id} type="date" value={str} onChange={(e) => onChange(e.target.value || null)} className={inputClass} />;
    case 'pct':
      return <input id={id} type="number" min={0} max={100} step="0.01" value={str}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className={inputClass} />;
    case 'rating':
      return (
        <select id={id} value={str} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} className={inputClass}>
          <option value="">Not set</option>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      );
    case 'analyst':
      return (
        <>
          <input id={id} type="text" list="qa-analysts" value={str} onChange={(e) => onChange(e.target.value)} className={inputClass} />
          <datalist id="qa-analysts">{analysts.map((a) => <option key={a} value={a} />)}</datalist>
        </>
      );
    case 'select':
      return (
        <select id={id} value={str} onChange={(e) => onChange(e.target.value || null)} className={inputClass}>
          <option value="">Not set</option>
          {withCurrent(f.options, value).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'lookup':
      return (
        <>
          <select id={id} value={str} onChange={(e) => onChange(e.target.value || null)} className={inputClass}>
            <option value="">Not set</option>
            {f.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {f.key === 'instructor_id' && f.options.length === 0 && (
            <div className="mt-1 text-xs text-ink-muted">The instructor list is empty until the master list is loaded.</div>
          )}
        </>
      );
    case 'multi':
      return <MultiPicker id={id} label={f.label} options={withCurrent(f.options, null).map((o) => ({ id: o, name: o }))}
        value={(value as string[]) ?? []} onChange={onChange} />;
    case 'multiLookup':
      return <MultiPicker id={id} label={f.label} options={f.options} value={(value as string[]) ?? []} onChange={onChange} />;
  }
}

function MultiPicker({ id, label, options, value, onChange }: {
  id: string; label: string; options: Named[]; value: string[]; onChange: (v: string[]) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const names = new Map(options.map((o) => [o.id, o.name]));
  // Keep values that are no longer in the list (e.g. from older imports).
  const all = [...options, ...value.filter((v) => !names.has(v)).map((v) => ({ id: v, name: v }))];
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const text = value.map((v) => names.get(v) ?? v).join(', ');
  return (
    <div ref={ref} className="relative">
      <button id={id} type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}
        className={`${inputClass} flex h-auto min-h-10 cursor-pointer items-center gap-2 py-1.5 text-left`}>
        <span className="flex-1">{text || <span className="text-ink-muted">Not set</span>}</span>
        <Chevron />
      </button>
      {open && (
        <div role="listbox" aria-multiselectable="true" aria-label={label}
          className="absolute top-full left-0 z-50 mt-1 flex max-h-72 w-full flex-col gap-0.5 overflow-y-auto rounded-[10px] border border-lilac-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(45,21,89,0.16)]">
          {all.map((o) => <CheckOption key={o.id} label={o.name} checked={value.includes(o.id)} onToggle={() => toggle(o.id)} />)}
          <button type="button" onClick={() => setOpen(false)} className="mt-1 h-9 cursor-pointer rounded-md bg-ink text-[13px] font-semibold text-white">Done</button>
        </div>
      )}
    </div>
  );
}

function FieldValue({ f, value }: { f: Field; value: unknown }) {
  const empty = <span className="text-ink-muted">—</span>;
  const box = (content: React.ReactNode) => <div id={`f-${f.key}`} className="pt-2.5 break-words whitespace-pre-wrap">{content}</div>;
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return box(empty);
  switch (f.kind) {
    case 'date': return box(formatDate(value as string));
    case 'pct': return box(`${value}%`);
    case 'url':
      return box(<a href={value as string} target="_blank" rel="noopener noreferrer" className="underline decoration-primary underline-offset-2">Open case link</a>);
    case 'lookup': return box(f.options.find((o) => o.id === value)?.name ?? 'Unknown');
    case 'multiLookup': return box((value as string[]).map((v) => f.options.find((o) => o.id === v)?.name ?? 'Unknown').join(', '));
    case 'multi': return box((value as string[]).join(', '));
    default: return box(String(value));
  }
}
