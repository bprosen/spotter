import { cn } from "@/lib/utils";

/** A grid of headline numbers split by hairlines, like a scoreboard. Pass the column count in `className`. */
export function Metrics({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-px overflow-hidden rounded-lg border bg-border", className)}>{children}</div>;
}

/** One number in a `Metrics` grid. */
export function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-card px-4 py-4 sm:px-5">
      <p className="eyebrow truncate text-muted-foreground">{label}</p>
      <p className="num mt-2 truncate text-2xl font-semibold sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
