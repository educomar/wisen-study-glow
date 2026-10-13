import { translate, useLang, getLocale } from '@/lib/i18n';
import { Link } from '@tanstack/react-router';
import { ArrowRight, BookOpen, ChartNoAxesColumn, CheckCircle2, FileText, Flame, FlaskConical, Layers, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/profile';
import { useAppState } from './store';
import { useAi } from './ai-store';

export function StudyDashboard() {
  useLang();
  const state = useAppState();
  const { cards } = useAi();
  const { user } = useSession();
  const [banner, setBanner] = useState(true);
  const now = Date.now();
  const week = now - 7 * 86400000;
  const questions = Object.values(state.questionResults).filter(r => r.t >= week).length;
  const reviewed = state.reviewHistory.filter(r => r.t >= week).length;
  const days = new Set([...state.activity.map(a => a.t), ...state.reviewHistory.map(r => r.t), ...Object.values(state.questionResults).map(r => r.t)].map(t => new Date(t).toDateString()));
  let streak = 0;
  const day = new Date();
  if (!days.has(day.toDateString())) day.setDate(day.getDate() - 1);
  while (days.has(day.toDateString())) { streak++; day.setDate(day.getDate() - 1); }
  const due = Object.values(state.cards).filter(c => c.status !== 'new' && c.due <= now).length;
  const tools = [
    { view: '/workspace', title: 'Workspace', eyebrow: 'RECOMMENDED STARTING POINT', description: 'Read your official lectures beside Wisen AI, and turn passages into notes and Kapsules.', footer: 'Open your lectures', icon: FileText },
    { view: '/flashcards', title: 'Kapsules', eyebrow: 'STUDY TOOL', description: 'Build a spaced-repetition deck from your courses and review until it sticks.', footer: user ? `${due} due today · ${cards.length + state.customCards.length} Kapsules` : 'Sign in to track', icon: Layers },
    { view: '/qbank', title: 'QBank', eyebrow: 'STUDY TOOL', description: 'Practice faculty questions, generate new questions, and prepare for your next EMD.', footer: `${questions} questions this week`, icon: FlaskConical },
    { view: '/roadmap', title: 'Roadmap', eyebrow: 'YOUR CURRICULUM', description: 'Explore your medical subjects and lessons, and keep track of what you have practiced.', footer: 'Explore your curriculum', icon: BookOpen },
  ] as const;
  return <main className="reference-dashboard">
    <section className="reference-intro">
      <div><span className="reference-eyebrow"><span/>{translate("Your study space")}</span><h1>{translate("Make today’s study hour")} <em>{translate("count.")}</em></h1><p>{translate("Pick up where you left off, or start with a focused study session.")}</p></div>
      <div className="reference-session"><span>{translate("YOUR SESSION")}</span><strong>{state.qbank || state.exam.phase === 'run' ? translate('Pick up where you left off') : translate('Ready when you are')}</strong></div>
    </section>
    {banner && <div className="reference-banner"><span className="reference-tool-icon"><Sparkles/></span><div><strong>{translate("Your next study session starts here")}</strong><p>{translate("Open a lecture in your Workspace and study it with Wisen AI.")}</p></div><Button asChild><Link to="/workspace" search={{sheet:''}}>{translate("Start studying")}</Link></Button><Button variant="ghost" size="icon" aria-label={translate("Dismiss study reminder")} onClick={() => setBanner(false)}><X/></Button></div>}
    <section className="reference-progress" aria-label={translate("Your progress")}><h2>{translate("YOUR PROGRESS")}</h2><div className="reference-metrics">
      <div className="reference-metric"><span className="reference-metric-icon"><FileText/></span><strong>{questions}<span>  {translate("questions this week")}</span></strong></div>
      <div className="reference-metric"><span className="reference-metric-icon kapsule"><Layers/></span>{user ? <strong>{reviewed}<span>  {translate("Kapsules reviewed")}</span></strong> : <Link to="/login">{translate("Sign in to track")}</Link>}</div>
      <div className="reference-metric"><span className="reference-metric-icon streak"><Flame/></span><strong>{streak}<span>  {translate("days streak")}</span></strong></div>
      <p className="reference-momentum"><ChartNoAxesColumn/>{translate("A small session today keeps momentum going.")}</p>
    </div></section>
    <section className="reference-tools" aria-labelledby="study-tools"><div className="reference-tools-heading"><div><h2 id="study-tools">{translate("TOOLS · STUDY SMARTER")}</h2><p>{translate("Everything you need, in one place")}</p></div><span className="reference-eyebrow">{translate("04 active tools")}</span></div>
      <div className="reference-tool-grid">{tools.map((tool, i) => <Link key={tool.view} to={tool.view} className={`reference-tool ${i === 0 ? 'recommended' : ''} ${i===3?'roadmap-preview':''}`}><span className="reference-tool-icon"><tool.icon/></span><span className="reference-tool-eyebrow">{translate(tool.eyebrow)}</span><h3>{translate(tool.title)}</h3><p>{translate(tool.description)}</p><div className="reference-tool-footer"><span>{translate(tool.footer)}</span><span className="text-primary">{i===3 ? translate('Roadmap') : translate('Open')} <ArrowRight/></span></div></Link>)}</div>
    </section>
    <div className="reference-tip"><CheckCircle2/><p><strong>{translate("Tip:")}</strong>  {translate("start with a topic you found difficult today — the best next session is usually the one you almost put off.")}</p></div>
    <div className="reference-dashboard-footer"><BookOpen className="size-4"/><span>{translate("Study smarter. Score higher. Pass.")}</span></div>
  </main>;
}