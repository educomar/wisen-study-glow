ALTER TABLE public.lesson_resources ALTER COLUMN unit_id DROP NOT NULL;

CREATE TABLE public.exam_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('past_emd','ai_generated')),
  title text NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  resource_id uuid REFERENCES public.lesson_resources(id) ON DELETE SET NULL,
  exam_year text NOT NULL DEFAULT '',
  session text NOT NULL DEFAULT 'normal' CHECK (session IN ('normal','rattrapage')),
  emd_number text NOT NULL DEFAULT '',
  has_corrige boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','in_review','verified','published')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_sets TO authenticated;
GRANT ALL ON public.exam_sets TO service_role;
ALTER TABLE public.exam_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manages exam sets" ON public.exam_sets FOR ALL TO authenticated USING (public.is_active_team(auth.uid())) WITH CHECK (public.is_active_team(auth.uid()));
CREATE POLICY "students read published exam sets" ON public.exam_sets FOR SELECT TO authenticated USING (status = 'published' AND public.student_can_see_subject(subject_id));
CREATE TRIGGER exam_sets_touch BEFORE UPDATE ON public.exam_sets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.exam_set_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.exam_sets(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  stem text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL DEFAULT '',
  format text NOT NULL DEFAULT '',
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exam_set_questions_set_idx ON public.exam_set_questions(set_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_set_questions TO authenticated;
GRANT ALL ON public.exam_set_questions TO service_role;
ALTER TABLE public.exam_set_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manages exam questions" ON public.exam_set_questions FOR ALL TO authenticated USING (public.is_active_team(auth.uid())) WITH CHECK (public.is_active_team(auth.uid()));
CREATE POLICY "students read published exam questions" ON public.exam_set_questions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.exam_sets s WHERE s.id = set_id AND s.status = 'published' AND public.student_can_see_subject(s.subject_id)));