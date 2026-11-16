import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Plus } from "lucide-react";
import { regionColor } from "@/components/spotter/muscle-chip";
import { PageHeader } from "@/components/spotter/page-header";
import { Button } from "@/components/ui/button";
import { getExercise } from "@/data/exercises";
import { useTraining } from "@/hooks/use-snapshot";
import { dateOf, relativeDays } from "@/lib/dates";
import { plural } from "@/lib/units";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/routines/")({
  head: () => ({ meta: [{ title: "Routines · Spotter" }] }),
  component: RoutinesPage,
});

function RoutinesPage() {
  const { snapshot, finished, today } = useTraining();
  return (
    <div>
      <PageHeader
        title="Routines"
        meta="Workouts you repeat. Starting one lays out its exercises with last time's weights."
      >
        <Button asChild>
          <Link to="/routines/new">
            <Plus className="size-4" /> New routine
          </Link>
        </Button>
      </PageHeader>

      {snapshot.routines.length === 0 ? (
        <p className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          No routines yet. Build one, or finish a workout and save it as a routine.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {snapshot.routines.map((r) => {
            const runs = finished.filter((w) => w.routineId === r.id);
            return (
              <Link
                key={r.id}
                to="/routines/$id"
                params={{ id: String(r.id) }}
                className="group panel flex flex-col overflow-hidden transition-colors hover:border-foreground/40"
              >
                <div className="flex items-start justify-between gap-4 border-b p-5">
                  <div className="min-w-0">
                    <h2 className="truncate text-3xl font-bold">{r.title}</h2>
                    {r.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-display text-4xl leading-none">{r.exercises.length}</p>
                    <p className="eyebrow text-[10px] text-muted-foreground">Exercises</p>
                  </div>
                </div>
                <ol className="flex-1 divide-y text-sm">
                  {r.exercises.slice(0, 5).map((e, i) => {
                    const ex = getExercise(e.exerciseId);
                    return (
                      // biome-ignore lint/suspicious/noArrayIndexKey: an exercise can appear twice in a routine.
                      <li key={i} className="flex items-center gap-3 px-5 py-2">
                        <span
                          className={cn("h-3 w-1 shrink-0 rounded-[1px]", ex ? regionColor(ex.muscle) : "bg-border")}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">{ex?.name ?? e.exerciseId}</span>
                        <span className="num shrink-0 text-muted-foreground">
                          {e.sets}
                          {e.reps ? ` × ${e.reps}` : " sets"}
                        </span>
                      </li>
                    );
                  })}
                  {r.exercises.length > 5 && (
                    <li className="px-5 py-2 text-xs text-muted-foreground">+{r.exercises.length - 5} more</li>
                  )}
                </ol>
                <div className="flex items-center justify-between border-t bg-muted/50 px-5 py-2.5 text-xs text-muted-foreground">
                  <span>
                    {runs.length
                      ? `Done ${plural(runs.length, "time")} · last ${relativeDays(dateOf(runs[0].startedAt), today)}`
                      : "Not done yet"}
                  </span>
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
