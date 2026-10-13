import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { LogIn, Menu, Moon, Sun, UserRound, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/site/theme';
import { Logo } from '@/components/site/Logo';
import { levelBadge, useSession } from '@/lib/profile';
import { ProfileDialog } from './ProfileDialog';
import { studySearch } from './study-navigation';
import { Toaster } from '@/components/ui/sonner';
import { MedicalBackdrop } from './MedicalBackdrop';
import { LangSwitch, useLang, translate } from '@/lib/i18n';

export function ReferenceShell({ children }: { children: ReactNode }) {
  useLang();
  const { dark, toggle } = useTheme();
  const { t } = useLang();
  const { user, profile, setProfile } = useSession();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const location = useRouterState({ select: s => s.location });
  const navigate = useNavigate();
  useEffect(() => {
    if (location.pathname === '/app') return;
    const open = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const target = studySearch({ view: event.detail }).view;
      if (target) void navigate({ to: '/app', search: { view: target } });
    };
    const review = () => { void navigate({ to: '/app', search: { view: 'cards' } }); };
    window.addEventListener('wisen-open-tool', open);
    window.addEventListener('wisen-review-deck', review);
    return () => { window.removeEventListener('wisen-open-tool', open); window.removeEventListener('wisen-review-deck', review); };
  }, [location.pathname, navigate]);
  const view = studySearch(location.search as Record<string, unknown>).view;
  const links = [
    { label: 'Dashboard', path: '/dashboard', active: location.pathname === '/dashboard' || (location.pathname === '/app' && !view) },
    { label: 'Roadmap', path: '/roadmap', active: location.pathname === '/roadmap' },
    { label: 'Workspace', path: '/workspace', active: location.pathname === '/workspace' },
    { label: 'Kapsules', path: '/flashcards', active: location.pathname === '/flashcards' },
    { label: 'QBank', path: '/qbank', active: location.pathname === '/qbank' },
    { label: 'Library', path: '/library', active: location.pathname === '/library' },
  ] as const;
  return <div className="study-theme reference-theme min-h-dvh bg-background text-foreground">
    <header className="reference-header">
      <div className="reference-nav">
        <Link to="/dashboard" className="reference-brand" aria-label={translate("Wisen dashboard")}><Logo className="reference-logo"/></Link>
        <nav className={`reference-links ${menu ? 'is-open' : ''}`} aria-label={translate("Study navigation")}>
          {links.map(item => <Link key={item.label} to={item.path} aria-current={item.active ? 'page' : undefined} onClick={() => setMenu(false)}>{t(item.label)}</Link>)}
        </nav>
        <div className="flex items-center gap-1">
          {user && profile && <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground" title={t("Your enrolled level")}>{levelBadge(profile)}</span>}
          {user && profile ? <Button variant="ghost" size="icon" aria-label={translate("Profile settings")} title={translate("Profile settings")} onClick={() => setEditing(true)}><UserRound/></Button> : <Button className="reference-signin" asChild><Link to="/login"><LogIn/>{t("Sign in")}</Link></Button>}
          <LangSwitch className="mr-1"/>
          <Button variant="ghost" size="icon" aria-label={dark ? translate('Switch to light mode') : translate('Switch to dark mode')} title={dark ? translate('Light mode') : translate('Dark mode')} onClick={toggle}>{dark ? <Sun/> : <Moon/>}</Button>
          <Button variant="ghost" size="icon" className="reference-menu" aria-label={translate("Toggle navigation")} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</Button>
        </div>
      </div>
    </header>
    <div className="reference-background" aria-hidden="true"/>
    <MedicalBackdrop/>
    <div className="reference-content">{children}</div>
    {location.pathname !== '/app' && <Toaster/>}
    {user && profile && <ProfileDialog open={editing} onOpenChange={setEditing} user={user} profile={profile} onSaved={setProfile}/>}
  </div>;
}