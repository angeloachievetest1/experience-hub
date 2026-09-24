import { PlaceholderPage, placeholderMetadata } from '@/components/PlaceholderPage';

const HREF = '/quality-analyst/survey-insights';
export const metadata = placeholderMetadata(HREF);

export default function Page() {
  return <PlaceholderPage href={HREF} />;
}
