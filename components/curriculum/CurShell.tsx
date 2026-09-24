'use client';

import { SectionShell } from '@/components/records/SectionShell';
import type { CurData } from '@/lib/curriculum/types';
import { CustomerCaseDrawer, RequestDrawer } from './CurDrawers';

export function CurShell({ data, title, subtitle, children }: {
  data: CurData; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <SectionShell
      data={data}
      title={title}
      subtitle={subtitle}
      rangeKey="eh.cur.range"
      hasSample={data.cases.some((c) => c.is_sample) || data.requests.some((r) => r.is_sample)}
      renderDrawer={(key, close) => {
        const [type, id] = key.split(':');
        return type === 'case' ? <CustomerCaseDrawer id={id} onClose={close} /> : <RequestDrawer id={id} onClose={close} />;
      }}
    >
      {children}
    </SectionShell>
  );
}
