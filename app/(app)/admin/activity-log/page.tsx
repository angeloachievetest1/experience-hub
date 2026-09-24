import { ActivityPage } from '@/components/admin/AdminShells';
import { loadActivity } from '@/lib/admin/data';
import { findPage } from '@/lib/sections';

const page = findPage('/admin/activity-log');
export const metadata = { title: page.title };

export default async function Page() {
  const data = await loadActivity();
  return <ActivityPage data={data} title={page.title} subtitle={page.subtitle} />;
}
