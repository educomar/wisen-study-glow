import { translate, useLang } from '@/lib/i18n';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowRight, BookOpen, Check, FileText, Layers, Loader2, LogIn, Paperclip, Search, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/profile';
import { generateQuestions } from '@/lib/ai/study.functions';
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
  const { t: translate } = useLang();
  return kind === 'cards' ? <Flashcards/> : <LegacyStudyTool kind={kind}/>;
}
function LegacyStudyTool({ kind }: { kind: 'sheets'|'qbank' }) {
  const { t: translate } = useLang();
  const { user } = useSession(); const { tree } = useCurriculum(); useRemoteQuestions();
  const [topic,setTopic] = useState(''), [notes,setNotes] = useState(''), [sc,setSc] = useState(emptyScope);
  const [count,setCount] = useState(12), [difficulty,setDifficulty] = useState('Board-style'), [focus,setFocus] = useState('General');
  const [ground,setGround] = useState(true), [busy,setBusy] = useState(''), [result,setResult] = useState(''), [review,setReview] = useState(false);
  const file = useRef<HTMLInputElement>(null); const genQs=useServerFn(generateQuestions);
  const s=useAppState(); const saved=s.notes.filter(n=>n.source==='Study Sheet');
  const generate=async()=>{
    if(kind!=='sheets'&&!user){toast.error(translate('Sign in to save your study material.'));return;}
    const scope=resolveScope(tree,sc);
    if(!notes.trim()&&!scope.files.length){toast.error(translate('Paste course notes, attach a file, or choose course material.'));return;}
    try {
      setBusy('Reading your material…');
      const material=notes.trim()?[{name:topic||'Course notes',text:notes}]:await extractMaterial(scope.files,6);
      if(!material.length)throw new Error('No readable course text was found.');
      setBusy('Wisen AI is writing…');
      if(kind==='sheets'){
        const response=await askWisenAI({action:'Summarize',message:`Create a ${difficulty} ${focus} study sheet on ${topic||scope.label}. Use only the attached material. Organize into Overview, Key concepts, Mechanisms, Clinical relevance and Active recall. ${ground?'Include source references.':''}`,subject:scope.subject||topic,title:topic||scope.label||'Course notes',page:1,pages:[],history:[],attachment:{name:material.map(m=>m.name).join(', '),text:material.map(m=>m.text).join('\n').slice(0,38000)}});
        setResult([response.text,...(response.points??[])].join('\n\n'));
      }else{
        const rows=await genQs({data:{mode:'qbank',qtype:'SCQ',difficulty:difficulty==='Foundational'?'Easy':difficulty==='Clinical'?'Medium':'Hard',count,subject:scope.subject||topic||'My Course',unit:scope.unit,lesson:scope.lesson||topic,material,pastEmds:[]}});await reloadAi();
        update(st=>({...st,qbank:{subject:scope.subject||topic||'My Course',lesson:scope.lesson||topic,difficulty:'All',order:rows.map(r=>`ai-${r.id}`),i:0,answers:{},startedAt:Date.now()}}));setReview(true);
      }
    }catch(e){toast.error(e instanceof Error ? e.message : translate('Generation failed.'));}finally{setBusy('');}
  };
  const attach=async(f?:File)=>{if(!f)return;setBusy('Reading file…');try{setNotes(f.type==='application/pdf'||f.name.endsWith('.pdf')?await fileText(f):await f.text());setTopic(f.name);}catch{toast.error(translate('This file could not be read.'));}finally{setBusy('');}};
  const controls=<><div className="tool-field"><span>{translate("Cards")}</span><div className="tool-segment">{[8,12,20].map(n=><Button key={n} variant={count===n?'default':'ghost'} onClick={()=>setCount(n)}>{n}</Button>)}</div></div><div className="tool-field"><span>{translate("Difficulty")}</span><div className="tool-segment">{['Foundational','Clinical','Board-style'].map(d=><Button key={d} variant={difficulty===d?'default':'ghost'} onClick={()=>setDifficulty(d)}>{translate(d)}</Button>)}</div></div><div className="tool-field"><span>{translate("Focus")}</span><div className="tool-segment">{['General','Mechanism','Management','Pharm'].map(f=><Button key={f} variant={focus===f?'default':'ghost'} onClick={()=>setFocus(f)}>{f}</Button>)}</div></div><label className="tool-ground"><input type="checkbox" checked={ground} onChange={e=>setGround(e.target.checked)}/>{translate("Ground in course material")}</label><div className="tool-material"><ScopePicker tree={tree} value={sc} onChange={setSc}/><textarea aria-label={translate("Course notes")} placeholder={translate("Paste course notes or attach a file…")} value={notes} onChange={e=>setNotes(e.target.value)}/></div><Button variant="ghost" onClick={()=>file.current?.click()}><Paperclip/>{translate("Attach material")}</Button><Button className="tool-generate" disabled={!!busy||(!topic&&!sc.s&&!notes)} onClick={()=>void generate()}>{busy?<Loader2 className="animate-spin"/>:<Sparkles/>}{busy||`Generate ${'questions'}`}</Button></>;
  return <main className={`reference-page ${kind==='sheets'?'sheets-page':''}`}><input ref={file} type="file" accept=".pdf,.txt,.md" hidden onChange={e=>void attach(e.target.files?.[0])}/>
    <header className="tool-page-heading"><span className="tool-kicker">{kind==='sheets' ? translate('STUDY SHEET · AI-POWERED') : translate('QBANK · EMD PRACTICE')}</span><h1>{kind==='sheets'?<>{translate("Generate your")} <em>{translate("study sheet.")}</em></>:<>{translate("Questions on")} <em>{translate("anything you like.")}</em></>}</h1><p>{kind==='sheets' ? translate('Name a topic or paste your notes. Build a focused sheet from your course material.') : translate('Name a topic and a question set is written from your medical course material. Your sets are saved so you can practice and review them later.')}</p></header>
    {kind==='sheets'?<>
      <form className="sheet-composer" onSubmit={e=>{e.preventDefault();void generate();}}><textarea aria-label={translate("Topic or notes")} placeholder={translate('A topic, a question, or your notes — e.g. Heart failure, or “why does hyperkalemia change the ECG?”')} value={notes} onChange={e=>{setNotes(e.target.value);setTopic(e.target.value.split('\n')[0]?.slice(0,100)||'');}}/><div className="sheet-options"><select aria-label={translate("Focus")} value={focus} onChange={e=>setFocus(e.target.value)}>{['General','Mechanism','Management','Pharm'].map(x=><option key={x} value={x}>{translate(x)}</option>)}</select><select aria-label={translate("Level")} value={difficulty} onChange={e=>setDifficulty(e.target.value)}>{['Basic','Clinical','Board-style'].map(x=><option key={x} value={x}>{translate(x)}</option>)}</select><span>{translate("High-yield")}</span><label><input type="checkbox" checked={ground} onChange={e=>setGround(e.target.checked)}/>{translate("Sources on")}</label><Button type="button" variant="ghost" size="icon" aria-label={translate("Attach source file")} onClick={()=>file.current?.click()}><Paperclip/></Button><Button type="submit" disabled={!!busy||!notes.trim()}>{busy?<Loader2 className="animate-spin"/>:<Sparkles/>}{busy||'Generate'}<ArrowRight/></Button></div></form>
      <div className="sheet-account"><BookOpen/><span>{user ? translate('Study sheets can be saved to your account.') : translate('Sign in to save your study sheets and learning progress.')}</span>{!user&&<Button variant="outline" asChild><Link to="/login">{translate("Sign in")}</Link></Button>}</div>
      <div className="sheet-topics"><span>{translate("TRY")}</span>{['Heart Failure','Diabetic Ketoacidosis','Warfarin','Urea Cycle','Community-Acquired Pneumonia','Ischemic Stroke'].map(t=><Button key={t} variant="outline" onClick={()=>{setTopic(t);setNotes(`${t}\n\n`);}}><Sparkles/>{translate(t)}</Button>)}</div>
      {result?<section className="sheet-result"><RichText text={result}/><Button onClick={()=>{addNote(result,topic||'Study Sheet','Study Sheet');void flushStudentData().catch(()=>toast.error(translate('Please try saving again.')));toast.success(translate('Study sheet saved'));}}><Check/>{translate("Save sheet")}</Button></section>:<div className="sheet-steps">{[['Name a topic','A disease, a drug, a pathway — or paste your own notes.'],['Watch it write','A focused summary grounded in your medical material.'],['Study it','Review the concepts, make Kapsules, and practice in QBank.']].map(([title,text],i)=><div key={title}><span className="reference-tool-icon">{i===0?<FileText/>:i===1?<Sparkles/>:<BookOpen/>}</span><div><strong>{translate(title)}</strong><p>{translate(text)}</p></div></div>)}</div>}
      {!!saved.length&&<section className="saved-sheets"><h2>{translate("Your sheets")}</h2>{saved.map(n=><Button key={n.id} variant="outline" onClick={()=>setResult(n.text)}>{n.subject}</Button>)}</section>}
    </>:kind==='qbank'&&!user?<div className="tool-signin"><span className="reference-tool-icon"><LogIn/></span><strong>{translate("Sign in to generate questions")}</strong><p>{translate("Generated sets are saved to your account so you can sit them and review them later.")}</p><Button asChild><Link to="/login"><LogIn/>{translate("Sign In to Start")}</Link></Button></div>:<>
      <div className="tool-stepper"><span>1 <b>{translate("Pick a topic")}</b></span><span>2 <b>{translate("Shape the")} {translate('set')}</b></span><span>3 <b>{translate('Start practice')}</b></span></div>
      <div className="tool-config-layout"><aside><section className="tool-config"><h2>{translate("Medical topic")}</h2><label className="tool-search"><Search/><input aria-label={translate("Medical topic")} placeholder={translate("Heart failure, pneumonia, DKA…")} value={topic} onChange={e=>setTopic(e.target.value)}/></label><span className="tool-kicker">{translate("POPULAR TOPICS")}</span><div className="popular-topics">{topics.map(([abbr,t,system])=><Button key={t} variant="ghost" onClick={()=>setTopic(t??'')}><span>{abbr}</span><div><strong>{translate(t)}</strong><small>{system}</small></div></Button>)}</div></section><section className="tool-config"><h2>{translate("Shape the")} {translate('set')}</h2>{controls}</section><Button variant="outline" className="w-full mt-3" onClick={()=>setReview(!review)}><Layers/>{review ? translate('Configure') : translate('Review saved material')}</Button></aside>
      <section className="tool-preview"><div className="tool-preview-heading"><h2>{review ? translate('Your study session') : translate('Your question set')}</h2><span>{review ? translate('Saved to your account') : translate('Preview')}</span></div>{review?<Practice source="ai"/>:<p className="tool-preview-empty">{translate("Choose your topic and material to generate an original question set.")}</p>}</section></div>
    </>}
  </main>;
}