'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { FilterMulti, FilterSelect, usePopover } from '@/components/ui/Dropdowns';
import { inRange } from '@/lib/qa/stats';
import { QA_SOURCES, VALIDITY_VALUES, caseIssue, type QaSource } from '@/lib/qa/types';
import { CaseTable } from './CaseTable';
import { useQa } from './QaShell';

export function CaseLogView() {
  const { data, range, courseNames, instructorName } = useQa();
  const [sources, setSources] = useState<string[]>([]);
  const [analyst, setAnalyst] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [validity, setValidity] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Columns and filters that none of the selected sources use are hidden
  // (Survey and Returned have no analyst or resolution; Returned has no validity).
  const shown = (sources.length ? sources : QA_SOURCES) as readonly string[];
  const hasAnalyst = shown.some((s) => s === 'Instructor' || s === 'Course');
  const hasOutcome = shown.some((s) => s !== 'Returned');
  const hasResolution = hasAnalyst;
  const analysts = useMemo(() => [...new Set(data.cases.map((c) => c.analyst).filter(Boolean) as string[])].sort(), [data.cases]);
  const categories = useMemo(() => {
    const listed = [...(data.options.qa_category_instructor ?? []), ...(data.options.qa_category_course ?? [])];
    const used = data.cases.map((c) => c.category).filter(Boolean) as string[];
    return [...new Set([...listed, ...used])];
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.cases.filter((c) => {
      if (!inRange(c.case_date, range)) return false;
      if (sources.length && !sources.includes(c.source)) return false;
      if (analyst && hasAnalyst && c.analyst !== analyst) return false;
      if (category && c.category !== category) return false;
      if (validity && hasOutcome && c.validity !== validity) return false;
      if (!q) return true;
      return [c.customer_name, courseNames(c), instructorName(c.instructor_id), c.analyst,
        caseIssue(c), c.survey_id, c.notes, c.customer_comment]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [data.cases, range, sources, analyst, hasAnalyst, hasOutcome, category, validity, query, courseNames, instructorName]);

  const inDateRange = data.cases.filter((c) => inRange(c.case_date, range)).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <FilterMulti label="Source" allLabel="All sources" options={[...QA_SOURCES]} value={sources} onChange={setSources} />
        {hasAnalyst && <FilterSelect label="Analyst" allLabel="All analysts" options={analysts} value={analyst} onChange={setAnalyst} />}
        <FilterSelect label="Category" allLabel="All categories" options={categories} value={category} onChange={setCategory} />
        {hasOutcome && <FilterSelect label="Validity" allLabel="All validity" options={[...VALIDITY_VALUES]} value={validity} onChange={setValidity} />}
        <label className="flex h-11 w-full items-center gap-2 rounded-[10px] border border-lilac-200 bg-white px-3.5 sm:w-72">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4" />
          </svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, course, instructor"
            aria-label="Search cases" className="w-full border-0 bg-transparent text-sm outline-none" />
        </label>
        {data.canEdit && <AddCaseButton />}
        <span className="ml-auto text-sm text-ink-muted">Showing {filtered.length} of {inDateRange} cases</span>
      </div>
      <CaseTable cases={filtered} columns={([
        'date', 'source', 'course', 'instructor', 'analyst', 'issue', 'validity', 'follow',
      ] as const).filter((c) => (c !== 'analyst' || hasAnalyst) && (c !== 'validity' || hasOutcome) && (c !== 'follow' || hasResolution))} />
    </div>
  );
}

export function AddCaseButton() {
  const { addCase, adding } = useQa();
  const { open, setOpen, ref } = usePopover();
  const labels: Record<QaSource, string> = {
    Instructor: 'Instructor complaint', Course: 'Course complaint', Survey: 'Survey record', Returned: 'Returned case',
  };
  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={adding} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}
        className="flex h-11 cursor-pointer items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold disabled:cursor-wait disabled:opacity-60">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14 M5 12h14" /></svg>
        {adding ? 'Adding…' : 'Add case'}
      </button>
      {open && (
        <div role="listbox" aria-label="Choose a case type"
          className="absolute top-[52px] left-0 z-30 flex w-56 flex-col gap-0.5 rounded-xl border border-lilac-200 bg-white p-2 shadow-[0_12px_32px_rgba(45,21,89,0.16)]">
          <div className="px-2.5 pt-1.5 pb-1 text-xs tracking-wide text-ink-muted uppercase">New case type</div>
          {QA_SOURCES.map((s) => (
            <button key={s} type="button" role="option" aria-selected={false} onClick={() => { setOpen(false); addCase(s); }}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-sm hover:bg-lilac-50">
              <Icon name="list" size={16} />
              {labels[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
