ALTER TABLE public.units ADD COLUMN legacy_container boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.units.legacy_container IS 'Preserved old integrated-unit folder; hidden from new curriculum selection after its existing lessons are organized into discipline branches. Existing exam references remain valid.';
DO $$
DECLARE item record; branch_id uuid;
BEGIN
 FOR item IN SELECT l.id lesson_id,l.name lesson_name,u.id old_unit,s.id subject_id,l.position,s.created_by FROM public.lessons l JOIN public.units u ON u.id=l.unit_id JOIN public.subjects s ON s.id=u.subject_id WHERE s.academic_year=2 AND u.name=s.name AND l.name IN ('Anatomie','Physiologie','Histologie','Biochimie','Biophysique') ORDER BY s.position,l.position LOOP
  SELECT id INTO branch_id FROM public.units WHERE subject_id=item.subject_id AND name=item.lesson_name AND NOT legacy_container LIMIT 1;
  IF branch_id IS NULL THEN
   INSERT INTO public.units(subject_id,name,position,created_by) VALUES(item.subject_id,item.lesson_name,item.position,item.created_by) RETURNING id INTO branch_id;
  END IF;
  UPDATE public.lessons SET unit_id=branch_id WHERE id=item.lesson_id;
  UPDATE public.units SET legacy_container=true WHERE id=item.old_unit AND NOT EXISTS(SELECT 1 FROM public.lessons WHERE unit_id=item.old_unit);
 END LOOP;
END $$;