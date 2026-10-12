import { createFileRoute } from '@tanstack/react-router';
import { ParallelWorkspace } from '@/components/app/ParallelWorkspace';
import { studyMeta } from '@/lib/study-meta';

export const Route = createFileRoute('/workspace')({
  validateSearch: (search: Record<string, unknown>): { sheet: string; file?: string | undefined } => ({
    sheet: typeof search['sheet'] === 'string' ? search['sheet'] : '',
    file: typeof search['file'] === 'string' ? search['file'] : undefined,
  }),
  head: () => studyMeta('Parallel Study Workspace', 'Study official UFAS1 lectures beside contextual Wisen AI, with selected-passage explanations, EMD questions, Kapsules and saved notes.'),
  component: WorkspacePage,
});

function WorkspacePage() {
  return <ParallelWorkspace />;
}