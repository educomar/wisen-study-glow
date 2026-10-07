import { Link } from '@tanstack/react-router';
import { Moon, Sun, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '@/lib/profile';
import { Logo } from '@/components/site/Logo';
import { useTheme } from '@/components/site/theme';
import { Button } from '@/components/ui/button';
import { ProfileDialog } from './ProfileDialog';
import type { StudyView } from './study-navigation';
export function StudentNav({ home = false, view }: { home?: boolean; view?: StudyView }) {
 const { dark, toggle } = useTheme();
 const { user, profile, setProfile } = useSession();
 const [editing, setEditing] = useState(false);
 const items = [{ label: 'Study Room', view: 'workspace', active: ['workspace','ai'] }, { label:'Practice',view:'qbank',active:['qbank','faculty','past','exam','custom','history','mistakes'] }, {label:'Kapsules',view:'cards',active:['cards','new','decks','reviews']},{label:'Progress',view:'progress',active:['progress','saved']}] as const;
 return <>
 <header className="study-nav grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border py-4 sm:flex sm:justify-between">
  <div className="flex min-w-0 items-center gap-8"><Link to="/home" aria-label="Wisen home"><Logo className="h-8 w-auto" /></Link><nav className="hidden items-center gap-6 text-sm font-medium md:flex"><Link to="/home" className={home ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}>Home</Link>{items.map(i => <Link key={i.label} to="/app" search={{view:i.view}} className={!home && i.active.some(v=>v===view) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}>{i.label}</Link>)}</nav></div>
  <div className="flex shrink-0 items-center gap-2"><Button size="icon" variant="ghost" onClick={toggle} aria-label="Toggle theme">{dark ? <Sun /> : <Moon />}</Button>{user && profile ? <Button size="icon" onClick={()=>setEditing(true)} aria-label="Profile settings" className="rounded-full">{(profile.full_name || "").charAt(0).toUpperCase() || <UserRound />}</Button> : <Button asChild variant="outline" size="sm"><Link to="/login">Log in</Link></Button>}</div>
 </header>
 <nav className="flex gap-5 overflow-x-auto border-b border-border py-3 text-xs md:hidden"><Link to="/home" className={home ? 'text-primary' : 'text-muted-foreground'}>Home</Link>{items.map(i=><Link key={i.label} to="/app" search={{view:i.view}} className="shrink-0 text-muted-foreground">{i.label}</Link>)}</nav>
 {user && profile && <ProfileDialog open={editing} onOpenChange={setEditing} user={user} profile={profile} onSaved={setProfile} />}
 </>;
}
