'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addCaseOption, deleteCaseOption, renameCaseOption, reorderCaseOptions, setCaseOptionHidden } from '@/app/(app)/admin/case-options/actions';
import { useShell } from '@/components/records/SectionShell';
import { SearchBox, matches } from '@/components/ui/SearchBox';
import { LIST_GROUPS, type ListData, type ListItem } from '@/lib/admin/lists';
import type { ActionResult } from '@/lib/records/sanitize';

// Case options: super-admins manage courses, instructors, mentors and every
// other dropdown. Each change is confirmed first, then saved; the database
// updates matching cases on a rename and writes the Activity Log.

const casesText = (n: number) => `${n} ${n === 1 ? 'case' : 'cases'}`;
const small = 'h-8 cursor-pointer rounded-[10px] border border-lilac-200 bg-white px-3 text-[13px] hover:border-secondary hover:bg-lilac-50 disabled:cursor-default disabled:opacity-40 disabled:hover:border-lilac-200 disabled:hover:bg-white';

// Every change is confirmed first, so a mis-click never changes a list.
type Confirm = { title: string; body: string; action: string; danger?: boolean; run: () => void; cancel?: () => void };
type Drag = { id: string; from: number; before: ListItem[] };

export function ListsView() {
  const { data } = useShell<ListData[]>();
  const [lists, setLists] = useState(data);
  const [selected, setSelected] = useState(data[0]?.key ?? '');
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const drag = useRef<Drag | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const router = useRouter();
  const [saving, startSaving] = useTransition();

  // Fresh data after each save (new counts, ids and order).
  useEffect(() => { setLists(data); }, [data]);

  const list = lists.find((l) => l.key === selected) ?? lists[0];
  const ordered = list.key === 'courses' || list.kind === 'text'; // instructors and mentors are alphabetical
  const locked = Boolean(list.locked);
  const canMove = ordered && !locked;

  const pick = (key: string) => { setSelected(key); setEditing(null); setNewName(''); setError(null); setMessage(null); };
  const update = (items: ListItem[]) => setLists((all) => all.map((l) => (l.key === list.key ? { ...l, items } : l)));
  const taken = (name: string, exceptId?: string) =>
    list.items.some((i) => i.id !== exceptId && i.name.toLowerCase() === name.trim().toLowerCase());
  const done = (text: string) => { setError(null); setMessage(text); };
  const fail = (text: string) => { setMessage(null); setError(text); };
  const ask = (c: Confirm) => { setError(null); setMessage(null); setConfirm(c); };
  const closeConfirm = (ok: boolean) => {
    const c = confirm;
    setConfirm(null);
    if (ok) c?.run(); else c?.cancel?.();
  };
  const save = (action: () => Promise<ActionResult>, success: string, then?: { onSuccess?: () => void; onError?: () => void }) => {
    setError(null);
    setMessage('Saving…');
    startSaving(async () => {
      const r = await action();
      if (!r.ok) { then?.onError?.(); fail(r.error); return; }
      then?.onSuccess?.();
      done(success);
      router.refresh();
    });
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (taken(name)) { fail(`“${name}” is already in this list.`); return; }
    ask({
      title: `Add “${name}”?`,
      body: `It will appear at the end of the ${list.label} dropdown straight away.`,
      action: 'Add',
      run: () => save(() => addCaseOption(list.key, name), `Added “${name}”.`, { onSuccess: () => setNewName('') }),
    });
  };

  const rename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const item = list.items.find((i) => i.id === editing.id)!;
    const name = editing.name.trim();
    if (!name || name === item.name) { setEditing(null); return; }
    if (taken(name, item.id)) { fail(`“${name}” is already in this list.`); return; }
    const effect = !item.uses ? 'No cases use it yet.'
      : list.kind === 'text' ? `This also updates the ${casesText(item.uses)} that use “${item.name}”.`
      : `The new name will show on all ${casesText(item.uses)}.`;
    ask({
      title: `Rename “${item.name}” to “${name}”?`,
      body: effect,
      action: 'Rename',
      run: () => save(() => renameCaseOption(list.key, item.id, name),
        `Renamed “${item.name}” to “${name}”.${item.uses && list.kind === 'text' ? ` Updated the ${casesText(item.uses)} that use it.` : ''}`,
        { onSuccess: () => setEditing(null) }),
    });
  };

  const toggleHidden = (item: ListItem) => ask(item.hidden
    ? {
      title: `Show “${item.name}” again?`,
      body: `It will appear in the ${list.label} dropdown again.`,
      action: 'Show',
      run: () => save(() => setCaseOptionHidden(list.key, item.id, false), `“${item.name}” is back in the dropdown.`),
    }
    : {
      title: `Hide “${item.name}”?`,
      body: `It will no longer appear in the ${list.label} dropdown.${item.uses ? ` The ${casesText(item.uses)} that use it keep it.` : ''}`,
      action: 'Hide',
      run: () => save(() => setCaseOptionHidden(list.key, item.id, true), `“${item.name}” no longer appears in the dropdown.`),
    });

  const remove = (item: ListItem) => ask({
    title: `Delete “${item.name}”?`,
    body: `It will be removed from ${list.label} for good. No cases use it.`,
    action: 'Delete',
    danger: true,
    run: () => save(() => deleteCaseOption(list.key, item.id), `Deleted “${item.name}”.`),
  });

  // Reordering: the row moves live while dragging; dropping asks before saving,
  // and Cancel puts everything back where it was.
  const confirmMove = (d: Drag, to: number) => {
    if (to === d.from) { update(d.before); return; }
    const item = d.before[d.from];
    const ids = d.before.map((i) => i.id);
    ids.splice(d.from, 1);
    ids.splice(to, 0, item.id);
    ask({
      title: 'Save the new order?',
      body: `“${item.name}” moves from position ${d.from + 1} to position ${to + 1} in the ${list.label} dropdown.`,
      action: 'Save order',
      run: () => save(() => reorderCaseOptions(list.key, ids, item.id), `Saved the new order. “${item.name}” is now number ${to + 1}.`,
        { onError: () => update(d.before) }),
      cancel: () => update(d.before),
    });
  };
  const moveTo = (id: string, to: number) => {
    const items = [...list.items];
    const from = items.findIndex((i) => i.id === id);
    if (from === -1 || from === to) return;
    const [it] = items.splice(from, 1);
    items.splice(to, 0, it);
    update(items);
  };
  // Press and hold the dots, move over other rows, let go. Works with mouse, touchpad and touch.
  const startDrag = (e: React.PointerEvent, item: ListItem, index: number) => {
    if (e.button !== 0 || saving) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: item.id, from: index, before: list.items };
    setDraggingId(item.id);
    setEditing(null); setError(null); setMessage(null);
  };
  const dragMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    if (e.clientY < 60) window.scrollBy(0, -12); // near the window edge: scroll
    else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('tr[data-index]');
    if (row) moveTo(drag.current.id, Number(row.dataset.index));
  };
  const drop = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDraggingId(null);
    confirmMove(d, list.items.findIndex((i) => i.id === d.id));
  };
  const cancelDrag = () => { // Escape or an interrupted drag: put it back
    const d = drag.current;
    drag.current = null;
    setDraggingId(null);
    if (d) update(d.before);
  };
  const cancelDragRef = useRef(cancelDrag);
  cancelDragRef.current = cancelDrag;
  useEffect(() => {
    if (!draggingId) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancelDragRef.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [draggingId]);
  const keyMove = (e: React.KeyboardEvent, item: ListItem, index: number) => {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : null;
    if (to === null || to < 0 || to >= list.items.length || saving) return;
    e.preventDefault();
    const d = { id: item.id, from: index, before: list.items };
    moveTo(item.id, to);
    confirmMove(d, to);
  };

  const visibleLists = lists.filter((l) => matches(query, [l.label, l.group, ...l.items.map((i) => i.name)]));
  const shown = list.items.filter((i) => !i.hidden).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <section className="flex flex-col gap-1 [&>*]:shrink-0 rounded-2xl border border-peach-200 bg-white p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto">
          <div className="mb-1"><SearchBox value={query} onChange={setQuery} placeholder="Search lists and options" label="Search lists and options" width="" /></div>
          {LIST_GROUPS.map((group) => {
            const inGroup = visibleLists.filter((l) => l.group === group);
            if (!inGroup.length) return null;
            return (
              <div key={group} className="flex flex-col gap-1">
                <div className="px-2.5 pt-3 pb-1 text-xs tracking-wide text-ink-muted uppercase">{group}</div>
                {inGroup.map((l) => {
                  const on = l.key === list.key;
                  return (
                    <button key={l.key} type="button" aria-pressed={on} onClick={() => pick(l.key)}
                      className={`flex min-h-9 cursor-pointer items-center justify-between gap-2 rounded-[10px] px-3 text-left text-sm ${on ? 'bg-lilac-100 font-semibold' : 'hover:bg-lilac-50'}`}>
                      <span>{l.label}{l.locked && <span className="ml-1.5 text-xs font-normal text-ink-muted">Locked</span>}</span>
                      <span className="text-[13px] text-ink-muted">{l.items.length}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {!visibleLists.length && <div className="px-2.5 py-2 text-sm text-ink-muted">No list or option matches “{query}”.</div>}
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <div className="text-xs tracking-wide text-ink-muted uppercase">{list.group}</div>
            <h2 className="m-0 font-display text-[22px] font-semibold">{list.label}</h2>
            <div className="text-sm text-ink-muted">
              Used for: {list.usedIn} · {shown} shown{list.items.length > shown ? `, ${list.items.length - shown} hidden` : ''}
            </div>
          </div>

          {locked ? (
            <div className="rounded-2xl border border-peach-200 bg-peach-50 px-5 py-3 text-sm"><strong>Locked.</strong> {list.locked}</div>
          ) : (
            <form onSubmit={add} className="flex flex-wrap items-center gap-3">
              <input value={newName} onChange={(e) => { setNewName(e.target.value); setError(null); }} placeholder={`New ${list.key === 'courses' ? 'course' : list.key === 'instructors' ? 'instructor' : list.key === 'mentors' ? 'mentor' : 'option'}`}
                aria-label={`Add to ${list.label}`} className="h-9 w-full rounded-[10px] border border-lilac-200 bg-white px-3.5 text-sm sm:w-80" />
              <button type="submit" disabled={!newName.trim() || saving}
                className="flex h-9 cursor-pointer items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold disabled:cursor-default disabled:opacity-50">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14 M5 12h14" /></svg>
                Add
              </button>
              <span className="text-[13px] text-ink-muted">
                {canMove ? 'Drag the dots to change the order. ' : ''}
                {list.kind === 'linked' ? 'Cases are linked to these names, so a new spelling shows on every past case.' : 'Renaming an option also updates the cases that use it.'}
              </span>
            </form>
          )}

          <div aria-live="polite">
            {error && <div className="rounded-[10px] bg-peach-100 px-4 py-2.5 text-sm">{error}</div>}
            {message && <div className="rounded-[10px] bg-lilac-50 px-4 py-2.5 text-sm">{message}</div>}
          </div>

          <div className="overflow-hidden rounded-2xl border border-peach-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead className="bg-lilac-50">
                  <tr className="text-left text-xs tracking-wide text-ink-muted uppercase">
                    {canMove && <th scope="col" className="w-12 py-2.5 pl-3 font-normal"><span className="sr-only">Order</span></th>}
                    <th scope="col" className={`py-2.5 pr-3 font-normal ${canMove ? '' : 'pl-5'}`}>Name</th>
                    <th scope="col" className="px-3 py-2.5 font-normal">Used by</th>
                    <th scope="col" className="px-3 py-2.5 font-normal">In dropdown</th>
                    {!locked && <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-normal">Actions</th>}
                  </tr>
                </thead>
                <tbody className={draggingId ? 'cursor-grabbing select-none' : ''}>
                  {list.items.map((item, index) => {
                    const isEditing = editing?.id === item.id;
                    const isDragging = draggingId === item.id;
                    return (
                      <tr key={item.id} data-index={index}
                        className={`border-t border-lilac-50 align-middle ${isDragging ? 'relative bg-lilac-100 shadow-[0_4px_14px_rgba(45,21,89,0.18)]' : ''} ${item.hidden ? 'text-ink-muted' : ''}`}>
                        {canMove && (
                          <td className="py-2 pl-3">
                            <button type="button" disabled={saving} onPointerDown={(e) => startDrag(e, item, index)} onPointerMove={dragMove}
                              onPointerUp={drop} onPointerCancel={cancelDrag} onKeyDown={(e) => keyMove(e, item, index)}
                              aria-label={`Move ${item.name}: drag, or use the up and down arrow keys`} title="Drag to move"
                              className={`flex size-8 touch-none items-center justify-center rounded-lg hover:bg-lilac-50 hover:text-ink ${isDragging ? 'cursor-grabbing text-ink' : 'cursor-grab text-ink-muted'}`}>
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                                <circle cx="5.5" cy="3" r="1.4" /><circle cx="10.5" cy="3" r="1.4" />
                                <circle cx="5.5" cy="8" r="1.4" /><circle cx="10.5" cy="8" r="1.4" />
                                <circle cx="5.5" cy="13" r="1.4" /><circle cx="10.5" cy="13" r="1.4" />
                              </svg>
                            </button>
                          </td>
                        )}
                        <td className={`py-2 pr-3 ${canMove ? '' : 'pl-5'}`}>
                          {isEditing ? (
                            <form onSubmit={rename} className="flex flex-wrap gap-2">
                              <input autoFocus value={editing.name} onChange={(e) => { setEditing({ ...editing, name: e.target.value }); setError(null); }}
                                onKeyDown={(e) => e.key === 'Escape' && setEditing(null)} aria-label={`New name for ${item.name}`}
                                className="h-8 min-w-56 flex-1 rounded-[10px] border border-secondary px-3 text-sm" />
                              <button type="submit" disabled={saving} className="h-8 cursor-pointer rounded-[10px] bg-primary px-3 text-[13px] font-semibold disabled:cursor-wait disabled:opacity-60">Save</button>
                              <button type="button" onClick={() => setEditing(null)} className={small}>Cancel</button>
                            </form>
                          ) : (
                            <>
                              <span className={item.hidden ? '' : 'font-medium'}>{item.name}</span>
                              {!!item.aliases?.length && <div className="text-xs text-ink-muted">Other spellings (for imports): {item.aliases.join(', ')}</div>}
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{item.uses ? casesText(item.uses) : <span className="text-ink-muted">Not used</span>}</td>
                        <td className="px-3 py-2">
                          <span className="rounded-full px-2.5 py-1 text-[13px] whitespace-nowrap" style={{ background: item.hidden ? '#FFE3D9' : '#F6F3FF' }}>
                            {item.hidden ? 'Hidden' : 'Shown'}
                          </span>
                        </td>
                        {!locked && (
                          <td className="py-2 pr-5 pl-3">
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => { setEditing({ id: item.id, name: item.name }); setError(null); }} disabled={isEditing || saving} className={small}>Rename</button>
                              <button type="button" onClick={() => toggleHidden(item)} disabled={saving} className={small}>{item.hidden ? 'Show' : 'Hide'}</button>
                              <button type="button" onClick={() => remove(item)} disabled={item.uses > 0 || saving}
                                title={item.uses ? `Used by ${casesText(item.uses)}. Hide it instead.` : undefined} className={small}>Delete</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {!locked && <p className="m-0 text-[13px] text-ink-muted">Every change asks you to confirm first. Delete only works for options no case uses; anything in use can be hidden instead, so past cases keep their value.</p>}
        </div>
      </div>
      {confirm && <ConfirmDialog confirm={confirm} onClose={closeConfirm} />}
    </div>
  );
}

function ConfirmDialog({ confirm, onClose }: { confirm: Confirm; onClose: (ok: boolean) => void }) {
  const okRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    // Delete starts on Cancel, so pressing Enter by accident never deletes.
    (confirm.danger ? cancelRef : okRef).current?.focus();
    document.documentElement.classList.add('panel-open');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.classList.remove('panel-open');
      document.removeEventListener('keydown', onKey);
    };
  }, [confirm]);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/20 px-4 py-24"
      onClick={(e) => e.target === e.currentTarget && onClose(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body"
        className="flex w-full max-w-[460px] flex-col gap-4 rounded-2xl border border-peach-200 bg-white p-6 shadow-[0_12px_32px_rgba(45,21,89,0.16)]">
        <h2 id="confirm-title" className="m-0 font-display text-[22px] font-semibold">{confirm.title}</h2>
        <p id="confirm-body" className="m-0 text-sm">{confirm.body}</p>
        <div className="flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={() => onClose(false)}
            className="h-10 cursor-pointer rounded-[10px] border border-lilac-200 bg-white px-4 text-sm hover:border-secondary hover:bg-lilac-50">Cancel</button>
          <button ref={okRef} type="button" onClick={() => onClose(true)}
            className="h-10 cursor-pointer rounded-[10px] bg-primary px-4 text-sm font-semibold">{confirm.action}</button>
        </div>
      </div>
    </div>
  );
}
