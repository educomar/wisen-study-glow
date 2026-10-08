import { createFileRoute } from '@tanstack/react-router';
import { StudyDashboard } from '@/components/app/StudyDashboard';
import { studyMeta } from '@/lib/study-meta';
export const Route = createFileRoute('/dashboard')({ head: () => studyMeta('Dashboard', 'Your Wisen study space: study sheets, Kapsules, medical questions and learning progress.'), component: StudyDashboard });