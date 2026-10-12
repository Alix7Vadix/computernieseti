import { useEffect, useMemo, useState } from "react";
import {
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Student = {
  id: string;
  full_name: string;
};

type ClassInfo = {
  id: string;
  name: string;
  join_code: string;
  created_at?: string;
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

const STANDARD_CLASSES = [
  { name: "5А", code: "5A" },
  { name: "5Б", code: "5B" },
  { name: "5В", code: "5V" },
  { name: "5Г", code: "5G" },
  { name: "5Д", code: "5D" },
  { name: "5Е", code: "5E" },
  { name: "5Ж", code: "5ZH" },
];

export const Route = createFileRoute(
  "/_authenticated/teacher",
)({
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

  const [selectedClassId, setSelectedClassId] =
    useState<string | null>(null);

  const [selectedStudent, setSelectedStudent] =
    useState<Student | null>(null);

  const [newClassName, setNewClassName] = useState("");
  const [creatingClass, setCreatingClass] =
    useState(false);

  const [deletingClassId, setDeletingClassId] =
    useState<string | null>(null);

  /*
   * ======================================================
   * ЗАГРУЗКА ДАННЫХ УЧИТЕЛЯ
   * ======================================================
   */

  async function loadTeacherData(
    keepSelectedClass = true,
  ) {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate({
          to: "/auth",
        });

        return;
      }

      setTeacherId(user.id);

      /*
       * Проверяем роль.
       */

      const {
        data: isTeacher,
        error: roleError,
      } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "teacher",
      });

      if (roleError) {
        throw roleError;
      }

      if (!isTeacher) {
        setError(
          "Доступ разрешён только учителю.",
        );

        return;
      }

      /*
       * ==================================================
       * СОЗДАЁМ 5А–5Ж
       * ==================================================
       *
       * SQL-функция создаёт стандартные классы
       * для текущего учителя.
       *
       * Если они уже существуют — ничего не происходит.
       */

      const {
        error: standardClassError,
      } = await supabase.rpc(
        "create_standard_classes",
      );

      if (standardClassError) {
        console.warn(
          "Не удалось создать стандартные классы:",
          standardClassError,
        );
      }

      /*
       * Загружаем классы учителя.
       */

      const {
        data: classData,
        error: classError,
      } = await supabase
        .from("classes")
        .select(
          "id, name, join_code, created_at",
        )
        .eq("teacher_id", user.id)
        .order("created_at", {
          ascending: true,
        });

      if (classError) {
        throw classError;
      }

      const loadedClasses =
        (classData ?? []) as ClassInfo[];

      /*
       * Сортируем 5А–5Ж по алфавиту,
       * остальные классы после них.
       */

      const sortedClasses =
        sortClasses(loadedClasses);

      setClasses(sortedClasses);

      /*
       * Если класс ещё не выбран —
       * выбираем 5А, а если его нет —
       * первый доступный.
       */

      if (!keepSelectedClass) {
        setSelectedClassId(
          sortedClasses[0]?.id ?? null,
        );
      } else if (
        selectedClassId &&
        sortedClasses.some(
          (item) =>
            item.id === selectedClassId,
        )
      ) {
        // Оставляем текущий класс.
      } else {
        setSelectedClassId(
          sortedClasses[0]?.id ?? null,
        );
      }

      /*
       * Если классов нет.
       */

      if (sortedClasses.length === 0) {
        setMembers([]);
        setStudents([]);
        setProgress([]);
        setAttempts([]);
        return;
      }

      const classIds =
        sortedClasses.map(
          (item) => item.id,
        );

      /*
       * ==================================================
       * УЧЕНИКИ В КЛАССАХ
       * ==================================================
       */

      const {
        data: memberData,
        error: memberError,
      } = await supabase
        .from("class_members")
        .select(
          "id, class_id, student_id",
        )
        .in("class_id", classIds);

      if (memberError) {
        throw memberError;
      }

      const loadedMembers =
        (memberData ?? []) as Member[];

      setMembers(loadedMembers);

      const studentIds = [
        ...new Set(
          loadedMembers.map(
            (member) =>
              member.student_id,
          ),
        ),
      ];

      /*
       * Нет учеников.
       */

      if (studentIds.length === 0) {
        setStudents([]);
        setProgress([]);
        setAttempts([]);
        return;
      }

      /*
       * ==================================================
       * ПРОФИЛИ
       * ==================================================
       */

      const {
        data: studentData,
        error: studentError,
      } = await supabase
        .from("profiles")
        .select(
          "id, full_name",
        )
        .in("id", studentIds)
        .order("full_name", {
          ascending: true,
        });

      if (studentError) {
        throw studentError;
      }

      const loadedStudents =
        (studentData ?? []) as Student[];

      setStudents(loadedStudents);

      /*
       * ==================================================
       * ПРОГРЕСС УРОКОВ
       * ==================================================
       */

      const {
        data: progressData,
        error: progressError,
      } = await supabase
        .from("lesson_progress")
        .select(
          "user_id, lesson_id, completed, exercise_done, score, max_score",
        )
        .in("user_id", studentIds);

      if (progressError) {
        throw progressError;
      }

      setProgress(
        (progressData ??
          []) as LessonProgress[],
      );

      /*
       * ==================================================
       * ТЕСТЫ
       * ==================================================
       */

      const {
        data: attemptData,
        error: attemptError,
      } = await supabase
        .from("quiz_attempts")
        .select(
          "id, user_id, quiz_type, lesson_id, score, max_score, percent, created_at",
        )
        .in("user_id", studentIds)
        .order("created_at", {
          ascending: false,
        });

      if (attemptError) {
        throw attemptError;
      }

      setAttempts(
        (attemptData ??
          []) as QuizAttempt[],
      );
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
    void loadTeacherData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * ======================================================
   * СОЗДАНИЕ ДОПОЛНИТЕЛЬНОГО КЛАССА
   * ======================================================
   */

  async function createClass() {
    const name =
      newClassName.trim();

    if (!name) {
      return;
    }

    setCreatingClass(true);
    setError("");

    try {
      const joinCode =
        createJoinCode();

      const {
        error: insertError,
      } = await supabase
        .from("classes")
        .insert({
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

  /*
   * ======================================================
   * УДАЛЕНИЕ КЛАССА
   * ======================================================
   */

  async function deleteClass(
    classId: string,
    className: string,
  ) {
    const confirmed =
      window.confirm(
        `Удалить класс «${className}»?\n\nУченики будут отключены от этого класса.`,
      );

    if (!confirmed) {
      return;
    }

    setDeletingClassId(classId);
    setError("");

    try {
      const {
        error: deleteError,
      } = await supabase
        .from("classes")
        .delete()
        .eq("id", classId)
        .eq(
          "teacher_id",
          teacherId,
        );

      if (deleteError) {
        throw deleteError;
      }

      if (
        selectedClassId ===
        classId
      ) {
        setSelectedClassId(null);
      }

      if (selectedStudent) {
        setSelectedStudent(null);
      }

      await loadTeacherData(
        false,
      );
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

  /*
   * ======================================================
   * ВЫХОД
   * ======================================================
   */

  async function logout() {
    await supabase.auth.signOut();

    navigate({
      to: "/auth",
    });
  }

  /*
   * ======================================================
   * ВЫБРАННЫЙ КЛАСС
   * ======================================================
   */

  const selectedClass =
    classes.find(
      (item) =>
        item.id ===
        selectedClassId,
    ) ?? null;

  /*
   * ======================================================
   * УЧЕНИКИ ВЫБРАННОГО КЛАССА
   * ======================================================
   */

  const selectedClassStudentIds =
    useMemo(() => {
      if (!selectedClassId) {
        return [];
      }

      return [
        ...new Set(
          members
            .filter(
              (member) =>
                member.class_id ===
                selectedClassId,
            )
            .map(
              (member) =>
                member.student_id,
            ),
        ),
      ];
    }, [
      members,
      selectedClassId,
    ]);

  const selectedClassStudents =
    useMemo(() => {
      const ids = new Set(
        selectedClassStudentIds,
      );

      return students
        .filter((student) =>
          ids.has(student.id),
        )
        .sort((a, b) =>
          a.full_name.localeCompare(
            b.full_name,
            "ru",
          ),
        );
    }, [
      students,
      selectedClassStudentIds,
    ]);

  /*
   * ======================================================
   * СТАТИСТИКА
   * ======================================================
   */

  const statistics =
    useMemo(() => {
      const progressByStudent =
        new Map<
          string,
          LessonProgress[]
        >();

      for (const item of progress) {
        const list =
          progressByStudent.get(
            item.user_id,
          ) ?? [];

        list.push(item);

        progressByStudent.set(
          item.user_id,
          list,
        );
      }

      const studentStats =
        selectedClassStudents.map(
          (student) => {
            const studentProgress =
              progressByStudent.get(
                student.id,
              ) ?? [];

            const studentAttempts =
              attempts.filter(
                (attempt) =>
                  attempt.user_id ===
                  student.id,
              );

            const completedLessons =
              new Set(
                studentProgress
                  .filter(
                    (item) =>
                      item.completed,
                  )
                  .map(
                    (item) =>
                      item.lesson_id,
                  ),
              ).size;

            const lessonProgressPercent =
              Math.min(
                100,
                Math.round(
                  (completedLessons /
                    8) *
                    100,
                ),
              );

            const averageQuizPercent =
              studentAttempts.length >
              0
                ? Math.round(
                    studentAttempts.reduce(
                      (
                        sum,
                        attempt,
                      ) =>
                        sum +
                        attempt.percent,
                      0,
                    ) /
                      studentAttempts.length,
                  )
                : 0;

            return {
              student,
              completedLessons,
              lessonProgressPercent,
              averageQuizPercent,
              attemptsCount:
                studentAttempts.length,
            };
          },
        );

      const averageProgress =
        studentStats.length > 0
          ? Math.round(
              studentStats.reduce(
                (
                  sum,
                  item,
                ) =>
                  sum +
                  item.lessonProgressPercent,
                0,
              ) /
                studentStats.length,
            )
          : 0;

      const classAttempts =
        attempts.filter(
          (attempt) =>
            selectedClassStudentIds.includes(
              attempt.user_id,
            ),
        );

      return {
        studentStats,
        averageProgress,
        classAttempts,
      };
    }, [
      selectedClassStudents,
      selectedClassStudentIds,
      progress,
      attempts,
    ]);

  /*
   * ======================================================
   * ОБЩАЯ СТАТИСТИКА
   * ======================================================
   */

  const totalStudents =
    students.length;

  const totalAttempts =
    attempts.length;

  /*
   * ======================================================
   * ПОДРОБНЫЙ УЧЕНИК
   * ======================================================
   */

  function getStudentProgress(
    studentId: string,
  ) {
    return progress.filter(
      (item) =>
        item.user_id ===
        studentId,
    );
  }

  function getStudentAttempts(
    studentId: string,
  ) {
    return attempts.filter(
      (item) =>
        item.user_id ===
        studentId,
    );
  }

  function getStudentClasses(
    studentId: string,
  ) {
    const studentClassIds =
      members
        .filter(
          (member) =>
            member.student_id ===
            studentId,
        )
        .map(
          (member) =>
            member.class_id,
        );

    return classes.filter(
      (classItem) =>
        studentClassIds.includes(
          classItem.id,
        ),
    );
  }

  /*
   * ======================================================
   * LOADING
   * ======================================================
   */

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
            <p className="text-lg font-medium">
              Загрузка панели учителя...
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ======================================================
   * ОШИБКА АВТОРИЗАЦИИ
   * ======================================================
   */

  if (error && !teacherId) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-destructive/30 bg-card p-8 shadow-sm">
            <h1 className="mb-3 text-2xl font-bold">
              Ошибка панели учителя
            </h1>

            <p className="mb-6 text-muted-foreground">
              {error}
            </p>

            <button
              onClick={() =>
                navigate({
                  to: "/lessons",
                })
              }
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
            >
              Вернуться к урокам
            </button>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ======================================================
   * ПОДРОБНОСТИ УЧЕНИКА
   * ======================================================
   */

  if (selectedStudent) {
    const studentProgress =
      getStudentProgress(
        selectedStudent.id,
      );

    const studentAttempts =
      getStudentAttempts(
        selectedStudent.id,
      );

    const studentClasses =
      getStudentClasses(
        selectedStudent.id,
      );

    const completedLessons =
      new Set(
        studentProgress
          .filter(
            (item) =>
              item.completed,
          )
          .map(
            (item) =>
              item.lesson_id,
          ),
      ).size;

    const overallProgress =
      Math.min(
        100,
        Math.round(
          (completedLessons /
            8) *
            100,
        ),
      );

    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <button
                onClick={() =>
                  setSelectedStudent(
                    null,
                  )
                }
                className="mb-3 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                ← Назад к классу
              </button>

              <h1 className="text-3xl font-bold">
                {selectedStudent.full_name ||
                  "Ученик"}
              </h1>

              <p className="mt-1 text-muted-foreground">
                Подробные результаты ученика
              </p>
            </div>

            <button
              onClick={() =>
                void loadTeacherData()
              }
              className="rounded-lg border bg-card px-4 py-2 text-sm hover:bg-muted"
            >
              Обновить
            </button>
          </header>

          <div className="grid gap-4 md:grid-cols-4">
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
              value={String(
                studentAttempts.length,
              )}
            />

            <StatCard
              title="Средний результат"
              value={
                studentAttempts.length >
                0
                  ? `${Math.round(
                      studentAttempts.reduce(
                        (
                          sum,
                          item,
                        ) =>
                          sum +
                          item.percent,
                        0,
                      ) /
                        studentAttempts.length,
                    )}%`
                  : "—"
              }
            />
          </div>

          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">
              Классы
            </h2>

            {studentClasses.length ===
            0 ? (
              <p className="text-muted-foreground">
                Ученик пока не состоит ни в одном классе.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {studentClasses.map(
                  (classItem) => (
                    <span
                      key={
                        classItem.id
                      }
                      className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium"
                    >
                      {classItem.name} ·{" "}
                      {classItem.join_code}
                    </span>
                  ),
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">
              Прогресс по урокам
            </h2>

            <div className="grid gap-3 md:grid-cols-2">
              {Array.from(
                {
                  length: 8,
                },
                (_, index) => {
                  const lessonId =
                    index + 1;

                  const lesson =
                    studentProgress.find(
                      (item) =>
                        item.lesson_id ===
                        lessonId,
                    );

                  return (
                    <div
                      key={
                        lessonId
                      }
                      className="rounded-xl border p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="font-medium">
                          Урок{" "}
                          {lessonId}
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
                        Баллы:{" "}
                        {lesson?.score ??
                          0}{" "}
                        /{" "}
                        {lesson?.max_score ??
                          0}
                      </div>

                      <div className="mt-1 text-sm text-muted-foreground">
                        Практическое задание:{" "}
                        {lesson?.exercise_done
                          ? "выполнено"
                          : "не выполнено"}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">
              Результаты тестов
            </h2>

            {studentAttempts.length ===
            0 ? (
              <p className="text-muted-foreground">
                Ученик ещё не проходил тесты.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3">
                        Тип
                      </th>
                      <th className="p-3">
                        Урок
                      </th>
                      <th className="p-3">
                        Баллы
                      </th>
                      <th className="p-3">
                        Результат
                      </th>
                      <th className="p-3">
                        Дата
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {studentAttempts.map(
                      (attempt) => (
                        <tr
                          key={
                            attempt.id
                          }
                          className="border-b"
                        >
                          <td className="p-3">
                            {formatQuizType(
                              attempt.quiz_type,
                            )}
                          </td>

                          <td className="p-3">
                            {attempt.lesson_id
                              ? `Урок ${attempt.lesson_id}`
                              : "—"}
                          </td>

                          <td className="p-3">
                            {
                              attempt.score
                            }{" "}
                            /{" "}
                            {
                              attempt.max_score
                            }
                          </td>

                          <td className="p-3 font-bold">
                            {
                              attempt.percent
                            }
                            %
                          </td>

                          <td className="p-3 text-muted-foreground">
                            {formatDate(
                              attempt.created_at,
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  /*
   * ======================================================
   * ОСНОВНАЯ ПАНЕЛЬ
   * ======================================================
   */

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-medium text-primary">
              ЦОР «Информация и компьютер»
            </p>

            <h1 className="text-3xl font-bold">
              Панель учителя
            </h1>

            <p className="mt-1 text-muted-foreground">
              Классы, ученики, прогресс и результаты тестов
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                navigate({
                  to: "/lessons",
                })
              }
              className="rounded-lg border bg-card px-4 py-2 text-sm hover:bg-muted"
            >
              ← К урокам
            </button>

            <button
              onClick={() =>
                void loadTeacherData()
              }
              className="rounded-lg border bg-card px-4 py-2 text-sm hover:bg-muted"
            >
              Обновить
            </button>

            <button
              onClick={() =>
                void logout()
              }
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
            >
              Выйти
            </button>
          </div>
        </header>

        {/* ERROR */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            {error}
          </div>
        )}

        {/* ОБЩАЯ СТАТИСТИКА */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Всего учеников"
            value={String(
              totalStudents,
            )}
          />

          <StatCard
            title="Классов"
            value={String(
              classes.length,
            )}
          />

          <StatCard
            title="Средний прогресс"
            value={`${statistics.averageProgress}%`}
          />

          <StatCard
            title="Всего попыток"
            value={String(
              totalAttempts,
            )}
          />
        </div>

        {/* ================================================= */}
        {/* КЛАССЫ */}
        {/* ================================================= */}

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold">
              Мои классы
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Выбери класс, чтобы посмотреть его учеников.
            </p>
          </div>

          {classes.length ===
          0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="font-medium">
                Классов пока нет.
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                Нажми «Создать стандартные классы»
                или создай класс вручную.
              </p>

              <button
                onClick={() =>
                  void loadTeacherData(
                    false,
                  )
                }
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground"
              >
                Создать 5А–5Ж
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {classes.map(
                (classItem) => {
                  const count =
                    members.filter(
                      (member) =>
                        member.class_id ===
                        classItem.id,
                    ).length;

                  const isSelected =
                    selectedClassId ===
                    classItem.id;

                  const isDeleting =
                    deletingClassId ===
                    classItem.id;

                  return (
                    <div
                      key={
                        classItem.id
                      }
                      className={`rounded-xl border-2 p-4 transition ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedClassId(
                            classItem.id,
                          )
                        }
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-lg font-bold">
                            {
                              classItem.name
                            }
                          </h3>

                          <span className="rounded-md bg-primary/10 px-2 py-1 font-mono text-xs font-bold">
                            {
                              classItem.join_code
                            }
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-muted-foreground">
                          Учеников:{" "}
                          {count}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void deleteClass(
                            classItem.id,
                            classItem.name,
                          )
                        }
                        disabled={
                          isDeleting
                        }
                        className="mt-4 w-full rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {isDeleting
                          ? "Удаление..."
                          : "Удалить класс"}
                      </button>
                    </div>
                  );
                },
              )}
            </div>
          )}

          {/* ДОПОЛНИТЕЛЬНЫЙ КЛАСС */}
          <div className="mt-6 border-t pt-5">
            <p className="mb-3 text-sm font-semibold">
              Создать дополнительный класс
            </p>

            <div className="flex flex-wrap gap-2">
              <input
                value={newClassName}
                onChange={(event) =>
                  setNewClassName(
                    event.target.value,
                  )
                }
                placeholder="Например: ИНФ-22с"
                className="min-w-[250px] flex-1 rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30"
              />

              <button
                onClick={() =>
                  void createClass()
                }
                disabled={
                  creatingClass ||
                  !newClassName.trim()
                }
                className="rounded-lg bg-primary px-5 py-2 text-primary-foreground disabled:opacity-50"
              >
                {creatingClass
                  ? "Создание..."
                  : "Создать"}
              </button>
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* ВЫБРАННЫЙ КЛАСС */}
        {/* ================================================= */}

        {selectedClass && (
          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  Выбранный класс
                </p>

                <h2 className="text-2xl font-bold">
                  {selectedClass.name}
                </h2>
              </div>

              <div className="rounded-xl bg-primary/10 px-5 py-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Код класса
                </p>

                <p className="font-mono text-xl font-bold">
                  {
                    selectedClass.join_code
                  }
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <StatCard
                title="Учеников"
                value={String(
                  selectedClassStudents.length,
                )}
              />

              <StatCard
                title="Средний прогресс"
                value={`${statistics.averageProgress}%`}
              />

              <StatCard
                title="Попыток тестов"
                value={String(
                  statistics.classAttempts
                    .length,
                )}
              />

              <StatCard
                title="Статус"
                value={
                  selectedClassStudents.length >
                  0
                    ? "Активен"
                    : "Пустой"
                }
              />
            </div>
          </section>
        )}

        {/* ================================================= */}
        {/* УЧЕНИКИ */}
        {/* ================================================= */}

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold">
              {selectedClass
                ? `Ученики класса ${selectedClass.name}`
                : "Ученики"}
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Нажми «Подробнее», чтобы посмотреть
              прогресс и все попытки тестов.
            </p>
          </div>

          {!selectedClass ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              Выбери класс выше.
            </div>
          ) : selectedClassStudents.length ===
            0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="font-medium">
                В классе пока нет учеников.
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                После регистрации ученик должен
                выбрать класс {selectedClass.name}.
                После этого он появится здесь.
              </p>

              <div className="mt-4 inline-flex rounded-lg bg-muted px-4 py-2 font-mono text-sm font-bold">
                Код:{" "}
                {selectedClass.join_code}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-3">
                      №
                    </th>

                    <th className="p-3">
                      Ученик
                    </th>

                    <th className="p-3">
                      Прогресс
                    </th>

                    <th className="p-3">
                      Уроки
                    </th>

                    <th className="p-3">
                      Тесты
                    </th>

                    <th className="p-3">
                      Действие
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {statistics.studentStats.map(
                    (
                      item,
                      index,
                    ) => (
                      <tr
                        key={
                          item.student
                            .id
                        }
                        className="border-b hover:bg-muted/30"
                      >
                        <td className="p-3 text-muted-foreground">
                          {index + 1}
                        </td>

                        <td className="p-3 font-semibold">
                          {item.student
                            .full_name ||
                            "Без имени"}
                        </td>

                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{
                                  width: `${item.lessonProgressPercent}%`,
                                }}
                              />
                            </div>

                            <span className="font-bold">
                              {
                                item.lessonProgressPercent
                              }
                              %
                            </span>
                          </div>
                        </td>

                        <td className="p-3">
                          {
                            item.completedLessons
                          }{" "}
                          / 8
                        </td>

                        <td className="p-3">
                          <div className="font-semibold">
                            {item.averageQuizPercent >
                            0
                              ? `${item.averageQuizPercent}%`
                              : "—"}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            попыток:{" "}
                            {
                              item.attemptsCount
                            }
                          </div>
                        </td>

                        <td className="p-3">
                          <button
                            onClick={() =>
                              setSelectedStudent(
                                item.student,
                              )
                            }
                            className="rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground hover:opacity-90"
                          >
                            Подробнее
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/*
 * ========================================================
 * КАРТОЧКА СТАТИСТИКИ
 * ========================================================
 */

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

/*
 * ========================================================
 * СОРТИРОВКА КЛАССОВ
 * ========================================================
 */

function sortClasses(
  classes: ClassInfo[],
) {
  const standardOrder =
    new Map(
      STANDARD_CLASSES.map(
        (item, index) => [
          item.name,
          index,
        ],
      ),
    );

  return [...classes].sort(
    (a, b) => {
      const aOrder =
        standardOrder.get(
          a.name,
        );

      const bOrder =
        standardOrder.get(
          b.name,
        );

      if (
        aOrder !== undefined &&
        bOrder !== undefined
      ) {
        return aOrder - bOrder;
      }

      if (
        aOrder !== undefined
      ) {
        return -1;
      }

      if (
        bOrder !== undefined
      ) {
        return 1;
      }

      return a.name.localeCompare(
        b.name,
        "ru",
      );
    },
  );
}

/*
 * ========================================================
 * КОД ДОПОЛНИТЕЛЬНОГО КЛАССА
 * ========================================================
 */

function createJoinCode() {
  return Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
}

/*
 * ========================================================
 * ДАТА
 * ========================================================
 */

function formatDate(
  value: string,
) {
  return new Date(
    value,
  ).toLocaleString(
    "ru-RU",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  );
}

/*
 * ========================================================
 * ТИП ТЕСТА
 * ========================================================
 */

function formatQuizType(
  value: string,
) {
  const types: Record<
    string,
    string
  > = {
    lesson: "Мини-тест",
    quiz: "Мини-тест",
    sor: "СОР",
    final: "Итоговый тест",
    final_test:
      "Итоговый тест",
  };

  return (
    types[value] ?? value
  );
}