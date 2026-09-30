import { ListsPage } from '@/components/admin/AdminShells';
import { loadLists } from '@/lib/admin/data';
import { findPage } from '@/lib/sections';

const page = findPage('/admin/case-options');
export const metadata = { title: page.title };

export default async function Page() {
  const data = await loadLists();
  return <ListsPage data={data} title={page.title} subtitle={page.subtitle} />;
}
