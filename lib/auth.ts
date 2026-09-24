import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { SectionKey } from '@/lib/sections';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  department: string | null;
  role: 'viewer' | 'admin';
  sections: SectionKey[];
  is_super_admin: boolean;
  status: 'active' | 'deactivated';
};

// The signed-in user and their profile, loaded once per request.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, department, role, sections, is_super_admin, status')
    .eq('id', user.id)
    .maybeSingle();

  // A signed-in user without a profile is treated like a deactivated one.
  return (data as Profile | null) ?? { ...emptyProfile, id: user.id, email: user.email ?? '' };
});

const emptyProfile: Profile = {
  id: '',
  email: '',
  full_name: '',
  department: null,
  role: 'viewer',
  sections: [],
  is_super_admin: false,
  status: 'deactivated',
};

// Use at the top of every signed-in page or layout.
export async function requireActiveProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/sign-in');
  if (profile.status !== 'active') redirect('/auth/deactivated');
  return profile;
}

export function canWriteSection(profile: Profile, section: SectionKey) {
  return profile.status === 'active' && profile.role === 'admin' && profile.sections.includes(section);
}
