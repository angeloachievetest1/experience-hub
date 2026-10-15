'use client';

import { useMemo } from 'react';
import { SectionShell, useShell } from '@/components/records/SectionShell';
import { NEW_RECORD } from '@/components/records/useNewRecord';
import type { QaCase, QaData, QaSource } from '@/lib/qa/types';
import { CaseDrawer } from './CaseDrawer';

// Quality Analyst pages: the shared section frame plus QA-specific helpers.
export function QaShell({
  data, title, subtitle, showRange = true, children,
}: { data: QaData; title: string; subtitle: string; showRange?: boolean; children: React.ReactNode }) {
  return (
    <SectionShell
      data={data}
      title={title}
      subtitle={subtitle}
      rangeKey="eh.qa.range"
      showRange={showRange}
      renderDrawer={(id, close) => <CaseDrawer id={id} onClose={close} />}
    >
      {children}
    </SectionShell>
  );
}

export function useQa() {
  const shell = useShell<QaData>();
  const { data } = shell;
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

  return {
    data,
    range: shell.range,
    setRange: shell.setRange,
    openCase: shell.open,
    // A blank case of that source, saved only by its Save case button.
    addCase: (source: QaSource) => shell.open(`${NEW_RECORD}:${source}`),
    ...lookups,
  };
}
