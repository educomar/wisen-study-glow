CREATE TYPE public.app_role AS ENUM ('admin','editor');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.team_members (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen')),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_active_team(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members m
    WHERE m.user_id = _user_id AND m.status = 'active' AND m.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_active_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_team(_user_id) AND public.has_role(_user_id, 'admin')
$$;

CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;

CREATE POLICY "Own membership readable" ON public.team_members FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read team" ON public.team_members FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));
CREATE POLICY "Admins read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));

CREATE TABLE public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'editor',
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at timestamptz NOT NULL,
  invited_by uuid,
  accepted_by uuid,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_invitations TO authenticated;
GRANT ALL ON public.team_invitations TO service_role;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read invites" ON public.team_invitations FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text NOT NULL DEFAULT '',
  actor_role text NOT NULL DEFAULT '',
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id text,
  entity_label text NOT NULL DEFAULT '',
  result text NOT NULL DEFAULT 'success',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit" ON public.audit_log FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));
CREATE POLICY "Team writes own audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() AND public.is_active_team(auth.uid()));
CREATE INDEX audit_log_created_idx ON public.audit_log (created_at DESC);

CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  faculty text NOT NULL DEFAULT 'Faculty of Medicine — Sétif 1',
  department text NOT NULL DEFAULT 'Medicine',
  academic_year integer NOT NULL DEFAULT 1,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.qbank_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  stem text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer integer NOT NULL DEFAULT 0,
  explanation text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'Medium',
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.question_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by uuid,
  changed_by_email text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.team_flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  front text NOT NULL,
  back text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.lesson_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT '',
  size_bytes bigint NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.kb_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  content text NOT NULL DEFAULT '',
  source_path text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects, public.units, public.lessons, public.qbank_questions, public.team_flashcards, public.lesson_resources, public.kb_entries TO authenticated;
GRANT SELECT, INSERT ON public.question_versions TO authenticated;
GRANT ALL ON public.subjects, public.units, public.lessons, public.qbank_questions, public.question_versions, public.team_flashcards, public.lesson_resources, public.kb_entries TO service_role;

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qbank_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_entries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.student_can_see_subject(_subject_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subjects s JOIN public.profiles p ON p.id = auth.uid()
    WHERE s.id = _subject_id AND s.faculty = p.faculty AND s.department = p.department AND s.academic_year = p.academic_year
  )
$$;

-- Subjects
CREATE POLICY "Team manage subjects" ON public.subjects FOR ALL TO authenticated USING (public.is_active_team(auth.uid())) WITH CHECK (public.is_active_team(auth.uid()));
CREATE POLICY "Students read own subjects" ON public.subjects FOR SELECT TO authenticated USING (public.student_can_see_subject(id));
-- Units
CREATE POLICY "Team manage units" ON public.units FOR ALL TO authenticated USING (public.is_active_team(auth.uid())) WITH CHECK (public.is_active_team(auth.uid()));
CREATE POLICY "Students read units" ON public.units FOR SELECT TO authenticated USING (public.student_can_see_subject(subject_id));
-- Lessons
CREATE POLICY "Team manage lessons" ON public.lessons FOR ALL TO authenticated USING (public.is_active_team(auth.uid())) WITH CHECK (public.is_active_team(auth.uid()));
CREATE POLICY "Students read lessons" ON public.lessons FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.units u WHERE u.id = unit_id AND public.student_can_see_subject(u.subject_id)));
-- Questions
CREATE POLICY "Team manage questions" ON public.qbank_questions FOR ALL TO authenticated USING (public.is_active_team(auth.uid())) WITH CHECK (public.is_active_team(auth.uid()));
CREATE POLICY "Students read questions" ON public.qbank_questions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.lessons l JOIN public.units u ON u.id = l.unit_id WHERE l.id = lesson_id AND public.student_can_see_subject(u.subject_id)));
-- Versions (append-only)
CREATE POLICY "Team read versions" ON public.question_versions FOR SELECT TO authenticated USING (public.is_active_team(auth.uid()));
CREATE POLICY "Team add versions" ON public.question_versions FOR INSERT TO authenticated WITH CHECK (public.is_active_team(auth.uid()) AND changed_by = auth.uid());
-- Flashcards
CREATE POLICY "Team manage flashcards" ON public.team_flashcards FOR ALL TO authenticated USING (public.is_active_team(auth.uid())) WITH CHECK (public.is_active_team(auth.uid()));
CREATE POLICY "Students read flashcards" ON public.team_flashcards FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.lessons l JOIN public.units u ON u.id = l.unit_id WHERE l.id = lesson_id AND public.student_can_see_subject(u.subject_id)));
-- Resources (team only)
CREATE POLICY "Team manage resources" ON public.lesson_resources FOR ALL TO authenticated USING (public.is_active_team(auth.uid())) WITH CHECK (public.is_active_team(auth.uid()));
-- KB (admin only)
CREATE POLICY "Admins manage kb" ON public.kb_entries FOR ALL TO authenticated USING (public.is_active_admin(auth.uid())) WITH CHECK (public.is_active_admin(auth.uid()));
-- Students: admins may read profiles
CREATE POLICY "Admins read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_active_admin(auth.uid()));

CREATE TRIGGER subjects_touch BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER units_touch BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER lessons_touch BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER qbank_touch BEFORE UPDATE ON public.qbank_questions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER flash_touch BEFORE UPDATE ON public.team_flashcards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER res_touch BEFORE UPDATE ON public.lesson_resources FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER kb_touch BEFORE UPDATE ON public.kb_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER team_touch BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Team members should not get a student profile row flagged; skip. 
