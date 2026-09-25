export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header>
      <h1 className="m-0 font-display text-[26px] leading-tight font-light md:text-[30px]">{title}</h1>
      {subtitle && <p className="mt-1 mb-0 text-sm text-ink-muted">{subtitle}</p>}
    </header>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-peach-200 bg-white p-6 ${className}`}>{children}</section>;
}
