/**
 * Every page opens with a condensed headline on a rule, an optional line of context beneath it, and actions on
 * the right.
 */
export function PageHeader({
  title,
  meta,
  children,
}: {
  title: React.ReactNode;
  /** A short line under the title: a date, a count, a description. */
  meta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-5xl break-words sm:text-6xl">{title}</h1>
        {meta && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{meta}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

/** A section title with an optional count and actions on the right. */
export function SectionHeading({
  children,
  count,
  action,
}: {
  children: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="flex items-baseline gap-2 text-2xl font-bold">
        {children}
        {count != null && <span className="num text-sm font-normal text-muted-foreground">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

/** Pending state while a route loads: a little equalizer. */
export function PageSkeleton() {
  return (
    <div className="grid place-items-center gap-4 py-28" role="status" aria-label="Loading">
      <div className="flex h-8 items-end gap-1" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="h-full w-1.5 origin-bottom rounded-sm bg-foreground"
            style={{ animation: `bar 0.9s ease-in-out ${i * 0.12}s infinite` }}
          />
        ))}
      </div>
      <p className="eyebrow text-muted-foreground">Loading</p>
    </div>
  );
}
