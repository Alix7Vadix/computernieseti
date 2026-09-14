import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useMe() {
  const { user } = useSession();
  const userId = user?.id;

  return useQuery({
    queryKey: ["me", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      const roles = (rolesRes.data ?? []).map((r) => r.role as string);
      return {
        id: userId!,
        email: user?.email ?? "",
        fullName: profileRes.data?.full_name ?? "",
        isTeacher: roles.includes("teacher"),
      };
    },
  });
}
