import { DashboardView } from '@/components/qa/DashboardView';
import { QaShell } from '@/components/qa/QaShell';
import { loadQaData } from '@/lib/qa/data';
import { findPage } from '@/lib/sections';

const page = findPage('/quality-analyst');
export const metadata = { title: page.title };

export default async function Page() {
  const data = await loadQaData();
  return (
    <QaShell data={data} title={page.title} subtitle={page.subtitle}>
      <DashboardView />
    </QaShell>
  );
}
