import { CurCaseLogView } from '@/components/curriculum/CurCaseLogView';
import { CurShell } from '@/components/curriculum/CurShell';
import { loadCurriculumData } from '@/lib/curriculum/data';
import { findPage } from '@/lib/sections';

const page = findPage('/curriculum/case-log');
export const metadata = { title: page.title };

export default async function Page() {
  const data = await loadCurriculumData();
  return (
    <CurShell data={data} title={page.title} subtitle={page.subtitle}>
      <CurCaseLogView />
    </CurShell>
  );
}
