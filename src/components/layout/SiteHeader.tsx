import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", label: "Главная", emoji: "🏠" },
  { to: "/lessons", label: "Уроки", emoji: "📚" },
  { to: "/progress", label: "Прогресс", emoji: "📈" },
  { to: "/final-test", label: "Итоговый тест", emoji: "🏁" },
] as const;

export function SiteHeader() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b-4 border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-extrabold">
          <span className="text-2xl">💻</span>
          <span className="font-display">Информация и компьютер</span>
        </Link>

        <nav className="order-3 flex w-full flex-wrap gap-2 sm:order-2 sm:w-auto sm:flex-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-full border-2 border-border px-3 py-1.5 text-sm font-bold transition-transform hover:-translate-y-0.5 hover:bg-accent"
              activeProps={{ className: "bg-primary text-primary-foreground" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.emoji} {l.label}
            </Link>
          ))}
          {me?.isTeacher && (
            <Link
              to="/teacher"
              className="rounded-full border-2 border-border px-3 py-1.5 text-sm font-bold transition-transform hover:-translate-y-0.5 hover:bg-accent"
              activeProps={{ className: "bg-primary text-primary-foreground" }}
            >
              👩‍🏫 Панель учителя
            </Link>
          )}
        </nav>

        <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
          <span className="hidden text-sm font-semibold sm:inline">
            {me?.fullName || me?.email} {me?.isTeacher ? "· учитель" : "· ученик"}
          </span>
          <Button size="sm" variant="secondary" onClick={signOut}>
            Выйти
          </Button>
        </div>
      </div>
    </header>
  );
}
