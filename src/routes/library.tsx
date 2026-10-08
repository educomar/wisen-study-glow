import { createFileRoute } from '@tanstack/react-router';
import { LibraryPage } from '@/components/app/LibraryPage';
import { studyMeta } from '@/lib/study-meta';

export const Route = createFileRoute('/library')({
  head: () => studyMeta('Library', 'Search and reopen your saved Wisen Study Sheets and Kapsule decks.'),
  component: LibraryPage,
});