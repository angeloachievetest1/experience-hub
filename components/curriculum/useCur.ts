'use client';

import { useMemo } from 'react';
import { useShell } from '@/components/records/SectionShell';
import type { CurData } from '@/lib/curriculum/types';
import type { ActionResult } from '@/lib/records/sanitize';

// Panel ids carry the record type: "case:<id>" or "req:<id>".
export const caseKey = (id: string) => `case:${id}`;
export const reqKey = (id: string) => `req:${id}`;

// Turns a create action's new id into a panel id.
export function withKey(prefix: (id: string) => string) {
  return async (p: Promise<ActionResult>): Promise<ActionResult> => {
    const r = await p;
    return r.ok && r.id ? { ...r, id: prefix(r.id) } : r;
  };
}

export function useCur() {
  const shell = useShell<CurData>();
  const courseName = useMemo(() => {
    const map = new Map(shell.data.courses.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? map.get(id) ?? 'Unknown course' : '');
  }, [shell.data.courses]);
  return { ...shell, courseName };
}
