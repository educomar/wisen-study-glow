import { createFileRoute } from '@tanstack/react-router';
import { EmdQBank } from '@/components/app/EmdQBank';
import { studyMeta } from '@/lib/study-meta';
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
export const Route = createFileRoute('/qbank')({
  validateSearch: (s: Record<string, unknown>): { s?: string; u?: string; l?: string; view?: 'mistakes' | 'history' } => ({ s: str(s['s']), u: str(s['u']), l: str(s['l']), view: str(s['view']) as 'mistakes' | 'history' | undefined }),
  head: () => studyMeta('QBank · EMD Practice', 'Practise past UFAS1 EMDs, sit timed EMD simulations, review your mistakes and exam history.'),
  component: EmdQBank,
});
