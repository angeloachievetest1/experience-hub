'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { INACTIVE_ACCOUNT_MESSAGE } from './messages';

export type SignInState = { error: string | null; email: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(String(formData.get('next') ?? ''));

  if (!email || !password) {
    return { error: 'Enter your email and password.', email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === 'user_banned' || /banned/i.test(error.message)) {
      return { error: DEACTIVATED_MESSAGE, email };
    }
    if (error.code === 'invalid_credentials') {
      return { error: 'That email and password don’t match. Try again.', email };
    }
    return { error: `Sign-in failed: ${error.message}`, email };
  }

  // Belt and braces: a deactivated profile never gets a session.
  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profile?.status !== 'active') {
    await supabase.auth.signOut();
    return { error: DEACTIVATED_MESSAGE, email };
  }

  redirect(next);
}

const DEACTIVATED_MESSAGE = INACTIVE_ACCOUNT_MESSAGE;

// Only allow redirects to pages inside this app.
function safeNext(value: string) {
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : '/';
}
