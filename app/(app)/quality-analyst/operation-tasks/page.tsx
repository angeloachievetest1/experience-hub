import { AuditShell } from '@/components/qa/AuditShell';
import { AuditDashboardView } from '@/components/qa/AuditDashboardView';
import { loadAuditData } from '@/lib/qa/audit-data';
import { findPage } from '@/lib/sections';

const page = findPage('/quality-analyst/operation-tasks');
export const metadata = { title: page.title };

export default async function Page() {
  const data = await loadAuditData();
  return (
    <AuditShell data={data} title={page.title} subtitle={page.subtitle}>
      <AuditDashboardView />
    </AuditShell>
  );
}
