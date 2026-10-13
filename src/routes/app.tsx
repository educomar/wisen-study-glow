import { translate, useLang } from '@/lib/i18n';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { badge, useSession } from '@/lib/profile';
import { StudentSections, kapsuleItems, progressItems, practiceItems } from '@/components/app/StudentSections';
import { CourseReader } from '@/components/app/CourseReader';
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
import { StudyDashboard } from '@/components/app/StudyDashboard';
import { academicName } from '@/components/app/academic-names';
export const Route=createFileRoute('/app')({validateSearch:studySearch,head:()=>({meta:[{title:'Study Environment — Wisen'},{name:'description',content:'Read your lectures, practice faculty and Wisen questions, review Kapsules and track your medical study progress.'},{property:'og:title',content:'Study Environment — Wisen'},{property:'og:description',content:'Your connected study room, practice, Kapsules and progress.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:AppShell});
const labels = Object.fromEntries([...practiceItems,...kapsuleItems,...progressItems,['courses','My Courses'],['ai','Wisen AI']]);
function AppShell(){
  useLang();const search=Route.useSearch(),nav=useNavigate();useRemoteQuestions();useAi();const {user,profile,loading}=useSession();const view=search.view??'courses';const label=labels[view]??'My Courses';
 useEffect(()=>{if(!loading&&user&&profile&&!profile.onboarded)nav({to:'/onboarding'});},[loading,user,profile,nav]);
 useEffect(()=>{if(view==='faculty')nav({to:'/qbank',replace:true});},[view,nav]);
 useEffect(()=>{const tab=view==='courses'?'courses':view==='ai'?'ai':['cards','new','decks','reviews'].includes(view)?'cards':['exam','history'].includes(view)?'exam':['progress'].includes(view)?'progress':view==='saved'?'saved':'qbank';update(s=>({...s,tab}));},[view]);
 useEffect(()=>{const on=(e:Event)=>{nav({to:'/app',search:{view:'cards'}});};window.addEventListener('wisen-review-deck',on);return()=>window.removeEventListener('wisen-review-deck',on);},[nav]);
 useEffect(()=>{const on=(event:Event)=>{if(!(event instanceof CustomEvent))return;const target=studySearch({view:event.detail}).view;if(target)nav({to:'/app',search:{view:target}});};window.addEventListener('wisen-open-tool',on);return()=>window.removeEventListener('wisen-open-tool',on);},[nav]);
 const ctx=profile?badge(profile):undefined;
  if (!search.view) return <><StudyDashboard/><Toaster/></>;
  return <main className="reference-workspace"><header className="mb-8"><Link to="/app" search={{}} className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground"><ChevronRight className="size-4 rotate-180"/>{translate("Dashboard")}</Link><h1>{translate(label)}</h1></header><StudentSections view={view}/>{practiceItems.some(([v])=>v===view)&&<nav aria-label={translate("Practice views")} className="mb-6 flex flex-wrap gap-2 border-b border-border pb-4">{practiceItems.map(([v,l])=><Link key={v} to="/app" search={{view:v}} aria-current={view===v?'page':undefined} className={`rounded-md px-3 py-2 text-sm ${view===v?'bg-secondary text-primary':'text-muted-foreground hover:bg-accent'}`}>{translate(l)}</Link>)}</nav>}<div className={view==='courses'||view==='ai'?'student-tool-height':''}>
  {view==='courses'&&<CourseReader/>}{view==='ai'&&<WisenChat context={ctx} initialQuery={search.query}/>}
{(view==='qbank'||view==='past')&&<QBank key={view} context={ctx} defaultSubject={search.subject} defaultLesson={search.lesson ? academicName(search.lesson, search.subject) : undefined} source={view==='qbank'?'ai':'past'}/>}
  {view==='exam'&&<Exam/>}
 {(['cards','new','decks','reviews'] as StudyView[]).includes(view)&&<Flashcards view={view as 'cards'|'new'|'decks'|'reviews'}/>}
 {view==='mistakes'&&<Mistakes/>}{view==='history'&&<ExamHistory/>}{view==='progress'&&<StudyProgress/>}{view==='saved'&&<Saved/>}
  </div><Toaster/></main>;
}
