import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { badge, useSession } from '@/lib/profile';
import { StudentNav } from '@/components/app/StudentNav';
import { Workspace } from '@/components/app/Workspace';
import { WisenChat } from '@/components/app/WisenChat';
import { QBank } from '@/components/app/QBank';
import { Exam } from '@/components/app/Exam';
import { Flashcards } from '@/components/app/Flashcards';
import { Saved } from '@/components/app/Progress';
import { Mistakes } from '@/components/app/Mistakes';
import { ExamHistory, StudyProgress } from '@/components/app/StudyProgress';
import { update } from '@/components/app/store';
import { useRemoteQuestions } from '@/components/app/remote';
import { studySearch, type StudyView } from '@/components/app/study-navigation';
import { useAi } from '@/components/app/ai-store';
import { Toaster } from '@/components/ui/sonner';
export const Route=createFileRoute('/app')({validateSearch:studySearch,head:()=>({meta:[{title:'Study Environment — Wisen'},{name:'description',content:'Read your lectures, practice faculty and Wisen questions, review Kapsules and track your medical study progress.'},{property:'og:title',content:'Study Environment — Wisen'},{property:'og:description',content:'Your connected study room, practice, Kapsules and progress.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:AppShell});
const groups=[{name:'Study Room',views:[['workspace','Parallel Workspace'],['ai','Wisen AI']]},{name:'Practice',views:[['faculty','Faculty QBank'],['qbank','Wisen QBank'],['past','Previous EMDs'],['exam','EMD Simulation'],['custom','Custom EMD'],['history','Exam History'],['mistakes','My Mistakes']]},{name:'Kapsules',views:[['cards','Due Today'],['new','New Kapsules'],['decks','Decks'],['reviews','Review History']]},{name:'Progress',views:[['progress','Overview'],['saved','Saved & Notes']]}] as const;
function AppShell(){const search=Route.useSearch(),nav=useNavigate();useRemoteQuestions();useAi();const {user,profile,loading}=useSession();const view=search.view??'workspace';const group=groups.find(g=>g.views.some(([v])=>v===view))??groups[0];const label=group.views.find(([v])=>v===view)?.[1]??'Study Room';
 useEffect(()=>{if(!loading&&user&&profile&&!profile.onboarded)nav({to:'/onboarding'});},[loading,user,profile,nav]);
 useEffect(()=>{const tab=view==='workspace'?'workspace':view==='ai'?'ai':['cards','new','decks','reviews'].includes(view)?'cards':['exam','custom','history'].includes(view)?'exam':['progress'].includes(view)?'progress':view==='saved'?'saved':'qbank';update(s=>({...s,tab}));},[view]);
 useEffect(()=>{const on=(e:Event)=>{nav({to:'/app',search:{view:'cards'}});};window.addEventListener('wisen-review-deck',on);return()=>window.removeEventListener('wisen-review-deck',on);},[nav]);
 useEffect(()=>{const on=(event:Event)=>{if(!(event instanceof CustomEvent))return;const target=studySearch({view:event.detail}).view;if(target)nav({to:'/app',search:{view:target}});};window.addEventListener('wisen-open-tool',on);return()=>window.removeEventListener('wisen-open-tool',on);},[nav]);
 const ctx=profile?badge(profile):undefined;
 return <div className="study-theme flex min-h-dvh flex-col bg-background text-foreground"><div className="px-5 sm:px-8"><StudentNav view={view}/></div><div className="flex min-h-0 flex-1"><aside className="hidden w-56 shrink-0 border-r border-border px-4 py-6 lg:block"><p className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase text-primary"><BookOpen className="size-3.5"/>Wisen Study</p>{groups.map(g=><div key={g.name} className="mb-6"><p className="mb-2 px-3 text-[10px] font-semibold uppercase text-muted-foreground">{g.name}</p>{g.views.map(([v,l])=><Link key={v} to="/app" search={{view:v}} className={`flex items-center justify-between rounded-md px-3 py-2 text-xs ${view===v?'bg-primary/10 font-medium text-primary':'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>{l}{view===v&&<ChevronRight className="size-3"/>}</Link>)}</div>)}</aside><main className="min-w-0 flex-1 px-4 py-5 sm:px-6"><header className="mb-5"><p className="font-mono text-[10px] uppercase text-primary">{group.name}{ctx?` · ${ctx}`:''}</p><h1 className="mt-2 text-2xl font-bold">{label}</h1><nav className="mt-4 flex gap-2 overflow-x-auto border-b border-border pb-3 lg:hidden">{group.views.map(([v,l])=><Link key={v} to="/app" search={{view:v}} className={`shrink-0 rounded-md px-3 py-2 text-xs ${view===v?'bg-primary/10 text-primary':'text-muted-foreground'}`}>{l}</Link>)}</nav></header><div className={view==='workspace'||view==='ai'?'study-room-height':''}>
 <div className={view==='workspace'?'h-full':'hidden'}><Workspace context={ctx}/></div><div className={view==='ai'?'h-full':'hidden'}><WisenChat context={ctx} initialQuery={search.query}/></div>
 {(view==='qbank'||view==='faculty'||view==='past')&&<QBank key={view} context={ctx} source={view==='qbank'?'ai':view==='faculty'?'faculty':'past'}/>}
 <div className={view==='exam'||view==='custom'?'':'hidden'}><Exam/></div>
 {(['cards','new','decks','reviews'] as StudyView[]).includes(view)&&<Flashcards view={view as 'cards'|'new'|'decks'|'reviews'}/>}
 {view==='mistakes'&&<Mistakes/>}{view==='history'&&<ExamHistory/>}{view==='progress'&&<StudyProgress/>}{view==='saved'&&<Saved/>}
 </div></main></div><Toaster/></div>;
}
