CREATE OR REPLACE FUNCTION public.lock_enrolled_level()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.onboarded AND (NEW.department IS DISTINCT FROM OLD.department OR NEW.academic_year IS DISTINCT FROM OLD.academic_year OR NEW.faculty IS DISTINCT FROM OLD.faculty)
     AND auth.uid() IS NOT NULL AND NOT public.is_active_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Department and academic year cannot be changed after enrolment';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_lock_level BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.lock_enrolled_level();