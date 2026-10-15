'use client';

import { useState } from 'react';
import type { ActionResult } from '@/lib/records/sanitize';

// "Add case" opens a blank record in the panel. Nothing is saved until its
// "Save case" button is clicked: the first save creates the record (its
// starting values plus what was filled in), later saves update it. Closing a
// blank record without saving leaves nothing behind.

// Panel id of a record that isn't saved yet: "new", or "new:<kind>" (e.g. a QA source).
export const NEW_RECORD = 'new';
export const isNewRecord = (id: string) => id === NEW_RECORD || id.startsWith(`${NEW_RECORD}:`);
export const newRecordKind = (id: string) => (id.startsWith(`${NEW_RECORD}:`) ? id.slice(NEW_RECORD.length + 1) : '');

export function useNewRecord<T extends { id: string }>({ id, rows, start, create, update, saveLabel = 'Save case' }: {
  id: string;                     // panel id: a saved record's id, or a new-record id
  rows: T[];                      // the section's saved records
  start: Partial<T>;              // a new record's starting values (also saved with it)
  create: (values: Record<string, unknown>) => Promise<ActionResult>;
  update: (id: string, patch: Record<string, unknown>) => Promise<ActionResult>;
  saveLabel?: string;
}) {
  const isNewPanel = isNewRecord(id);
  const [draft] = useState(() => ({ ...start, id: NEW_RECORD, updated_at: '' }) as unknown as T);
  const [createdId, setCreatedId] = useState<string | null>(null);
  // Once created it is the saved record, even before the page has refreshed.
  const savedId = isNewPanel ? createdId : id;
  const saved = savedId ? rows.find((r) => r.id === savedId) ?? null : null;

  return {
    record: saved ?? (isNewPanel ? draft : null),
    saved,
    isNew: !savedId,
    // A second click on Save before the page refreshes updates instead of creating twice.
    save: async (patch: Record<string, unknown>): Promise<ActionResult> => {
      if (savedId) return update(savedId, patch);
      const result = await create({ ...start, ...patch });
      if (result.ok && result.id) setCreatedId(result.id);
      return result;
    },
    remove: (del: (id: string) => Promise<ActionResult>) => () => del(savedId!),
    // RecordDrawer settings while the record isn't saved yet.
    drawer: { canDelete: Boolean(savedId), saveLabel: savedId ? undefined : saveLabel },
  };
}
