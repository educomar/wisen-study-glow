WITH nl AS (
  INSERT INTO public.lessons (unit_id, name, position)
  SELECT id, 'Course Materials', 1 FROM public.units WHERE id IN ('eea29813-86c4-49ac-bf45-5b32f23b1a14','926b4fd7-37f1-49dc-8838-ee5930a8b2bb')
  RETURNING id, unit_id)
UPDATE public.lesson_resources r SET lesson_id = nl.id FROM nl WHERE r.unit_id = nl.unit_id AND r.lesson_id IS NULL;