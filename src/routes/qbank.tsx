import { createFileRoute } from '@tanstack/react-router';
import { EmdQBank } from '@/components/app/EmdQBank';
import { studyMeta } from '@/lib/study-meta';
export const Route=createFileRoute('/qbank')({head:()=>studyMeta('QBank · EMD Practice','Practise past UFAS1 EMDs and sit timed EMD simulations with a QCM answer grid and a /20 debrief.'),component:EmdQBank});
