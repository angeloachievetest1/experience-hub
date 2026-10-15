'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { CheckOption, Chevron, usePopover } from '@/components/ui/Dropdowns';
import type { ActionResult } from '@/lib/records/sanitize';
import { formatDate, formatDateTime, parseDateTime } from '@/lib/qa/stats';

// The right-hand panel used by every case log to view, edit and delete a record.

// hidden: taken out of dropdowns on the Case options page; still shown on the cases that use it.
export type Named = { id: string; name: string; hidden?: boolean };

export type FieldDef = (
  | { key: string; label: string; kind: 'text' | 'textarea' | 'date' | 'datetime' | 'url' | 'pct' | 'number' | 'rating' | 'bool' }
  | { key: string; label: string; kind: 'suggest'; suggestions: string[] }
  // names: shown next to the value (MCS – Mid Course Survey); labels: shown instead of it (admin → Admin)
  | { key: string; label: string; kind: 'select'; options: readonly string[]; names?: Record<string, string>; labels?: Record<string, string>; required?: boolean }
  // A list plus "Others", which opens a blank box to type the value in.
  | { key: string; label: string; kind: 'selectOther'; options: readonly string[] }
  | { key: string; label: string; kind: 'lookup'; options: Named[]; emptyHint?: string }
  | { key: string; label: string; kind: 'multi'; options: readonly string[] }
  | { key: string; label: string; kind: 'multiLookup'; options: Named[] }
) & {
  // Show the field only when this returns true (e.g. sections only for Admins).
  visible?: (draft: Record<string, unknown>) => boolean;
  // Shown but never typed into (e.g. calculated elsewhere); the text says why.
  readOnly?: string;
};

export type FieldGroup = { title: string; fields: FieldDef[] };

type Draft = Record<string, unknown>;
type Message = { kind: 'ok' | 'error'; text: string } | null;

export type RecordDrawerProps = {
  record: (Record<string, unknown> & { id: string; updated_at?: string; field_notes?: Record<string, string> }) | null;
  loadingText?: string;
  kindLabel: string;           // e.g. "Instructor record"
  color: string;               // little square next to kindLabel
  title: string;               // the customer (or requester) name
  groups: FieldGroup[];
  canEdit: boolean;
  readOnlyText: string;
  onSave: (patch: Record<string, unknown>) => Promise<ActionResult>;
  onDelete: () => Promise<ActionResult>;
  deleteQuestion: string;
  deleteLabel?: string;
  canDelete?: boolean;         // false for a new case that hasn't been saved yet
  saveLabel?: string;          // e.g. "Save case" for a new case
  onClose: () => void;
  // Adjust other fields when one changes (e.g. fill year/quarter from a date).
  derive?: (draft: Draft, changedKey: string) => Draft;
  extra?: React.ReactNode;     // shown after the fields
};

export function RecordDrawer(props: RecordDrawerProps) {
  const { record, onClose, title } = props;
  const closeRef = useRef<HTMLButtonElement>(null);
  const [message, setMessage] = useState<Message>(null); // survives the form reloading after a save

  useEffect(() => { closeRef.current?.focus(); }, [record?.id]);

  // Freeze the page and menu behind the panel so only the panel scrolls.
  useEffect(() => {
    document.documentElement.classList.add('panel-open');
    return () => document.documentElement.classList.remove('panel-open');
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-ink/20" aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={record ? title : 'Record details'}
        className="relative flex h-full w-full max-w-[480px] flex-col gap-5 overflow-y-auto border-l [&>*]:shrink-0 border-peach-200 bg-white px-6 pt-6 pb-10 shadow-[-12px_0_32px_rgba(45,21,89,0.12)]"
      >
        {record ? (
          <RecordForm key={`${record.id}:${record.updated_at ?? ''}`} {...props} record={record} closeRef={closeRef} message={message} setMessage={setMessage} />
        ) : (
          <div className="flex items-start justify-between gap-3">
            <p className="m-0 min-w-0 flex-1 text-sm text-ink-muted">{props.loadingText ?? 'Loading… If this doesn’t change, the record may have been deleted.'}</p>
            <CloseButton ref={closeRef} onClick={onClose} />
          </div>
        )}
      </aside>
    </div>
  );
}

function CloseButton({ onClick, ref }: { onClick: () => void; ref: React.Ref<HTMLButtonElement> }) {
  return (
    <button ref={ref} type="button" onClick={onClick} aria-label="Close details"
      className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-lilac-200 bg-white">
      <Icon name="cross" size={18} />
    </button>
  );
}

// The same as the × at the top, for when you have scrolled to the bottom.
// iconOnly: just the × (next to Save/Undo/Delete, where a label wouldn't fit).
function BottomCloseButton({ onClick, iconOnly = false }: { onClick: () => void; iconOnly?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={iconOnly ? 'Close' : undefined} title={iconOnly ? 'Close' : undefined}
      className={`flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-lilac-200 bg-white text-sm ${iconOnly ? 'w-10' : 'px-4'}`}>
      <Icon name="cross" size={iconOnly ? 18 : 16} />
      {!iconOnly && 'Close'}
    </button>
  );
}

function RecordForm({
  record, kindLabel, color, title, groups, canEdit, readOnlyText, onSave, onDelete,
  deleteQuestion, deleteLabel = 'Delete case', canDelete = true, saveLabel = 'Save changes', onClose, derive, extra, closeRef, message, setMessage,
}: RecordDrawerProps & {
  record: NonNullable<RecordDrawerProps['record']>;
  closeRef: React.Ref<HTMLButtonElement>; message: Message; setMessage: (m: Message) => void;
}) {
  const router = useRouter();
  const keys = useMemo(() => {
    const k = groups.flatMap((g) => g.fields.map((f) => f.key));
    return 'field_notes' in record ? [...k, 'field_notes'] : k;
  }, [groups, record]);
  const original = useMemo(() => Object.fromEntries(keys.map((k) => [k, record[k] ?? null])), [record, keys]);
  const [draft, setDraft] = useState<Draft>(original);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const changed = keys.filter((k) => JSON.stringify(draft[k] ?? null) !== JSON.stringify(original[k] ?? null));
  const dirty = changed.length > 0;
  const notes = (draft.field_notes as Record<string, string> | undefined) ?? {};
  const hasNotes = 'field_notes' in record;

  // With unsaved changes, closing asks first, inside the panel (browser
  // pop-ups don't show everywhere, e.g. in an embedded browser).
  const [leaving, setLeaving] = useState(false);
  const close = () => { if (dirty) setLeaving(true); else onClose(); };
  // Remounts the inputs after "Undo" so they forget anything half-typed.
  const [undoCount, setUndoCount] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (leaving) setLeaving(false); else close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const set = (k: string, v: unknown) => {
    setDraft((d) => {
      const next = { ...d, [k]: v };
      return derive ? derive(next, k) : next;
    });
    setMessage(null);
  };

  const save = (thenClose = false) => {
    setMessage(null);
    const patch = Object.fromEntries(changed.map((k) => [k, draft[k]]));
    startTransition(async () => {
      const result = await onSave(patch);
      if (!result.ok) { setMessage({ kind: 'error', text: result.error }); setLeaving(false); return; }
      if (thenClose) onClose(); else setMessage({ kind: 'ok', text: 'Changes saved.' });
      router.refresh();
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await onDelete();
      if (!result.ok) { setMessage({ kind: 'error', text: result.error }); setConfirming(false); return; }
      onClose();
      router.refresh();
    });
  };

  return (
    <>
      {/* min-w-0 + wrapping keeps long names/emails from pushing the close button out */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] text-ink-muted">
            <span className="size-2.5 rounded-[3px]" style={{ background: color }} aria-hidden="true" />
            <span>{kindLabel}</span>
          </div>
          <h2 className="mt-1.5 mb-0 font-display text-[22px] leading-tight font-semibold [overflow-wrap:anywhere]">{title}</h2>
          {!canEdit && <p className="mt-1 mb-0 text-[13px] text-ink-muted">{readOnlyText}</p>}
        </div>
        <CloseButton ref={closeRef} onClick={close} />
      </div>

      {groups.map((g) => (
        <section key={g.title} className="flex flex-col gap-2">
          <h3 className="m-0 font-display text-lg font-normal">{g.title}</h3>
          <div className="flex flex-col">
            {g.fields.filter((f) => !f.visible || f.visible(draft)).map((f) => (
              <div key={f.key} className="grid grid-cols-[130px_minmax(0,1fr)] items-start gap-3 border-t border-lilac-50 py-2 text-sm">
                <label htmlFor={`f-${f.key}`} className="pt-2.5 text-ink-muted">{f.label}</label>
                <div className="min-w-0">
                  {canEdit && !f.readOnly
                    ? <FieldInput key={undoCount} f={f} value={draft[f.key]} onChange={(v) => set(f.key, v)} />
                    : <FieldValue f={f} value={draft[f.key]} />}
                  {canEdit && f.readOnly && <div className="mt-1 text-xs text-ink-muted">{f.readOnly}</div>}
                  {hasNotes && NOTE_KINDS.includes(f.kind) && (
                    <FieldNote
                      label={f.label}
                      note={notes[f.key] ?? ''}
                      canEdit={canEdit}
                      onChange={(text) => {
                        const next = { ...notes };
                        if (text.trim()) next[f.key] = text.trim(); else delete next[f.key];
                        set('field_notes', next);
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {extra}

      {!canEdit && (
        <div className="border-t border-lilac-50 pt-4">
          <BottomCloseButton onClick={close} />
        </div>
      )}

      {canEdit && (
        <div className="flex flex-col gap-3 border-t border-lilac-50 pt-4">
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'}
              className={`m-0 rounded-[10px] px-3.5 py-2.5 text-sm ${message.kind === 'error' ? 'border border-primary bg-peach-100' : 'bg-highlight'}`}>
              {message.text}
            </p>
          )}
          {dirty && !message && !confirming && (
            <p role="status" className="m-0 text-[13px] text-ink-muted">You have unsaved changes. Click <strong>{saveLabel}</strong> to keep them.</p>
          )}
          {confirming ? (
            <div className="flex flex-col gap-2.5">
              <div className="text-sm">{deleteQuestion} This can’t be undone. It will be recorded in the activity log.</div>
              <div className="flex gap-2">
                <button type="button" onClick={remove} disabled={pending}
                  className="h-10 cursor-pointer rounded-[10px] bg-primary px-4 text-sm font-semibold disabled:opacity-60">
                  {pending ? 'Deleting…' : `Yes, ${deleteLabel.toLowerCase()}`}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="h-10 cursor-pointer rounded-[10px] border border-lilac-200 px-4 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => save()} disabled={!dirty || pending}
                className="h-10 cursor-pointer rounded-[10px] bg-primary px-5 text-sm font-semibold disabled:cursor-default disabled:opacity-50">
                {pending ? 'Saving…' : saveLabel}
              </button>
              {dirty && (
                <button type="button" onClick={() => { setDraft(original); setMessage(null); setUndoCount((n) => n + 1); }}
                  className="h-10 cursor-pointer rounded-[10px] border border-lilac-200 px-4 text-sm">
                  Undo
                </button>
              )}
              <BottomCloseButton onClick={close} iconOnly />
              {canDelete && (
                <button type="button" onClick={() => setConfirming(true)}
                  className="ml-auto h-10 cursor-pointer rounded-[10px] border border-[#FFB199] bg-white px-4 text-sm font-semibold text-primary">
                  {deleteLabel}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {leaving && (
        <div role="alertdialog" aria-label="Unsaved changes"
          className="fixed right-0 bottom-0 z-50 flex w-full max-w-[480px] flex-col gap-3 border-t border-l border-peach-200 bg-white px-6 py-4 shadow-[0_-8px_24px_rgba(45,21,89,0.12)]">
          <div className="text-sm">You have unsaved changes. Close anyway?</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => save(true)} disabled={pending}
              className="h-10 cursor-pointer rounded-[10px] bg-primary px-4 text-sm font-semibold disabled:opacity-60">
              {pending ? 'Saving…' : 'Save and close'}
            </button>
            <button type="button" autoFocus onClick={onClose} className="h-10 cursor-pointer rounded-[10px] border border-lilac-200 bg-white px-4 text-sm">
              Close without saving
            </button>
            <button type="button" onClick={() => setLeaving(false)} className="h-10 cursor-pointer rounded-[10px] border border-lilac-200 bg-white px-4 text-sm">
              Keep editing
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Notes on dropdown fields ("+ Add note", shown on hover), as in the prototype.
// ---------------------------------------------------------------------------
const NOTE_KINDS: FieldDef['kind'][] = ['select', 'lookup', 'rating', 'bool'];

function FieldNote({ label, note, canEdit, onChange }: {
  label: string; note: string; canEdit: boolean; onChange: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note);
  const linkClass = 'cursor-pointer border-0 bg-transparent p-0 text-xs text-secondary underline decoration-dotted underline-offset-2';

  if (editing) {
    return (
      <div className="mt-1.5 flex flex-col gap-1.5">
        <textarea autoFocus rows={2} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Add a note about this field" aria-label={`Note for ${label}`}
          className="w-full rounded-md border border-lilac-200 px-2 py-1.5 text-xs" />
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => { onChange(text); setEditing(false); }}
            className="h-8 cursor-pointer rounded-md bg-primary px-2.5 text-xs font-semibold">Save note</button>
          <button type="button" onClick={() => { setText(note); setEditing(false); }}
            className="h-8 cursor-pointer rounded-md border border-lilac-200 bg-white px-2.5 text-xs">Cancel</button>
          {note && (
            <button type="button" onClick={() => { onChange(''); setText(''); setEditing(false); }} className={`${linkClass} ml-1`}>
              Remove note
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!note) {
    return canEdit ? (
      <button type="button" onClick={() => { setText(''); setEditing(true); }} className={`${linkClass} mt-1.5 block`}>+ Add note</button>
    ) : null;
  }

  return (
    <span className="group relative mt-1.5 inline-flex items-center gap-1">
      <button type="button" onClick={canEdit ? () => { setText(note); setEditing(true); } : undefined}
        aria-label={`Note for ${label}: ${note}${canEdit ? ' (click to edit)' : ''}`}
        className={`${linkClass} inline-flex items-center gap-1 no-underline ${canEdit ? '' : 'cursor-default'}`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 4h16v12H8l-4 4z" />
        </svg>
        <span className="underline decoration-dotted underline-offset-2">Notes</span>
      </button>
      <span role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-0 z-50 mb-1.5 w-max max-w-[260px] min-w-[200px] rounded-lg bg-ink px-2.5 py-2 text-xs leading-snug whitespace-pre-wrap text-white opacity-0 shadow-[0_8px_20px_rgba(45,21,89,0.25)] transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        {note}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inputs and read-only values
// ---------------------------------------------------------------------------
const inputClass = 'h-10 w-full rounded-lg border border-lilac-200 bg-white px-2.5 text-sm focus:border-secondary';

function withCurrent(options: readonly string[], current: unknown) {
  return typeof current === 'string' && current && !options.includes(current) ? [...options, current] : options;
}

function FieldInput({ f, value, onChange }: { f: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
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
            <a href={str} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs underline decoration-primary underline-offset-2">Open link</a>
          )}
        </>
      );
    case 'textarea':
      return <textarea id={id} rows={3} value={str} onChange={(e) => onChange(e.target.value)} className={`${inputClass} h-auto py-2`} />;
    case 'date':
      return <input id={id} type="date" value={str} onChange={(e) => onChange(e.target.value || null)} className={inputClass} />;
    case 'datetime':
      return <DateTimeInput id={id} label={f.label} value={str} onChange={onChange} />;
    case 'pct':
    case 'number':
      return <input id={id} type="number" min={0} max={f.kind === 'pct' ? 100 : undefined} step="0.01" value={str}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className={inputClass} />;
    case 'rating':
      return (
        <select id={id} value={str} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} className={inputClass}>
          <option value="">Not set</option>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      );
    case 'bool':
      return (
        <select id={id} value={value === true ? 'yes' : value === false ? 'no' : ''}
          onChange={(e) => onChange(e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null)} className={inputClass}>
          <option value="">Not set</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      );
    case 'suggest':
      return (
        <>
          <input id={id} type="text" list={`${id}-list`} value={str} onChange={(e) => onChange(e.target.value)} className={inputClass} />
          <datalist id={`${id}-list`}>{f.suggestions.map((a) => <option key={a} value={a} />)}</datalist>
        </>
      );
    case 'select':
      return (
        <select id={id} value={str} onChange={(e) => onChange(e.target.value || null)} className={inputClass}>
          {!f.required && <option value="">Not set</option>}
          {withCurrent(f.options, value).map((o) => (
            <option key={o} value={o}>{f.labels?.[o] ?? (f.names?.[o] ? `${o} – ${f.names[o]}` : o)}</option>
          ))}
        </select>
      );
    case 'selectOther':
      return <SelectOther id={id} label={f.label} options={f.options} value={str} onChange={onChange} />;
    case 'lookup': {
      const options = f.options.filter((o) => !o.hidden || o.id === value);
      return (
        <>
          <select id={id} value={str} onChange={(e) => onChange(e.target.value || null)} className={inputClass}>
            <option value="">Not set</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name}{o.hidden ? ' (hidden)' : ''}</option>)}
          </select>
          {options.length === 0 && f.emptyHint && <div className="mt-1 text-xs text-ink-muted">{f.emptyHint}</div>}
        </>
      );
    }
    case 'multi':
      return <MultiPicker id={id} label={f.label} options={f.options.map((o) => ({ id: o, name: o }))}
        value={(value as string[]) ?? []} onChange={onChange} />;
    case 'multiLookup':
      return <MultiPicker id={id} label={f.label} value={(value as string[]) ?? []} onChange={onChange}
        options={f.options.filter((o) => !o.hidden || ((value as string[]) ?? []).includes(o.id))} />;
  }
}

// Date and time you can type or paste ("9/28/2026 2:13 PM", copied from the sheet
// or Kustomer), or pick with the calendar button. Read when you paste, press
// Enter or leave the box; shown back as "28 Sep 2026, 2:13 PM".
function DateTimeInput({ id, label, value, onChange }: {
  id: string; label: string; value: string; onChange: (v: unknown) => void;
}) {
  const [text, setText] = useState(value ? formatDateTime(value) : '');
  const [unreadable, setUnreadable] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => { setText(value ? formatDateTime(value) : ''); setUnreadable(false); }, [value]);

  const commit = (raw: string) => {
    const parsed = raw.trim() ? parseDateTime(raw) : '';
    if (parsed === null) { setText(raw); setUnreadable(true); return; }
    setText(parsed ? formatDateTime(parsed) : '');
    setUnreadable(false);
    if (parsed !== value) onChange(parsed || null);
  };

  const openPicker = () => {
    const el = picker.current;
    if (!el) return;
    try { el.showPicker(); } catch { el.focus(); el.click(); }
  };

  return (
    <>
      <div className="relative flex gap-1.5">
        <input id={id} type="text" value={text} placeholder="e.g. 9/28/2026 2:13 PM" autoComplete="off"
          aria-invalid={unreadable || undefined} aria-describedby={unreadable ? `${id}-hint` : undefined}
          onChange={(e) => { setText(e.target.value); setUnreadable(false); }}
          onPaste={(e) => { e.preventDefault(); commit(e.clipboardData.getData('text')); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(text); } }}
          onBlur={() => commit(text)}
          className={`${inputClass} ${unreadable ? 'border-primary' : ''}`} />
        <button type="button" onClick={openPicker} aria-label={`Pick ${label.toLowerCase()} from a calendar`} title="Pick from a calendar"
          className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-lilac-200 bg-white hover:bg-lilac-50">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4" />
          </svg>
        </button>
        {/* The browser's own picker, opened by the button; kept in the page so it can open. */}
        <input ref={picker} type="datetime-local" tabIndex={-1} aria-hidden="true" value={value}
          onChange={(e) => onChange(e.target.value || null)}
          className="pointer-events-none absolute right-0 bottom-0 h-0 w-0 opacity-0" />
      </div>
      {unreadable && (
        <div id={`${id}-hint`} className="mt-1 text-xs text-primary">
          Couldn’t read that date and time. Try 9/28/2026 2:13 PM, or use the calendar.
        </div>
      )}
    </>
  );
}

const OTHERS = '__others__';

function SelectOther({ id, label, options, value, onChange }: {
  id: string; label: string; options: readonly string[]; value: string; onChange: (v: unknown) => void;
}) {
  // A value that isn't in the list was typed in, so it shows as Others.
  const custom = value !== '' && !options.includes(value);
  const [typing, setTyping] = useState(custom);
  const [text, setText] = useState(custom ? value : '');
  // Picking Others changes nothing until something is typed; clearing the box
  // goes back to the value from before.
  const [before, setBefore] = useState(value);
  return (
    <>
      <select id={id} value={typing ? OTHERS : value} className={inputClass}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTHERS) { setTyping(true); setBefore(value); setText(''); return; }
          setTyping(false);
          onChange(v || null);
        }}>
        <option value="">Not set</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value={OTHERS}>Others</option>
      </select>
      {typing && (
        <input type="text" autoFocus={!custom} value={text} placeholder="Type it here" aria-label={`${label}: others`}
          onChange={(e) => { setText(e.target.value); onChange(e.target.value.trim() ? e.target.value : before || null); }}
          className={`${inputClass} mt-1.5`} />
      )}
    </>
  );
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
          className="absolute top-full left-0 z-50 mt-1 flex max-h-72 w-full flex-col gap-0.5 [&>*]:shrink-0 overflow-y-auto rounded-[10px] border border-lilac-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(45,21,89,0.16)]">
          {all.map((o) => <CheckOption key={o.id} label={o.name} checked={value.includes(o.id)} onToggle={() => toggle(o.id)} />)}
          <button type="button" onClick={() => setOpen(false)} className="mt-1 h-9 cursor-pointer rounded-md bg-ink text-[13px] font-semibold text-white">Done</button>
        </div>
      )}
    </div>
  );
}

function FieldValue({ f, value }: { f: FieldDef; value: unknown }) {
  const box = (content: React.ReactNode) => <div id={`f-${f.key}`} className="pt-2.5 break-words whitespace-pre-wrap">{content}</div>;
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) {
    return box(<span className="text-ink-muted">—</span>);
  }
  switch (f.kind) {
    case 'date': return box(formatDate(value as string));
    case 'datetime': return box(formatDateTime(value as string));
    case 'pct': return box(`${value}%`);
    case 'bool': return box(value ? 'Yes' : 'No');
    case 'url':
      return box(<a href={value as string} target="_blank" rel="noopener noreferrer" className="underline decoration-primary underline-offset-2">Open link</a>);
    case 'lookup': return box(f.options.find((o) => o.id === value)?.name ?? 'Unknown');
    case 'multiLookup': return box((value as string[]).map((v) => f.options.find((o) => o.id === v)?.name ?? 'Unknown').join(', '));
    case 'multi': return box((value as string[]).join(', '));
    case 'select': {
      const v = String(value);
      return box(f.labels?.[v] ?? (f.names?.[v] ? `${v} – ${f.names[v]}` : v));
    }
    default: return box(String(value));
  }
}
