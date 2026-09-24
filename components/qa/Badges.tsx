import { FOLLOW_STYLE, SOURCE_COLORS, VALIDITY_BADGE, followState, type QaCase, type QaSource } from '@/lib/qa/types';

export function SourceTag({ source }: { source: QaSource }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: SOURCE_COLORS[source] }} aria-hidden="true" />
      <span>{source}</span>
    </span>
  );
}

export function ValidityBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-ink-muted">—</span>;
  return (
    <span className="inline-block rounded-full px-2.5 py-1 text-[13px] whitespace-nowrap" style={{ background: VALIDITY_BADGE[value] ?? '#F6F3FF' }}>
      {value}
    </span>
  );
}

export function FollowBadge({ c }: { c: QaCase }) {
  const state = followState(c);
  if (!state) return <span className="text-ink-muted">—</span>;
  const s = FOLLOW_STYLE[state];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] whitespace-nowrap" style={{ background: s.bg }}>
      <span className="size-2 rounded-full" style={{ background: s.dot }} aria-hidden="true" />
      {state}
    </span>
  );
}

export function SampleTag() {
  return <span className="rounded-full bg-highlight px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase">Sample</span>;
}
