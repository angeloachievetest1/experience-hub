import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

const HREF = '/curriculum/instructor-requests';
export const metadata = placeholderMetadata(HREF);

export default function Page() {
  return <PlaceholderPage href={HREF} />;
}
