import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LESSONS, gradeFor } from "@/content/course";
import { fetchMyProgress, coursePercent } from "@/lib/progress";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Мой прогресс — Информация и компьютер, 5 класс" },
      { name: "description", content: "Шкала прохождения курса, пройденные уроки и оценки за тесты." },
      { property: "og:title", content: "Мой прогресс по курсу «Информация и компьютер»" },
      { property: "og:description", content: "Пройденные темы, баллы мини-тестов, СОР и итогового теста." },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const { user } = useSession();
  const { data } = useQuery({
    queryKey: ["progress", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchMyProgress(user!.id),
  });
  const progress = data?.progress ?? [];
  const attempts = data?.attempts ?? [];
  const done = progress.filter((p) => p.completed).length;
  const percent = coursePercent(done);
  const finals = attempts.filter((a) => a.quiz_type === "final");

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">📈 Мой прогресс</h1>

      <div className="rounded-3xl border-4 border-border bg-card p-5 shadow-[6px_6px_0_0_var(--color-border)]">
        <div className="mb-2 flex justify-between font-bold">
          <span>Пройдено тем</span>
          <span>
            {done} из {LESSONS.length} · {percent}%
          </span>
        </div>
        <div className="h-6 overflow-hidden rounded-full border-2 border-border bg-muted">
          <div className="h-full bg-success transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {LESSONS.map((l) => {
          const row = progress.find((p) => p.lesson_id === l.id);
          return (
            <Link
              key={l.id}
              to="/lessons/$lessonId"
              params={{ lessonId: String(l.id) }}
              className="flex items-center gap-3 rounded-2xl border-4 border-border bg-card p-4 hover:-translate-y-0.5"
            >
              <span className="text-3xl">{l.emoji}</span>
              <div className="flex-1">
                <p className="font-bold">
                  {l.id}. {l.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {row && row.max_score > 0
                    ? `Тест: ${row.score}/${row.max_score}${l.isSor ? ` · оценка ${gradeFor(row.score, row.max_score)}` : ""}`
                    : "Тест ещё не пройден"}
                </p>
              </div>
              <span className="text-2xl">{row?.completed ? "✅" : "⏳"}</span>
            </Link>
          );
        })}
      </div>

      <div className="rounded-3xl border-4 border-border bg-secondary p-5">
        <h2 className="font-display text-xl font-extrabold">🏁 Итоговый тест</h2>
        {finals.length === 0 ? (
          <p>
            Ещё не пройден.{" "}
            <Link to="/final-test" className="font-bold underline">
              Пройти тест
            </Link>
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {finals.map((a) => (
              <li key={a.id} className="font-semibold">
                {new Date(a.created_at).toLocaleDateString("ru-RU")}: {a.score}/{a.max_score} ({a.percent}%) · оценка{" "}
                {gradeFor(a.score, a.max_score)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
