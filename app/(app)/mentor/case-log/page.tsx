import { MentorCaseLogView } from '@/components/mentor/MentorCaseLogView';
import { MentorShell } from '@/components/mentor/MentorShell';
import { loadMentorData } from '@/lib/mentor/data';
import { findPage } from '@/lib/sections';

const page = findPage('/mentor/case-log');
export const metadata = { title: page.title };

export default async function Page() {
  const data = await loadMentorData();
  return (
    <MentorShell data={data} title={page.title} subtitle={page.subtitle}>
      <MentorCaseLogView />
    </MentorShell>
  );
}
