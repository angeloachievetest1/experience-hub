import { CurDashboardView } from '@/components/curriculum/CurDashboardView';
import { CurShell } from '@/components/curriculum/CurShell';
import { loadCurriculumData } from '@/lib/curriculum/data';
import { findPage } from '@/lib/sections';

const page = findPage('/curriculum');
export const metadata = { title: page.title };

export default async function Page() {
  const data = await loadCurriculumData();
  return (
    <CurShell data={data} title={page.title} subtitle={page.subtitle}>
      <CurDashboardView />
    </CurShell>
  );
}
