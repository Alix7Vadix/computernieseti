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

const STUDENT_CODE_STORAGE_KEY = "cor_student_code";

/**
 * Генерирует уникальный код ученика.
 *
 * Пример:
 * STUDENT-482731
 */
function generateStudentCode(): string {
  const randomPart = Math.floor(
    100000 + Math.random() * 900000,
  );

  return `STUDENT-${randomPart}`;
}

/**
 * Создаём внутренний email только для Supabase.
 *
 * Ученик его никогда не вводит и не видит.
 *
 * Например:
 * student-482731-a8f31c@example.com
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
          "Ученики могут иметь одинаковые фамилии и имена.",
      },
    ],
  }),

  component: AuthPage,
});

function AuthPage() {
  const { role } = Route.useSearch();
  const navigate = useNavigate();

  const isStudent = role === "student";

  const [mode, setMode] = useState<"in" | "up">("in");

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");

  const [teacherName, setTeacherName] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  /*
   * Код ученика.
   *
   * При регистрации он создаётся автоматически.
   * При входе берётся из localStorage.
   */
  const [studentCode, setStudentCode] = useState("");

  /*
   * Код, который только что был создан.
   * Нужен, чтобы красиво показать его после регистрации.
   */
  const [createdStudentCode, setCreatedStudentCode] =
    useState<string | null>(null);

  const [error, setError] = useState<string | null>(
    null,
  );

  const [busy, setBusy] = useState(false);

  /*
   * При открытии страницы пробуем восстановить
   * код ученика из браузера.
   */
  useEffect(() => {
    if (!isStudent) return;

    const savedCode = localStorage.getItem(
      STUDENT_CODE_STORAGE_KEY,
    );

    if (savedCode) {
      setStudentCode(savedCode);
    }
  }, [isStudent]);

  /*
   * Если пользователь уже вошёл,
   * отправляем его в нужный раздел.
   */
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const { data } =
        await supabase.auth.getSession();

      if (cancelled || !data.session) return;

      const currentRole =
        data.session.user.user_metadata?.role;

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
   * При переключении роли/режима очищаем ошибку.
   */
  useEffect(() => {
    setError(null);
    setCreatedStudentCode(null);
  }, [role, mode]);

  async function submit(
    e: React.FormEvent,
  ) {
    e.preventDefault();

    setError(null);
    setCreatedStudentCode(null);
    setBusy(true);

    try {
      /*
       * ==============================
       * ПРОВЕРКИ
       * ==============================
       */

      if (
        isStudent &&
        (!lastName.trim() ||
          !firstName.trim())
      ) {
        setError(
          "Введите фамилию и имя",
        );
        return;
      }

      if (
        !isStudent &&
        !email.trim()
      ) {
        setError(
          "Введите электронную почту",
        );
        return;
      }

      if (
        !isStudent &&
        !email.includes("@")
      ) {
        setError(
          "Введите корректный адрес электронной почты",
        );
        return;
      }

      if (password.length < 6) {
        setError(
          "Пароль должен быть не короче 6 символов",
        );
        return;
      }

      /*
       * ==============================
       * РЕГИСТРАЦИЯ УЧЕНИКА
       * ==============================
       */

      if (
        isStudent &&
        mode === "up"
      ) {
        /*
         * Код создаётся АВТОМАТИЧЕСКИ.
         *
         * Ученик ничего не вводит.
         */
        const newStudentCode =
          generateStudentCode();

        /*
         * Создаём уникальный внутренний email.
         *
         * Он нужен только Supabase.
         */
        const internalEmail =
          studentEmailFromCode(
            newStudentCode,
          );

        const name = fullName(
          lastName,
          firstName,
        );

        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: internalEmail,
            password,
            options: {
              emailRedirectTo:
                window.location.origin,

              data: {
                full_name: name,
                role: "student",

                /*
                 * Сохраняем данные ученика.
                 */
                last_name:
                  lastName.trim(),

                first_name:
                  firstName.trim(),

                /*
                 * Автоматически
                 * присвоенный код.
                 */
                student_code:
                  newStudentCode,
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
         * Сохраняем код в браузере.
         */
        localStorage.setItem(
          STUDENT_CODE_STORAGE_KEY,
          newStudentCode,
        );

        setStudentCode(
          newStudentCode,
        );

        setCreatedStudentCode(
          newStudentCode,
        );

        /*
         * Если Supabase сразу создал сессию —
         * сразу отправляем ученика в уроки.
         */
        if (data.session) {
          navigate({
            to: "/lessons",
            replace: true,
          });

          return;
        }

        /*
         * Если подтверждение email включено
         * в Supabase, сессии сразу не будет.
         *
         * Для нашего внутреннего email это
         * неудобно, поэтому показываем понятное
         * сообщение вместо непонятной ошибки.
         */
        setError(
          "Аккаунт создан. Если вход не произошёл автоматически, отключите подтверждение email в Supabase → Authentication → Providers → Email.",
        );

        return;
      }

      /*
       * ==============================
       * ВХОД УЧЕНИКА
       * ==============================
       */

      if (isStudent) {
        /*
         * Для нового ученика используется
         * автоматически присвоенный код.
         *
         * Код НЕ создаётся вручную.
         */
        if (!studentCode.trim()) {
          setError(
            "Код ученика ещё не сохранён. Зарегистрируйтесь заново или восстановите код из ранее сохранённого аккаунта.",
          );

          return;
        }

        /*
         * Восстанавливаем тот же принцип
         * внутреннего email.
         *
         * Важно:
         * здесь используется сохранённый код.
         */
        const code =
          studentCode
            .trim()
            .toUpperCase();

        /*
         * Старые аккаунты у тебя продолжают
         * работать через старую функцию.
         *
         * Для нового формата ниже нужен
         * специальный email.
         *
         * Поскольку при регистрации к email
         * добавлялась случайная часть,
         * ищем сохранённый внутренний email.
         */
        const savedInternalEmail =
          localStorage.getItem(
            `${STUDENT_CODE_STORAGE_KEY}_email`,
          );

        let loginEmail =
          savedInternalEmail;

        /*
         * Если email ещё не был сохранён,
         * используем старый механизм.
         *
         * Это позволяет не ломать старых
         * учеников.
         */
        if (!loginEmail) {
          loginEmail = studentEmail(
            lastName,
            firstName,
          );
        }

        const {
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
            "Не удалось войти. Проверьте код ученика и пароль.",
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
       * ==============================
       * РЕГИСТРАЦИЯ УЧИТЕЛЯ
       * ==============================
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
            "Введите Ф. И. О. учителя",
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

        /*
         * Если сессия создана сразу —
         * отправляем учителя в панель.
         */
        if (data.session) {
          navigate({
            to: "/teacher",
            replace: true,
          });

          return;
        }

        setError(
          "Учитель зарегистрирован. Если вход не произошёл автоматически, проверьте настройки подтверждения email в Supabase.",
        );

        return;
      }

      /*
       * ==============================
       * ВХОД УЧИТЕЛЯ
       * ==============================
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

        {/* Роль */}
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
              ? "Введите фамилию, имя и пароль. Уникальный номер ученика система присвоит автоматически."
              : "Введите свои данные для входа. Для нового аккаунта используется автоматически присвоенный номер ученика."
            : "Учитель входит по электронной почте и паролю."}
        </p>

        {/* ========================= */}
        {/* УСПЕШНАЯ РЕГИСТРАЦИЯ */}
        {/* ========================= */}

        {createdStudentCode && (
          <div className="mb-4 rounded-xl border-2 border-green-500 bg-green-50 p-4">
            <p className="font-bold text-green-800">
              Ученик успешно зарегистрирован!
            </p>

            <p className="mt-2 text-sm text-green-700">
              Система автоматически присвоила
              вам номер:
            </p>

            <p className="mt-2 text-center text-2xl font-extrabold tracking-wider text-green-800">
              {createdStudentCode}
            </p>

            <p className="mt-2 text-xs text-green-700">
              Номер сохранён автоматически.
              Запишите его на всякий случай.
            </p>
          </div>
        )}

        {/* ========================= */}
        {/* ФОРМА */}
        {/* ========================= */}

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

              {/* При регистрации код НЕ показываем */}
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
                    placeholder="Будет присвоен автоматически"
                  />

                  <p className="mt-1 text-xs text-muted-foreground">
                    Для зарегистрированного
                    аккаунта номер сохраняется
                    в этом браузере автоматически.
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

              {/* Email учителя */}
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