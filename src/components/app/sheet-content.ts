import type { Profile } from '@/lib/profile';
import type { Tree } from './Curriculum';

export const sheetSections = [
  { id: 'overview', title: 'Overview', instruction: 'Give a concise overview with a definition, location and fundamental purpose. Start with a pretesting question on a separate line: TEASER: question. Then use short paragraphs or bullets.' },
  { id: 'approach', title: 'Clinical / Fundamental Approach', instruction: 'Explain the fundamental approach step by step. Include clinical relevance only when stated in the material. Use concise numbered steps.' },
  { id: 'points', title: 'Key Points', instruction: 'Give 4–6 numbered high-yield points. Where appropriate start a comparison with [VS], a mechanism with [MEC], or differential diagnosis with [DDX]. Use bold for essential terms.' },
  { id: 'hooks', title: 'Memory Hooks', instruction: 'Give 2–4 concise mnemonic memory hooks. Bold the memorable letters. Clearly label newly devised mnemonics as memory aids, not lecture quotes.' },
  { id: 'traps', title: 'Exam Traps', instruction: 'Give 3–4 plausible misunderstandings and contrasting correct facts from the material. Do not invent professor tricks, prior exam patterns or exam guarantees. Use numbered points and a short warning.' },
  { id: 'cards', title: 'Kapsules', instruction: 'Write exactly 4 active-recall cards using this repeated plain format, without extra commentary: Q: question on one line then A: concise answer on the next line. Cover only facts from the material.' },
] as const;
export type SheetSectionId = typeof sheetSections[number]['id'];
export type SheetCard = { front: string; back: string };
export type SheetSource = { name: string; text: string; fileId?: string | undefined };
export type StudySheetData = {
  id: string; topic: string; subject: string; level: string; focus: string;
  sections: Partial<Record<SheetSectionId, string>>; teaser: string;
  cards: SheetCard[]; sources: { name: string; fileId?: string | undefined; pages: string[] }[];
  complete: boolean; cardsAdded: boolean;
};
const firstYearTopics = [
  { topic: 'Femur', subject: 'Anatomy' },
  { topic: 'Brachial Plexus', subject: 'Anatomy' },
  { topic: 'Gastrulation & Neurulation', subject: 'Embryology' },
  { topic: 'First Week of Development', subject: 'Embryology' },
  { topic: 'Epithelial Tissue', subject: 'Histology' },
  { topic: 'Protein Structure', subject: 'Biochemistry' },
  { topic: 'Ionizing Radiation', subject: 'Biophysics' },
];
/** Display-only translations: curriculum IDs and original file metadata stay intact. */
export function englishSheetLabel(value: string): string {
  const translations: [string, string][] = [
    ['organisation des systemes de soins', 'Organization of Healthcare Systems'],
    ['biostatistique et informatique', 'Biostatistics and Computer Science'],
    ['sante, societe et humanite', 'Health, Society and Humanities'],
    ['structure des proteines', 'Protein Structure'], ['plexus brachial', 'Brachial Plexus'],
    ['tissu epithelial', 'Epithelial Tissue'], ['premiere semaine', 'First Week of Development'],
    ['rayonnements ionisants', 'Ionizing Radiation'], ['rayonnement ionisant', 'Ionizing Radiation'],
    ['statistique descriptive', 'Descriptive Statistics'], ['les sondages', 'Sampling Surveys'],
    ['test de khi-deux', 'Chi-square Test'], ['lentilles minces', 'Thin Lenses'],
    ['insuffisance cardiaque', 'Heart Failure'], ['intro humain anatomy', 'Introduction to Human Anatomy'],
    ['le femur', 'Femur'], ['anatomie', 'Anatomy'], ['embryologie', 'Embryology'],
    ['histologie', 'Histology'], ['biochimie', 'Biochemistry'], ['biophysique', 'Biophysics'],
    ['physiologie', 'Physiology'], ['cardiologie', 'Cardiology'], ['cytologie', 'Cytology'],
    ['chimie', 'Chemistry'], ['electrocinetique', 'Electrokinetics'], ['electrostatique', 'Electrostatics'],
    ['biophysics of radiation', 'Biophysics of Radiation'], ['rayonnements', 'Radiation'],
    ['rayonnement', 'Radiation'], ['reflexion', 'Reflection'], ['oeil', 'Eye'],
    ['glucides', 'Carbohydrates'], ['mecanismes', 'Mechanisms'], ['mecanisme', 'Mechanism'],
    ['fondamental', 'Fundamental'], ['approfondi', 'Advanced'], ['special emd', 'EMD Focus'],
    ['anatomie clinique', 'Clinical Anatomy'], ['revision emd', 'EMD Review'],
    ['general', 'General'], ['cours', 'Lectures'], ['cour', 'Lecture'], ['suite', 'Continuation'],
    ['anglais', 'English'], ['francais', 'French'], ['novembre', 'November'],
  ];
  let label = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/_/g, ' ');
  for (const [from, to] of translations) label = label.replace(new RegExp(`\\b${from}\\b`, 'gi'), to);
  return label;
}
export function sheetSuggestions(profile: Pick<Profile, 'academic_year' | 'department'> | null, tree: Tree | null) {
  if (!profile || (profile.academic_year === 1 && profile.department === 'Medicine')) return firstYearTopics;
  return (tree ?? []).flatMap(s => s.units.flatMap(u => u.lessons.map(l => ({ topic: englishSheetLabel(l.name), subject: englishSheetLabel(s.name) })))).slice(0, 8);
}
export function parseSheetCards(text: string): SheetCard[] {
  const cards: SheetCard[] = [];
  const matches = text.matchAll(/(?:^|\n)\s*(?:\d+[.)]\s*)?(?:\*\*)?Q\s*:\s*(.+?)(?:\*\*)?\s*\n\s*(?:\*\*)?A\s*:\s*([\s\S]+?)(?=\n\s*(?:\d+[.)]\s*)?(?:\*\*)?Q\s*:|$)/g);
  for (const m of matches) {
    const front = m[1]?.replace(/\*\*/g, '').trim();
    const back = m[2]?.replace(/\*\*/g, '').trim();
    if (front && back) cards.push({ front, back });
  }
  return cards.slice(0, 4);
}
export function splitTeaser(text: string) {
  const teaser = text.match(/^\s*TEASER:\s*(.+)$/im)?.[1]?.trim() ?? '';
  return { teaser, body: text.replace(/^\s*TEASER:.*\n?/im, '').trim() };
}
export function sourcePages(text: string) {
  return [...new Set([...text.matchAll(/\[Page\s+(\d+)\]/g)].map(m => m[1]).filter((p): p is string => Boolean(p)))];
}
export function readableSheet(sheet: StudySheetData) {
  return [sheet.topic, `${sheet.level} · ${sheet.focus} · UFAS1 Sétif`, ...sheetSections.map(s => `${s.title}\n${sheet.sections[s.id] ?? ''}`), `Sources\n${sheet.sources.map(s => s.name).join('\n')}`].join('\n\n');
}