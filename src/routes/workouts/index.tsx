import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useMemo } from "react";
import { PageHeader } from "@/components/spotter/page-header";
import { LogPastDialog } from "@/components/spotter/start-workout";
import { WorkoutList } from "@/components/spotter/workout-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getExercise, isExerciseId } from "@/data/exercises";
import { useTraining } from "@/hooks/use-snapshot";
import { addDays, dateOf, formatDay, startOfWeek } from "@/lib/dates";
import { matches } from "@/lib/search";
import { exerciseOf, workoutStats } from "@/lib/training";
import type { Workout } from "@/lib/types";
import { formatVolume, plural } from "@/lib/units";

type HistorySearch = { q?: string; exercise?: string };

export const Route = createFileRoute("/workouts/")({
  head: () => ({ meta: [{ title: "History · Spotter" }] }),
  validateSearch: (s: Record<string, unknown>): HistorySearch => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    exercise: isExerciseId(s.exercise) ? s.exercise : undefined,
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { finished, settings, today } = useTraining();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const set = (patch: Partial<HistorySearch>) => navigate({ search: (s) => ({ ...s, ...patch }), replace: true });
  const filterExercise = search.exercise ? getExercise(search.exercise) : undefined;

  const shown = finished.filter(
    (w) =>
      (!search.exercise || w.exercises.some((l) => l.exerciseId === search.exercise)) &&
      matches(`${w.title} ${w.note ?? ""} ${w.exercises.map((l) => exerciseOf(l).name).join(" ")}`, search.q ?? ""),
  );

  // Group by week, newest first.
  const weeks = useMemo(() => {
    const out = new Map<string, Workout[]>();
    for (const w of shown) {
      const k = startOfWeek(dateOf(w.startedAt), settings.weekStart);
      const list = out.get(k) ?? [];
      list.push(w);
      out.set(k, list);
    }
    return [...out.entries()];
  }, [shown, settings.weekStart]);

  return (
    <div>
      <PageHeader
        title="History"
        meta={finished.length ? `${plural(finished.length, "workout")} logged.` : "Nothing logged yet."}
      >
        <LogPastDialog />
      </PageHeader>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.q ?? ""}
            onChange={(e) => set({ q: e.target.value || undefined })}
            placeholder="Search workouts or exercises…"
            className="h-9 w-72 pl-8"
            aria-label="Search workouts"
          />
        </div>
        {filterExercise && (
          <Button variant="secondary" size="sm" onClick={() => set({ exercise: undefined })}>
            Only {filterExercise.name} <X className="size-3.5" />
          </Button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          {finished.length === 0 ? "Finish a workout and it'll be here." : "No workouts match."}
        </p>
      ) : (
        <div className="space-y-8">
          {weeks.map(([start, list]) => {
            const volume = list.reduce((n, w) => n + workoutStats(w).volumeKg, 0);
            return (
              <section key={start}>
                <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                  <h2 className="text-xl font-bold">
                    {formatDay(start)} – {formatDay(addDays(start, 6))}
                  </h2>
                  <span className="num text-xs text-muted-foreground">
                    {plural(list.length, "workout")}
                    {volume > 0 && ` · ${formatVolume(volume, settings.weightUnit)}`}
                  </span>
                </div>
                <WorkoutList workouts={list} settings={settings} today={today} />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
