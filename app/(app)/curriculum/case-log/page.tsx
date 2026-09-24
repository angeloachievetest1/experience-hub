import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

const HREF = '/curriculum/case-log';
export const metadata = placeholderMetadata(HREF);

export default function Page() {
  return <PlaceholderPage href={HREF} />;
}
