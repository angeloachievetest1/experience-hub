import Link from 'next/link';
import { AccessCheck } from '@/components/AccessCheck';
import { Icon } from '@/components/Icon';
import { Card, PageHeader } from '@/components/PageHeader';
import { canWriteSection, requireActiveProfile } from '@/lib/auth';
import { SECTION_GROUPS, SECTION_KEYS, SECTION_NAMES, type SectionKey } from '@/lib/sections';

export const metadata = { title: 'Home' };

export default async function HomePage() {
  const profile = await requireActiveProfile();
  const firstName = profile.full_name.split(' ')[0] || profile.email;
  const expected = Object.fromEntries(
    SECTION_KEYS.map((key) => [key, canWriteSection(profile, key)]),
  ) as Record<SectionKey, boolean>;
  const editable = SECTION_KEYS.filter((key) => expected[key]);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title={`Welcome, ${firstName}`} subtitle="Case tracking for the Quality Analyst, Curriculum and Mentor teams." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="flex flex-col gap-5">
          <h2 className="m-0 font-display text-[22px] font-normal">Your access</h2>
          <dl className="m-0 grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm">
            <dt className="text-ink-muted">Role</dt>
            <dd className="m-0 font-semibold">{profile.role === 'admin' ? 'Admin' : 'Viewer'}</dd>
            <dt className="text-ink-muted">Can edit</dt>
            <dd className="m-0">
              {editable.length ? editable.map((key) => SECTION_NAMES[key]).join(', ') : 'Nothing (read only)'}
            </dd>
            <dt className="text-ink-muted">Can read</dt>
            <dd className="m-0">All three sections</dd>
            <dt className="text-ink-muted">Super-admin</dt>
            <dd className="m-0">{profile.is_super_admin ? 'Yes — can open the Experience Hub Dashboard' : 'No'}</dd>
            {profile.department && (
              <>
                <dt className="text-ink-muted">Department</dt>
                <dd className="m-0">{profile.department}</dd>
              </>
            )}
          </dl>
        </Card>

        <Card className="flex flex-col gap-5">
          <h2 className="m-0 font-display text-[22px] font-normal">Check with the database</h2>
          <AccessCheck expected={expected} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {SECTION_GROUPS.map((group) => (
          <Link
            key={group.key}
            href={group.pages[0].href}
            className="group flex flex-col gap-2 rounded-2xl border border-peach-200 bg-white p-6 no-underline hover:border-secondary"
          >
            <span className="flex items-center justify-between font-display text-[22px]">
              {group.name}
              <Icon name="arrow" size={18} />
            </span>
            <span className="text-sm text-ink-muted">{group.pages.map((p) => p.label).join(' · ')}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
