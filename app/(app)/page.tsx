import { redirect } from 'next/navigation';
import { START_PAGE } from '@/lib/sections';

// No separate Home page: the app opens on the Quality Analyst dashboard.
export default function Page() {
  redirect(START_PAGE);
}
