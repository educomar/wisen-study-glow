import { createFileRoute } from '@tanstack/react-router';
import { Flashcards } from '@/components/app/Flashcards';
import { studyMeta } from '@/lib/study-meta';
export const Route=createFileRoute('/flashcards')({validateSearch:(search:Record<string,unknown>)=>({deck:typeof search['deck']==='string'?search['deck']:''}),head:()=>studyMeta('Kapsules','Build medical active-recall decks from your material and review with spaced repetition.'),component:FlashcardsRoute});
function FlashcardsRoute(){const {deck}=Route.useSearch();return <Flashcards initialDeck={deck || undefined}/>;}