import { FollowUpView } from '@/components/qa/FollowUpView';
import { QaShell } from '@/components/qa/QaShell';
import { loadQaData } from '@/lib/qa/data';
import { findPage } from '@/lib/sections';

const page = findPage('/quality-analyst/resolution');
export const metadata = { title: page.title };

export default async function Page() {
  const data = await loadQaData();
  return (
    <QaShell data={data} title={page.title} subtitle={page.subtitle}>
      <FollowUpView />
    </QaShell>
  );
}
