import { CurShell } from '@/components/curriculum/CurShell';
import { RequestsView } from '@/components/curriculum/RequestsView';
import { loadCurriculumData } from '@/lib/curriculum/data';
import { findPage } from '@/lib/sections';

const page = findPage('/curriculum/instructor-requests');
export const metadata = { title: page.title };

export default async function Page() {
  const data = await loadCurriculumData();
  return (
    <CurShell data={data} title={page.title} subtitle={page.subtitle}>
      <RequestsView />
    </CurShell>
  );
}
