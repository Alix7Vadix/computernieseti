import { useState } from "react";
import type { Question } from "@/content/course";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type QuizResult = {
  score: number;
  max: number;
  percent: number;
  answers: { q: string; chosen: number; correct: number; ok: boolean }[];
};

type Props = {
  questions: Question[];
  title: string;
  emoji?: string;
  submitLabel?: string;
  onFinish?: (result: QuizResult) => void;
  showReview?: boolean;
};

export function Quiz({
  questions,
  title,
  emoji = "🧠",
  submitLabel = "Проверить",
  onFinish,
  showReview = true,
}: Props) {
  const [chosen, setChosen] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  const answeredAll = questions.every((_, i) => chosen[i] !== undefined);

  function submit() {
    const answers = questions.map((q, i) => ({
      q: q.q,
      chosen: chosen[i] ?? -1,
      correct: q.correct,
      ok: chosen[i] === q.correct,
    }));
    const score = answers.filter((a) => a.ok).length;
    const res: QuizResult = {
      score,
      max: questions.length,
      percent: Math.round((score / questions.length) * 100),
      answers,
    };
    setResult(res);
    onFinish?.(res);
  }

  function restart() {
    setChosen({});
    setResult(null);
  }

  return (
    <section className="rounded-3xl border-4 border-border bg-card p-5 shadow-[6px_6px_0_0_var(--color-border)]">
      <h3 className="mb-4 text-xl font-bold">
        {emoji} {title}
      </h3>

      <ol className="space-y-5">
        {questions.map((q, i) => (
          <li key={i} className="rounded-2xl bg-muted/60 p-4">
            <p className="mb-3 font-semibold">
              {i + 1}. {q.q}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((opt, oi) => {
                const picked = chosen[i] === oi;
                const isCorrect = result && oi === q.correct;
                const isWrongPick = result && picked && oi !== q.correct;
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={!!result}
                    onClick={() => setChosen((c) => ({ ...c, [i]: oi }))}
                    className={cn(
                      "rounded-xl border-2 border-border bg-background px-3 py-2 text-left text-sm font-medium transition-transform",
                      !result && "hover:-translate-y-0.5 hover:bg-accent",
                      picked && !result && "bg-primary text-primary-foreground",
                      isCorrect && "border-[color:var(--color-success)] bg-[color:var(--color-success)] text-white",
                      isWrongPick && "border-destructive bg-destructive text-destructive-foreground",
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {result && showReview && (
              <p className="mt-2 text-sm">
                {result.answers[i]!.ok ? "✅ Верно! " : "❌ Правильный ответ: "}
                {!result.answers[i]!.ok && <strong>{q.options[q.correct]}. </strong>}
                <span className="text-muted-foreground">{q.explain}</span>
              </p>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!result ? (
          <Button size="lg" disabled={!answeredAll} onClick={submit}>
            {submitLabel}
          </Button>
        ) : (
          <>
            <div className="rounded-2xl bg-primary px-4 py-2 font-bold text-primary-foreground">
              Результат: {result.score} из {result.max} ({result.percent}%)
            </div>
            <Button size="lg" variant="secondary" onClick={restart}>
              Пройти снова
            </Button>
          </>
        )}
        {!answeredAll && !result && (
          <span className="text-sm text-muted-foreground">Ответь на все вопросы</span>
        )}
      </div>
    </section>
  );
}
