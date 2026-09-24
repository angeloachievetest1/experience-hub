import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="m-0 font-display text-[32px] font-light">Page not found</h1>
      <p className="m-0 text-ink-muted">This page doesn’t exist, or you don’t have access to it.</p>
      <Link href="/" className="min-h-11 rounded-[10px] bg-primary px-5 py-2.5 font-semibold no-underline">
        Go to Home
      </Link>
    </main>
  );
}
