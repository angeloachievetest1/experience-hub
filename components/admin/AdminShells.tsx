'use client';

import { SectionShell } from '@/components/records/SectionShell';
import type { LoginRow } from '@/lib/admin/types';
import { ActivityView, type ActivityData } from './ActivityView';
import { LoginsView } from './LoginsView';
import { UserDrawer, type UsersData } from './UserDrawer';
import { UsersView } from './UsersView';

type Head = { title: string; subtitle: string };

export function UsersPage({ data, title, subtitle }: Head & { data: UsersData }) {
  return (
    <SectionShell data={data} title={title} subtitle={subtitle} rangeKey="eh.admin.range" showRange={false}
      renderDrawer={(id, close) => <UserDrawer id={id} onClose={close} />}>
      <UsersView />
    </SectionShell>
  );
}

export function ActivityPage({ data, title, subtitle }: Head & { data: ActivityData }) {
  return (
    <SectionShell data={data} title={title} subtitle={subtitle} rangeKey="eh.admin.range" renderDrawer={() => null}>
      <ActivityView />
    </SectionShell>
  );
}

export function LoginsPage({ data, title, subtitle }: Head & { data: LoginRow[] }) {
  return (
    <SectionShell data={data} title={title} subtitle={subtitle} rangeKey="eh.admin.range" renderDrawer={() => null}>
      <LoginsView />
    </SectionShell>
  );
}
