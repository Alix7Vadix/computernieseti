import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LESSONS, getLesson, gradeFor } from "@/content/course";
import { VideoBlock } from "@/components/course/VideoBlock";
import { ExerciseBlock } from "@/components/course/ExerciseBlock";
import { Quiz } from "@/components/course/Quiz";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { saveLessonProgress, saveQuizAttempt, fetchMyProgress } from "@/lib/progress";

export const Route = createFileRoute("/_authenticated/lessons/$lessonId")({
  head: ({ params }) => {
    const lesson = getLesson(Number(params.lessonId));
    const title = lesson ? `Урок ${lesson.id}. ${lesson.title}` : "Урок курса";
    const description = lesson?.short ?? "Урок раздела «Информация и компьютер» для 5 класса.";
    return {
      meta: [
        { title: `${title} — Информация и компьютер` },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: LessonPage,
});

function LessonPage() {
  const { lessonId } = Route.useParams();
  const lesson = getLesson(Number(lessonId));
  const { user } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["progress", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchMyProgress(user!.id),
  });

  if (!lesson) {
    return (
      <div className="rounded-2xl border-4 border-border bg-card p-6">
        <p className="font-bold">Такого урока нет.</p>
        <Link to="/lessons" className="underline">
          Вернуться к списку уроков
        </Link>
      </div>
    );
  }

  const myRow = (data?.progress ?? []).find((p) => p.lesson_id === lesson.id);
  const isDone = !!myRow?.completed;
  const next = LESSONS.find((l) => l.id === lesson.id + 1);

  async function handleQuiz(result: { score: number; max: number; percent: number; answers: unknown }) {
    if (!user) return;
    await saveQuizAttempt({
      userId: user.id,
      quizType: lesson!.isSor ? "sor" : "mini",
      lessonId: lesson!.id,
      score: result.score,
      max: result.max,
      percent: result.percent,
      answers: result.answers,
    });
    await saveLessonProgress({
      userId: user.id,
      lessonId: lesson!.id,
      score: result.score,
      max: result.max,
    });
    await queryClient.invalidateQueries({ queryKey: ["progress", user.id] });
    toast.success(
      lesson!.isSor
        ? `Работа СОР сохранена. Оценка: ${gradeFor(result.score, result.max)}`
        : `Результат сохранён: ${result.score} из ${result.max}`,
    );
  }

  async function finishLesson() {
    if (!user) return;
    setSaving(true);
    try {
      await saveLessonProgress({ userId: user.id, lessonId: lesson!.id, completed: true });
      await queryClient.invalidateQueries({ queryKey: ["progress", user.id] });
      toast.success(`Урок ${lesson!.id} отмечен как пройденный! 🎉`);
      if (next) navigate({ to: "/lessons/$lessonId", params: { lessonId: String(next.id) } });
      else navigate({ to: "/progress" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="space-y-6">
      <header className={`rounded-3xl border-4 border-border p-6 shadow-[6px_6px_0_0_var(--color-border)] ${lesson.color}`}>
        <Link to="/lessons" className="text-sm font-bold">
          ← Все уроки
        </Link>
        <p className="mt-3 text-sm font-bold uppercase">Урок {lesson.id}</p>
        <h1 className="font-display text-3xl font-extrabold">
          {lesson.emoji} {lesson.title}
        </h1>
        <p className="mt-1 font-medium">{lesson.short}</p>
        {isDone && <p className="mt-2 font-bold">✅ Урок пройден</p>}
      </header>

      {lesson.theory.map((block, i) => (
        <section key={i} className="rounded-3xl border-4 border-border bg-card p-5 shadow-[6px_6px_0_0_var(--color-border)]">
          <h2 className="font-display text-2xl font-extrabold">{block.heading}</h2>
          <p className="mt-2 text-lg leading-relaxed">{block.text}</p>

          {block.scheme && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {block.scheme.map((s, si) => (
                <div key={si} className="flex items-center gap-2">
                  <div className="rounded-2xl border-2 border-border bg-muted px-3 py-2 text-center">
                    <div className="text-2xl">{s.emoji}</div>
                    <div className="text-sm font-bold">{s.label}</div>
                  </div>
                  {si < block.scheme!.length - 1 && <span className="text-xl font-bold">→</span>}
                </div>
              ))}
            </div>
          )}

          {block.bullets && (
            <ul className="mt-4 space-y-2">
              {block.bullets.map((b, bi) => (
                <li key={bi} className="flex gap-2 rounded-xl bg-muted/60 p-2 font-medium">
                  <span>👉</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {block.cards && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {block.cards.map((c, ci) => (
                <div key={ci} className="rounded-2xl border-2 border-border bg-background p-3">
                  <div className="text-2xl">{c.emoji}</div>
                  <p className="font-bold">{c.title}</p>
                  <p className="text-sm text-muted-foreground">{c.text}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      <VideoBlock title={lesson.video.title} search={lesson.video.search} />

      <ExerciseBlock
        exercise={lesson.exercise}
        onDone={(ok) => {
          if (ok && user) {
            void saveLessonProgress({ userId: user.id, lessonId: lesson.id, exerciseDone: true }).then(() =>
              queryClient.invalidateQueries({ queryKey: ["progress", user.id] }),
            );
          }
        }}
      />

      <Quiz
        questions={lesson.quiz}
        title={lesson.isSor ? "Суммативное оценивание за раздел (10 вопросов)" : "Мини-тест для самопроверки"}
        emoji={lesson.isSor ? "🏆" : "🧠"}
        onFinish={handleQuiz}
      />

      <section className="rounded-3xl border-4 border-border bg-primary/10 p-6 text-center">
        <p className="mb-3 text-lg font-bold">Всё изучил и выполнил задания?</p>
        <Button size="lg" className="text-lg" disabled={saving} onClick={finishLesson}>
          {saving ? "Сохраняем…" : isDone ? "✅ Отметить снова и продолжить" : "✅ Завершить урок"}
        </Button>
        <p className="mt-2 text-sm text-muted-foreground">
          Прохождение сохранится, и общий прогресс обновится.
        </p>
      </section>
    </article>
  );
}
