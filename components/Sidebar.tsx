'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/app/auth/actions';
import { ADMIN_GROUP, SECTION_GROUPS, START_PAGE, type NavGroup } from '@/lib/sections';
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
  // On small screens the menu folds away behind a Menu button.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <nav
      aria-label="Main"
      className="flex flex-col gap-3 border-b border-peach-200 bg-white px-4 py-3 md:sticky md:top-0 md:h-screen md:w-[220px] md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0 md:py-4"
    >
      <div className="flex items-center justify-between gap-3">
        <Link href={inAdmin ? '/admin' : START_PAGE} className="flex items-center gap-2.5 no-underline">
          <Logo />
          <span className="font-display text-base leading-tight font-semibold">
            {inAdmin ? 'Experience Hub Dashboard' : 'Experience Hub'}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-controls="main-menu"
          className="flex h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-lilac-200 px-3.5 text-sm font-medium md:hidden"
        >
          <Icon name={menuOpen ? 'cross' : 'list'} size={18} />
          {menuOpen ? 'Close' : 'Menu'}
        </button>
      </div>

      <div id="main-menu" className={`${menuOpen ? 'flex' : 'hidden'} flex-1 flex-col gap-4 pb-3 md:flex md:pb-0`}>
      <div className="flex flex-col gap-2">
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col">
            <div className="px-3 pb-1 font-display text-[12px] font-semibold tracking-[0.06em] uppercase">
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

      <div className="mt-auto flex flex-col gap-2">
        {inAdmin ? (
          <SwitchLink href={START_PAGE} label="Back to Experience Hub" icon="back" />
        ) : (
          isSuperAdmin && <SwitchLink href="/admin" label="Switch to Experience Hub Dashboard" icon="arrow" />
        )}

        {/* Account: name + sign-out on one line, role tags below (email shows on hover). */}
        <div className="flex flex-col gap-1.5 rounded-[10px] bg-lilac-50 p-2.5">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 truncate text-sm font-semibold" title={email}>{name || email}</div>
            <form action={signOut}>
              <button type="submit" aria-label="Sign out" title="Sign out"
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-lilac-200 bg-white hover:bg-peach-50">
                <Icon name="logout" size={16} />
              </button>
            </form>
          </div>
          <div className="flex flex-wrap gap-1 text-[11px]">
            <span className="rounded-full bg-lilac-100 px-2 py-0.5">{roleLabel}</span>
            {isSuperAdmin && <span className="rounded-full bg-highlight px-2 py-0.5 font-semibold">Super-admin</span>}
          </div>
        </div>
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
      className={`flex min-h-8 items-center gap-2.5 rounded-lg px-3 text-sm no-underline ${
        active ? 'bg-lilac-100 font-semibold' : 'hover:bg-lilac-50'
      }`}
    >
      <Icon name={icon} size={18} />
      <span>{label}</span>
    </Link>
  );
}

function SwitchLink({ href, label, icon }: { href: string; label: string; icon: 'arrow' | 'back' }) {
  return (
    <Link
      href={href}
      className="flex min-h-8 items-center gap-2 rounded-lg border border-lilac-200 px-2.5 py-1 text-[13px] leading-tight font-medium no-underline hover:bg-lilac-50"
    >
      <Icon name={icon} size={16} />
      <span>{label}</span>
    </Link>
  );
}
