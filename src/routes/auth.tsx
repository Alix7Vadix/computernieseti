import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { studentEmail, fullName } from "@/lib/studentLogin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "student" | "teacher";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { role: Role } => ({
    role: search.role === "teacher" ? "teacher" : "student",
  }),
  head: () => ({
    meta: [
      { title: "Вход и регистрация — ЦОР «Информация и компьютер»" },
      {
        name: "description",
        content: "Вход для учеников по фамилии и имени и отдельный вход для учителя.",
      },
      { property: "og:title", content: "Вход и регистрация — ЦОР «Информация и компьютер»" },
      { property: "og:description", content: "Ученик входит по фамилии и имени, учитель — по электронной почте." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { role } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/lessons", replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    setError(null);
  }, [role, mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const isStudent = role === "student";
      if (isStudent && (!lastName.trim() || !firstName.trim())) {
        setError("Введите фамилию и имя");
        return;
      }
      const loginEmail = isStudent ? studentEmail(lastName, firstName) : email.trim();
      if (!loginEmail || (!isStudent && !loginEmail.includes("@"))) {
        setError("Введите корректный адрес электронной почты");
        return;
      }
      if (password.length < 6) {
        setError("Пароль должен быть не короче 6 символов");
        return;
      }

      if (mode === "up") {
        const name = isStudent ? fullName(lastName, firstName) : teacherName.trim();
        const { error: signUpError } = await supabase.auth.signUp({
          email: loginEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name, role },
          },
        });
        if (signUpError) {
          setError(
            signUpError.message.includes("already registered")
              ? isStudent
                ? "Такой ученик уже зарегистрирован — войдите по своему паролю"
                : "Этот адрес уже зарегистрирован — войдите"
              : signUpError.message,
          );
          return;
        }
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });
      if (signInError) {
        setError(
          signInError.message.includes("Invalid login credentials")
            ? isStudent
              ? "Не найдено. Проверьте фамилию, имя и пароль или зарегистрируйтесь"
              : "Неверная почта или пароль"
            : signInError.message,
        );
        return;
      }
      navigate({ to: role === "teacher" ? "/teacher" : "/lessons", replace: true });
    } finally {
      setBusy(false);
    }
  }

  const isStudent = role === "student";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#DDEBFF] via-background to-[#FFE7C2] px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border-4 border-border bg-card p-6 shadow-[8px_8px_0_0_var(--color-border)]">
        <Link to="/" className="text-sm font-bold text-muted-foreground">
          ← На главную
        </Link>

        <div className="mt-4 mb-5 grid grid-cols-2 gap-2">
          <Link
            to="/auth"
            search={{ role: "student" }}
            className={`rounded-xl border-2 border-border px-3 py-2 text-center font-bold ${
              isStudent ? "bg-primary text-primary-foreground" : "bg-background"
            }`}
          >
            🎒 Ученик
          </Link>
          <Link
            to="/auth"
            search={{ role: "teacher" }}
            className={`rounded-xl border-2 border-border px-3 py-2 text-center font-bold ${
              !isStudent ? "bg-primary text-primary-foreground" : "bg-background"
            }`}
          >
            👩‍🏫 Учитель
          </Link>
        </div>

        <h1 className="font-display text-2xl font-extrabold">
          {mode === "in" ? "Вход" : "Регистрация"} · {isStudent ? "ученик" : "учитель"}
        </h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {isStudent
            ? "Ученик входит по фамилии, имени и своему паролю — почта не нужна."
            : "Учитель входит по электронной почте и паролю."}
        </p>

        <form onSubmit={submit} className="space-y-3">
          {isStudent ? (
            <>
              <div>
                <Label htmlFor="ln">Фамилия</Label>
                <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Иванов" />
              </div>
              <div>
                <Label htmlFor="fn">Имя</Label>
                <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Алишер" />
              </div>
            </>
          ) : (
            <>
              {mode === "up" && (
                <div>
                  <Label htmlFor="tn">Ф. И. О. учителя</Label>
                  <Input id="tn" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="Асанова А. К." />
                </div>
              )}
              <div>
                <Label htmlFor="em">Электронная почта</Label>
                <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@school.kz" />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="pw">Пароль</Label>
            <Input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="не менее 6 символов"
            />
          </div>

          {error && (
            <p className="rounded-xl border-2 border-destructive bg-destructive/10 p-2 text-sm font-semibold">{error}</p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Подождите…" : mode === "in" ? "Войти" : "Зарегистрироваться"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="mt-4 w-full text-sm font-bold underline"
        >
          {mode === "in" ? "Ещё нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}
