'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createQaCase } from '@/app/(app)/quality-analyst/actions';
import { PageHeader } from '@/components/PageHeader';
import { DateRangeButton } from '@/components/ui/DateRange';
import { ALL_TIME, type DateRange } from '@/lib/qa/stats';
import type { QaCase, QaData, QaSource } from '@/lib/qa/types';
import { CaseDrawer } from './CaseDrawer';

type QaContext = {
  data: QaData;
  range: DateRange;
  setRange: (r: DateRange) => void;
  openCase: (id: string) => void;
  addCase: (source: QaSource) => void;
  adding: boolean;
  courseName: (id: string | null) => string;
  instructorName: (id: string | null) => string;
  courseNames: (c: QaCase) => string;
};

const Ctx = createContext<QaContext | null>(null);

export function useQa() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useQa must be used inside QaShell');
  return ctx;
}

const RANGE_KEY = 'eh.qa.range';

// Frame for every Quality Analyst page: header with the date range, shared
// data, and the case detail panel.
export function QaShell({
  data, title, subtitle, showRange = true, children,
}: { data: QaData; title: string; subtitle: string; showRange?: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const [range, setRangeState] = useState<DateRange>(ALL_TIME);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  // Remember the date range while moving between Quality Analyst pages.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(RANGE_KEY);
      if (saved) setRangeState(JSON.parse(saved));
    } catch { /* storage unavailable: start with all time */ }
  }, []);
  const setRange = useCallback((r: DateRange) => {
    setRangeState(r);
    try { sessionStorage.setItem(RANGE_KEY, JSON.stringify(r)); } catch { /* ignore */ }
  }, []);

  const lookups = useMemo(() => {
    const courses = new Map(data.courses.map((c) => [c.id, c.name]));
    const instructors = new Map(data.instructors.map((i) => [i.id, i.name]));
    const courseName = (id: string | null) => (id ? courses.get(id) ?? 'Unknown course' : '');
    return {
      courseName,
      instructorName: (id: string | null) => (id ? instructors.get(id) ?? 'Unknown instructor' : ''),
      courseNames: (c: QaCase) =>
        c.source === 'Returned' ? c.course_ids.map(courseName).sort().join(', ') : courseName(c.course_id),
    };
  }, [data.courses, data.instructors]);

  const addCase = useCallback((source: QaSource) => {
    setError(null);
    startAdding(async () => {
      const result = await createQaCase(source);
      if (!result.ok) { setError(result.error); return; }
      setSelected(result.id ?? null);
      router.refresh();
    });
  }, [router]);

  const value: QaContext = { data, range, setRange, openCase: setSelected, addCase, adding, ...lookups };

  return (
    <Ctx.Provider value={value}>
      <div className="flex flex-col gap-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageHeader title={title} subtitle={subtitle} />
          <div className="flex flex-wrap items-center gap-3">
            {data.cases.some((c) => c.is_sample) && (
              <span className="rounded-full border border-lilac-200 bg-white px-3.5 py-2 text-[13px] text-ink-muted">Includes sample records</span>
            )}
            {showRange && <DateRangeButton value={range} onChange={setRange} />}
          </div>
        </div>
        {error && (
          <p role="alert" className="m-0 rounded-[10px] border border-primary bg-peach-100 px-4 py-3 text-sm">{error}</p>
        )}
        {children}
      </div>
      {selected && <CaseDrawer key={selected} id={selected} onClose={() => setSelected(null)} />}
    </Ctx.Provider>
  );
}
