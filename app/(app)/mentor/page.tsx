import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

const HREF = '/mentor';
export const metadata = placeholderMetadata(HREF);

export default function Page() {
  return <PlaceholderPage href={HREF} />;
}
