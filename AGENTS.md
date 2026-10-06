<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Team roles live in `user_roles` + `team_members`; every Team server fn in `src/lib/team.functions.ts` re-checks role/status via `requireTeam` — frontend role state is never trusted.
- Team content writes go through `saveContent`/`deleteContent` so every change is audited and QBank edits snapshot to `question_versions`.
- Student QBank reads the same `subjects → units → lessons → qbank_questions` tables, scoped by profile via RLS (`student_can_see_subject`).
- Resource files use a private `resources` bucket accessed only through server-issued signed URLs (no storage policies).
- Wisen AI runs on `google/gemini-3.8-flash` via `src/lib/ai/gateway.server.ts` (user choice); the model name never appears in UI or messages.
- AI-generated questions/flashcards are saved per student in `ai_questions` / `ai_flashcards` (own-row RLS); MCQ answers are a bitmask in the client so scoring stays a number compare.
- Previous-year EMDs are `lesson_resources.kind = 'past_emd'`; they're hidden from My Courses and used only as style reference for AI exams.
- Course material is extracted to text in the browser (pdf.js) before being sent to Wisen AI.
- Student personal study data (bookmarks, notes, attempts, exam history, SRS card state, activity) lives in `student_data` (one own-row RLS row per user), synced by `src/components/app/store.ts`; localStorage is only a per-user cache keyed `wisen-app-state:<uid>` so accounts on a shared browser never mix.
- `/api/curriculum-file/$id` verifies the bearer with the auth server and reads `lesson_resources` as the caller, so RLS alone decides file access; it serves the stored MIME type and rejects Drive HTML interstitials.
