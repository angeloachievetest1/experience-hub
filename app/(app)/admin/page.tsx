import { UsersPage } from '@/components/admin/AdminShells';
import { loadUsers } from '@/lib/admin/data';
import { findPage } from '@/lib/sections';

const page = findPage('/admin');
export const metadata = { title: page.title };

export default async function Page() {
  const data = await loadUsers();
  return <UsersPage data={data} title={page.title} subtitle={page.subtitle} />;
}
