CREATE TABLE public.student_data (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmarks jsonb NOT NULL DEFAULT '[]'::jsonb,
  saved_cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  card_states jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  custom_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  attempts jsonb NOT NULL DEFAULT '{}'::jsonb,
  exam_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  activity jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.student_data TO authenticated;
GRANT ALL ON public.student_data TO service_role;
ALTER TABLE public.student_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own student data read" ON public.student_data FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own student data insert" ON public.student_data FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own student data update" ON public.student_data FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER student_data_touch BEFORE UPDATE ON public.student_data FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();