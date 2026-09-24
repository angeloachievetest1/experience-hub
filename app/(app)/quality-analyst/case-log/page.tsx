import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

const HREF = '/quality-analyst/case-log';
export const metadata = placeholderMetadata(HREF);

export default function Page() {
  return <PlaceholderPage href={HREF} />;
}
