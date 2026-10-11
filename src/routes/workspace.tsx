import { createFileRoute } from '@tanstack/react-router';
import { StudySheets } from '@/components/app/StudySheets';
import { studyMeta } from '@/lib/study-meta';

export const Route = createFileRoute('/workspace')({
  validateSearch: (search: Record<string, unknown>) => ({
    sheet: typeof search['sheet'] === 'string' ? search['sheet'] : '',
  }),
  head: () => studyMeta('Workspace', 'Your Wisen study workspace for faculty-grounded medical sheets, EMD revision and active recall.'),
  component: WorkspacePage,
});

function WorkspacePage() {
  const { sheet } = Route.useSearch();
  return <StudySheets initialSheetId={sheet || undefined} />;
}