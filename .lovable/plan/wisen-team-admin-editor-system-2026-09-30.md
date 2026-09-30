# Wisen Team: Admin & Editor system

## What you get
- A separate Team sign-in at `/team/login` (email + password, Google). Team members skip student onboarding.
- First Admin: a one-time "Admin setup" form that asks for the code WISENTBB19. The code is checked on the server only and stops working once an Admin exists.
- Team area at `/admin` with a different sidebar per role:
  - Admin: Dashboard, QBank, Subjects, Files & Sources, Flashcards, Wisen AI Knowledge Base, Students, Team
  - Editor: Dashboard, QBank, Subjects, Files & Sources, Flashcards
- `/admin/team`: invite an Editor by email, see pending invites, resend or revoke them, freeze, unfreeze or delete Editors, promote an existing member to Admin, and view the activity log with filters.
- Invitations: each is tied to one email, has a secret token, expires after 7 days, and works only once. Opening `/team/invite/<token>` and signing in with that same email makes the person an Editor automatically.
- Subjects → Units → Lessons editor. Each Subject is tagged with faculty, department and year, and the student QBank reads this same structure, filtered by the student's profile.
- Resource files attached to a Unit or Lesson: upload, view, replace, delete. Files are stored privately.
- Questions are edited with version history: every edit saves the previous version, and an Admin can restore any version.
- Knowledge Base entries and the Students list are Admin only.
- Frozen members are blocked everywhere. Their history, the activity log and past versions are kept, even after an Editor is deleted.

## Needs a decision
- **Sending invitation emails** requires an email sender domain for your project. Until one is set up, each invite shows a copyable invite link the Admin can send manually. I'll add real email sending once the domain is connected.

## Technical details
- Tables: `team_members` (user_id, email, status active/frozen, deleted_at), `user_roles` + `app_role` enum (admin, editor) with a `has_role` security-definer function, `is_active_team(uid)`, `team_invitations` (email, token_hash, role, status, expires_at), `audit_log` (actor_id, actor_email, role, action, entity_type, entity_id, detail jsonb, result, created_at), `subjects`/`units`/`lessons` (subjects carry faculty, department, academic_year), `qbank_questions` + `question_versions`, `lesson_resources`, `kb_entries`.
- Row-level security: content writes are allowed only for active admin/editor. KB, students, team, invitations and the audit log are readable by active admins only. Students can read subjects that match their profile. Audit and version rows cannot be updated or deleted.
- A private storage bucket `resources` with policies for active team members only.
- Server functions (with sign-in required): `claimFirstAdmin(code)` (code kept as a secret `ADMIN_SETUP_CODE`, and it fails if any admin exists), `createInvite`, `revokeInvite`, `resendInvite`, `acceptInvite(token)` (compares the signed-in email with the invite email and uses a hashed token), `setMemberStatus`, `deleteEditor` (soft delete + role removal), `promoteToAdmin`. Each one re-checks the role on the server and writes to the audit log.
- Content CRUD goes through server functions that write to the audit log and create versions. The `/admin` routes live under the managed signed-in area, and the server rejects frozen members and non-members.
- The student QBank loads team questions from the database for the student's subjects and falls back to the current sample questions.
