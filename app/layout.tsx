import type { Metadata } from 'next';
import { Bitter, DM_Sans } from 'next/font/google';
import './globals.css';

const bitter = Bitter({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  variable: '--font-bitter',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Experience Hub', template: '%s · Experience Hub' },
  description: 'Internal case tracking for Quality Analyst, Curriculum and Mentor teams.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bitter.variable} ${dmSans.variable}`}>
      <body className="min-h-screen text-[15px]">{children}</body>
    </html>
  );
}
