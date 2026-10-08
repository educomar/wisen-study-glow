import { createFileRoute } from '@tanstack/react-router';
import { StudySheets } from '@/components/app/StudySheets';
import { studyMeta } from '@/lib/study-meta';
export const Route=createFileRoute('/sheets')({head:()=>studyMeta('Study Sheets','Create faculty-grounded UFAS1 medical study sheets with EMD revision, active recall and saved Kapsules.'),component:StudySheets});