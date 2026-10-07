import { useEffect, useState, type ReactNode } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { StudentNav } from './StudentNav';
import { studySearch } from './study-navigation';

export function StudentShell({children}:{children:ReactNode}) {
 const location=useRouterState({select:s=>s.location});
 const home=location.pathname==='/home';
 const view=studySearch(location.search as Record<string,unknown>).view??'courses';
 const [open,setOpen]=useState(true);
 useEffect(()=>{setOpen(localStorage.getItem('wisen-sidebar-open')!=='false');},[]);
 const change=(next:boolean)=>{setOpen(next);localStorage.setItem('wisen-sidebar-open',String(next));};
 return <div className="study-theme min-h-dvh bg-background text-foreground"><SidebarProvider open={open} onOpenChange={change}><StudentNav home={home} view={view}/><div className="relative min-w-0 flex-1"><header className="student-toolbar flex h-16 items-center gap-3 border-b border-border px-5 sm:px-10"><SidebarTrigger aria-label="Toggle sidebar"/><span className="text-sm text-muted-foreground">{home?'Home':'Study'}<span className="mx-2 text-border">/</span><span className="font-medium text-foreground">{home?'Your day':view==='courses'?'My Courses':view==='ai'?'Wisen AI':['cards','new','decks','reviews'].includes(view)?'Kapsules':['progress','saved'].includes(view)?'Progress':'Practice'}</span></span></header><div className="student-content p-5 sm:p-10">{children}</div></div></SidebarProvider></div>;
}