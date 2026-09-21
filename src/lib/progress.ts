import { supabase } from "@/integrations/supabase/client";
import { LESSONS } from "@/content/course";

export type QuizType = "mini" | "sor" | "final";

export async function saveQuizAttempt(params: {
  userId: string;
  quizType: QuizType;
  lessonId: number | null;
  score: number;
  max: number;
  percent: number;
  answers: unknown;
}) {
  await supabase.from("quiz_attempts").insert({
    user_id: params.userId,
    quiz_type: params.quizType,
    lesson_id: params.lessonId,
    score: params.score,
    max_score: params.max,
    percent: params.percent,
    answers: params.answers as never,
  });
}

export async function saveLessonProgress(params: {
  userId: string;
  lessonId: number;
  score?: number;
  max?: number;
  completed?: boolean;
  exerciseDone?: boolean;
}) {
  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("id, score, max_score, completed, exercise_done")
    .eq("user_id", params.userId)
    .eq("lesson_id", params.lessonId)
    .maybeSingle();

  const nextScore = Math.max(params.score ?? 0, existing?.score ?? 0);
  const nextMax = params.max ?? existing?.max_score ?? 0;

  const row = {
    user_id: params.userId,
    lesson_id: params.lessonId,
    score: nextScore,
    max_score: nextMax,
    completed: params.completed ?? existing?.completed ?? false,
    exercise_done: params.exerciseDone ?? existing?.exercise_done ?? false,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from("lesson_progress").update(row).eq("id", existing.id);
  } else {
    await supabase.from("lesson_progress").insert(row);
  }
}

export async function fetchMyProgress(userId: string) {
  const [progress, attempts] = await Promise.all([
    supabase.from("lesson_progress").select("*").eq("user_id", userId),
    supabase
      .from("quiz_attempts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);
  return {
    progress: progress.data ?? [],
    attempts: attempts.data ?? [],
  };
}

export function coursePercent(completedLessons: number) {
  return Math.round((completedLessons / LESSONS.length) * 100);
}
