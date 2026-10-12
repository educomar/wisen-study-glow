import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import type { StudyView } from './study-navigation';

export const practiceItems = [['qbank','Wisen QBank'],['past','Previous EMDs'],['exam','EMD Simulation'],['history','Exam History'],['mistakes','My Mistakes']] as const;
export const kapsuleItems = [['cards','Due Today'],['new','New Kapsules'],['decks','Decks'],['reviews','Review History']] as const;
export const progressItems = [['progress','Overview'],['saved','Saved & Notes']] as const;
export function StudentSections({ view }: { view: StudyView }) {
 const items = kapsuleItems.some(([v])=>v===view) ? kapsuleItems : progressItems.some(([v])=>v===view) ? progressItems : [];
 if (!items.length) return null;
 return <nav aria-label="Section views" className="mb-8 flex flex-wrap gap-2 border-b border-border pb-4">{items.map(([v,label])=><Button key={v} variant={v===view?'secondary':'ghost'} asChild><Link to="/app" search={{view:v}} aria-current={v===view?'page':undefined}>{label}</Link></Button>)}</nav>;
}