ALTER TABLE public.lesson_resources ADD COLUMN IF NOT EXISTS drive_created_at timestamptz;
CREATE INDEX IF NOT EXISTS lesson_resources_drive_created_idx ON public.lesson_resources(drive_created_at);