import { createFileRoute } from '@tanstack/react-router';
import { ReferenceStudyTool } from '@/components/app/ReferenceStudyTools';
import { studyMeta } from '@/lib/study-meta';
export const Route=createFileRoute('/qbank')({head:()=>studyMeta('QBank','Generate original medical practice questions grounded in your own academic material.'),component:()=> <ReferenceStudyTool kind="qbank"/>});