import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FINAL_TEST, gradeFor } from "@/content/course";
import { Quiz } from "@/components/course/Quiz";
import { useSession } from "@/hooks/useSession";
import { fetchMyProgress, saveQuizAttempt } from "@/lib/progress";

export const Route = createFileRoute("/_authenticated/final-test")({
  head: () => ({
    meta: [
      { title: "Итоговый тест курса — Информация и компьютер, 5 класс" },
      { name: "description", content: "Итоговый тест из 20 вопросов по всему разделу с баллами, процентом и разбором ошибок." },
      { property: "og:title", content: "Итоговый тест курса «Информация и компьютер»" },
      { property: "og:description", content: "20 вопросов, подсчёт баллов и подробный разбор ошибок." },
    ],
  }),
  component: FinalTestPage,
});

function FinalTestPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["progress", user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchMyProgress(user!.id),
  });

  const best = (data?.attempts ?? [])
    .filter((a) => a.quiz_type === "final")
    .reduce<number | null>((acc, a) => (acc === null || a.percent > acc ? a.percent : acc), null);

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border-4 border-border bg-[#FFF2B8] p-6 shadow-[6px_6px_0_0_var(--color-border)]">
        <h1 className="font-display text-3xl font-extrabold">🏁 Итоговый тест курса</h1>
        <p className="mt-1 font-medium">
          20 вопросов по всем темам раздела. После проверки ты увидишь баллы, процент выполнения и разбор
          каждой ошибки.
        </p>
        {best !== null && <p className="mt-2 font-bold">Твой лучший результат: {best}%</p>}
      </header>

      <Quiz
        questions={FINAL_TEST}
        title="Итоговый тест (20 вопросов)"
        emoji="🏁"
        submitLabel="Завершить тест"
        onFinish={async (r) => {
          if (!user) return;
          await saveQuizAttempt({
            userId: user.id,
            quizType: "final",
            lessonId: null,
            score: r.score,
            max: r.max,
            percent: r.percent,
            answers: r.answers,
          });
          await queryClient.invalidateQueries({ queryKey: ["progress", user.id] });
          toast.success(`Тест сохранён: ${r.score}/${r.max} (${r.percent}%). Оценка: ${gradeFor(r.score, r.max)}`);
        }}
      />
    </div>
  );
}
