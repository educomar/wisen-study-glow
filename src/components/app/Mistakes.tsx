import { useState } from 'react';
import { Layers, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { addCard, useAppState } from './store';
import { QuestionView } from './QBank';
import { isCorrectOption } from './ai-store';
export function Mistakes(){
 const s=useAppState();const [retry,setRetry]=useState<string|null>(null);
 const wrong=Object.values(s.questionResults).filter(r=>!r.correct).sort((a,b)=>b.t-a.t);
 return <div className="mx-auto max-w-4xl space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">{wrong.length} questions to revisit</h2><Button variant="outline" disabled={!wrong.length} onClick={()=>{wrong.forEach(({question:q})=>addCard(q.stem,q.options.filter((_,k)=>isCorrectOption(q,k)).join(' · '),q.why,q.topic,q.source));toast('Mistakes saved as Kapsules');}}><Layers/>Convert mistakes into Kapsules</Button></div>{wrong.map(({question:q,picked})=><section key={q.id} className="space-y-2"><Button variant="ghost" size="sm" onClick={()=>setRetry(q.id)}><RotateCcw/>Retry · {q.topic}</Button><QuestionView key={`${q.id}-${retry===q.id}`} q={q} {...(retry===q.id?{}:{picked,onPick:()=>undefined})}/></section>)}{!wrong.length && <p className="py-16 text-center text-sm text-muted-foreground">No mistakes to review</p>}</div>;
}
