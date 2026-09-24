import { notFound } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth';

// The Admin Dashboard exists only for super-admins. Everyone else gets a 404.
// (The data behind it is also protected by row-level security.)
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile?.is_super_admin || profile.status !== 'active') notFound();
  return children;
}
