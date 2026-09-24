'use client';

import { useState, useTransition } from 'react';
import { runAccessCheck, type AccessCheckResult } from '@/app/(app)/actions';
import { SECTION_KEYS, SECTION_NAMES, type SectionKey } from '@/lib/sections';
import { Icon } from './Icon';

// "Test my write access": shows what the database itself allows, next to
// what this user's profile says they should be allowed.
export function AccessCheck({ expected }: { expected: Record<SectionKey, boolean> }) {
  const [result, setResult] = useState<AccessCheckResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => setResult(await runAccessCheck()))}
          className="min-h-11 cursor-pointer rounded-[10px] bg-primary px-5 font-semibold text-ink disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? 'Checking…' : 'Test my write access'}
        </button>
        <p className="mt-2 mb-0 text-[13px] text-ink-muted">
          Tries to add a case in each section as you, then undoes it. Nothing is saved.
        </p>
      </div>

      {result && !result.ok && (
        <p role="alert" className="m-0 rounded-[10px] border border-primary bg-peach-100 px-4 py-3 text-sm">
          The check could not run: {result.error}
        </p>
      )}

      {result?.ok && (
        <ul className="m-0 flex list-none flex-col p-0" aria-live="polite">
          {SECTION_KEYS.map((key) => {
            const allowed = result.access[key];
            const asExpected = allowed === expected[key];
            return (
              <li
                key={key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-lilac-50 py-3 text-sm sm:grid-cols-[160px_minmax(0,1fr)_auto]"
              >
                <span className="font-semibold">{SECTION_NAMES[key]}</span>
                <span className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${allowed ? 'bg-secondary' : 'bg-lilac-200'}`} aria-hidden="true" />
                  {allowed ? 'Database allows you to add, edit and delete' : 'Database blocks changes (read only)'}
                </span>
                <span
                  className={`col-span-2 flex items-center gap-1.5 justify-self-start rounded-full px-2.5 py-0.5 text-xs sm:col-span-1 ${
                    asExpected ? 'bg-highlight' : 'bg-peach-200 font-semibold'
                  }`}
                >
                  <Icon name={asExpected ? 'check' : 'cross'} size={14} />
                  {asExpected ? 'Matches your profile' : 'Does not match your profile'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
