import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

const HREF = '/quality-analyst/follow-up';
export const metadata = placeholderMetadata(HREF);

export default function Page() {
  return <PlaceholderPage href={HREF} />;
}
