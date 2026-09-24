// Lightweight charts drawn with plain HTML/CSS, styled after the prototype.

export function Panel({
  title, aside, children, className = '',
}: { title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col gap-5 rounded-2xl border border-peach-200 bg-white p-6 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 font-display text-[22px] font-normal">{title}</h2>
        {aside && <div className="text-[13px] text-ink-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function Kpi({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-peach-200 bg-white p-6">
      <div className="text-sm text-ink-muted">{label}</div>
      <div className="font-display text-[44px] leading-[1.1] font-light">{value}</div>
      {note && <div className="text-sm text-ink-muted">{note}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-ink-muted">{children}</div>;
}

export type BarItem = { name: string; value: number; color?: string };

export function BarList({ items, empty = 'No cases in this selection.', color = '#9F7DFF', compact = false }: {
  items: BarItem[]; empty?: string; color?: string; compact?: boolean;
}) {
  if (!items.length) return <Empty>{empty}</Empty>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className={`flex flex-col ${compact ? 'gap-3' : 'gap-4'}`}>
      {items.map((i) => (
        <div key={i.name} className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-3 text-sm">
            <span>{i.name}</span>
            <span className="font-semibold">{i.value}</span>
          </div>
          <div className="h-2.5 rounded-md bg-lilac-50">
            <div className="h-2.5 rounded-md" style={{ width: `${(i.value / max) * 100}%`, background: i.color ?? color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { name: string; color: string; hatched?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
      {items.map((l) => (
        <div key={l.name} className="flex items-center gap-2">
          <span
            className="size-3 rounded-[3px] border border-ink/40"
            style={l.hatched ? { background: HATCH } : { background: l.color }}
            aria-hidden="true"
          />
          <span>{l.name}</span>
        </div>
      ))}
    </div>
  );
}

export const HATCH = 'repeating-linear-gradient(135deg, #F6F3FF 0 5px, #DDD1FF 5px 7px)';

export type Column = {
  key: string;
  label: string;
  segments: { name: string; color: string; value: number }[];
  missing?: string | null; // whole column has no data: shown as a gap, not zero
  partial?: string | null; // some of the data is missing
};

// Stacked columns. Missing periods are drawn as a hatched "No data" gap.
export function ColumnChart({ columns, height = 220 }: { columns: Column[]; height?: number }) {
  if (!columns.length) return <Empty>No cases in this date range.</Empty>;
  const totals = columns.map((c) => c.segments.reduce((a, s) => a + s.value, 0));
  const max = Math.max(...totals, 1);
  const wide = columns.length > 14;
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-end gap-2.5" style={{ height: height + 44, minWidth: wide ? columns.length * 44 : undefined }}>
        {columns.map((c, i) => {
          const total = totals[i];
          const label = `${c.label}: ${c.missing ? 'no data' : total}${c.partial ? ` (${c.partial})` : ''}`;
          return (
            <div key={c.key} className="flex min-w-7 flex-1 flex-col items-center justify-end gap-1.5" title={c.missing ?? c.partial ?? undefined} aria-label={label} role="img">
              {c.missing ? (
                <>
                  <div className="text-[11px] font-semibold text-ink-muted">No data</div>
                  <div className="w-full rounded-t-md border border-dashed border-lilac-200" style={{ height: height * 0.5, background: HATCH }} />
                </>
              ) : (
                <>
                  <div className="text-[13px] font-semibold">
                    {total}
                    {c.partial && <span className="text-primary" aria-hidden="true">*</span>}
                  </div>
                  <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-md" style={{ height: (total / max) * height }}>
                    {c.segments.filter((s) => s.value > 0).map((s) => (
                      <div key={s.name} style={{ height: `${(s.value / total) * 100}%`, background: s.color }} className="w-full border-t border-white" />
                    ))}
                  </div>
                </>
              )}
              <div className="text-xs whitespace-nowrap text-ink-muted">{c.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Rows × columns table with shaded cells.
export function HeatTable({
  rows, cols, value, missingCols = [], rowHeader,
}: {
  rows: string[]; cols: { key: string; label: string; sub?: string }[]; value: (row: string, col: string) => number;
  missingCols?: string[]; rowHeader: string;
}) {
  if (!rows.length || !cols.length) return <Empty>No survey records in this date range.</Empty>;
  const max = Math.max(1, ...rows.flatMap((r) => cols.map((c) => value(r, c.key))));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 bg-white py-2 pr-3 text-left text-xs font-normal tracking-wide text-ink-muted uppercase">{rowHeader}</th>
            {cols.map((c) => (
              <th key={c.key} scope="col" className="px-1.5 py-2 text-center align-bottom text-xs font-normal text-ink-muted">
                <span className="block font-semibold whitespace-nowrap text-ink">{c.label}</span>
                {c.sub && <span className="mx-auto block max-w-24 leading-tight">{c.sub}</span>}
              </th>
            ))}
            <th scope="col" className="px-1.5 py-2 text-right text-xs font-normal text-ink-muted">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const total = cols.reduce((a, c) => a + value(r, c.key), 0);
            return (
              <tr key={r} className="border-t border-lilac-50">
                <th scope="row" className="sticky left-0 min-w-40 bg-white py-2 pr-3 text-left font-normal">{r}</th>
                {cols.map((c) => {
                  const v = value(r, c.key);
                  const gap = missingCols.includes(c.key);
                  return (
                    <td key={c.key} className="p-1 text-center">
                      <div
                        className="flex h-8 min-w-9 items-center justify-center rounded-md text-[13px]"
                        style={gap ? { background: HATCH } : { background: v ? `rgba(159,125,255,${0.15 + (v / max) * 0.85})` : '#F6F3FF', color: v / max > 0.6 ? '#fff' : undefined }}
                      >
                        {gap ? '' : v || ''}
                      </div>
                    </td>
                  );
                })}
                <td className="p-1 text-right font-semibold">{total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Two-part ring, e.g. reached vs not reached.
export function Donut({ a, b, aLabel, bLabel, aColor = '#FF4500', bColor = '#9F7DFF' }: {
  a: number; b: number; aLabel: string; bLabel: string; aColor?: string; bColor?: string;
}) {
  const total = a + b;
  const aPct = total ? Math.round((a / total) * 100) : 0;
  return (
    <div className="relative size-[200px] shrink-0" role="img" aria-label={`${aLabel} ${aPct}%, ${bLabel} ${100 - aPct}%`}>
      <div className="size-full rounded-full" style={{ background: `conic-gradient(${aColor} 0 ${aPct}%, ${bColor} ${aPct}% 100%)` }} />
      <div className="absolute inset-5 flex items-center justify-center gap-3 rounded-full bg-white">
        <div className="text-center">
          <div className="font-display text-[22px] leading-tight font-semibold" style={{ color: aColor }}>{aPct}%</div>
          <div className="text-[11px] text-ink-muted">{aLabel}</div>
        </div>
        <div className="w-px self-stretch bg-lilac-50" />
        <div className="text-center">
          <div className="font-display text-[22px] leading-tight font-semibold" style={{ color: bColor }}>{total ? 100 - aPct : 0}%</div>
          <div className="text-[11px] text-ink-muted">{bLabel}</div>
        </div>
      </div>
    </div>
  );
}
