'use client';

import { useMemo } from 'react';
import { useShell } from '@/components/records/SectionShell';
import type { CurData } from '@/lib/curriculum/types';

// Panel ids carry the record type: "case:<id>" or "req:<id>".
export const caseKey = (id: string) => `case:${id}`;
export const reqKey = (id: string) => `req:${id}`;

export function useCur() {
  const shell = useShell<CurData>();
  const courseName = useMemo(() => {
    const map = new Map(shell.data.courses.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? map.get(id) ?? 'Unknown course' : '');
  }, [shell.data.courses]);
  return { ...shell, courseName };
}
