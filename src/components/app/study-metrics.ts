import type { AppState } from './store';
import type { Question } from './data';
export function studyMetrics(s: AppState, pool: Question[]) {
 const lessons = Object.entries(s.attempts).filter(([,a])=>a.total>0).map(([name,a])=>({name,...a,subject:s.questionResults ? Object.values(s.questionResults).find(r=>r.question.topic===name)?.question.subject ?? pool.find(q=>q.topic===name)?.subject ?? 'Course' : 'Course', pct:Math.round(a.correct/a.total*100)}));
 const subjects = [...new Set(lessons.map(l=>l.subject))].map(name=>{const rows=lessons.filter(l=>l.subject===name);const total=rows.reduce((n,l)=>n+l.total,0);const correct=rows.reduce((n,l)=>n+l.correct,0);return {name,total,correct,pct:Math.round(correct/total*100)};}).sort((a,b)=>b.pct-a.pct);
 const total=lessons.reduce((n,l)=>n+l.total,0), correct=lessons.reduce((n,l)=>n+l.correct,0);
 return {lessons,subjects,total,correct,accuracy:total?Math.round(correct/total*100):null,strongest:subjects[0],focus:subjects.at(-1),retention:s.reviewHistory.length?Math.round(s.reviewHistory.filter(r=>r.rating==='Good'||r.rating==='Easy').length/s.reviewHistory.length*100):null};
}
