type Props = { title: string; search: string };

export function VideoBlock({ title, search }: Props) {
  const src = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(search)}`;

  return (
    <section className="rounded-3xl border-4 border-border bg-card p-5 shadow-[6px_6px_0_0_var(--color-border)]">
      <h3 className="mb-3 flex items-center gap-2 text-xl font-bold">🎬 Видеоматериал: {title}</h3>
      <div className="overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "16 / 9" }}>
        <iframe
          src={src}
          title={title}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Плеер показывает подборку видео по теме урока. Учитель может предложить другой ролик.
      </p>
    </section>
  );
}
