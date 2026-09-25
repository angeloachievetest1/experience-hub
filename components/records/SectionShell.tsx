'use client';

import { createContext, useCallback, useContext, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { DateRangeButton } from '@/components/ui/DateRange';
import { ALL_TIME, type DateRange } from '@/lib/qa/stats';
import type { ActionResult } from '@/lib/records/sanitize';

type ShellContext<T> = {
  data: T;
  range: DateRange;
  setRange: (r: DateRange) => void;
  openId: string | null;
  open: (id: string) => void;
  close: () => void;
  adding: boolean;
  // Creates a record, then opens it once the page has refreshed.
  add: (create: () => Promise<ActionResult>) => void;
};

const Ctx = createContext<ShellContext<unknown> | null>(null);

export function useShell<T>() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useShell must be used inside SectionShell');
  return ctx as ShellContext<T>;
}

// Frame shared by every section page: header, date range (remembered while
// moving between the section's pages), errors, and the record panel.
export function SectionShell<T>({
  data, title, subtitle, rangeKey, showRange = true, hasSample = false, renderDrawer, children,
}: {
  data: T;
  title: string;
  subtitle: string;
  rangeKey: string;
  showRange?: boolean;
  hasSample?: boolean;
  renderDrawer: (id: string, close: () => void) => React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [range, setRangeState] = useState<DateRange>(ALL_TIME);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(rangeKey);
      if (saved) setRangeState(JSON.parse(saved));
    } catch { /* storage unavailable: start with all time */ }
  }, [rangeKey]);

  const setRange = useCallback((r: DateRange) => {
    setRangeState(r);
    try { sessionStorage.setItem(rangeKey, JSON.stringify(r)); } catch { /* ignore */ }
  }, [rangeKey]);

  const add = useCallback((create: () => Promise<ActionResult>) => {
    setError(null);
    startAdding(async () => {
      const result = await create();
      if (!result.ok) { setError(result.error); return; }
      setOpenId(result.id ?? null);
      router.refresh();
    });
  }, [router]);

  const close = useCallback(() => setOpenId(null), []);
  const value: ShellContext<T> = { data, range, setRange, openId, open: setOpenId, close, adding, add };

  return (
    <Ctx.Provider value={value as ShellContext<unknown>}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageHeader title={title} subtitle={subtitle} />
          <div className="flex flex-wrap items-center gap-3">
            {hasSample && (
              <span className="rounded-full border border-lilac-200 bg-white px-3 py-1.5 text-[13px] text-ink-muted">Includes sample records</span>
            )}
            {showRange && <DateRangeButton value={range} onChange={setRange} />}
          </div>
        </div>
        {error && <p role="alert" className="m-0 rounded-[10px] border border-primary bg-peach-100 px-4 py-3 text-sm">{error}</p>}
        {children}
      </div>
      {openId && <div key={openId}>{renderDrawer(openId, close)}</div>}
    </Ctx.Provider>
  );
}
