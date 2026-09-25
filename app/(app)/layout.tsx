import { Sidebar } from '@/components/Sidebar';
import { requireActiveProfile } from '@/lib/auth';

// Every signed-in page. Deactivated users are signed out here.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireActiveProfile();

  return (
    <div className="min-h-screen md:flex">
      <Sidebar
        name={profile.full_name}
        email={profile.email}
        roleLabel={profile.role === 'admin' ? 'Admin' : 'Viewer'}
        isSuperAdmin={profile.is_super_admin}
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:pt-6 md:pb-10">{children}</main>
    </div>
  );
}
