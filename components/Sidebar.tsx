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

// Wider screens: the menu's right edge can be dragged (double-click resets),
// and the « button hides it down to a slim strip with a » button to bring it
// back. Both are remembered in this browser.
// Narrowest 212: below about 210 the "Experience Hub" title no longer fits
// next to the « button when the menu shows its scrollbar.
const WIDTH = { normal: 220, min: 212, max: 400, hidden: 56 };
const clampWidth = (w: number) => Math.min(WIDTH.max, Math.max(WIDTH.min, Math.round(w)));

function remember(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable: lasts until reload */ }
}

export function Sidebar({ name, email, roleLabel, isSuperAdmin }: Props) {
  const pathname = usePathname();
  const inAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const groups: NavGroup[] = inAdmin ? [ADMIN_GROUP] : SECTION_GROUPS;
  // On small screens the menu folds away behind a Menu button.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);

  const [width, setWidth] = useState(WIDTH.normal);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem('eh.sidebar.width'));
      if (saved) setWidth(clampWidth(saved));
      setHidden(localStorage.getItem('eh.sidebar.hidden') === '1');
    } catch { /* storage unavailable: defaults */ }
  }, []);

  const changeWidth = (w: number) => { setWidth(w); remember('eh.sidebar.width', String(w)); };
  const toggleHidden = (h: boolean) => { setHidden(h); remember('eh.sidebar.hidden', h ? '1' : '0'); };

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const start = width;
    let latest = start;
    const move = (ev: PointerEvent) => { latest = clampWidth(start + ev.clientX - startX); setWidth(latest); };
    const up = () => {
      window.removeEventListener('pointermove', move);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      changeWidth(latest);
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  const sideButton = 'hidden size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-lilac-200 bg-white hover:bg-lilac-50 md:flex';

  return (
    <div
      className="relative md:sticky md:top-0 md:h-screen md:w-[var(--sidebar-w)] md:shrink-0"
      style={{ '--sidebar-w': `${hidden ? WIDTH.hidden : width}px` } as React.CSSProperties}
    >
      <nav
        aria-label="Main"
        className={`flex flex-col gap-3 [&>*]:shrink-0 border-b border-peach-200 bg-white px-4 py-3 md:h-full md:overflow-y-auto md:border-r md:border-b-0 md:py-4 ${hidden ? 'md:items-center md:px-2' : 'md:px-3'}`}
      >
        {hidden && (
          <button type="button" onClick={() => toggleHidden(false)} aria-label="Show menu" title="Show menu" className={sideButton}>
            <Icon name="expand" size={18} />
          </button>
        )}

        <div className={`flex items-center justify-between gap-2 ${hidden ? 'md:hidden' : ''}`}>
          <Link href={inAdmin ? '/admin' : START_PAGE} className="flex min-w-0 items-center gap-2 no-underline">
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
          <button type="button" onClick={() => toggleHidden(true)} aria-label="Hide menu" title="Hide menu" className={sideButton}>
            <Icon name="collapse" size={18} />
          </button>
        </div>

        <div id="main-menu" className={`${menuOpen ? 'flex' : 'hidden'} flex-1 flex-col gap-4 pb-3 md:pb-0 ${hidden ? 'md:hidden' : 'md:flex'}`}>
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
      {!hidden && (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the menu"
          aria-valuenow={width}
          aria-valuemin={WIDTH.min}
          aria-valuemax={WIDTH.max}
          title="Drag to resize. Double-click to reset."
          tabIndex={0}
          onPointerDown={startDrag}
          onDoubleClick={() => changeWidth(WIDTH.normal)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); changeWidth(clampWidth(width + 20)); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); changeWidth(clampWidth(width - 20)); }
          }}
          className="group absolute top-0 -right-1.5 z-20 hidden h-full w-3 cursor-col-resize touch-none justify-center outline-none md:flex"
        >
          <span className="w-0.5 group-hover:w-[3px] group-hover:bg-secondary group-focus-visible:w-[3px] group-focus-visible:bg-secondary" />
        </span>
      )}
    </div>
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
