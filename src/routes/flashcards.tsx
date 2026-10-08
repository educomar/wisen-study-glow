import { createFileRoute } from '@tanstack/react-router';
import { ReferenceStudyTool } from '@/components/app/ReferenceStudyTools';
import { studyMeta } from '@/lib/study-meta';
export const Route=createFileRoute('/flashcards')({head:()=>studyMeta('Kapsules','Build medical active-recall decks from your material and review with spaced repetition.'),component:()=> <ReferenceStudyTool kind="cards"/>});