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
