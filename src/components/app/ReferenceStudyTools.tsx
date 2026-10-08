import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowRight, BookOpen, Check, FileText, Layers, Loader2, LogIn, Paperclip, Search, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/profile';
import { generateFlashcards, generateQuestions } from '@/lib/ai/study.functions';
import { askWisenAI } from '@/lib/ai/client';
import { useCurriculum } from './Curriculum';
import { emptyScope, resolveScope, ScopePicker } from './ScopePicker';
import { extractMaterial, fileText, reloadAi } from './ai-store';
import { addNote, flushStudentData, log, update, useAppState } from './store';
import { RichText } from './RichText';
import { Flashcards } from './Flashcards';
import { Practice } from './QBank';
import { useRemoteQuestions } from './remote';

const topics = [['MI','Myocardial Infarction','Cardiology'],['PN','Pneumonia','Pulmonology'],['DKA','Diabetic Ketoacidosis','Endocrinology'],['CVA','Ischemic Stroke','Neurology'],['NS','Nephrotic Syndrome','Nephrology'],['SEP','Sepsis','Critical Care']];
export function ReferenceStudyTool({ kind }: { kind: 'sheets'|'cards'|'qbank' }) {
  return kind === 'cards' ? <Flashcards/> : <LegacyStudyTool kind={kind}/>;
}
function LegacyStudyTool({ kind }: { kind: 'sheets'|'cards'|'qbank' }) {
  const { user } = useSession(); const { tree } = useCurriculum(); useRemoteQuestions();
  const [topic,setTopic] = useState(''), [notes,setNotes] = useState(''), [sc,setSc] = useState(emptyScope);
  const [count,setCount] = useState(12), [difficulty,setDifficulty] = useState('Board-style'), [focus,setFocus] = useState('General');
  const [ground,setGround] = useState(true), [busy,setBusy] = useState(''), [result,setResult] = useState(''), [review,setReview] = useState(false), [flipped,setFlipped] = useState(false);
  const file = useRef<HTMLInputElement>(null); const genCards=useServerFn(generateFlashcards),genQs=useServerFn(generateQuestions);
  const s=useAppState(); const saved=s.notes.filter(n=>n.source==='Study Sheet');
  const generate=async()=>{
    if(kind!=='sheets'&&!user){toast.error('Sign in to save your study material.');return;}
    const scope=resolveScope(tree,sc);
    if(!notes.trim()&&!scope.files.length){toast.error('Paste course notes, attach a file, or choose course material.');return;}
    try {
      setBusy('Reading your material…');
      const material=notes.trim()?[{name:topic||'Course notes',text:notes}]:await extractMaterial(scope.files,6);
      if(!material.length)throw new Error('No readable course text was found.');
      setBusy('Wisen AI is writing…');
      if(kind==='sheets'){
        const response=await askWisenAI({action:'Summarize',message:`Create a ${difficulty} ${focus} study sheet on ${topic||scope.label}. Use only the attached material. Organize into Overview, Key concepts, Mechanisms, Clinical relevance and Active recall. ${ground?'Include source references.':''}`,subject:scope.subject||topic,title:topic||scope.label||'Course notes',page:1,pages:[],history:[],attachment:{name:material.map(m=>m.name).join(', '),text:material.map(m=>m.text).join('\n').slice(0,38000)}});
        setResult([response.text,...(response.points??[])].join('\n\n'));
      }else if(kind==='cards'){
        const rows=await genCards({data:{subject:scope.subject||topic||'My Course',scope:topic||scope.label,count,material}});await reloadAi();
        update(st=>({...st,flash:{...st.flash,source:'ai',cardId:rows[0]?`aic-${rows[0].id}`:null,flipped:false}}));setReview(true);log(`Generated ${rows.length} Kapsules · ${topic||scope.label}`);
      }else{
        const rows=await genQs({data:{mode:'qbank',qtype:'SCQ',difficulty:difficulty==='Foundational'?'Easy':difficulty==='Clinical'?'Medium':'Hard',count,subject:scope.subject||topic||'My Course',unit:scope.unit,lesson:scope.lesson||topic,material,pastEmds:[]}});await reloadAi();
        update(st=>({...st,qbank:{subject:scope.subject||topic||'My Course',lesson:scope.lesson||topic,difficulty:'All',order:rows.map(r=>`ai-${r.id}`),i:0,answers:{},startedAt:Date.now()}}));setReview(true);
      }
    }catch(e){toast.error(e instanceof Error?e.message:'Generation failed.');}finally{setBusy('');}
  };
  const attach=async(f?:File)=>{if(!f)return;setBusy('Reading file…');try{setNotes(f.type==='application/pdf'||f.name.endsWith('.pdf')?await fileText(f):await f.text());setTopic(f.name);}catch{toast.error('This file could not be read.');}finally{setBusy('');}};
  const controls=<><div className="tool-field"><span>Cards</span><div className="tool-segment">{[8,12,20].map(n=><Button key={n} variant={count===n?'default':'ghost'} onClick={()=>setCount(n)}>{n}</Button>)}</div></div><div className="tool-field"><span>Difficulty</span><div className="tool-segment">{['Foundational','Clinical','Board-style'].map(d=><Button key={d} variant={difficulty===d?'default':'ghost'} onClick={()=>setDifficulty(d)}>{d}</Button>)}</div></div><div className="tool-field"><span>Focus</span><div className="tool-segment">{['General','Mechanism','Management','Pharm'].map(f=><Button key={f} variant={focus===f?'default':'ghost'} onClick={()=>setFocus(f)}>{f}</Button>)}</div></div><label className="tool-ground"><input type="checkbox" checked={ground} onChange={e=>setGround(e.target.checked)}/>Ground in course material</label><div className="tool-material"><ScopePicker tree={tree} value={sc} onChange={setSc}/><textarea aria-label="Course notes" placeholder="Paste course notes or attach a file…" value={notes} onChange={e=>setNotes(e.target.value)}/></div><Button variant="ghost" onClick={()=>file.current?.click()}><Paperclip/>Attach material</Button><Button className="tool-generate" disabled={!!busy||(!topic&&!sc.s&&!notes)} onClick={()=>void generate()}>{busy?<Loader2 className="animate-spin"/>:<Sparkles/>}{busy||`Generate ${kind==='cards'?'Kapsules':'questions'}`}</Button></>;
  return <main className={`reference-page ${kind==='sheets'?'sheets-page':''}`}><input ref={file} type="file" accept=".pdf,.txt,.md" hidden onChange={e=>void attach(e.target.files?.[0])}/>
    <header className="tool-page-heading"><span className="tool-kicker">{kind==='sheets'?'STUDY SHEET · AI-POWERED':kind==='cards'?'KAPSULES · SPACED REPETITION':'QBANK · EMD PRACTICE'}</span><h1>{kind==='sheets'?<>Generate your <em>study sheet.</em></>:kind==='cards'?<>Study any topic, <em>lock it in.</em></>:<>Questions on <em>anything you like.</em></>}</h1><p>{kind==='sheets'?'Name a topic or paste your notes. Build a focused sheet from your course material.':kind==='cards'?'Enter a medical topic — a deck of active-recall cards is written from your material, then scheduled so you see each one just before it slips.':'Name a topic and a question set is written from your medical course material. Your sets are saved so you can practice and review them later.'}</p></header>
    {kind==='sheets'?<>
      <form className="sheet-composer" onSubmit={e=>{e.preventDefault();void generate();}}><textarea aria-label="Topic or notes" placeholder={'A topic, a question, or your notes — e.g. Heart failure, or “why does hyperkalemia change the ECG?”'} value={notes} onChange={e=>{setNotes(e.target.value);setTopic(e.target.value.split('\n')[0]?.slice(0,100)||'');}}/><div className="sheet-options"><select aria-label="Focus" value={focus} onChange={e=>setFocus(e.target.value)}>{['General','Mechanism','Management','Pharm'].map(x=><option key={x}>{x}</option>)}</select><select aria-label="Level" value={difficulty} onChange={e=>setDifficulty(e.target.value)}>{['Basic','Clinical','Board-style'].map(x=><option key={x}>{x}</option>)}</select><span>High-yield</span><label><input type="checkbox" checked={ground} onChange={e=>setGround(e.target.checked)}/>Sources on</label><Button type="button" variant="ghost" size="icon" aria-label="Attach source file" onClick={()=>file.current?.click()}><Paperclip/></Button><Button type="submit" disabled={!!busy||!notes.trim()}>{busy?<Loader2 className="animate-spin"/>:<Sparkles/>}{busy||'Generate'}<ArrowRight/></Button></div></form>
      <div className="sheet-account"><BookOpen/><span>{user?'Study sheets can be saved to your account.':'Sign in to save your study sheets and learning progress.'}</span>{!user&&<Button variant="outline" asChild><Link to="/login">Sign in</Link></Button>}</div>
      <div className="sheet-topics"><span>TRY</span>{['Heart Failure','Diabetic Ketoacidosis','Warfarin','Urea Cycle','Community-Acquired Pneumonia','Ischemic Stroke'].map(t=><Button key={t} variant="outline" onClick={()=>{setTopic(t);setNotes(`${t}\n\n`);}}><Sparkles/>{t}</Button>)}</div>
      {result?<section className="sheet-result"><RichText text={result}/><Button onClick={()=>{addNote(result,topic||'Study Sheet','Study Sheet');void flushStudentData().catch(()=>toast.error('Please try saving again.'));toast.success('Study sheet saved');}}><Check/>Save sheet</Button></section>:<div className="sheet-steps">{[['Name a topic','A disease, a drug, a pathway — or paste your own notes.'],['Watch it write','A focused summary grounded in your medical material.'],['Study it','Review the concepts, make Kapsules, and practice in QBank.']].map(([title,text],i)=><div key={title}><span className="reference-tool-icon">{i===0?<FileText/>:i===1?<Sparkles/>:<BookOpen/>}</span><div><strong>{title}</strong><p>{text}</p></div></div>)}</div>}
      {!!saved.length&&<section className="saved-sheets"><h2>Your sheets</h2>{saved.map(n=><Button key={n.id} variant="outline" onClick={()=>setResult(n.text)}>{n.subject}</Button>)}</section>}
    </>:kind==='qbank'&&!user?<div className="tool-signin"><span className="reference-tool-icon"><LogIn/></span><strong>Sign in to generate questions</strong><p>Generated sets are saved to your account so you can sit them and review them later.</p><Button asChild><Link to="/login"><LogIn/>Sign In to Start</Link></Button></div>:<>
      <div className="tool-stepper"><span>1 <b>Pick a topic</b></span><span>2 <b>Shape the {kind==='cards'?'deck':'set'}</b></span><span>3 <b>{kind==='cards'?'Review on schedule':'Start practice'}</b></span></div>
      <div className="tool-config-layout"><aside><section className="tool-config"><h2>Medical topic</h2><label className="tool-search"><Search/><input aria-label="Medical topic" placeholder="Heart failure, pneumonia, DKA…" value={topic} onChange={e=>setTopic(e.target.value)}/></label><span className="tool-kicker">POPULAR TOPICS</span><div className="popular-topics">{topics.map(([abbr,t,system])=><Button key={t} variant="ghost" onClick={()=>setTopic(t??'')}><span>{abbr}</span><div><strong>{t}</strong><small>{system}</small></div></Button>)}</div></section><section className="tool-config"><h2>Shape the {kind==='cards'?'deck':'set'}</h2>{controls}</section><Button variant="outline" className="w-full mt-3" onClick={()=>setReview(!review)}><Layers/>{review?'Configure':'Review saved material'}</Button></aside>
      <section className="tool-preview"><div className="tool-preview-heading"><h2>{review?'Your study session':kind==='cards'?'What a card looks like':'Your question set'}</h2><span>{review?'Saved to your account':'Preview'}</span></div>{review?(kind==='cards'?<Flashcards/>:<Practice source="ai"/>):<><Button variant="outline" className="preview-card" onClick={()=>setFlipped(!flipped)}><span className="reference-eyebrow">{flipped?'ANSWER':'QUESTION'}</span><p>{kind==='cards'?(flipped?'Review the answer from your own saved course material.':'Your generated Kapsule will appear here, with a concise question drawn from your medical material.'):'Choose your topic and material to generate an original question set.'}</p><small>{flipped?'Turn back to the question':'Tap to turn the card'}</small></Button>{kind==='cards'&&<div className="preview-ratings">{['Again','Hard','Good','Easy'].map((r,i)=><Button key={r} variant="outline" disabled>{r}<small>{['<1 min','6 min','1 day','4 days'][i]}</small></Button>)}</div>}</>}</section></div>
    </>}
  </main>;
}