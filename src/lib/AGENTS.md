## Team server rules
- Faculty QBank questions store correct options in `qbank_questions.answers` (jsonb indices, `answer` kept as first index for legacy reads); bulk/AI imports go through team-checked `bulkImportQuestions`/`aiParseQuestions` so every batch is audited and only reviewed drafts are saved.
- Drive curriculum imports (`drive-import.functions.ts`) are team-checked, audited, and skip existing `gdrive:` paths so re-imports never duplicate files.
