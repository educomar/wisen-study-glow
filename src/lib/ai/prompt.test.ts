import { test } from 'node:test';
import { strictEqual, ok } from 'node:assert';
import { prepare } from './prompt';

const request = { message: 'Explique le mécanisme de la gastrulation dans le cours.', action: 'Summarize', subject: 'Embryologie', title: 'Gastrulation', page: 1, excerpts: [], history: [] };

test('English-only sheet requests override French detection and forbid bilingual terms', () => {
  const result = prepare({ ...request, outputLanguage: 'english' });
  strictEqual(result.route.lang, 'english');
  ok(result.system.includes('Respond exclusively in English'));
  ok(result.system.includes('Do not add French translations in parentheses'));
  strictEqual(result.system.includes('Réponds en français'), false);
});

test('other Wisen requests retain automatic language detection', () => {
  strictEqual(prepare(request).route.lang, 'french');
});