import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Student = {
  id: string;
  full_name: string;
};

type ClassInfo = {
  id: string;
  name: string;
  join_code: string;
};

type Member = {
  id: string;
  class_id: string;
  student_id: string;
};

type LessonProgress = {
  user_id: string;
  lesson_id: number;
  completed: boolean;
  exercise_done: boolean;
  score: number;
  max_score: number;
};

type QuizAttempt = {
  id: string;
  user_id: string;
  quiz_type: string;
  lesson_id: number | null;
  score: number;
  max_score: number;
  percent: number;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/teacher")({
  component: TeacherPage,
});

function TeacherPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [teacherId, setTeacherId] = useState("");
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [newClassName, setNewClassName] = useState("");
  const [creatingClass, setCreatingClass] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);

  async function loadTeacherData() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate({ to: "/auth" });
        return;
      }

      setTeacherId(user.id);

      const { data: isTeacher, error: roleError } = await supabase.rpc(
        "has_role",
        {
          _user_id: user.id,
          _role: "teacher",
        },
      );

      if (roleError) {
        throw roleError;
      }

      if (!isTeacher) {
        setError("Доступ разрешён только учителю.");
        return;
      }

      const { data: classData, error: classError } = await supabase
        .from("classes")
        .select("id, name, join_code")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: true });

      if (classError) {
        throw classError;
      }

      const loadedClasses = (classData ?? []) as ClassInfo[];
      setClasses(loadedClasses);

      if (loadedClasses.length === 0) {
        setMembers([]);
        setStudents([]);
        setProgress([]);
        setAttempts([]);
        return;
      }

      const classIds = loadedClasses.map((item) => item.id);

      const { data: memberData, error: memberError } = await supabase
        .from("class_members")
        .select("id, class_id, student_id")
        .in("class_id", classIds);

      if (memberError) {
        throw memberError;
      }

      const loadedMembers = (memberData ?? []) as Member[];
      setMembers(loadedMembers);

      const studentIds = [
        ...new Set(loadedMembers.map((member) => member.student_id)),
      ];

      if (studentIds.length === 0) {
        setStudents([]);
        setProgress([]);
        setAttempts([]);
        return;
      }

      const { data: studentData, error: studentError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", studentIds)
        .order("full_name", { ascending: true });

      if (studentError) {
        throw studentError;
      }

      const loadedStudents = (studentData ?? []) as Student[];
      setStudents(loadedStudents);

      const { data: progressData, error: progressError } = await supabase
        .from("lesson_progress")
        .select(
          "user_id, lesson_id, completed, exercise_done, score, max_score",
        )
        .in("user_id", studentIds);

      if (progressError) {
        throw progressError;
      }

      setProgress((progressData ?? []) as LessonProgress[]);

      const { data: attemptData, error: attemptError } = await supabase
        .from("quiz_attempts")
        .select(
          "id, user_id, quiz_type, lesson_id, score, max_score, percent, created_at",
        )
        .in("user_id", studentIds)
        .order("created_at", { ascending: false });

      if (attemptError) {
        throw attemptError;
      }

      setAttempts((attemptData ?? []) as QuizAttempt[]);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Не удалось загрузить данные панели учителя.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTeacherData();
  }, []);

  async function createClass() {
    const name = newClassName.trim();

    if (!name) {
      return;
    }

    setCreatingClass(true);
    setError("");

    try {
      const joinCode = createJoinCode();

      const { error: insertError } = await supabase.from("classes").insert({
        teacher_id: teacherId,
        name,
        join_code: joinCode,
      });

      if (insertError) {
        throw insertError;
      }

      setNewClassName("");
      await loadTeacherData();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Не удалось создать класс.",
      );
    } finally {
      setCreatingClass(false);
    }
  }

  async function deleteClass(classId: string, className: string) {
    const confirmed = window.confirm(
      `Удалить класс «${className}»?\n\nУченики будут отключены от этого класса.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingClassId(classId);
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("classes")
        .delete()
        .eq("id", classId)
        .eq("teacher_id", teacherId);

      if (deleteError) {
        throw deleteError;
      }

      if (selectedStudent) {
        const stillConnected = members.some(
          (member) =>
            member.student_id === selectedStudent.id &&
            member.class_id !== classId,
        );

        if (!stillConnected) {
          setSelectedStudent(null);
        }
      }

      await loadTeacherData();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Не удалось удалить класс.",
      );
    } finally {
      setDeletingClassId(null);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const statistics = useMemo(() => {
    const studentIds = students.map((student) => student.id);

    const progressByStudent = new Map<string, LessonProgress[]>();

    for (const item of progress) {
      const list = progressByStudent.get(item.user_id) ?? [];
      list.push(item);
      progressByStudent.set(item.user_id, list);
    }

    const studentStats = students.map((student) => {
      const studentProgress = progressByStudent.get(student.id) ?? [];

      const studentAttempts = attempts.filter(
        (attempt) => attempt.user_id === student.id,
      );

      const completedLessons = new Set(
        studentProgress
          .filter((item) => item.completed)
          .map((item) => item.lesson_id),
      ).size;

      const lessonProgressPercent = Math.round(
        (completedLessons / 8) * 100,
      );

      const averageQuizPercent =
        studentAttempts.length > 0
          ? Math.round(
              studentAttempts.reduce(
                (sum, attempt) => sum + attempt.percent,
                0,
              ) / studentAttempts.length,
            )
          : 0;

      return {
        student,
        completedLessons,
        lessonProgressPercent,
        averageQuizPercent,
      };
    });

    const averageProgress =
      studentStats.length > 0
        ? Math.round(
            studentStats.reduce(
              (sum, item) => sum + item.lessonProgressPercent,
              0,
            ) / studentStats.length,
          )
        : 0;

    return {
      studentIds,
      studentStats,
      averageProgress,
    };
  }, [students, progress, attempts]);

  function getStudentProgress(studentId: string) {
    return progress.filter((item) => item.user_id === studentId);
  }

  function getStudentAttempts(studentId: string) {
    return attempts.filter((item) => item.user_id === studentId);
  }

  function getStudentClasses(studentId: string) {
    const studentClassIds = members
      .filter((member) => member.student_id === studentId)
      .map((member) => member.class_id);

    return classes.filter((classItem) =>
      studentClassIds.includes(classItem.id),
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
            <p className="text-lg font-medium">
              Загрузка панели учителя...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error && !teacherId) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-destructive/30 bg-card p-8 shadow-sm">
            <h1 className="mb-3 text-2xl font-bold">
              Ошибка панели учителя
            </h1>

            <p className="mb-6 text-muted-foreground">{error}</p>

            <button
              onClick={() => navigate({ to: "/lessons" })}
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
            >
              Вернуться к урокам
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (selectedStudent) {
    const studentProgress = getStudentProgress(selectedStudent.id);
    const studentAttempts = getStudentAttempts(selectedStudent.id);
    const studentClasses = getStudentClasses(selectedStudent.id);

    const completedLessons = new Set(
      studentProgress
        .filter((item) => item.completed)
        .map((item) => item.lesson_id),
    ).size;

    const overallProgress = Math.round((completedLessons / 8) * 100);

    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="mb-3 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                ← Назад к ученикам
              </button>

              <h1 className="text-3xl font-bold">
                {selectedStudent.full_name || "Ученик"}
              </h1>

              <p className="text-muted-foreground">
                Подробные результаты ученика
              </p>
            </div>

            <button
              onClick={() => void loadTeacherData()}
              className="rounded-lg border bg-card px-4 py-2 text-sm hover:bg-muted"
            >
              Обновить
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Общий прогресс"
              value={`${overallProgress}%`}
            />

            <StatCard
              title="Завершено уроков"
              value={`${completedLessons} / 8`}
            />

            <StatCard
              title="Попыток тестов"
              value={String(studentAttempts.length)}
            />
          </div>

          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">Классы</h2>

            {studentClasses.length === 0 ? (
              <p className="text-muted-foreground">
                Ученик пока не состоит ни в одном классе.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {studentClasses.map((classItem) => (
                  <span
                    key={classItem.id}
                    className="rounded-full bg-primary/10 px-3 py-1 text-sm"
                  >
                    {classItem.name}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">
              Прогресс по урокам
            </h2>

            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 8 }, (_, index) => {
                const lessonId = index + 1;

                const lesson = studentProgress.find(
                  (item) => item.lesson_id === lessonId,
                );

                return (
                  <div
                    key={lessonId}
                    className="rounded-xl border p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium">
                        Урок {lessonId}
                      </span>

                      <span
                        className={
                          lesson?.completed
                            ? "font-semibold text-green-600"
                            : "text-muted-foreground"
                        }
                      >
                        {lesson?.completed
                          ? "✓ Завершён"
                          : "Не завершён"}
                      </span>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      Баллы: {lesson?.score ?? 0} /{" "}
                      {lesson?.max_score ?? 0}
                    </div>

                    <div className="mt-1 text-sm text-muted-foreground">
                      Практическое задание:{" "}
                      {lesson?.exercise_done
                        ? "выполнено"
                        : "не выполнено"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">
              Результаты тестов
            </h2>

            {studentAttempts.length === 0 ? (
              <p className="text-muted-foreground">
                Ученик ещё не проходил тесты.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3">Тип</th>
                      <th className="p-3">Урок</th>
                      <th className="p-3">Баллы</th>
                      <th className="p-3">Результат</th>
                      <th className="p-3">Дата</th>
                    </tr>
                  </thead>

                  <tbody>
                    {studentAttempts.map((attempt) => (
                      <tr
                        key={attempt.id}
                        className="border-b"
                      >
                        <td className="p-3">
                          {formatQuizType(attempt.quiz_type)}
                        </td>

                        <td className="p-3">
                          {attempt.lesson_id
                            ? `Урок ${attempt.lesson_id}`
                            : "—"}
                        </td>

                        <td className="p-3">
                          {attempt.score} / {attempt.max_score}
                        </td>

                        <td className="p-3 font-semibold">
                          {attempt.percent}%
                        </td>

                        <td className="p-3 text-muted-foreground">
                          {formatDate(attempt.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-medium text-primary">
              ЦОР «Информация и компьютер»
            </p>

            <h1 className="text-3xl font-bold">
              Панель учителя
            </h1>

            <p className="mt-1 text-muted-foreground">
              Управление классами и просмотр результатов учеников
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate({ to: "/lessons" })}
              className="rounded-lg border bg-card px-4 py-2 text-sm hover:bg-muted"
            >
              ← К урокам
            </button>

            <button
              onClick={() => void loadTeacherData()}
              className="rounded-lg border bg-card px-4 py-2 text-sm hover:bg-muted"
            >
              Обновить
            </button>

            <button
              onClick={() => void logout()}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            >
              Выйти
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Учеников"
            value={String(students.length)}
          />

          <StatCard
            title="Классов"
            value={String(classes.length)}
          />

          <StatCard
            title="Средний прогресс"
            value={`${statistics.averageProgress}%`}
          />

          <StatCard
            title="Всего попыток"
            value={String(attempts.length)}
          />
        </div>

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">
                Мои классы
              </h2>

              <p className="text-sm text-muted-foreground">
                Создай класс и используй код для подключения учеников.
              </p>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            <input
              value={newClassName}
              onChange={(event) =>
                setNewClassName(event.target.value)
              }
              placeholder="Название класса, например ИНФ-22с"
              className="min-w-[260px] flex-1 rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
            />

            <button
              onClick={() => void createClass()}
              disabled={
                creatingClass || !newClassName.trim()
              }
              className="rounded-lg bg-primary px-5 py-2 text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingClass
                ? "Создание..."
                : "Создать класс"}
            </button>
          </div>

          {classes.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
              Классов пока нет. Создай первый класс выше.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {classes.map((classItem) => {
                const count = members.filter(
                  (member) =>
                    member.class_id === classItem.id,
                ).length;

                const isDeleting =
                  deletingClassId === classItem.id;

                return (
                  <div
                    key={classItem.id}
                    className="rounded-xl border p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold">
                          {classItem.name}
                        </h3>

                        <p className="mt-1 text-sm text-muted-foreground">
                          Учеников: {count}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-lg bg-primary/10 px-3 py-1 font-mono text-sm font-bold">
                        {classItem.join_code}
                      </span>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          void deleteClass(
                            classItem.id,
                            classItem.name,
                          )
                        }
                        disabled={isDeleting}
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isDeleting
                          ? "Удаление..."
                          : "Удалить класс"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-bold">
              Ученики
            </h2>

            <p className="text-sm text-muted-foreground">
              Нажми на ученика, чтобы посмотреть подробные
              результаты.
            </p>
          </div>

          {students.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="font-medium">
                Пока нет подключённых учеников.
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                Создай класс и подключи учеников по коду класса.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-3">Ученик</th>
                    <th className="p-3">Прогресс</th>
                    <th className="p-3">Уроки</th>
                    <th className="p-3">Тесты</th>
                    <th className="p-3">Действие</th>
                  </tr>
                </thead>

                <tbody>
                  {statistics.studentStats.map((item) => (
                    <tr
                      key={item.student.id}
                      className="border-b"
                    >
                      <td className="p-3 font-medium">
                        {item.student.full_name ||
                          "Без имени"}
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${item.lessonProgressPercent}%`,
                              }}
                            />
                          </div>

                          <span className="font-semibold">
                            {item.lessonProgressPercent}%
                          </span>
                        </div>
                      </td>

                      <td className="p-3">
                        {item.completedLessons} / 8
                      </td>

                      <td className="p-3">
                        {item.averageQuizPercent > 0
                          ? `${item.averageQuizPercent}%`
                          : "—"}
                      </td>

                      <td className="p-3">
                        <button
                          onClick={() =>
                            setSelectedStudent(item.student)
                          }
                          className="rounded-lg bg-primary px-3 py-2 text-primary-foreground hover:opacity-90"
                        >
                          Подробнее
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>
    </div>
  );
}

function createJoinCode() {
  return Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatQuizType(value: string) {
  const types: Record<string, string> = {
    lesson: "Мини-тест",
    quiz: "Мини-тест",
    sor: "СОР",
    final: "Итоговый тест",
    final_test: "Итоговый тест",
  };

  return types[value] ?? value;
}