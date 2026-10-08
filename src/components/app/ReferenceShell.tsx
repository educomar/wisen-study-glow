import { Link, useRouterState } from '@tanstack/react-router';
import { LogIn, Menu, Moon, Sun, UserRound, X, Sparkles } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/site/theme';
import { useSession } from '@/lib/profile';
import { ProfileDialog } from './ProfileDialog';
import { studySearch } from './study-navigation';
import { MedicalBackdrop } from './MedicalBackdrop';

export function ReferenceShell({ children }: { children: ReactNode }) {
  const { dark, toggle } = useTheme();
  const { user, profile, setProfile } = useSession();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const location = useRouterState({ select: s => s.location });
  const view = studySearch(location.search as Record<string, unknown>).view;
  const links = [
    { label: 'Dashboard', path: '/dashboard', active: location.pathname === '/dashboard' || (location.pathname === '/app' && !view) },
    { label: 'Roadmap', path: '/roadmap', active: location.pathname === '/roadmap' },
    { label: 'Sheets', path: '/sheets', active: location.pathname === '/sheets' },
    { label: 'Kapsules', path: '/flashcards', active: location.pathname === '/flashcards' },
    { label: 'QBank', path: '/qbank', active: location.pathname === '/qbank' },
  ] as const;
  return <div className="study-theme reference-theme min-h-dvh bg-background text-foreground">
    <header className="reference-header">
      <div className="reference-nav">
        <Link to="/dashboard" className="reference-brand" aria-label="Wisen dashboard"><Sparkles className="size-6 text-primary"/><span>Wisen<span className="text-primary italic"> AI</span></span><span className="reference-beta">STUDY</span></Link>
        <nav className={`reference-links ${menu ? 'is-open' : ''}`} aria-label="Study navigation">
          {links.map(item => <Link key={item.label} to={item.path} aria-current={item.active ? 'page' : undefined} onClick={() => setMenu(false)}>{item.label}</Link>)}
          <Link to="/app" search={{view:'courses'}} aria-current={view==='courses'?'page':undefined} onClick={() => setMenu(false)}>Library</Link>
        </nav>
        <div className="flex items-center gap-1">
          {user && profile ? <Button variant="ghost" size="icon" aria-label="Profile settings" title="Profile settings" onClick={() => setEditing(true)}><UserRound/></Button> : <Button className="reference-signin" asChild><Link to="/login"><LogIn/>Sign in</Link></Button>}
          <Button variant="ghost" size="icon" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'} onClick={toggle}>{dark ? <Sun/> : <Moon/>}</Button>
          <Button variant="ghost" size="icon" className="reference-menu" aria-label="Toggle navigation" aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</Button>
        </div>
      </div>
    </header>
    <div className="reference-background" aria-hidden="true"/>
    <MedicalBackdrop/>
    <div className="reference-content">{children}</div>
    {user && profile && <ProfileDialog open={editing} onOpenChange={setEditing} user={user} profile={profile} onSaved={setProfile}/>}
  </div>;
}