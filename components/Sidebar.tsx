'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/app/auth/actions';
import { ADMIN_GROUP, SECTION_GROUPS, type NavGroup } from '@/lib/sections';
import { Icon, Logo } from './Icon';

type Props = {
  name: string;
  email: string;
  roleLabel: string;
  isSuperAdmin: boolean;
};

export function Sidebar({ name, email, roleLabel, isSuperAdmin }: Props) {
  const pathname = usePathname();
  const inAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const groups: NavGroup[] = inAdmin ? [ADMIN_GROUP] : SECTION_GROUPS;

  return (
    <nav
      aria-label="Main"
      className="flex flex-col gap-8 border-b border-peach-200 bg-white px-5 py-7 md:sticky md:top-0 md:h-screen md:w-[248px] md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0"
    >
      <Link href={inAdmin ? '/admin' : '/'} className="flex items-center gap-3 no-underline">
        <Logo />
        <span className="font-display text-lg leading-tight font-semibold">
          {inAdmin ? 'Experience Hub Dashboard' : 'Experience Hub'}
        </span>
      </Link>

      <div className="flex flex-col gap-6">
        {!inAdmin && <NavItem href="/" label="Home" icon="home" active={pathname === '/'} />}
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-1">
            <div className="px-3.5 pb-2 font-display text-[15px] font-semibold tracking-[0.03em] uppercase">
              {inAdmin ? 'Admin' : group.name}
            </div>
            {group.pages.map((page) => (
              <NavItem
                key={page.href}
                href={page.href}
                label={page.label}
                icon={page.icon}
                active={pathname === page.href}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        {inAdmin ? (
          <SwitchLink href="/" label="Back to Experience Hub" icon="back" />
        ) : (
          isSuperAdmin && <SwitchLink href="/admin" label="Switch to Experience Hub Dashboard" icon="arrow" />
        )}

        <div className="flex flex-col gap-2 rounded-[10px] bg-lilac-50 p-3.5">
          <div className="min-w-0">
            <div className="truncate font-semibold">{name || email}</div>
            <div className="truncate text-[13px] text-ink-muted">{email}</div>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-lilac-100 px-2.5 py-0.5">{roleLabel}</span>
            {isSuperAdmin && <span className="rounded-full bg-highlight px-2.5 py-0.5 font-semibold">Super-admin</span>}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="mt-1 flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[10px] border border-lilac-200 bg-white px-3.5 text-sm font-medium hover:bg-peach-50"
            >
              <Icon name="logout" size={18} />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}

function NavItem({ href, label, icon, active }: { href: string; label: string; icon: Parameters<typeof Icon>[0]['name']; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-[10px] px-3.5 no-underline ${
        active ? 'bg-lilac-100 font-semibold' : 'hover:bg-lilac-50'
      }`}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </Link>
  );
}

function SwitchLink({ href, label, icon }: { href: string; label: string; icon: 'arrow' | 'back' }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-2.5 rounded-[10px] border border-lilac-200 px-3.5 text-sm font-medium no-underline hover:bg-lilac-50"
    >
      <Icon name={icon} size={18} />
      <span>{label}</span>
    </Link>
  );
}
