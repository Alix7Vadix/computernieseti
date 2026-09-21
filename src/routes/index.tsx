import { createFileRoute, Link } from "@tanstack/react-router";
import { LESSONS } from "@/content/course";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ЦОР «Информация и компьютер» — информатика 5 класс" },
      {
        name: "description",
        content:
          "Цифровой образовательный ресурс по информатике для 5 класса: 8 интерактивных уроков, видео, упражнения, СОР и итоговый тест с сохранением прогресса.",
      },
      { property: "og:title", content: "ЦОР «Информация и компьютер» — информатика 5 класс" },
      {
        property: "og:description",
        content: "8 интерактивных уроков, видео, упражнения, СОР и итоговый тест для пятиклассников.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="flex items-center gap-2 text-lg font-extrabold">
          <span className="text-2xl">💻</span>
          <span className="font-display">Информация и компьютер</span>
        </span>
        <Link
          to="/auth"
          search={{ role: "teacher" }}
          className="rounded-full border-4 border-border bg-card px-4 py-2 text-sm font-bold shadow-[4px_4px_0_0_var(--color-border)] transition-transform hover:-translate-y-0.5"
        >
          👩‍🏫 Учитель
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="rounded-[2rem] border-4 border-border bg-gradient-to-br from-[#FFE7C2] via-[#DDEBFF] to-[#EDE3FF] p-8 text-center shadow-[8px_8px_0_0_var(--color-border)]">
          <p className="mb-2 text-sm font-bold uppercase tracking-wide">Информатика · 5 класс</p>
          <h1 className="font-display text-4xl leading-tight font-extrabold sm:text-5xl">
            Раздел «Информация и компьютер» 🚀
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-medium">
            8 интерактивных уроков с видео, играми-упражнениями и тестами. Твой прогресс сохраняется
            автоматически, а учитель видит результаты класса.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              search={{ role: "student" }}
              className="rounded-2xl border-4 border-border bg-primary px-6 py-3 text-lg font-extrabold text-primary-foreground shadow-[6px_6px_0_0_var(--color-border)] transition-transform hover:-translate-y-1"
            >
              🎒 Я ученик — начать
            </Link>
            <Link
              to="/auth"
              search={{ role: "teacher" }}
              className="rounded-2xl border-4 border-border bg-card px-6 py-3 text-lg font-extrabold shadow-[6px_6px_0_0_var(--color-border)] transition-transform hover:-translate-y-1"
            >
              👩‍🏫 Учитель
            </Link>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display mb-4 text-2xl font-extrabold">Что тебя ждёт</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LESSONS.map((l) => (
              <div
                key={l.id}
                className={`rounded-2xl border-4 border-border p-4 shadow-[4px_4px_0_0_var(--color-border)] ${l.color}`}
              >
                <div className="text-3xl">{l.emoji}</div>
                <p className="mt-2 text-xs font-bold uppercase">Урок {l.id}</p>
                <p className="font-bold">{l.title}</p>
                <p className="mt-1 text-sm">{l.short}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { emoji: "🎬", title: "Видео к каждому уроку", text: "Смотри прямо на странице урока" },
            { emoji: "🧩", title: "Интерактивные задания", text: "Перетаскивание, сопоставление, сортировка" },
            { emoji: "📈", title: "Личный прогресс", text: "Оценки за СОР, мини-тесты и итоговый тест" },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border-4 border-border bg-card p-5">
              <div className="text-3xl">{f.emoji}</div>
              <p className="mt-2 text-lg font-bold">{f.title}</p>
              <p className="text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
