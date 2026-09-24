'use client';

import { useActionState } from 'react';
import { signIn, type SignInState } from './actions';

export function SignInForm({ next, notice }: { next: string; notice: string | null }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: null, email: '' });
  const message = state.error ?? notice;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />

      {message && (
        <p role="alert" className="m-0 rounded-[10px] border border-primary bg-peach-100 px-4 py-3 text-sm">
          {message}
        </p>
      )}

      <label className="flex flex-col gap-2 text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className="min-h-11 rounded-[10px] border border-lilac-200 bg-white px-3.5 text-[15px] font-normal outline-none focus:border-secondary"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-11 rounded-[10px] border border-lilac-200 bg-white px-3.5 text-[15px] font-normal outline-none focus:border-secondary"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 cursor-pointer rounded-[10px] bg-primary px-5 font-semibold text-ink disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="m-0 text-[13px] text-ink-muted">Forgot your password? Ask a super-admin to set a new one.</p>
    </form>
  );
}
