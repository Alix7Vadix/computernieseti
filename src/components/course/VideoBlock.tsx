type Props = {
  title: string;
  search?: string;
  url?: string;
};

export function VideoBlock({ title, search, url }: Props) {
  let src = "";

  if (url) {
    const videoUrl = new URL(url);

    videoUrl.searchParams.set("rel", "0");

    if (typeof window !== "undefined") {
      videoUrl.searchParams.set("origin", window.location.origin);
    }

    src = videoUrl.toString();
  } else if (search) {
    src =
      `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(search)}`;
  }

  return (
    <section className="rounded-3xl border-4 border-border bg-card p-5 shadow-[6px_6px_0_0_var(--color-border)]">
      <h3 className="mb-3 flex items-center gap-2 text-xl font-bold">
        🎬 Видеоматериал: {title}
      </h3>

      <div
        className="overflow-hidden rounded-2xl bg-black"
        style={{ aspectRatio: "16 / 9" }}
      >
        <iframe
          src={src}
          title={title}
          className="h-full w-full"
          referrerPolicy="origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Видеоматериал по теме урока.
      </p>
    </section>
  );
}