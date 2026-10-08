import { createFileRoute } from '@tanstack/react-router';
import { ReferenceStudyTool } from '@/components/app/ReferenceStudyTools';
import { studyMeta } from '@/lib/study-meta';
export const Route=createFileRoute('/sheets')({head:()=>studyMeta('Study Sheets','Create high-yield medical study sheets from your notes and course material with Wisen AI.'),component:()=> <ReferenceStudyTool kind="sheets"/>});