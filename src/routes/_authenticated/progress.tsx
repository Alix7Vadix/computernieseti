import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LESSONS } from "@/content/course";

type LessonProgress = {
  lesson_id: number;
  completed: boolean;
  exercise_done: boolean;
  score: number;
  max_score: number;
};

type QuizAttempt = {
  id: string;
  quiz_type: string;
  lesson_id: number | null;
  score: number;
  max_score: number;
  percent: number;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/progress")({
  component: ProgressPage,
});

function ProgressPage() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [error, setError] = useState("");

  async function loadProgress() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setError("Пользователь не авторизован.");
        return;
      }

      const [progressResult, attemptsResult] = await Promise.all([
        supabase
          .from("lesson_progress")
          .select(
            "lesson_id, completed, exercise_done, score, max_score",
          )
          .eq("user_id", user.id)
          .order("lesson_id", { ascending: true }),

        supabase
          .from("quiz_attempts")
          .select(
            "id, quiz_type, lesson_id, score, max_score, percent, created_at",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (progressResult.error) throw progressResult.error;
      if (attemptsResult.error) throw attemptsResult.error;

      setProgress(progressResult.data ?? []);
      setAttempts(attemptsResult.data ?? []);
    } catch (err) {
      console.error(err);
      setError("Не удалось загрузить прогресс.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProgress();
  }, []);

  const completedLessons = useMemo(
    () => progress.filter((item) => item.completed).length,
    [progress],
  );

  const progressPercent = useMemo(() => {
    if (!LESSONS.length) return 0;

    return Math.round((completedLessons / LESSONS.length) * 100);
  }, [completedLessons]);

  const bestAttempt = useMemo(() => {
    if (!attempts.length) return null;

    return Math.max(...attempts.map((item) => item.percent));
  }, [attempts]);

  function lessonTitle(lessonId: number) {
    const lesson = LESSONS.find((item) => item.id === lessonId);

    return lesson?.title ?? `Урок ${lessonId}`;
  }

  function quizTitle(type: string) {
    switch (type) {
      case "lesson":
        return "Тест урока";
      case "quiz":
        return "Тест";
      case "sor":
        return "СОР";
      case "final":
      case "final_test":
        return "Итоговый тест";
      default:
        return type;
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-muted-foreground">Загрузка прогресса...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <Link
          to="/lessons"
          className="mb-4 inline-flex rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          ← Назад к урокам
        </Link>

        <p className="text-sm text-muted-foreground">
          ЦОР «Информация и компьютер»
        </p>

        <h1 className="mt-1 text-3xl font-bold">Мой прогресс</h1>

        <p className="mt-2 text-muted-foreground">
          Здесь отображаются результаты прохождения уроков и тестов.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Общая статистика */}
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Прогресс</p>
          <p className="mt-2 text-3xl font-bold">{progressPercent}%</p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Уроки</p>
          <p className="mt-2 text-3xl font-bold">
            {completedLessons}/{LESSONS.length}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Попытки</p>
          <p className="mt-2 text-3xl font-bold">{attempts.length}</p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Лучший результат</p>
          <p className="mt-2 text-3xl font-bold">
            {bestAttempt === null ? "—" : `${bestAttempt}%`}
          </p>
        </div>
      </section>

      {/* Прогресс по урокам */}
      <section className="mb-8 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-bold">Прогресс по урокам</h2>
          <p className="text-sm text-muted-foreground">
            Состояние прохождения каждого урока.
          </p>
        </div>

        <div className="space-y-3">
          {LESSONS.map((lesson) => {
            const item = progress.find(
              (progressItem) => progressItem.lesson_id === lesson.id,
            );

            const completed = item?.completed ?? false;
            const exerciseDone = item?.exercise_done ?? false;

            return (
              <div
                key={lesson.id}
                className="flex items-center justify-between gap-4 rounded-xl border p-4"
              >
                <div>
                  <p className="font-semibold">
                    {lesson.id}. {lesson.title}
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {completed
                      ? "Урок пройден"
                      : exerciseDone
                        ? "Упражнение выполнено"
                        : "Не начат"}
                  </p>
                </div>

                <div className="text-right">
                  {completed ? (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                      ✓ Готово
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
                      Не пройден
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Тесты */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-bold">Результаты тестов</h2>
          <p className="text-sm text-muted-foreground">
            История выполненных тестов и СОР.
          </p>
        </div>

        {attempts.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            Пока нет выполненных тестов.
          </div>
        ) : (
          <div className="space-y-3">
            {attempts.map((attempt) => (
              <div
                key={attempt.id}
                className="flex items-center justify-between gap-4 rounded-xl border p-4"
              >
                <div>
                  <p className="font-semibold">
                    {quizTitle(attempt.quiz_type)}
                  </p>

                  {attempt.lesson_id && (
                    <p className="text-sm text-muted-foreground">
                      {lessonTitle(attempt.lesson_id)}
                    </p>
                  )}

                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(attempt.created_at).toLocaleString("ru-RU")}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold">
                    {attempt.percent}%
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {attempt.score}/{attempt.max_score}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}