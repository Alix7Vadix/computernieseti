import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listClasses, loginStudent, registerStudent } from "@/lib/student-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "student" | "teacher";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { role?: Role } => ({
    role: search["role"] === "teacher" ? "teacher" : "student",
  }),
  head: () => ({
    meta: [
      { title: "Вход и регистрация — ЦОР «Информация и компьютер»" },
      { name: "description", content: "Вход для учеников по фамилии, имени и классу и отдельный вход для учителя." },
      { property: "og:title", content: "Вход и регистрация — ЦОР «Информация и компьютер»" },
      { property: "og:description", content: "Ученик входит по фамилии, имени и классу, учитель — по электронной почте." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const role: Role = Route.useSearch().role ?? "student";
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [classId, setClassId] = useState("");
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [newCode, setNewCode] = useState<{ code: string; namesakes: boolean } | null>(null);
  const [teacherName, setTeacherName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchClasses = useServerFn(listClasses);
  const doRegister = useServerFn(registerStudent);
  const doLogin = useServerFn(loginStudent);
  const { data: classes = [] } = useQuery({ queryKey: ["classes-public"], queryFn: () => fetchClasses() });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !newCode) navigate({ to: "/lessons", replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setError(null);
    setNeedCode(false);
  }, [role, mode]);

  const isStudent = role === "student";

  async function submitStudent() {
    if (!lastName.trim() || !firstName.trim()) return setError("Введите фамилию и имя");
    if (!classId) return setError("Выберите свой класс");
    if (password.length < 6) return setError("Пароль должен быть не короче 6 символов");

    if (mode === "up") {
      const res = await doRegister({ data: { lastName, firstName, classId, password } });
      if (!res.ok) return setError(res.error);
      await supabase.auth.setSession(res.session);
      setNewCode({ code: res.activationCode, namesakes: res.hasNamesakes });
      return;
    }
    const res = await doLogin({
      data: { lastName, firstName, classId, password, code: code.trim() || undefined },
    });
    if (!res.ok) {
      if (res.needCode) setNeedCode(true);
      return setError(res.error);
    }
    await supabase.auth.setSession(res.session);
    navigate({ to: "/lessons", replace: true });
  }

  async function submitTeacher() {
    const loginEmail = email.trim();
    if (!loginEmail.includes("@")) return setError("Введите корректный адрес электронной почты");
    if (password.length < 6) return setError("Пароль должен быть не короче 6 символов");
    if (mode === "up") {
      const { error: e } = await supabase.auth.signUp({
        email: loginEmail,
        password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: teacherName.trim(), role: "teacher" } },
      });
      if (e) {
        return setError(e.message.includes("already registered") ? "Этот адрес уже зарегистрирован — войдите" : e.message);
      }
    }
    const { error: e } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (e) return setError(e.message.includes("Invalid login") ? "Неверная почта или пароль" : e.message);
    navigate({ to: "/teacher", replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isStudent) await submitStudent();
      else await submitTeacher();
    } catch (err) {
      console.error(err);
      setError("Что-то пошло не так. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  if (newCode) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-extrabold">🎉 Ты зарегистрирован!</h1>
        <p className="mt-2">Твой личный код активации:</p>
        <p className="my-3 rounded-2xl border-4 border-border bg-muted p-4 text-center font-mono text-3xl font-extrabold tracking-widest">
          {newCode.code}
        </p>
        <p className="text-sm text-muted-foreground">
          {newCode.namesakes
            ? "В твоём классе уже есть ученик с такими же фамилией и именем. Обязательно запиши этот код — он понадобится при входе."
            : "Запиши код на всякий случай: он понадобится, если в классе появится ученик с таким же именем."}
        </p>
        <Button size="lg" className="mt-4 w-full" onClick={() => navigate({ to: "/lessons", replace: true })}>
          Перейти к урокам →
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <Link to="/" className="text-sm font-bold text-muted-foreground">
        ← На главную
      </Link>

      <div className="mt-4 mb-5 grid grid-cols-2 gap-2">
        {(["student", "teacher"] as const).map((r) => (
          <Link
            key={r}
            to="/auth"
            search={{ role: r }}
            className={`rounded-xl border-2 border-border px-3 py-2 text-center font-bold ${
              role === r ? "bg-primary text-primary-foreground" : "bg-background"
            }`}
          >
            {r === "student" ? "🎒 Ученик" : "👩‍🏫 Учитель"}
          </Link>
        ))}
      </div>

      <h1 className="font-display text-2xl font-extrabold">
        {mode === "in" ? "Вход" : "Регистрация"} · {isStudent ? "ученик" : "учитель"}
      </h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {isStudent
          ? "Ученик входит по фамилии, имени, классу и паролю — почта не нужна."
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
            <div>
              <Label htmlFor="cl">Класс</Label>
              <select
                id="cl"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-base"
              >
                <option value="">— выбери класс —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {classes.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Классов пока нет — попроси учителя создать класс.</p>
              )}
            </div>
            {mode === "in" && needCode && (
              <div>
                <Label htmlFor="code">Код активации</Label>
                <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Например, K7M2QX" />
              </div>
            )}
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
          <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="не менее 6 символов" />
        </div>

        {error && <p className="rounded-xl border-2 border-destructive bg-destructive/10 p-2 text-sm font-semibold">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Подождите…" : mode === "in" ? "Войти" : "Зарегистрироваться"}
        </Button>
      </form>

      {isStudent && mode === "in" && !needCode && (
        <button type="button" onClick={() => setNeedCode(true)} className="mt-3 w-full text-xs underline">
          У меня есть код активации
        </button>
      )}
      <button
        type="button"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
        className="mt-3 w-full text-sm font-bold underline"
      >
        {mode === "in" ? "Ещё нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-accent via-background to-secondary px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border-4 border-border bg-card p-6 shadow-[8px_8px_0_0_var(--color-border)]">
        {children}
      </div>
    </div>
  );
}
