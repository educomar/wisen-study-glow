import aliases from '@/data/academic-name-aliases.json';

/** Exact aliases only: never rewrite medical prose or unrelated custom topics. */
export function academicName(name: string, subject?: string): string {
  const matches = aliases.filter(row => row.old === name && (!subject || row.subject === subject));
  const targets = new Set(matches.map(row => row.name));
  return targets.size === 1 ? matches[0]?.name ?? name : name;
}
