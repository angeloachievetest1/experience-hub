import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Signed-in pages send deactivated users here: end the session and explain why.
export async function GET() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/sign-in?reason=deactivated');
}
