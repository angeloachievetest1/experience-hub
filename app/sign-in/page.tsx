import { Logo } from '@/components/Icon';
import { START_PAGE } from '@/lib/sections';
import { INACTIVE_ACCOUNT_MESSAGE } from './messages';
import { SignInForm } from './SignInForm';

export const metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  const notice = reason === 'deactivated' ? INACTIVE_ACCOUNT_MESSAGE : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-[420px] flex-col gap-7 rounded-2xl border border-peach-200 bg-white p-8">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-display text-lg font-semibold">Experience Hub</span>
        </div>
        <div>
          <h1 className="m-0 font-display text-[32px] leading-tight font-light">Sign in</h1>
          <p className="mt-2 mb-0 text-ink-muted">Staff only. Use the email and password you were given.</p>
        </div>
        <SignInForm next={next ?? START_PAGE} notice={notice} />
      </div>
    </main>
  );
}
