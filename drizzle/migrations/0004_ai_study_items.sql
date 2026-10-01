ALTER TABLE public.lesson_resources ADD COLUMN kind text NOT NULL DEFAULT 'course' CHECK (kind IN ('course','past_emd'));

CREATE TABLE public.ai_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qtype text NOT NULL DEFAULT 'SCQ' CHECK (qtype IN ('SCQ','MCQ')),
  subject text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  lesson text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'Medium',
  stem text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  origin text NOT NULL DEFAULT 'qbank',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ai_questions TO authenticated;
GRANT ALL ON public.ai_questions TO service_role;
ALTER TABLE public.ai_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own ai questions read" ON public.ai_questions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own ai questions insert" ON public.ai_questions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own ai questions delete" ON public.ai_questions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.ai_flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT '',
  scope_label text NOT NULL DEFAULT '',
  front text NOT NULL,
  back text NOT NULL,
  tip text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ai_flashcards TO authenticated;
GRANT ALL ON public.ai_flashcards TO service_role;
ALTER TABLE public.ai_flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own ai cards read" ON public.ai_flashcards FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own ai cards insert" ON public.ai_flashcards FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own ai cards delete" ON public.ai_flashcards FOR DELETE TO authenticated USING (user_id = auth.uid());

UPDATE public.units SET name = 'S1 — English Version' WHERE id = '28d51b78-6fee-470d-a1c6-a058ab252d20';
UPDATE public.units SET name = 'S1 — French Version' WHERE id = '4434dbb7-ee76-4d2e-9e5c-e59e90dacead';
UPDATE public.units SET name = 'S2 — English Version' WHERE id = '0ff3b6eb-db5d-4e63-8d54-ec75bfa0d65e';
UPDATE public.units SET name = 'S2 — French Version' WHERE id = '26190a7a-94b3-4488-b769-dde136da2970';