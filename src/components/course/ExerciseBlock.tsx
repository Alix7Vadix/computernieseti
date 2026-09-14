import { useMemo, useState } from "react";
import type { Exercise } from "@/content/course";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { exercise: Exercise; onDone?: (allCorrect: boolean) => void };

export function ExerciseBlock({ exercise, onDone }: Props) {
  return (
    <section className="rounded-3xl border-4 border-border bg-card p-5 shadow-[6px_6px_0_0_var(--color-border)]">
      <h3 className="text-xl font-bold">🧩 {exercise.title}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{exercise.hint}</p>
      {exercise.kind === "categorize" && <Categorize ex={exercise} onDone={onDone} />}
      {exercise.kind === "match" && <Match ex={exercise} onDone={onDone} />}
      {exercise.kind === "order" && <Order ex={exercise} onDone={onDone} />}
    </section>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/* ---------- Перетаскивание по группам ---------- */

function Categorize({
  ex,
  onDone,
}: {
  ex: Extract<Exercise, { kind: "categorize" }>;
  onDone?: (ok: boolean) => void;
}) {
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const pool = useMemo(() => shuffle(ex.items), [ex]);

  const rest = pool.filter((i) => !placed[i.id]);
  const allPlaced = rest.length === 0;

  function place(groupId: string, itemId?: string) {
    const id = itemId ?? selected;
    if (!id) return;
    setPlaced((p) => ({ ...p, [id]: groupId }));
    setSelected(null);
    setChecked(false);
  }

  function check() {
    const ok = ex.items.every((i) => placed[i.id] === i.group);
    setChecked(true);
    onDone?.(ok);
  }

  const correctCount = ex.items.filter((i) => placed[i.id] === i.group).length;

  return (
    <div>
      <div className="mb-4 flex min-h-16 flex-wrap gap-2 rounded-2xl bg-muted/60 p-3">
        {rest.length === 0 ? (
          <span className="text-sm text-muted-foreground">Все карточки распределены 🎉</span>
        ) : (
          rest.map((item) => (
            <button
              key={item.id}
              type="button"
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
              onClick={() => setSelected(selected === item.id ? null : item.id)}
              className={cn(
                "cursor-grab rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-semibold",
                selected === item.id && "bg-primary text-primary-foreground",
              )}
            >
              {item.emoji} {item.label}
            </button>
          ))
        )}
      </div>

      <div className={cn("grid gap-3", ex.groups.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {ex.groups.map((g) => (
          <div
            key={g.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              place(g.id, e.dataTransfer.getData("text/plain"));
            }}
            onClick={() => place(g.id)}
            className="min-h-32 rounded-2xl border-4 border-dashed border-border bg-background p-3"
          >
            <p className="mb-2 font-bold">
              {g.emoji} {g.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {ex.items
                .filter((i) => placed[i.id] === g.id)
                .map((i) => {
                  const ok = i.group === g.id;
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlaced((p) => {
                          const n = { ...p };
                          delete n[i.id];
                          return n;
                        });
                        setChecked(false);
                      }}
                      className={cn(
                        "rounded-xl border-2 border-border px-2 py-1 text-sm font-medium",
                        checked && ok && "border-[color:var(--color-success)] bg-[color:var(--color-success)] text-white",
                        checked && !ok && "border-destructive bg-destructive text-destructive-foreground",
                        !checked && "bg-secondary",
                      )}
                    >
                      {i.emoji} {i.label}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button disabled={!allPlaced} onClick={check}>
          Проверить
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setPlaced({});
            setChecked(false);
          }}
        >
          Сбросить
        </Button>
        {checked && (
          <span className="font-semibold">
            {correctCount === ex.items.length
              ? "🎉 Всё верно!"
              : `Верно ${correctCount} из ${ex.items.length}. Нажми на неверную карточку и переставь её.`}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- Сопоставление ---------- */

function Match({
  ex,
  onDone,
}: {
  ex: Extract<Exercise, { kind: "match" }>;
  onDone?: (ok: boolean) => void;
}) {
  const options = useMemo(() => shuffle(ex.pairs.map((p) => p.right)), [ex]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);

  const allAnswered = ex.pairs.every((_, i) => answers[i]);
  const correctCount = ex.pairs.filter((p, i) => answers[i] === p.right).length;

  return (
    <div>
      <ul className="space-y-3">
        {ex.pairs.map((p, i) => {
          const ok = answers[i] === p.right;
          return (
            <li key={i} className="flex flex-col gap-2 rounded-2xl bg-muted/60 p-3 sm:flex-row sm:items-center">
              <span className="min-w-48 font-semibold">{p.left}</span>
              <select
                value={answers[i] ?? ""}
                onChange={(e) => {
                  setAnswers((a) => ({ ...a, [i]: e.target.value }));
                  setChecked(false);
                }}
                className={cn(
                  "flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-medium",
                  checked && ok && "border-[color:var(--color-success)]",
                  checked && !ok && "border-destructive",
                )}
              >
                <option value="">— выбери ответ —</option>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              {checked && <span className="text-lg">{ok ? "✅" : "❌"}</span>}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          disabled={!allAnswered}
          onClick={() => {
            setChecked(true);
            onDone?.(correctCount === ex.pairs.length);
          }}
        >
          Проверить
        </Button>
        {checked && (
          <span className="font-semibold">
            {correctCount === ex.pairs.length ? "🎉 Всё верно!" : `Верно ${correctCount} из ${ex.pairs.length}`}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- Сортировка по порядку ---------- */

function Order({
  ex,
  onDone,
}: {
  ex: Extract<Exercise, { kind: "order" }>;
  onDone?: (ok: boolean) => void;
}) {
  const [list, setList] = useState(() => shuffle(ex.items));
  const [checked, setChecked] = useState(false);

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setList(next);
    setChecked(false);
  }

  const correctCount = list.filter((item, i) => ex.items[i]!.id === item.id).length;

  return (
    <div>
      <ol className="space-y-2">
        {list.map((item, i) => {
          const ok = ex.items[i]!.id === item.id;
          return (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl border-2 border-border bg-background p-3",
                checked && ok && "border-[color:var(--color-success)]",
                checked && !ok && "border-destructive",
              )}
            >
              <span className="w-7 text-center font-bold">{i + 1}</span>
              <span className="flex-1 font-semibold">
                {item.emoji} {item.label}
              </span>
              <Button size="sm" variant="secondary" onClick={() => move(i, -1)} aria-label="Вверх">
                ↑
              </Button>
              <Button size="sm" variant="secondary" onClick={() => move(i, 1)} aria-label="Вниз">
                ↓
              </Button>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            setChecked(true);
            onDone?.(correctCount === ex.items.length);
          }}
        >
          Проверить
        </Button>
        {checked && (
          <span className="font-semibold">
            {correctCount === ex.items.length ? "🎉 Идеальный порядок!" : `Верно на своих местах: ${correctCount} из ${ex.items.length}`}
          </span>
        )}
      </div>
    </div>
  );
}
