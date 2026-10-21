## Team server rules
- Faculty QBank questions store correct options in `qbank_questions.answers` (jsonb indices, `answer` kept as first index for legacy reads); bulk/AI imports go through team-checked `bulkImportQuestions`/`aiParseQuestions` so every batch is audited and only reviewed drafts are saved.
- Drive curriculum imports (`drive-import.functions.ts`) are team-checked, audited, and skip existing `gdrive:` paths so re-imports never duplicate files.
- Past EMDs and AI exams are central `exam_sets` + `exam_set_questions` (team-managed via `exams.functions.ts`, students read only `published` sets in their level); files are never tagged past_emd by name, only by explicit admin choice, so lectures aren't misclassified.
