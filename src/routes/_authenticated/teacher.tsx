import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/useSession";
import { LESSONS, gradeFor } from "@/content/course";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/teacher")({
  head: () => ({
    meta: [
      { title: "Панель учителя — Информация и компьютер, 5 класс" },
      { name: "description", content: "Классы, список учеников и результаты тестов по каждой из 8 тем." },
      { property: "og:title", content: "Панель учителя — ЦОР «Информация и компьютер»" },
      { property: "og:description", content: "Успеваемость учеников по 8 темам и подробные ответы." },
    ],
  }),
  component: TeacherPage,
});

type Answer = { q: string; chosen: number; correct: number; ok: boolean };

function TeacherPage() {
  const { data: me, isLoading } = useMe();
  const queryClient = useQueryClient();
  const [classId, setClassId] = useState<string>("");
  const [newClass, setNewClass] = useState("");
  const [openStudent, setOpenStudent] = useState<string | null>(null);

  const classesQ = useQuery({
    queryKey: ["teacher-classes", me?.id],
    enabled: !!me?.isTeacher,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, join_code")
        .eq("teacher_id", me!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const classes = classesQ.data ?? [];
  const activeClass = classId || classes[0]?.id || "";

  const studentsQ = useQuery({
    queryKey: ["teacher-students", activeClass],
    enabled: !!activeClass,
    queryFn: async () => {
      const { data: members } = await supabase.from("class_members").select("student_id").eq("class_id", activeClass);
      const ids = (members ?? []).map((m) => m.student_id);
      if (ids.length === 0) return { students: [], progress: [], attempts: [] };
      const [p, lp, qa] = await Promise.all([
        supabase.from("profiles").select("id, full_name, last_name, first_name, activation_code").in("id", ids),
        supabase.from("lesson_progress").select("*").in("user_id", ids),
        supabase.from("quiz_attempts").select("*").in("user_id", ids).order("created_at", { ascending: false }),
      ]);
      const students = (p.data ?? []).sort((a, b) => a.full_name.localeCompare(b.full_name, "ru"));
      return { students, progress: lp.data ?? [], attempts: qa.data ?? [] };
    },
  });

  if (isLoading) return <p>Загрузка…</p>;
  if (!me?.isTeacher) {
    return (
      <div className="rounded-3xl border-4 border-border bg-card p-6">
        <p className="font-bold">Эта страница доступна только учителю.</p>
      </div>
    );
  }

  async function createStandard() {
    const { error } = await supabase.rpc("create_standard_classes");
    if (error) toast.error(error.message);
    else toast.success("Классы созданы");
    await queryClient.invalidateQueries({ queryKey: ["teacher-classes"] });
  }

  async function addClass(e: React.FormEvent) {
    e.preventDefault();
    const name = newClass.trim();
    if (!name) return;
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { error } = await supabase.from("classes").insert({ name, teacher_id: me!.id, join_code: code });
    if (error) return toast.error("Не удалось создать класс");
    setNewClass("");
    toast.success(`Класс ${name} создан`);
    await queryClient.invalidateQueries({ queryKey: ["teacher-classes"] });
  }

  const data = studentsQ.data;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">👩‍🏫 Панель учителя</h1>

      <section className="rounded-3xl border-4 border-border bg-card p-5 shadow-[6px_6px_0_0_var(--color-border)]">
        <h2 className="font-display text-xl font-extrabold">Мои классы</h2>
        {classes.length === 0 && (
          <p className="text-muted-foreground">Классов пока нет. Создайте их — ученики выберут свой класс при регистрации.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setClassId(c.id);
                setOpenStudent(null);
              }}
              className={`rounded-full border-2 border-border px-4 py-1.5 font-bold ${
                activeClass === c.id ? "bg-primary text-primary-foreground" : "bg-background"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={createStandard}>
            Создать классы 5А–5Ж
          </Button>
          <form onSubmit={addClass} className="flex gap-2">
            <Input value={newClass} onChange={(e) => setNewClass(e.target.value)} placeholder="Например, 5З" className="w-36" />
            <Button type="submit">Добавить класс</Button>
          </form>
        </div>
      </section>

      {activeClass && (
        <section className="overflow-x-auto rounded-3xl border-4 border-border bg-card p-5">
          <h2 className="mb-3 font-display text-xl font-extrabold">
            Успеваемость · {classes.find((c) => c.id === activeClass)?.name}
          </h2>
          {!data ? (
            <p>Загрузка…</p>
          ) : data.students.length === 0 ? (
            <p className="text-muted-foreground">В этом классе пока нет учеников.</p>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left">
                  <th className="p-2">Ученик</th>
                  {LESSONS.map((l) => (
                    <th key={l.id} className="p-2 text-center" title={l.title}>
                      {l.emoji} {l.id}
                    </th>
                  ))}
                  <th className="p-2 text-center">Итог</th>
                  <th className="p-2 text-center">Пройдено</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => {
                  const rows = data.progress.filter((p) => p.user_id === s.id);
                  const finals = data.attempts.filter((a) => a.user_id === s.id && a.quiz_type === "final");
                  const best = finals.reduce<number | null>((m, a) => (m === null || a.percent > m ? a.percent : m), null);
                  const done = rows.filter((r) => r.completed).length;
                  const open = openStudent === s.id;
                  return (
                    <>
                      <tr
                        key={s.id}
                        className="cursor-pointer border-b border-border/30 hover:bg-muted"
                        onClick={() => setOpenStudent(open ? null : s.id)}
                      >
                        <td className="p-2 font-bold">
                          {s.full_name}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">#{s.activation_code}</span>
                        </td>
                        {LESSONS.map((l) => {
                          const r = rows.find((x) => x.lesson_id === l.id);
                          return (
                            <td key={l.id} className="p-2 text-center">
                              {r?.completed ? "✅" : ""}
                              <div className="text-xs">
                                {r && r.max_score > 0
                                  ? l.isSor
                                    ? `${r.score}/${r.max_score} (${gradeFor(r.score, r.max_score)})`
                                    : `${r.score}/${r.max_score}`
                                  : "—"}
                              </div>
                            </td>
                          );
                        })}
                        <td className="p-2 text-center font-bold">{best === null ? "—" : `${best}%`}</td>
                        <td className="p-2 text-center">
                          {done}/{LESSONS.length}
                        </td>
                      </tr>
                      {open && (
                        <tr key={`${s.id}-d`}>
                          <td colSpan={LESSONS.length + 3} className="bg-muted/50 p-3">
                            <StudentAttempts attempts={data.attempts.filter((a) => a.user_id === s.id)} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Нажмите на ученика, чтобы увидеть подробные ответы.</p>
        </section>
      )}
    </div>
  );
}

function StudentAttempts({
  attempts,
}: {
  attempts: { id: string; quiz_type: string; lesson_id: number | null; score: number; max_score: number; percent: number; created_at: string; answers: unknown }[];
}) {
  if (attempts.length === 0) return <p>Ученик ещё не проходил тесты.</p>;
  return (
    <div className="space-y-3">
      {attempts.map((a) => {
        const lesson = LESSONS.find((l) => l.id === a.lesson_id);
        const title =
          a.quiz_type === "final" ? "Итоговый тест" : `${a.quiz_type === "sor" ? "СОР" : "Мини-тест"} · ${lesson?.title ?? ""}`;
        const answers = Array.isArray(a.answers) ? (a.answers as Answer[]) : [];
        return (
          <details key={a.id} className="rounded-xl border-2 border-border bg-card p-2">
            <summary className="cursor-pointer font-bold">
              {title} — {a.score}/{a.max_score} ({a.percent}%) · {new Date(a.created_at).toLocaleString("ru-RU")}
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-6">
              {answers.map((ans, i) => (
                <li key={i} className={ans.ok ? "" : "font-semibold text-destructive"}>
                  {ans.ok ? "✅" : "❌"} {ans.q}
                </li>
              ))}
            </ol>
          </details>
        );
      })}
    </div>
  );
}
