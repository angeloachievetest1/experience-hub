import { QaShell } from '@/components/qa/QaShell';
import { SurveyInsightsView } from '@/components/qa/SurveyInsightsView';
import { loadQaData } from '@/lib/qa/data';
import { findPage } from '@/lib/sections';

const page = findPage('/quality-analyst/survey-insights');
export const metadata = { title: page.title };

export default async function Page() {
  const data = await loadQaData();
  return (
    <QaShell data={data} title={page.title} subtitle={page.subtitle}>
      <SurveyInsightsView />
    </QaShell>
  );
}
