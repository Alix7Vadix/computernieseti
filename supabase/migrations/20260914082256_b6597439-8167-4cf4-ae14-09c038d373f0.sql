REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_my_student(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_member_of_class(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_student(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_of_class(UUID) TO authenticated;