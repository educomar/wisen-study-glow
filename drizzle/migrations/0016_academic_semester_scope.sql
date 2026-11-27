ALTER TABLE public.units ADD COLUMN semester text NOT NULL DEFAULT '';
COMMENT ON COLUMN public.units.semester IS 'Year 1 only: S1, S2, or empty for unassigned/shared legacy content. In Years 2–6 units rows represent subjects inside integrated modules stored in subjects.';
UPDATE public.units u SET semester = CASE WHEN u.name ~* '(semester|semestre|\mS)\s*1\M' THEN 'S1' WHEN u.name ~* '(semester|semestre|\mS)\s*2\M' THEN 'S2' WHEN s.name IN ('SSH','Embryology','Embryologie') THEN 'S1' WHEN s.name IN ('Histology','Histologie','Physiology','Physiologie') THEN 'S2' ELSE '' END FROM public.subjects s WHERE s.id = u.subject_id AND s.academic_year = 1;
CREATE OR REPLACE FUNCTION public.validate_academic_semester() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.semester NOT IN ('', 'S1', 'S2') THEN RAISE EXCEPTION 'Choose S1 or S2.'; END IF;
 IF NEW.semester <> '' AND NOT EXISTS(SELECT 1 FROM public.subjects WHERE id=NEW.subject_id AND academic_year=1) THEN RAISE EXCEPTION 'Semesters are available in Year 1 only.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_academic_semester BEFORE INSERT OR UPDATE OF subject_id, semester ON public.units FOR EACH ROW EXECUTE FUNCTION public.validate_academic_semester();
CREATE OR REPLACE FUNCTION public.prevent_semester_year_change() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.academic_year <> 1 AND EXISTS(SELECT 1 FROM public.units WHERE subject_id=NEW.id AND semester <> '') THEN RAISE EXCEPTION 'Remove semester assignments before changing the academic year.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER prevent_semester_year_change BEFORE UPDATE OF academic_year ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.prevent_semester_year_change();