'use client';

import { useMemo, useState } from 'react';
import { createCustomerCase } from '@/app/(app)/curriculum/actions';
import { RecordTable } from '@/components/records/RecordTable';
import { FilterSelect } from '@/components/ui/Dropdowns';
import { AddButton, SearchBox, matches } from '@/components/ui/SearchBox';
import { formatDate, inRange } from '@/lib/qa/stats';
import { resolutionDays } from '@/lib/curriculum/types';
import { customerLabel } from '@/lib/records/labels';
import { caseKey, useCur, withKey } from './useCur';

const distinct = (values: (string | null)[]) => [...new Set(values.filter(Boolean) as string[])].sort();

export function CurCaseLogView() {
  const { data, range, open, add, adding, courseName } = useCur();
  const [category, setCategory] = useState<string | null>(null);
  const [material, setMaterial] = useState<string | null>(null);
  const [sme, setSme] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const inDates = useMemo(() => data.cases.filter((c) => inRange(c.case_date, range)), [data.cases, range]);
  const rows = inDates.filter((c) =>
    (!category || c.category === category) &&
    (!material || c.material_type === material) &&
    (!sme || c.curriculum_sme === sme) &&
    matches(query, [c.customer_name, courseName(c.course_id), c.comments, c.feedback_progress, c.curriculum_sme]));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect label="Category" allLabel="All categories" value={category} onChange={setCategory}
          options={distinct([...(data.options.cur_category ?? []), ...data.cases.map((c) => c.category)])} />
        <FilterSelect label="Material type" allLabel="All types" value={material} onChange={setMaterial}
          options={distinct(data.cases.map((c) => c.material_type))} />
        <FilterSelect label="Curriculum SME" allLabel="All SMEs" value={sme} onChange={setSme}
          options={distinct(data.cases.map((c) => c.curriculum_sme))} />
        <SearchBox value={query} onChange={setQuery} placeholder="Search customer, course, comment" label="Search curriculum cases" />
        {data.canEdit && <AddButton label="Add case" busy={adding} onClick={() => add(() => withKey(caseKey)(createCustomerCase()))} />}
        <span className="ml-auto text-sm text-ink-muted">Showing {rows.length} of {inDates.length} cases</span>
      </div>
      <RecordTable
        rows={rows}
        leading={{ key: 'date', header: 'Date', render: (c) => <span className="whitespace-nowrap">{formatDate(c.case_date) || '—'}</span> }}
        label={customerLabel}
        link={(c) => c.case_link}
        onOpen={(id) => open(caseKey(id))}
        columns={[
          { key: 'category', header: 'Category', render: (c) => c.category || '—' },
          { key: 'course', header: 'Course', render: (c) => courseName(c.course_id) || '—' },
          { key: 'material', header: 'Material type', render: (c) => c.material_type || '—' },
          { key: 'sme', header: 'Curriculum SME', render: (c) => c.curriculum_sme || '—' },
          { key: 'tat', header: 'TAT', render: (c) => { const d = resolutionDays(c); return d === null ? '—' : `${d} d`; } },
          { key: 'comment', header: 'Comment', render: (c) => <span className="line-clamp-2 max-w-72 text-ink-muted">{c.comments || '—'}</span> },
        ]}
      />
    </div>
  );
}
