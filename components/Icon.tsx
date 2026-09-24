import type { IconName } from '@/lib/sections';

const PATHS: Record<IconName | 'arrow' | 'back' | 'logout' | 'check' | 'cross', string> = {
  home: 'M4 11l8-7 8 7 M6 9.5V20h12V9.5 M10 20v-5h4v5',
  grid: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  chart: 'M5 20v-6 M12 20V5 M19 20v-9 M3 20h18',
  list: 'M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6',
  bookmark: 'M6 4h12v16l-6-4-6 4z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  cap: 'M12 3L2 8l10 5 10-5-10-5z M6 10.5V16c0 1.5 2.5 3 6 3s6-1.5 6-3v-5.5',
  chat: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21c0-3.3 3.1-6 7-6s7 2.7 7 6 M16 3.1a4 4 0 0 1 0 7.8 M22 21c0-2.8-2-5.1-4.8-5.8',
  login: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4 M10 17l5-5-5-5 M15 12H3',
  arrow: 'M7 7h10v10 M17 7L7 17',
  back: 'M15 6l-6 6 6 6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  check: 'M5 12l5 5L20 7',
  cross: 'M6 6l12 12 M18 6L6 18',
};

export function Icon({ name, size = 20 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Logo() {
  return (
    <svg width="44" height="28" viewBox="0 0 40 26" aria-hidden="true" className="shrink-0">
      <line x1="20" y1="3" x2="20" y2="9" stroke="#FF4500" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="8" y1="5.5" x2="12" y2="9.5" stroke="#DDD1FF" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="32" y1="5.5" x2="28" y2="9.5" stroke="#FFB199" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="3" y1="20" x2="9" y2="20" stroke="#FF4500" strokeWidth="4.5" strokeLinecap="round" />
      <line x1="31" y1="20" x2="37" y2="20" stroke="#9F7DFF" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}
