import { Link, useRouterState } from '@tanstack/react-router';
import { LogIn, Menu, Moon, Sun, UserRound, X, Sparkles } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/site/theme';
import { useSession } from '@/lib/profile';
import { ProfileDialog } from './ProfileDialog';
import { studySearch } from './study-navigation';

export function ReferenceShell({ children }: { children: ReactNode }) {
  const { dark, toggle } = useTheme();
  const { user, profile, setProfile } = useSession();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const search = useRouterState({ select: s => s.location.search });
  const view = studySearch(search as Record<string, unknown>).view;
  const links = [
    { label: 'Dashboard', view: undefined, active: !view },
    { label: 'My Courses', view: 'courses', active: view === 'courses' },
    { label: 'Kapsules', view: 'cards', active: ['cards', 'new', 'decks', 'reviews'].includes(view ?? '') },
    { label: 'QBank', view: 'faculty', active: ['faculty', 'qbank', 'past', 'exam', 'history', 'mistakes'].includes(view ?? '') },
    { label: 'Wisen AI', view: 'ai', active: view === 'ai' },
    { label: 'Progress', view: 'progress', active: ['progress', 'saved'].includes(view ?? '') },
  ] as const;
  return <div className="study-theme reference-theme min-h-dvh bg-background text-foreground">
    <header className="reference-header">
      <div className="reference-nav">
        <Link to="/app" search={{}} className="reference-brand" aria-label="Wisen dashboard"><Sparkles className="size-6 text-primary"/><span>Wisen<span className="text-primary italic"> AI</span></span><span className="reference-beta">STUDY</span></Link>
        <nav className={`reference-links ${menu ? 'is-open' : ''}`} aria-label="Study navigation">
          <Link to="/home" onClick={() => setMenu(false)}>Home</Link>
          {links.map(item => <Link key={item.label} to="/app" search={{ view: item.view }} aria-current={item.active ? 'page' : undefined} onClick={() => setMenu(false)}>{item.label}</Link>)}
        </nav>
        <div className="flex items-center gap-1">
          {user && profile ? <Button variant="ghost" size="icon" aria-label="Profile settings" title="Profile settings" onClick={() => setEditing(true)}><UserRound/></Button> : <Button className="reference-signin" asChild><Link to="/login"><LogIn/>Sign in</Link></Button>}
          <Button variant="ghost" size="icon" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'} onClick={toggle}>{dark ? <Sun/> : <Moon/>}</Button>
          <Button variant="ghost" size="icon" className="reference-menu" aria-label="Toggle navigation" aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</Button>
        </div>
      </div>
    </header>
    <div className="reference-background" aria-hidden="true"/>
    <div className="reference-content">{children}</div>
    {user && profile && <ProfileDialog open={editing} onOpenChange={setEditing} user={user} profile={profile} onSaved={setProfile}/>}
  </div>;
}