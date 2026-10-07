ALTER TABLE public.student_data ADD COLUMN IF NOT EXISTS question_results jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN IF NOT EXISTS review_history jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN IF NOT EXISTS study_sessions jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE public.study_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
 task_date date NOT NULL,
 slot text NOT NULL DEFAULT 'Morning' CHECK (slot IN ('Morning','Afternoon','Evening','Night')),
 start_time time NOT NULL DEFAULT '08:00',
 duration integer NOT NULL DEFAULT 30 CHECK (duration BETWEEN 1 AND 600),
 kind text NOT NULL DEFAULT 'REVIEW' CHECK (kind IN ('MUST','QUESTIONS','REVIEW','KAPSULES')),
 completed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_tasks TO authenticated;
GRANT ALL ON public.study_tasks TO service_role;
ALTER TABLE public.study_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own tasks" ON public.study_tasks FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Students create own tasks" ON public.study_tasks FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Students update own tasks" ON public.study_tasks FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Students delete own tasks" ON public.study_tasks FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE INDEX study_tasks_user_date ON public.study_tasks (user_id, task_date);
CREATE TRIGGER study_tasks_touch BEFORE UPDATE ON public.study_tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();