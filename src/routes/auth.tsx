import { useEffect, useState } from "react";
import {
  createFileRoute,
  Link,
  useNavigate,
} from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { studentEmail, fullName } from "@/lib/studentLogin";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Role = "student" | "teacher";

type StudentClass = {
  name: string;
  code: string;
};

const STUDENT_CLASSES: StudentClass[] = [
  { name: "5А", code: "5A" },
  { name: "5Б", code: "5B" },
  { name: "5В", code: "5V" },
  { name: "5Г", code: "5G" },
  { name: "5Д", code: "5D" },
  { name: "5Е", code: "5E" },
  { name: "5Ж", code: "5ZH" },
];

const STUDENT_CODE_STORAGE_KEY = "cor_student_code";
const STUDENT_EMAIL_STORAGE_KEY = "cor_student_email";
const STUDENT_CLASS_STORAGE_KEY = "cor_student_class";

/**
 * Генерация уникального номера ученика.
 *
 * Например:
 * STUDENT-482731
 */
function generateStudentCode(): string {
  const randomPart = Math.floor(
    100000 + Math.random() * 900000,
  );

  return `STUDENT-${randomPart}`;
}

/**
 * Внутренний email для Supabase.
 *
 * Ученик его не вводит.
 */
function studentEmailFromCode(code: string): string {
  const randomPart = Math.random()
    .toString(36)
    .slice(2, 8);

  const numericPart = code
    .replace("STUDENT-", "")
    .toLowerCase();

  return `student-${numericPart}-${randomPart}@students.example.com`;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { role: Role } => ({
    role:
      search.role === "teacher"
        ? "teacher"
        : "student",
  }),

  head: () => ({
    meta: [
      {
        title:
          "Вход и регистрация — ЦОР «Информация и компьютер»",
      },
      {
        name: "description",
        content:
          "Вход для учеников и отдельный вход для учителя.",
      },
      {
        property: "og:title",
        content:
          "Вход и регистрация — ЦОР «Информация и компьютер»",
      },
      {
        property: "og:description",
        content:
          "Регистрация учеников с автоматическим выбором класса.",
      },
    ],
  }),

  component: AuthPage,
});

function AuthPage() {
  const { role } = Route.useSearch();
  const navigate = useNavigate();

  const isStudent = role === "student";

  const [mode, setMode] =
    useState<"in" | "up">("in");

  const [lastName, setLastName] =
    useState("");

  const [firstName, setFirstName] =
    useState("");

  const [teacherName, setTeacherName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  /*
   * Выбранный класс ученика.
   */
  const [selectedClass, setSelectedClass] =
    useState("");

  /*
   * Код ученика хранится только для
   * внутренней авторизации.
   */
  const [studentCode, setStudentCode] =
    useState("");

  /*
   * Показываем созданный номер после
   * регистрации.
   */
  const [
    createdStudentCode,
    setCreatedStudentCode,
  ] = useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [busy, setBusy] =
    useState(false);

  /*
   * Восстанавливаем данные ученика
   * из браузера.
   */
  useEffect(() => {
    if (!isStudent) return;

    const savedCode =
      localStorage.getItem(
        STUDENT_CODE_STORAGE_KEY,
      );

    const savedClass =
      localStorage.getItem(
        STUDENT_CLASS_STORAGE_KEY,
      );

    if (savedCode) {
      setStudentCode(savedCode);
    }

    if (savedClass) {
      setSelectedClass(savedClass);
    }
  }, [isStudent]);

  /*
   * Если пользователь уже авторизован,
   * отправляем его в нужный раздел.
   */
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const { data } =
        await supabase.auth.getSession();

      if (
        cancelled ||
        !data.session
      ) {
        return;
      }

      const currentRole =
        data.session.user.user_metadata
          ?.role;

      if (currentRole === "teacher") {
        navigate({
          to: "/teacher",
          replace: true,
        });
      } else {
        navigate({
          to: "/lessons",
          replace: true,
        });
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  /*
   * При переключении режима/роли
   * очищаем сообщения.
   */
  useEffect(() => {
    setError(null);
    setCreatedStudentCode(null);
  }, [role, mode]);

  /*
   * ===============================
   * ОСНОВНАЯ ФУНКЦИЯ
   * ===============================
   */
  async function submit(
    e: React.FormEvent,
  ) {
    e.preventDefault();

    setError(null);
    setCreatedStudentCode(null);
    setBusy(true);

    try {
      /*
       * ===============================
       * ПРОВЕРКИ
       * ===============================
       */

      if (isStudent) {
        if (!lastName.trim()) {
          setError(
            "Введите фамилию.",
          );
          return;
        }

        if (!firstName.trim()) {
          setError(
            "Введите имя.",
          );
          return;
        }

        if (!selectedClass) {
          setError(
            "Выберите класс.",
          );
          return;
        }
      }

      if (!isStudent && !email.trim()) {
        setError(
          "Введите электронную почту.",
        );
        return;
      }

      if (
        !isStudent &&
        !email.includes("@")
      ) {
        setError(
          "Введите корректный адрес электронной почты.",
        );
        return;
      }

      if (password.length < 6) {
        setError(
          "Пароль должен быть не короче 6 символов.",
        );
        return;
      }

      /*
       * ===============================
       * РЕГИСТРАЦИЯ УЧЕНИКА
       * ===============================
       */

      if (
        isStudent &&
        mode === "up"
      ) {
        const selectedClassInfo =
          STUDENT_CLASSES.find(
            (item) =>
              item.code ===
              selectedClass,
          );

        if (!selectedClassInfo) {
          setError(
            "Выбранный класс не найден.",
          );
          return;
        }

        /*
         * Генерируем уникальный номер.
         */
        const newStudentCode =
          generateStudentCode();

        /*
         * Генерируем внутренний email.
         */
        const internalEmail =
          studentEmailFromCode(
            newStudentCode,
          );

        const name = fullName(
          lastName,
          firstName,
        );

        /*
         * Регистрируем пользователя
         * в Supabase.
         */
        const {
          data,
          error: signUpError,
        } =
          await supabase.auth.signUp({
            email: internalEmail,
            password,

            options: {
              emailRedirectTo:
                window.location.origin,

              data: {
                full_name: name,
                role: "student",

                last_name:
                  lastName.trim(),

                first_name:
                  firstName.trim(),

                student_code:
                  newStudentCode,

                class_code:
                  selectedClassInfo.code,

                class_name:
                  selectedClassInfo.name,
              },
            },
          });

        if (signUpError) {
          console.error(
            "Student signUp error:",
            signUpError,
          );

          setError(
            signUpError.message,
          );

          return;
        }

        /*
         * Сохраняем данные локально.
         */
        localStorage.setItem(
          STUDENT_CODE_STORAGE_KEY,
          newStudentCode,
        );

        localStorage.setItem(
          STUDENT_EMAIL_STORAGE_KEY,
          internalEmail,
        );

        localStorage.setItem(
          STUDENT_CLASS_STORAGE_KEY,
          selectedClassInfo.code,
        );

        setStudentCode(
          newStudentCode,
        );

        setCreatedStudentCode(
          newStudentCode,
        );

        /*
         * Если Supabase сразу дал сессию,
         * автоматически подключаем ученика
         * к выбранному классу.
         */
        if (data.session) {
          const {
            error: joinError,
          } =
            await supabase.rpc(
              "join_class_by_code",
              {
                p_join_code:
                  selectedClassInfo.code,
              },
            );

          if (joinError) {
            console.error(
              "join_class_by_code error:",
              joinError,
            );

            setError(
              `Аккаунт создан, но не удалось подключить к классу ${selectedClassInfo.name}: ${joinError.message}`,
            );

            return;
          }

          navigate({
            to: "/lessons",
            replace: true,
          });

          return;
        }

        /*
         * Если сессии нет, значит включено
         * подтверждение email.
         */
        setError(
          "Аккаунт создан, но Supabase не создал сессию. Для автоматической регистрации учеников отключите подтверждение email в Supabase → Authentication → Providers → Email.",
        );

        return;
      }

      /*
       * ===============================
       * ВХОД УЧЕНИКА
       * ===============================
       */

      if (isStudent) {
        if (!selectedClass) {
          setError(
            "Выберите класс.",
          );
          return;
        }

        let loginEmail =
          localStorage.getItem(
            STUDENT_EMAIL_STORAGE_KEY,
          );

        /*
         * Старые аккаунты используют
         * старую систему studentEmail().
         */
        if (!loginEmail) {
          loginEmail = studentEmail(
            lastName,
            firstName,
          );
        }

        if (!loginEmail) {
          setError(
            "Не удалось определить аккаунт ученика.",
          );
          return;
        }

        const {
          data: loginData,
          error: signInError,
        } =
          await supabase.auth.signInWithPassword(
            {
              email: loginEmail,
              password,
            },
          );

        if (signInError) {
          console.error(
            "Student signIn error:",
            signInError,
          );

          setError(
            "Не удалось войти. Проверьте фамилию, имя, пароль и номер ученика.",
          );

          return;
        }

        /*
         * Сохраняем выбранный класс.
         */
        localStorage.setItem(
          STUDENT_CLASS_STORAGE_KEY,
          selectedClass,
        );

        /*
         * Автоматически подключаем
         * ученика к выбранному классу.
         *
         * Это особенно полезно для уже
         * зарегистрированного ученика.
         */
        const {
          error: joinError,
        } =
          await supabase.rpc(
            "join_class_by_code",
            {
              p_join_code:
                selectedClass,
            },
          );

        if (joinError) {
          console.error(
            "join_class_by_code error:",
            joinError,
          );

          /*
           * Сам вход уже успешен.
           * Поэтому не блокируем ученика,
           * а просто показываем предупреждение.
           */
          console.warn(
            "Ученик вошёл, но класс не подключён:",
            joinError.message,
          );
        }

        /*
         * Обновляем код из metadata,
         * если он существует.
         */
        const metadataCode =
          loginData.user
            ?.user_metadata
            ?.student_code;

        if (
          metadataCode &&
          typeof metadataCode ===
            "string"
        ) {
          localStorage.setItem(
            STUDENT_CODE_STORAGE_KEY,
            metadataCode,
          );

          setStudentCode(
            metadataCode,
          );
        }

        navigate({
          to: "/lessons",
          replace: true,
        });

        return;
      }

      /*
       * ===============================
       * РЕГИСТРАЦИЯ УЧИТЕЛЯ
       * ===============================
       */

      if (
        !isStudent &&
        mode === "up"
      ) {
        const teacherEmail =
          email.trim();

        const name =
          teacherName.trim();

        if (!name) {
          setError(
            "Введите Ф. И. О. учителя.",
          );
          return;
        }

        const {
          data,
          error: signUpError,
        } =
          await supabase.auth.signUp({
            email: teacherEmail,
            password,

            options: {
              emailRedirectTo:
                window.location.origin,

              data: {
                full_name: name,
                role: "teacher",
              },
            },
          });

        if (signUpError) {
          console.error(
            "Teacher signUp error:",
            signUpError,
          );

          if (
            signUpError.message
              .toLowerCase()
              .includes(
                "already registered",
              )
          ) {
            setError(
              "Этот адрес уже зарегистрирован — войдите.",
            );
          } else {
            setError(
              signUpError.message,
            );
          }

          return;
        }

        if (data.session) {
          navigate({
            to: "/teacher",
            replace: true,
          });

          return;
        }

        setError(
          "Учитель зарегистрирован. Если вход не произошёл автоматически, проверьте подтверждение email в Supabase.",
        );

        return;
      }

      /*
       * ===============================
       * ВХОД УЧИТЕЛЯ
       * ===============================
       */

      const teacherEmail =
        email.trim();

      const {
        error: signInError,
      } =
        await supabase.auth.signInWithPassword(
          {
            email: teacherEmail,
            password,
          },
        );

      if (signInError) {
        console.error(
          "Teacher signIn error:",
          signInError,
        );

        if (
          signInError.message.includes(
            "Invalid login credentials",
          )
        ) {
          setError(
            "Неверная почта или пароль.",
          );
        } else {
          setError(
            signInError.message,
          );
        }

        return;
      }

      navigate({
        to: "/teacher",
        replace: true,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#DDEBFF] via-background to-[#FFE7C2] px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border-4 border-border bg-card p-6 shadow-[8px_8px_0_0_var(--color-border)]">

        {/* Назад */}
        <Link
          to="/"
          className="text-sm font-bold text-muted-foreground"
        >
          ← На главную
        </Link>

        {/* Выбор роли */}
        <div className="mt-4 mb-5 grid grid-cols-2 gap-2">
          <Link
            to="/auth"
            search={{
              role: "student",
            }}
            className={`rounded-xl border-2 border-border px-3 py-2 text-center font-bold ${
              isStudent
                ? "bg-primary text-primary-foreground"
                : "bg-background"
            }`}
          >
            🎒 Ученик
          </Link>

          <Link
            to="/auth"
            search={{
              role: "teacher",
            }}
            className={`rounded-xl border-2 border-border px-3 py-2 text-center font-bold ${
              !isStudent
                ? "bg-primary text-primary-foreground"
                : "bg-background"
            }`}
          >
            👩‍🏫 Учитель
          </Link>
        </div>

        {/* Заголовок */}
        <h1 className="font-display text-2xl font-extrabold">
          {mode === "in"
            ? "Вход"
            : "Регистрация"}{" "}
          ·{" "}
          {isStudent
            ? "ученик"
            : "учитель"}
        </h1>

        <p className="mb-4 text-sm text-muted-foreground">
          {isStudent
            ? mode === "up"
              ? "Введите фамилию, имя, выберите свой класс и придумайте пароль."
              : "Введите свои данные, выберите класс и войдите в систему."
            : "Учитель входит по электронной почте и паролю."}
        </p>

        {/* Успешная регистрация */}
        {createdStudentCode && (
          <div className="mb-4 rounded-xl border-2 border-green-500 bg-green-50 p-4">
            <p className="font-bold text-green-800">
              Ученик успешно зарегистрирован!
            </p>

            <p className="mt-2 text-sm text-green-700">
              Вам автоматически присвоен
              номер:
            </p>

            <p className="mt-2 text-center text-2xl font-extrabold tracking-wider text-green-800">
              {createdStudentCode}
            </p>

            <p className="mt-2 text-xs text-green-700">
              Номер сохранён автоматически.
            </p>
          </div>
        )}

        {/* Форма */}
        <form
          onSubmit={submit}
          className="space-y-3"
        >
          {isStudent ? (
            <>
              {/* Фамилия */}
              <div>
                <Label htmlFor="ln">
                  Фамилия
                </Label>

                <Input
                  id="ln"
                  value={lastName}
                  onChange={(e) =>
                    setLastName(
                      e.target.value,
                    )
                  }
                  placeholder="Иванов"
                  autoComplete="family-name"
                />
              </div>

              {/* Имя */}
              <div>
                <Label htmlFor="fn">
                  Имя
                </Label>

                <Input
                  id="fn"
                  value={firstName}
                  onChange={(e) =>
                    setFirstName(
                      e.target.value,
                    )
                  }
                  placeholder="Иван"
                  autoComplete="given-name"
                />
              </div>

              {/* КЛАСС */}
              <div>
                <Label htmlFor="student-class">
                  Класс
                </Label>

                <select
                  id="student-class"
                  value={selectedClass}
                  onChange={(e) =>
                    setSelectedClass(
                      e.target.value,
                    )
                  }
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">
                    Выберите класс
                  </option>

                  {STUDENT_CLASSES.map(
                    (item) => (
                      <option
                        key={item.code}
                        value={item.code}
                      >
                        {item.name}
                      </option>
                    ),
                  )}
                </select>

                <p className="mt-1 text-xs text-muted-foreground">
                  Выберите свой класс.
                  Система автоматически
                  подключит вас к нему.
                </p>
              </div>

              {/* Номер ученика */}
              {mode === "in" && (
                <div>
                  <Label htmlFor="student-code">
                    Номер ученика
                  </Label>

                  <Input
                    id="student-code"
                    value={studentCode}
                    onChange={(e) =>
                      setStudentCode(
                        e.target.value.toUpperCase(),
                      )
                    }
                    placeholder="Например STUDENT-482731"
                  />

                  <p className="mt-1 text-xs text-muted-foreground">
                    Для нового аккаунта номер
                    создаётся автоматически.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* ФИО учителя */}
              {mode === "up" && (
                <div>
                  <Label htmlFor="tn">
                    Ф. И. О. учителя
                  </Label>

                  <Input
                    id="tn"
                    value={teacherName}
                    onChange={(e) =>
                      setTeacherName(
                        e.target.value,
                      )
                    }
                    placeholder="Асанова А. К."
                    autoComplete="name"
                  />
                </div>
              )}

              {/* Email */}
              <div>
                <Label htmlFor="em">
                  Электронная почта
                </Label>

                <Input
                  id="em"
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value,
                    )
                  }
                  placeholder="teacher@school.kz"
                  autoComplete="email"
                />
              </div>
            </>
          )}

          {/* Пароль */}
          <div>
            <Label htmlFor="pw">
              Пароль
            </Label>

            <Input
              id="pw"
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value,
                )
              }
              placeholder="не менее 6 символов"
              autoComplete={
                mode === "up"
                  ? "new-password"
                  : "current-password"
              }
            />
          </div>

          {/* Ошибка */}
          {error && (
            <p className="rounded-xl border-2 border-destructive bg-destructive/10 p-2 text-sm font-semibold">
              {error}
            </p>
          )}

          {/* Кнопка */}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={busy}
          >
            {busy
              ? "Подождите…"
              : mode === "in"
                ? "Войти"
                : "Зарегистрироваться"}
          </Button>
        </form>

        {/* Переключение вход/регистрация */}
        <button
          type="button"
          onClick={() =>
            setMode(
              mode === "in"
                ? "up"
                : "in",
            )
          }
          className="mt-4 w-full text-sm font-bold underline"
        >
          {mode === "in"
            ? "Ещё нет аккаунта? Зарегистрироваться"
            : "Уже есть аккаунт? Войти"}
        </button>
      </div>
    </div>
  );
}