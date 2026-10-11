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
- `/home` is a legacy redirect to /dashboard; dashboard and study tools share persisted student state, and /app search views preserve older study deep links.
- Manual planner tasks are individual own-row RLS records in `study_tasks`; question results, review events and sessions extend `student_data` so student tools share persisted history.
- Study-only theme overrides are scoped to `.study-theme` so redesigns do not change the public website or team workspace.
- ReferenceShell wraps /dashboard, /roadmap, /workspace, /sheets, /flashcards, /qbank, /library and legacy /app with one horizontal navigation and a browser canvas medical backdrop; the page tools reuse existing authorized generation and persistence functions to keep student data ownership intact.
- /workspace composes CourseReader and the existing WisenChat in parallel; selected-passage actions reuse authorized AI and student_data notes/cards, while /sheets remains the dedicated sheet tool.
- CourseReader remains standalone in legacy study views; the parallel workspace intercepts selection actions and citation jumps so they never navigate away from the two-pane session.
- General weakness and lesson-performance analytics live in StudyProgress; QBank shows only scope, practice and current-session results.
- Roadmap derives semester groups and search results in the browser from the authorized curriculum tree and existing academic knowledge; annual content is shared across semesters and academic totals deduplicate IDs, avoiding duplicated counts or invented assignments.
- Study Sheets uses sequential existing Wisen server-function calls per section for truthful completion progress; structured sheets stay in student notes and exact embedded cards save to the own-row AI card table, avoiding regenerated card answers.
- Study Sheets passes an explicit output-language override through the validated AI request into the system prompt and formats curriculum labels only for display; this avoids auto-detected source languages and leaves other study tools and canonical curriculum metadata unchanged.
- Kapsules routes reuse Flashcards as one active hub; scheduling is isolated in kapsule-review and curriculum generation passes a validated English override, preserving authorized storage and consistent review behavior across entry points.
- /qbank is EmdQBank: Past EMDs are transcribed once per student from authorized past_emd files into ai_questions (origin 'past', unit = academic year) and cached; the EMD Simulator reuses generateQuestions and the persisted exam session, with /20 scoring in emd-exam.ts so results stay consistent across entry points.
- /library is a read-only index over the existing own-row student notes and Kapsules stores; actions deep-link into Sheets, Kapsules and QBank so saved content is never duplicated into a parallel persistence model.

- Workspace studio styles and palette are scoped to workspace and its portals; its copilot composes AI Elements over the existing chat transport, preserving conversation persistence and authorized study actions.
