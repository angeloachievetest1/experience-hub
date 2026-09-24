import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

const HREF = '/mentor/case-log';
export const metadata = placeholderMetadata(HREF);

export default function Page() {
  return <PlaceholderPage href={HREF} />;
}
