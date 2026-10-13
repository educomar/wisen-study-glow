import { translate, useLang } from '@/lib/i18n';
import { Link } from '@tanstack/react-router';
import { BookOpen, ChartNoAxesColumn, ChevronDown, Home, Layers, ListChecks, LogIn, Moon, Sun, UserRound, Zap } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '@/lib/profile';
import { useTheme } from '@/components/site/theme';
import { Button } from '@/components/ui/button';
import { Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from '@/components/ui/sidebar';
import { ProfileDialog } from './ProfileDialog';
import { practiceItems } from './StudentSections';
import type { StudyView } from './study-navigation';
export function StudentNav({home=false,view}:{home?:boolean;view?:StudyView}) {
  useLang();
 const {dark,toggle}=useTheme(),{user,profile,setProfile}=useSession();
 const {state,isMobile,setOpenMobile}=useSidebar();
 const [editing,setEditing]=useState(false),[expanded,setExpanded]=useState<boolean|null>(null);
 const activePractice=!home&&practiceItems.some(([v])=>v===view);
 const collapsed=state==='collapsed'&&!isMobile;
 const close=()=>setOpenMobile(false);
 const items=[{label:'My Courses',view:'courses',icon:BookOpen,active:view==='courses'},{label:'Wisen AI',view:'ai',icon:Zap,active:view==='ai'},{label:'Practice',view:'qbank',icon:ListChecks,active:activePractice},{label:'Kapsules',view:'cards',icon:Layers,active:['cards','new','decks','reviews'].some(v=>v===view)},{label:'Progress',view:'progress',icon:ChartNoAxesColumn,active:['progress','saved'].some(v=>v===view)}] as const;
 return <><Sidebar collapsible="icon" className="student-sidebar study-theme"><SidebarHeader className="px-6 py-7"><Link to="/home" onClick={close} className="text-2xl font-bold text-primary" aria-label={translate("Wisen home")}>{collapsed ? translate('W') : translate('Wisen')}</Link></SidebarHeader><SidebarContent className="px-4"><nav aria-label={translate("Student navigation")}><SidebarMenu><SidebarMenuItem><SidebarMenuButton asChild isActive={home} tooltip={translate("Home")}><Link to="/home" onClick={close} aria-current={home?'page':undefined}><Home/><span>{translate("Home")}</span></Link></SidebarMenuButton></SidebarMenuItem>{items.map(item=><SidebarMenuItem key={item.label}><SidebarMenuButton asChild isActive={!home&&item.active} tooltip={translate(item.label)}><Link to="/app" search={{view:item.view}} onClick={close} aria-current={!home&&item.active?'page':undefined}><item.icon/><span>{translate(item.label)}</span></Link></SidebarMenuButton>{item.label==='Practice'&&!collapsed&&<><Button variant="ghost" size="icon" className="absolute right-1 top-1 size-8" aria-label={translate("Expand practice")} aria-expanded={expanded??activePractice} onClick={()=>setExpanded(!(expanded??activePractice))}><ChevronDown className="size-4"/></Button>{(expanded??activePractice)&&<ul className="my-2 ml-5 space-y-1 border-l border-border pl-3">{practiceItems.map(([v,label])=><li key={v}><Link to="/app" search={{view:v}} onClick={close} aria-current={!home&&view===v?'page':undefined} className={`block rounded-md px-3 py-2 text-base ${!home&&view===v?'bg-primary/10 font-medium text-primary':'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>{translate(label)}</Link></li>)}</ul>}</>}</SidebarMenuItem>)}</SidebarMenu></nav></SidebarContent><SidebarFooter className="gap-2 border-t border-border p-4"><Button variant="ghost" onClick={toggle} className="justify-start" aria-label={translate("Toggle theme")}>{dark?<Sun/>:<Moon/>}{!collapsed&&(dark?'Light mode':'Dark mode')}</Button>{user&&profile?<Button variant="ghost" className="justify-start" onClick={()=>setEditing(true)} aria-label={translate("Profile settings")}><UserRound/>{!collapsed&&<span className="truncate">{profile.full_name||'Profile'}</span>}</Button>:<Button variant="ghost" asChild><Link to="/login"><LogIn/>{!collapsed&&'Log in'}</Link></Button>}</SidebarFooter></Sidebar>{user&&profile&&<ProfileDialog open={editing} onOpenChange={setEditing} user={user} profile={profile} onSaved={setProfile}/>}</>;
}
