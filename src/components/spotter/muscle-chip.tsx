import { Link } from "@tanstack/react-router";
import { MUSCLES, type Muscle } from "@/data/exercises";
import { cn } from "@/lib/utils";

const REGION_COLOR = {
  upper: "bg-region-upper",
  lower: "bg-region-lower",
  core: "bg-region-core",
  cardio: "bg-region-cardio",
} as const;

/** The colour of a muscle's body region, as a Tailwind background class. */
export function regionColor(muscle: Muscle): string {
  return REGION_COLOR[MUSCLES[muscle].region];
}

/** A small square-cornered tag naming a muscle, keyed by region colour. Optionally links to the filtered catalog. */
export function MuscleChip({
  muscle,
  link = false,
  className,
}: {
  muscle: Muscle;
  link?: boolean;
  className?: string;
}) {
  const cls = cn(
    "inline-flex items-center gap-1.5 rounded-sm bg-secondary px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap uppercase tracking-wide",
    link && "hover:bg-accent",
    className,
  );
  const body = (
    <>
      <span className={cn("size-1.5 rounded-[1px]", regionColor(muscle))} aria-hidden />
      {MUSCLES[muscle].label}
    </>
  );
  return link ? (
    <Link to="/exercises" search={{ muscle }} className={cls}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}
