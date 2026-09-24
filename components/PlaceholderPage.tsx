import type { Metadata } from 'next';
import { requireActiveProfile } from '@/lib/auth';
import { findPage } from '@/lib/sections';
import { Card, PageHeader } from './PageHeader';

// Empty page used until the page is built in its phase.
export async function PlaceholderPage({ href }: { href: string }) {
  // Layouts don't re-run on every navigation, so each page checks access too.
  await requireActiveProfile();
  const page = findPage(href);
  return (
    <div className="flex flex-col gap-7">
      <PageHeader title={page.title} subtitle={page.subtitle} />
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h2 className="m-0 font-display text-[22px] font-normal">What this page will show</h2>
          <span className="rounded-full bg-lilac-100 px-2.5 py-0.5 text-xs">Coming in Phase {page.phase}</span>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {page.planned.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-2 size-2 shrink-0 rounded-full bg-secondary" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function placeholderMetadata(href: string): Metadata {
  return { title: findPage(href).title };
}
