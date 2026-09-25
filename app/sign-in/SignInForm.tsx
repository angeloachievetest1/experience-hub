'use client';

import { useActionState, useState } from 'react';
import { signIn, type SignInState } from './actions';

export function SignInForm({ next, notice }: { next: string; notice: string | null }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: null, email: '' });
  const [showPassword, setShowPassword] = useState(false);
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

      <div className="flex flex-col gap-2 text-sm font-medium">
        <label htmlFor="password">Password</label>
        <div className="flex min-h-11 items-center rounded-[10px] border border-lilac-200 bg-white focus-within:border-secondary">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="min-h-11 min-w-0 flex-1 rounded-[10px] border-0 bg-transparent px-3.5 text-[15px] font-normal outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-pressed={showPassword}
            aria-controls="password"
            className="mr-1.5 min-h-8 cursor-pointer rounded-lg px-2.5 text-[13px] font-semibold text-ink-muted hover:bg-lilac-50 hover:text-ink"
          >
            {showPassword ? 'Hide' : 'Show'}
            <span className="sr-only"> password</span>
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 cursor-pointer rounded-[10px] bg-primary px-5 font-semibold text-ink disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="m-0 text-[13px] text-ink-muted">Forgot your password? Contact the management department to have it reset.</p>
    </form>
  );
}
