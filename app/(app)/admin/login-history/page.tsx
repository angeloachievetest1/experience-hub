import { LoginsPage } from '@/components/admin/AdminShells';
import { loadLogins } from '@/lib/admin/data';
import { findPage } from '@/lib/sections';

const page = findPage('/admin/login-history');
export const metadata = { title: page.title };

export default async function Page() {
  const data = await loadLogins();
  return <LoginsPage data={data} title={page.title} subtitle={page.subtitle} />;
}
