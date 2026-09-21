import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LESSONS } from "@/content/course";
import { fetchMyProgress, coursePercent } from "@/lib/progress";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/lessons/")({
  head: () => ({
    meta: [
      { title: "Уроки курса — Информация и компьютер, 5 класс" },
      { name: "description", content: "8 интерактивных уроков раздела «Информация и компьютер» с видео, заданиями и тестами." },
      { property: "og:title", content: "Уроки курса — Информация и компьютер" },
      { property: "og:description", content: "Выбери урок: эргономика, информация, поиск, история компьютеров, ПО и ИИ." },
    ],
  }),
  component: LessonsPage,
});

function LessonsPage() {
  const { user } = useSession();
  const { data } = useQuery({
    queryKey: ["progress", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchMyProgress(user!.id),
  });

  const done = new Set((data?.progress ?? []).filter((p) => p.completed).map((p) => p.lesson_id));
  const percent = coursePercent(done.size);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold">📚 Уроки курса</h1>
      <p className="text-muted-foreground">Пройди все 8 тем раздела «Информация и компьютер».</p>

      <div className="mt-4 rounded-2xl border-4 border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between font-bold">
          <span>Общий прогресс</span>
          <span>
            {done.size} из {LESSONS.length} · {percent}%
          </span>
        </div>
        <div className="h-5 overflow-hidden rounded-full border-2 border-border bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LESSONS.map((l) => (
          <Link
            key={l.id}
            to="/lessons/$lessonId"
            params={{ lessonId: String(l.id) }}
            className={`block rounded-2xl border-4 border-border p-5 shadow-[5px_5px_0_0_var(--color-border)] transition-transform hover:-translate-y-1 ${l.color}`}
          >
            <div className="flex items-start justify-between">
              <span className="text-4xl">{l.emoji}</span>
              <span className="rounded-full border-2 border-border bg-card px-2 py-0.5 text-xs font-bold">
                {done.has(l.id) ? "✅ Пройден" : `Урок ${l.id}`}
              </span>
            </div>
            <p className="mt-3 text-lg font-extrabold">{l.title}</p>
            <p className="text-sm">{l.short}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
