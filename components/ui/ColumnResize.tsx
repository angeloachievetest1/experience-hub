'use client';

import { useEffect, useRef, useState } from 'react';

// Tables whose columns can be made wider or narrower: drag the line at the
// right edge of a column heading (or focus it and use the arrow keys), and
// double-click it to go back to the original widths. Widths are remembered in
// this browser for each table. The last column takes whatever space is left.
const MIN = 60;
const LAST_MIN = 120;
const STEP = 20;

type Widths = Record<string, number>;

export function useColumnWidths(storageKey: string, keys: string[]) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [widths, setWidths] = useState<Widths | null>(null);
  const storage = `eh.cols.${storageKey}`;
  const last = keys[keys.length - 1];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storage);
      setWidths(saved ? JSON.parse(saved) : null);
    } catch { setWidths(null); }
  }, [storage]);

  const persist = (w: Widths | null) => {
    try {
      if (w) localStorage.setItem(storage, JSON.stringify(w)); else localStorage.removeItem(storage);
    } catch { /* storage unavailable: widths last until the page reloads */ }
  };

  // The widths the columns have on screen right now (all but the last).
  const measure = (): Widths => {
    const out: Widths = {};
    tableRef.current?.querySelectorAll<HTMLElement>(':scope > thead th[data-col]').forEach((th) => {
      if (th.dataset.col !== last) out[th.dataset.col!] = Math.round(th.getBoundingClientRect().width);
    });
    return out;
  };

  const startDrag = (key: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const base = measure();
    const startX = e.clientX;
    let latest: Widths | null = null; // stays null for a click without a drag: nothing to remember
    const move = (ev: PointerEvent) => {
      latest = { ...base, [key]: Math.max(MIN, base[key] + ev.clientX - startX) };
      setWidths(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (latest) persist(latest);
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  const nudge = (key: string, delta: number) => {
    const base = measure();
    const next = { ...base, [key]: Math.max(MIN, base[key] + delta) };
    setWidths(next);
    persist(next);
  };

  const reset = () => { setWidths(null); persist(null); };

  const resized = widths !== null;
  const total = keys.filter((k) => k !== last).reduce((sum, k) => sum + (widths?.[k] ?? MIN), 0) + LAST_MIN;

  return {
    tableRef,
    resized,
    // Spread onto the <table>: fixed widths once a column has been resized.
    tableStyle: resized ? { tableLayout: 'fixed' as const, width: '100%', minWidth: total } : undefined,
    tableClass: resized ? 'cols-resized' : '',
    colgroup: resized ? (
      <colgroup>
        {keys.map((k) => <col key={k} style={k !== last && widths[k] ? { width: widths[k] } : undefined} />)}
      </colgroup>
    ) : null,
    // Put inside each <th data-col={key} className="relative …">.
    handle: (key: string, label: string) => key === last ? null : (
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize the ${label} column`}
        title="Drag to resize. Double-click to reset all columns."
        tabIndex={0}
        onPointerDown={(e) => startDrag(key, e)}
        onDoubleClick={reset}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); nudge(key, STEP); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(key, -STEP); }
        }}
        className="group absolute top-0 -right-1.5 z-10 flex h-full w-3 cursor-col-resize touch-none justify-center outline-none"
      >
        <span className="my-2 w-px rounded bg-lilac-200 group-hover:w-[3px] group-hover:bg-secondary group-focus-visible:w-[3px] group-focus-visible:bg-secondary" />
      </span>
    ),
  };
}
