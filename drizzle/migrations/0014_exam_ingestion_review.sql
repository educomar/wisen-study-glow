ALTER TABLE public.exam_sets ADD COLUMN IF NOT EXISTS semester text NOT NULL DEFAULT '' CHECK (semester IN ('','S1','S2'));
ALTER TABLE public.exam_set_questions ADD COLUMN IF NOT EXISTS option_comments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.exam_set_questions ADD COLUMN IF NOT EXISTS trap_phrase text NOT NULL DEFAULT '';
ALTER TABLE public.exam_set_questions ADD COLUMN IF NOT EXISTS trap_explanation text NOT NULL DEFAULT '';
ALTER TABLE public.exam_set_questions ADD COLUMN IF NOT EXISTS answer_source text NOT NULL DEFAULT 'official' CHECK (answer_source IN ('official','missing','generated'));
ALTER TABLE public.exam_set_questions ADD COLUMN IF NOT EXISTS review_note text NOT NULL DEFAULT '';
ALTER TABLE public.exam_set_questions ADD COLUMN IF NOT EXISTS source_pages integer[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS exam_sets_scope_status_idx ON public.exam_sets(subject_id, kind, status, exam_year, semester);
CREATE OR REPLACE FUNCTION public.replace_exam_questions(p_set_id uuid, p_questions jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE s public.exam_sets; q jsonb; lid uuid; pos integer := 0;
BEGIN
 IF NOT public.is_active_team(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 SELECT * INTO s FROM public.exam_sets WHERE id = p_set_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Exam not found'; END IF;
 IF jsonb_typeof(p_questions) <> 'array' OR jsonb_array_length(p_questions) > 200 THEN RAISE EXCEPTION 'Invalid question list'; END IF;
 FOR q IN SELECT value FROM jsonb_array_elements(p_questions) LOOP
  FOR lid IN SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(q->'lesson_ids','[]'::jsonb)) LOOP
   IF NOT EXISTS (SELECT 1 FROM public.lessons l JOIN public.units u ON u.id=l.unit_id WHERE l.id=lid AND u.subject_id=s.subject_id AND (s.unit_id IS NULL OR u.id=s.unit_id)) THEN RAISE EXCEPTION 'Lesson outside exam scope'; END IF;
  END LOOP;
 END LOOP;
 DELETE FROM public.exam_set_questions WHERE set_id=p_set_id;
 FOR q IN SELECT value FROM jsonb_array_elements(p_questions) LOOP
  INSERT INTO public.exam_set_questions(set_id,position,stem,options,answers,explanation,format,verified,lesson_ids,option_comments,trap_phrase,trap_explanation,answer_source,review_note,source_pages)
  VALUES(p_set_id,pos,q->>'stem',q->'options',q->'answers',COALESCE(q->>'explanation',''),COALESCE(q->>'format',''),COALESCE((q->>'verified')::boolean,false),ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(q->'lesson_ids','[]'::jsonb))),COALESCE(q->'option_comments','[]'::jsonb),COALESCE(q->>'trap_phrase',''),COALESCE(q->>'trap_explanation',''),COALESCE(q->>'answer_source','missing'),COALESCE(q->>'review_note',''),ARRAY(SELECT value::integer FROM jsonb_array_elements_text(COALESCE(q->'source_pages','[]'::jsonb))));
  pos := pos+1;
 END LOOP;
 UPDATE public.exam_sets SET status=CASE WHEN pos=0 THEN 'uploaded' ELSE 'in_review' END WHERE id=p_set_id;
END; $$;
REVOKE ALL ON FUNCTION public.replace_exam_questions(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.replace_exam_questions(uuid,jsonb) TO authenticated,service_role;