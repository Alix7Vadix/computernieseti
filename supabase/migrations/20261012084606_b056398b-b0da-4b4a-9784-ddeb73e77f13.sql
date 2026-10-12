ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activation_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_activation_code_key ON public.profiles(activation_code) WHERE activation_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_student_lookup ON public.profiles(class_id, lower(last_name), lower(first_name));

REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
DROP POLICY IF EXISTS "own profile update" ON public.profiles;

DROP POLICY IF EXISTS "student joins class" ON public.class_members;
DROP POLICY IF EXISTS "student leaves class" ON public.class_members;